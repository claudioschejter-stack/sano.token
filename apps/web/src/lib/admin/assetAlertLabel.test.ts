import { describe, expect, it } from 'vitest';
import { assetAlertLabel, assetCode } from './assetAlertLabel';

/** Los dos edificios de Añelo, como están realmente en producción. */
const UV2 = {
  title: 'APART HOTEL URBAN VIEW - AÑELO',
  tokenSymbol: 'ANELOUV2',
  contractAddress: '0x1dD753e74C68E5Acfa4846D5336e7D552C999664'
};
const UV3 = {
  title: 'AÑELO - APART HOTEL URBAN VIEW',
  tokenSymbol: 'UV3RWA',
  contractAddress: '0x481fAa4102Fb080e8291cA49d1e70bA42d36c8F1'
};

describe('assetCode', () => {
  it('usa el símbolo del token, que es lo que separa UV2 de UV3', () => {
    expect(assetCode(UV2)).toBe('ANELOUV2');
    expect(assetCode(UV3)).toBe('UV3RWA');
  });

  it('cae a la dirección del token cuando todavía no hay símbolo', () => {
    expect(assetCode({ ...UV3, tokenSymbol: null })).toBe('0x481fAa41…');
  });

  it('ignora un símbolo que es solo espacios', () => {
    expect(assetCode({ ...UV3, tokenSymbol: '   ' })).toBe('0x481fAa41…');
  });

  it('devuelve null para un activo sin desplegar', () => {
    expect(assetCode({ title: 'Centenario', tokenSymbol: null, contractAddress: null })).toBeNull();
  });
});

describe('assetAlertLabel', () => {
  it('pone el código adelante, no al final', () => {
    expect(assetAlertLabel(UV3)).toBe('[UV3RWA] AÑELO - APART HOTEL URBAN VIEW');
  });

  it('distingue los dos edificios cuyos títulos son las mismas palabras', () => {
    expect(assetAlertLabel(UV2)).not.toBe(assetAlertLabel(UV3));
    expect(assetAlertLabel(UV2).startsWith('[ANELOUV2]')).toBe(true);
    expect(assetAlertLabel(UV3).startsWith('[UV3RWA]')).toBe(true);
  });

  it('conserva el título, para que la etiqueta siga leyéndose como el proyecto', () => {
    expect(assetAlertLabel(UV3)).toContain('AÑELO - APART HOTEL URBAN VIEW');
  });

  it('devuelve el título solo cuando no hay con qué codificarlo', () => {
    expect(
      assetAlertLabel({ title: 'Centenario — Módulos', tokenSymbol: null, contractAddress: null })
    ).toBe('Centenario — Módulos');
  });
});
