import { describe, expect, it } from 'vitest';
import { classifyCheckoutPaymentLane, pickCardBackend } from './checkoutPaymentLanes';
import { railsForCardBackend } from './checkoutPaymentDisplay';
import type { DepositPaymentOption } from './depositPaymentOptions';

function option(overrides: Partial<DepositPaymentOption>): DepositPaymentOption {
  return {
    id: 'x',
    groupId: 'argentina',
    method: 'LOCAL_RAIL',
    label: 'x',
    provider: 'macro_click',
    providerRail: 'macro_click_hosted_ars',
    configured: true,
    feeUsd: 0.5,
    gasUsd: 0,
    networkUsd: 0.02,
    totalUsd: 20.52,
    totalLocal: 28_420,
    displayCurrency: 'ARS',
    usesLocalCurrency: true,
    sortOrder: 112,
    ...overrides
  } as DepositPaymentOption;
}

const macroArs = option({ id: 'macro_click_ars' });
const bridge = option({
  id: 'bridge',
  provider: 'bridge',
  providerRail: 'bridge',
  method: 'BRIDGE',
  groupId: 'international',
  totalUsd: 20.1,
  totalLocal: null,
  displayCurrency: 'USD',
  usesLocalCurrency: false,
  sortOrder: 200
});
const debin = option({ id: 'macro_click_debin', providerRail: 'macro_click_debin' });

describe('el checkout de Macro es tarjeta, no billetera', () => {
  /**
   * Caía en 'electronic_wallet' por ser LOCAL_RAIL, así que el pago con tarjeta en
   * pesos quedaba escondido entre las billeteras. La API de Macro declara nueve
   * marcas de tarjeta habilitadas y ninguna billetera.
   */
  it('clasifica el checkout alojado en el carril de tarjeta', () => {
    expect(classifyCheckoutPaymentLane(macroArs)).toBe('card');
    expect(classifyCheckoutPaymentLane(option({ id: 'macro_click_usd' }))).toBe('card');
  });

  it('deja DEBIN fuera del carril de tarjeta, porque es una transferencia', () => {
    expect(classifyCheckoutPaymentLane(debin)).not.toBe('card');
  });
});

describe('pickCardBackend', () => {
  /**
   * Macro primero en Argentina es una decisión de negocio, no un hecho de precio:
   * gana incluso cuando Bridge sale más barato en dólares.
   */
  it('prefiere Macro en Argentina aunque Bridge sea más barato', () => {
    expect(bridge.totalUsd).toBeLessThan(macroArs.totalUsd);
    expect(pickCardBackend([bridge, macroArs], 'AR')?.id).toBe('macro_click_ars');
  });

  it('fuera de Argentina elige por precio', () => {
    expect(pickCardBackend([bridge, macroArs], 'US')?.id).toBe('bridge');
  });

  it('cae a Bridge si Macro no está configurado', () => {
    const macroApagado = option({ id: 'macro_click_ars', configured: false });
    expect(pickCardBackend([bridge, macroApagado], 'AR')?.id).toBe('bridge');
  });

  it('devuelve null cuando no hay ningún cobrador de tarjeta configurado', () => {
    expect(pickCardBackend([option({ id: 'bridge', provider: 'bridge', method: 'BRIDGE', configured: false })], 'AR')).toBeNull();
  });

  it('ignora las filas que no cobran con tarjeta', () => {
    expect(pickCardBackend([debin], 'AR')).toBeNull();
  });
});

describe('railsForCardBackend', () => {
  /**
   * Ofrecerle "transferencia internacional" contra Macro es una opción que no
   * existe: su checkout es local.
   */
  it('Macro sólo ofrece débito y crédito', () => {
    expect(railsForCardBackend(macroArs)).toEqual(['debit_card', 'credit_card']);
  });

  it('Bridge sí ofrece la transferencia internacional', () => {
    expect(railsForCardBackend(bridge)).toContain('international_transfer');
  });
});
