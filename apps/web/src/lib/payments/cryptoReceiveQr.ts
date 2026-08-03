import { getAddress } from 'ethers';

/** Canonical Base mainnet USDC. */
export const BASE_USDC_TOKEN_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const BASE_CHAIN_ID = 8453;

export type CryptoReceiveQrMode = 'address' | 'eip681_usdc';

/**
 * Payload encoded in the funding QR.
 *
 * - `address`: bare checksummed 0x… — widest support (Ripio, Lemon, Coinbase, MetaMask).
 * - `eip681_usdc`: full ERC-20 transfer URI — MetaMask / some Coinbase builds; often rejected by Ripio/Lemon.
 */
export function buildCryptoReceiveQrPayload(input: {
  receiveAddress: string;
  amountUsdc: number;
  mode: CryptoReceiveQrMode;
}): string {
  const address = getAddress(input.receiveAddress.trim());
  if (input.mode === 'address') {
    return address;
  }

  const micros = Math.max(0, Math.round(input.amountUsdc * 1e6));
  // Scientific notation is preferred by EIP-681 for readability / parser friendliness.
  const amountParam = micros >= 1_000_000 ? `${micros / 1_000_000}e6` : String(micros);
  return `ethereum:${BASE_USDC_TOKEN_ADDRESS}@${BASE_CHAIN_ID}/transfer?address=${address}&uint256=${amountParam}`;
}

export function cryptoReceiveQrImageUrl(payload: string, size = 220): string {
  const params = new URLSearchParams({
    size: `${size}x${size}`,
    margin: '8',
    data: payload
  });
  return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
}
