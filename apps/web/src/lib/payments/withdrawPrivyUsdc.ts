import { Interface, getAddress, isAddress, parseUnits } from 'ethers';
import { prisma } from '@sanova/database';
import { privyTransferUsdc, privyWaitForTransferTxHash } from '../privy/walletTransferApi';
import { resolveInvestorPrivyWalletIdForUser } from '../privy/resolveInvestorPrivyWalletId';
import { getLinkedWalletForUser } from '../investor/linkedWalletPolicy';
import { assertLinkedCryptoWalletOwnership } from '../investor/linkedWalletsService';
import { readWalletUsdcBalanceDetailed } from '../portfolio/onChainUsdcReader';
import { quoteBaseUserPaysGasUsd } from './baseUserPaysGasQuote';
import { recordTokenMovement } from '../reconciliation/tokenMovementLedger';
import { usdcDecimals, usdcTokenAddress } from './paymentConfig';

/**
 * Let an investor take their own USDC out of their Sanova wallet.
 *
 * Everything the platform could do with that balance pointed inwards: fund it,
 * or spend it on a purchase. There was no way out, while the public FAQ told
 * investors they could withdraw to any external wallet at any time. The money
 * was never locked by a contract — it simply had no route through the product.
 *
 * Two constraints shape this. The destination must be a wallet the account
 * already linked, because a session that can move funds anywhere turns any
 * account takeover into a theft. And gas is paid in USDC out of the same
 * balance, so a withdrawal of everything has to leave the fee behind or it
 * cannot be signed.
 */

/** Floor for the gas the transfer itself will consume, in USDC. */
const MIN_GAS_RESERVE_USDC = 0.05;

export type WithdrawPrivyUsdcResult =
  | {
      ok: true;
      txHash: string;
      amountUsdc: string;
      destination: string;
      /** Left behind to pay for the transfer. */
      gasReserveUsdc: string;
      remainingUsdc: string;
    }
  | { ok: false; code: string; detail?: string };

async function gasReserveUsdc(input: {
  from: string;
  destination: string;
  token: string;
}): Promise<number> {
  const transferData = new Interface([
    'function transfer(address,uint256) returns (bool)'
  ]).encodeFunctionData('transfer', [input.destination, 1n]);

  const quote = await quoteBaseUserPaysGasUsd({
    transactions: [{ to: input.token, data: transferData }],
    fromAddress: input.from
  }).catch(() => null);

  const quoted = Number(quote?.networkFeeUsd);
  // Doubled: the quote is a point-in-time estimate and the fee is taken later.
  return Math.max(MIN_GAS_RESERVE_USDC, Number.isFinite(quoted) ? quoted * 2 : 0);
}

