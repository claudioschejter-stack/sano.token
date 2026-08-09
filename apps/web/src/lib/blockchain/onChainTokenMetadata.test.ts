import { describe, expect, it } from 'vitest';
import { buildOnChainTokenName, normalizeSymbol } from './deployLaunchToken';

/**
 * Estas dos transformaciones son la razón por la que la base y la cadena
 * divergían: el deploy las aplica y el proyecto guardaba lo pedido.
 */
describe('normalizeSymbol', () => {
  it('reproduce el símbolo que UV2 tiene realmente en la cadena', () => {
    // Se pidió "ANELO UV2 RWA"; el contrato dice ANELOUV2.
    expect(normalizeSymbol('ANELO UV2 RWA')).toBe('ANELOUV2');
  });

  it('deja intacto un símbolo que ya cumple, como el de UV3', () => {
    expect(normalizeSymbol('UV3RWA')).toBe('UV3RWA');
  });

  it('recorta a ocho caracteres, que es de dónde vino la diferencia', () => {
    expect(normalizeSymbol('ABCDEFGHIJK')).toHaveLength(8);
  });

  it('saca acentos y signos porque el símbolo es alfanumérico', () => {
    expect(normalizeSymbol('añelo-uv2')).toBe('AELOUV2');
  });

  it('cae a RWA antes que dejar un símbolo vacío', () => {
    expect(normalizeSymbol('   ')).toBe('RWA');
    expect(normalizeSymbol('—')).toBe('RWA');
  });
});

describe('buildOnChainTokenName', () => {
  it('agrega el sufijo del instrumento, que la base no guardaba', () => {
    expect(buildOnChainTokenName('ANELO UV3 RWA', 'EQUITY')).toBe('ANELO UV3 RWA Equity');
    expect(buildOnChainTokenName('Nota X', 'DEBT')).toBe('Nota X Debt Note');
  });

  it('no agrega nada cuando no hay tipo de instrumento', () => {
    expect(buildOnChainTokenName('ANELO UV3 RWA')).toBe('ANELO UV3 RWA');
  });

  it('recorta a 64 caracteres', () => {
    expect(buildOnChainTokenName('A'.repeat(80), 'EQUITY')).toHaveLength(64);
  });

  it('no arregla la ortografía: el nombre que se manda es el que queda grabado', () => {
    // El typo de UV2 vive en el contrato y ERC20 no tiene setter de name.
    expect(buildOnChainTokenName('URVAN VIEW AÑELO UV2', 'EQUITY')).toBe(
      'URVAN VIEW AÑELO UV2 Equity'
    );
  });
});
