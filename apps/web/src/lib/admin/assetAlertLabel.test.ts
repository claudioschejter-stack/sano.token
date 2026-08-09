import { describe, expect, it } from 'vitest';
import { assetAlertLabel } from './assetAlertLabel';

/** The two Añelo buildings, as they actually are in production. */
const UV2 = {
  title: 'APART HOTEL URBAN VIEW - AÑELO',
  tokenSymbol: 'ANELO UV2 RWA',
  contractAddress: '0x1dD753e74C68E5Acfa4846D5336e7D552C999664'
};
const UV3 = {
  title: 'AÑELO - APART HOTEL URBAN VIEW',
  tokenSymbol: 'UV3RWA',
  contractAddress: '0x481fAa4102Fb080e8291cA49d1e70bA42d36c8F1'
};

describe('assetAlertLabel', () => {
  it('separates the two Urban View buildings, whose titles are the same words', () => {
    expect(assetAlertLabel(UV2)).not.toBe(assetAlertLabel(UV3));
    expect(assetAlertLabel(UV2)).toContain('UV2');
    expect(assetAlertLabel(UV3)).toContain('UV3');
  });

  it('keeps the title, so the label still reads like the project', () => {
    expect(assetAlertLabel(UV3)).toContain('AÑELO - APART HOTEL URBAN VIEW');
  });

  it('falls back to the contract address when there is no symbol yet', () => {
    const label = assetAlertLabel({ ...UV3, tokenSymbol: null });
    expect(label).toContain('0x481fAa41');
    expect(label).not.toContain(UV3.contractAddress);
  });

  it('returns the plain title for an asset that is not deployed at all', () => {
    expect(
      assetAlertLabel({ title: 'Centenario — Módulos', tokenSymbol: null, contractAddress: null })
    ).toBe('Centenario — Módulos');
  });

  it('ignores a symbol that is only whitespace', () => {
    const label = assetAlertLabel({ ...UV3, tokenSymbol: '   ' });
    expect(label).toContain('0x481fAa41');
  });
});
