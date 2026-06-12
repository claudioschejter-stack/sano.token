import { ethers } from 'ethers';
import type { StablecoinNetwork } from './stablecoinNetworks';

type SolanaTokenBalanceRow = {
  accountIndex?: number;
  mint?: string;
  owner?: string;
  uiTokenAmount?: {
    amount?: string;
    decimals?: number;
  };
};

type SolanaTransactionMeta = {
  err?: unknown;
  preTokenBalances?: SolanaTokenBalanceRow[];
  postTokenBalances?: SolanaTokenBalanceRow[];
};

type SolanaGetTransactionResult = {
  meta?: SolanaTransactionMeta | null;
};

function tokenBalanceByAccount(meta: SolanaTransactionMeta): Map<number, { mint: string; owner: string; amount: bigint }> {
  const rows = new Map<number, { mint: string; owner: string; amount: bigint }>();

  for (const row of meta.preTokenBalances ?? []) {
    if (row.accountIndex == null || !row.mint || !row.owner) {
      continue;
    }
    rows.set(row.accountIndex, {
      mint: row.mint,
      owner: row.owner,
      amount: BigInt(row.uiTokenAmount?.amount ?? '0')
    });
  }

  for (const row of meta.postTokenBalances ?? []) {
    if (row.accountIndex == null || !row.mint || !row.owner) {
      continue;
    }
    rows.set(row.accountIndex, {
      mint: row.mint,
      owner: row.owner,
      amount: BigInt(row.uiTokenAmount?.amount ?? '0')
    });
  }

  return rows;
}

function preTokenBalanceByAccount(meta: SolanaTransactionMeta): Map<number, bigint> {
  const rows = new Map<number, bigint>();
  for (const row of meta.preTokenBalances ?? []) {
    if (row.accountIndex == null) {
      continue;
    }
    rows.set(row.accountIndex, BigInt(row.uiTokenAmount?.amount ?? '0'));
  }
  return rows;
}

export function verifySolanaUsdcTransfer(input: {
  result: SolanaGetTransactionResult | null | undefined;
  network: StablecoinNetwork;
  treasuryAddress: string;
  expectedBaseUnits: bigint;
  expectedPayer?: string | null;
}): boolean {
  const meta = input.result?.meta;
  if (!meta || meta.err) {
    return false;
  }

  const mint = input.network.tokenAddress?.trim();
  const treasury = input.network.treasuryAddress?.trim();
  if (!mint || !treasury) {
    return false;
  }

  const postByAccount = tokenBalanceByAccount(meta);
  const preByAccount = preTokenBalanceByAccount(meta);

  let treasuryCredit = 0n;
  let payerDebit = 0n;

  for (const [accountIndex, postRow] of postByAccount.entries()) {
    if (postRow.mint !== mint) {
      continue;
    }

    const preAmount = preByAccount.get(accountIndex) ?? 0n;
    const delta = postRow.amount - preAmount;

    if (postRow.owner === treasury && delta > 0n) {
      treasuryCredit += delta;
    }

    if (input.expectedPayer && postRow.owner === input.expectedPayer && delta < 0n) {
      payerDebit += -delta;
    }
  }

  if (treasuryCredit < input.expectedBaseUnits) {
    return false;
  }

  if (input.expectedPayer && payerDebit > 0n && payerDebit < input.expectedBaseUnits) {
    return false;
  }

  return true;
}

export function expectedSolanaUsdcBaseUnits(amountUsd: string, decimals = 6): bigint {
  return ethers.parseUnits(Number(amountUsd).toFixed(decimals), decimals);
}