export async function withdrawPrivyUsdc(input: {
  userId: string;
  /** Omit to withdraw everything the gas reserve allows. */
  amountUsdc?: number;
  /** Must be a wallet already linked to this account. Defaults to the linked one. */
  destinationAddress?: string;
}): Promise<WithdrawPrivyUsdcResult> {
  const walletRef = await resolveInvestorPrivyWalletIdForUser(input.userId).catch(() => null);
  if (!walletRef?.walletId || !walletRef.address) {
    return { ok: false, code: 'SANOVA_WALLET_NOT_FOUND' };
  }

  const requested = input.destinationAddress?.trim();
  let destination: string;
  try {
    destination = requested
      ? await assertLinkedCryptoWalletOwnership(input.userId, requested)
      : ((await getLinkedWalletForUser(input.userId)) ?? '');
  } catch (error) {
    return {
      ok: false,
      code: error instanceof Error ? error.message : 'WALLET_NOT_LINKED_TO_ACCOUNT'
    };
  }

  if (!destination || !isAddress(destination)) {
    return { ok: false, code: 'DESTINATION_ADDRESS_REQUIRED' };
  }
  if (getAddress(destination) === getAddress(walletRef.address)) {
    return {
      ok: false,
      code: 'DESTINATION_IS_SANOVA_WALLET',
      detail: 'Elegí una wallet distinta de tu wallet Sanova: ahí el USDC ya está.'
    };
  }

  const balance = await readWalletUsdcBalanceDetailed(walletRef.address).catch(() => null);
  if (!balance || balance.balance === null) {
    return { ok: false, code: 'USDC_BALANCE_READ_FAILED' };
  }

  const token = usdcTokenAddress();
  if (!token) {
    return { ok: false, code: 'USDC_TOKEN_NOT_CONFIGURED' };
  }

  const held = balance.balance;
  const reserve = await gasReserveUsdc({
    from: walletRef.address,
    destination,
    token
  });
  const withdrawable = Math.max(0, Math.floor((held - reserve) * 1e6) / 1e6);

  if (withdrawable <= 0) {
    return {
      ok: false,
      code: 'INSUFFICIENT_USDC_FOR_GAS',
      detail: `Tenés ${held} USDC y la transferencia necesita alrededor de ${reserve} para el gas.`
    };
  }

  const amount =
    input.amountUsdc === undefined
      ? withdrawable
      : Math.floor(input.amountUsdc * 1e6) / 1e6;

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, code: 'INVALID_WITHDRAWAL_AMOUNT' };
  }
  if (amount > withdrawable) {
    return {
      ok: false,
      code: 'AMOUNT_ABOVE_WITHDRAWABLE',
      detail: `Podés retirar hasta ${withdrawable} USDC: ${reserve} quedan para el gas de la transferencia.`
    };
  }

  let txHash: string | null = null;
  try {
    const transfer = await privyTransferUsdc({
      walletId: walletRef.walletId,
      amountUsdc: amount,
      destinationAddress: destination,
      chain: 'base',
      requireAuthorizationSignature: true,
      /** One withdrawal per account, amount and destination, not one per click. */
      idempotencyKey: `privy-usdc-withdrawal:${input.userId}:${destination}:${amount}`
    });
    txHash = transfer.txHash;
    if (!txHash && transfer.actionId) {
      txHash = await privyWaitForTransferTxHash({
        walletId: walletRef.walletId,
        actionId: transfer.actionId,
        attempts: 14
      });
    }
  } catch (error) {
    return {
      ok: false,
      code: 'PRIVY_TRANSFER_FAILED',
      detail: error instanceof Error ? error.message.slice(0, 300) : undefined
    };
  }

  if (!txHash) {
    return {
      ok: false,
      code: 'PRIVY_TRANSFER_TX_HASH_PENDING',
      detail: 'La transferencia se envió pero todavía no tiene hash. Revisá tu saldo en un minuto.'
    };
  }

  const investor = await prisma.investor
    .findFirst({ where: { user: { id: input.userId } }, select: { id: true } })
    .catch(() => null);

  {
    await recordTokenMovement({
      kind: 'USDC_INVESTOR_WITHDRAWAL',
      // The investor asked for this; nothing about it is inferred.
      authoritative: true,
      asset: 'USDC',
      contractAddress: token,
      fromAddress: walletRef.address,
      toAddress: destination,
      amountRaw: parseUnits(amount.toFixed(usdcDecimals()), usdcDecimals()).toString(),
      decimals: usdcDecimals(),
      txHash,
      logIndex: 0,
      blockNumber: 0,
      userId: input.userId,
      investorId: investor?.id ?? null,
      metadata: { source: 'investor-withdrawal', gasReserveUsdc: reserve }
    }).catch((error) => {
      // The money already moved; a missing ledger row is for the indexer to fix.
      console.error('[withdrawPrivyUsdc] ledger record failed', error);
    });
  }

  return {
    ok: true,
    txHash,
    amountUsdc: amount.toFixed(6),
    destination,
    gasReserveUsdc: reserve.toFixed(6),
    remainingUsdc: Math.max(0, held - amount).toFixed(6)
  };
}
