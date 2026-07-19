import { describe, expect, it } from 'vitest';
import { decodeMacroClickCommerceRef, encodeMacroClickCommerceRef } from './commerceRef';

describe('macroClick commerceRef', () => {
  it('round-trips rent refs with ARS/USD', () => {
    const encoded = encodeMacroClickCommerceRef({
      kind: 'rent',
      projectId: 'proj123',
      periodKey: '2026-07',
      currency: 'ARS',
      tenantKey: 'tenant9'
    });
    expect(decodeMacroClickCommerceRef(encoded)).toEqual({
      kind: 'rent',
      projectId: 'proj123',
      periodKey: '2026-07',
      currency: 'ARS',
      tenantKey: 'tenant9'
    });
  });

  it('round-trips deposit and cart', () => {
    expect(decodeMacroClickCommerceRef(encodeMacroClickCommerceRef({ kind: 'deposit', depositId: 'dep_abc' }))).toEqual({
      kind: 'deposit',
      depositId: 'dep_abc'
    });
    expect(decodeMacroClickCommerceRef(encodeMacroClickCommerceRef({ kind: 'cart', batchId: 'batch1' }))).toEqual({
      kind: 'cart',
      batchId: 'batch1'
    });
  });
});
