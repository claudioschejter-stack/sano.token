import { createThirdwebClient } from 'thirdweb';
import { defineChain } from 'thirdweb/chains';
import { deployERC20Contract } from 'thirdweb/deploys';
import { getContract } from 'thirdweb';
import { mintTo } from 'thirdweb/extensions/erc20';
import { privateKeyToAccount } from 'thirdweb/wallets';
import { resolveChainId } from './explorerUrls';

export { buildSmartContractDocUrl, explorerUrl, resolveChainId } from './explorerUrls';

export type DeployTokenInput = {
  tokenName: string;
  tokenSymbol: string;
  totalSupplyUnits: number;
  treasuryAddress?: string;
};

export type DeployTokenResult =
  | { status: 'DEPLOYED'; contractAddress: string; chainId: number; txHash: string }
  | { status: 'SKIPPED'; reason: string };

function normalizeSymbol(symbol: string): string {
  const cleaned = symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cleaned.slice(0, 8) || 'RWA';
}

export async function deployAssetToken(input: DeployTokenInput): Promise<DeployTokenResult> {
  const secretKey = process.env.THIRDWEB_SECRET_KEY?.trim();
  const privateKey = (process.env.TOKEN_DEPLOY_PRIVATE_KEY ?? process.env.PRIVATE_KEY)?.trim();
  const chainId = resolveChainId();

  if (!secretKey) {
    return {
      status: 'SKIPPED',
      reason:
        'Configurá THIRDWEB_SECRET_KEY (gratis en thirdweb.com → API Keys). Es el método recomendado para emitir tokens en un clic.'
    };
  }

  if (!privateKey) {
    return {
      status: 'SKIPPED',
      reason: 'Configurá TOKEN_DEPLOY_PRIVATE_KEY o PRIVATE_KEY con una wallet con gas en testnet (Base Sepolia recomendada).'
    };
  }

  if (!Number.isInteger(input.totalSupplyUnits) || input.totalSupplyUnits <= 0) {
    return {
      status: 'SKIPPED',
      reason: 'Supply de tokens inválido para la emisión.'
    };
  }

  try {
    const client = createThirdwebClient({ secretKey });
    const chain = defineChain(chainId);
    const account = privateKeyToAccount({ client, privateKey });
    const symbol = normalizeSymbol(input.tokenSymbol);

    const contractAddress = await deployERC20Contract({
      client,
      chain,
      account,
      type: 'TokenERC20',
      params: {
        name: input.tokenName.trim().slice(0, 64),
        symbol,
        description: `Sanova Global RWA — ${input.tokenName.trim()}`
      }
    });

    const contract = getContract({
      client,
      chain,
      address: contractAddress
    });

    const mintRecipient = input.treasuryAddress ?? account.address;
    const mintAmount = BigInt(input.totalSupplyUnits) * 10n ** 18n;

    const mintReceipt = await mintTo({
      contract,
      to: mintRecipient,
      amount: mintAmount.toString()
    });

    const txHash =
      mintReceipt && typeof mintReceipt === 'object' && 'transactionHash' in mintReceipt
        ? String(mintReceipt.transactionHash)
        : 'mint-submitted';

    return {
      status: 'DEPLOYED',
      contractAddress,
      chainId,
      txHash
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown deployment error';
    return {
      status: 'SKIPPED',
      reason: `Thirdweb: ${message}`
    };
  }
}
