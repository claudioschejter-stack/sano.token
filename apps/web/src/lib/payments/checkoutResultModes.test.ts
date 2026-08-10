import { describe, expect, it } from 'vitest';
import {
  isLocalRailManualResult,
  isPendingManualGatewayResult,
  isPrivyClientFundResult,
  isRipioOnRampResult
} from './checkoutResultModes';

describe('checkoutResultModes', () => {
  it('reconoce el carril local en conciliación manual', () => {
    expect(isLocalRailManualResult({ mode: 'manual_reconciliation' })).toBe(true);
    expect(isLocalRailManualResult({ configured: true })).toBe(false);
    expect(isLocalRailManualResult(null)).toBe(false);
  });

  it('reconoce un on-ramp de Ripio', () => {
    expect(isRipioOnRampResult({ mode: 'ripio_on_ramp' })).toBe(true);
    expect(isRipioOnRampResult({ mode: 'manual_reconciliation' })).toBe(false);
  });

  it('reconoce el fondeo desde el cliente de Privy', () => {
    expect(isPrivyClientFundResult({ mode: 'privy_client_fund' })).toBe(true);
    expect(isPrivyClientFundResult({})).toBe(false);
  });

  it('agrupa como pendiente manual lo que espera una acción del inversor', () => {
    expect(isPendingManualGatewayResult({ mode: 'manual_reconciliation' })).toBe(true);
    expect(isPendingManualGatewayResult({ mode: 'ripio_on_ramp' })).toBe(true);
    expect(isPendingManualGatewayResult({ mode: 'privy_client_fund' })).toBe(false);
  });
});
