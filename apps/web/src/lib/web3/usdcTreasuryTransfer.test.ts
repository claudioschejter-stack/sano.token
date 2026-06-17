import { describe, expect, it } from 'vitest';
import { buildEvmUsdcTransferTx, isEvmAutoUsdcNetwork } from './usdcTreasuryTransfer';

describe('usdcTreasuryTransfer', () => {
  it('builds ERC-20 transfer calldata', () => {
    const tx = buildEvmUsdcTransferTx({
      tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      treasuryAddress: '0x1111111111111111111111111111111111111111',
      amountUsd: 100,
      decimals: 6
    });

    expect(tx.to).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    expect(tx.data.startsWith('0xa9059cbb')).toBe(true);
    expect(tx.value).toBe('0');
  });

  it('detects non-EVM networks as unsupported', () => {
    expect(isEvmAutoUsdcNetwork('SOLANA')).toBe(false);
    expect(isEvmAutoUsdcNetwork('TRON')).toBe(false);
  });
});
