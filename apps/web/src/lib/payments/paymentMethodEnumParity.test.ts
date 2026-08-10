import { describe, expect, it } from 'vitest';
import type { PaymentMethod } from '@prisma/client';
import { listCheckoutMethods } from './checkoutMethods';

/**
 * El enum de la base y el catálogo de checkout tienen que coincidir. Cuando el
 * enum tenía valores sin cobrador detrás (STRIPE, RAMP, COINBASE,
 * CUSTODIAL_STABLECOIN), leer el esquema hacía creer que había cuatro formas de
 * pagar que en realidad no existían, y un checkout que nombrara una de ellas
 * llegaba hasta el final antes de fallar.
 */
function catalogMethodIds(): Set<string> {
  return new Set<string>([
    ...listCheckoutMethods('purchase').map((method) => method.id),
    ...listCheckoutMethods('deposit').map((method) => method.id)
  ]);
}

describe('paridad entre el enum PaymentMethod y el catálogo de checkout', () => {
  it('ningún método retirado sobrevive en el catálogo', () => {
    const ids = catalogMethodIds();
    for (const retired of ['STRIPE', 'RAMP', 'COINBASE', 'CUSTODIAL_STABLECOIN']) {
      expect(ids.has(retired)).toBe(false);
    }
  });

  it('el catálogo cubre todos los métodos que la base acepta', () => {
    const ids = catalogMethodIds();
    const acceptedByDatabase: PaymentMethod[] = [
      'INTERNAL_BALANCE',
      'USDC_ONCHAIN',
      'LOCAL_RAIL',
      'BRIDGE',
      'PRIVY_ONRAMP',
      'RIPIO',
      'MERCADO_PAGO'
    ];
    for (const method of acceptedByDatabase) {
      expect(ids.has(method), `falta la fila de ${method}`).toBe(true);
    }
  });

  it('el catálogo no nombra métodos que la base rechazaría', () => {
    const acceptedByDatabase = new Set<string>([
      'INTERNAL_BALANCE',
      'USDC_ONCHAIN',
      'LOCAL_RAIL',
      'BRIDGE',
      'PRIVY_ONRAMP',
      'RIPIO',
      'MERCADO_PAGO'
    ]);
    for (const id of catalogMethodIds()) {
      expect(acceptedByDatabase.has(id), `${id} no existe en el enum`).toBe(true);
    }
  });
});
