import { describe, expect, it } from 'vitest';
import { vaultSharesForTokenCount } from './investorVaultShareDelivery';

describe('investorVaultShareDelivery', () => {
  it('maps token count to 18-decimal share units', () => {
    expect(vaultSharesForTokenCount(10)).toBe(10n * 10n ** 18n);
  });

  it('returns zero for invalid counts', () => {
    expect(vaultSharesForTokenCount(0)).toBe(0n);
    expect(vaultSharesForTokenCount(-1)).toBe(0n);
  });
});
