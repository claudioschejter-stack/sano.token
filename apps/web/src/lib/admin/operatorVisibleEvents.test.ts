import { describe, expect, it } from 'vitest';
import { operatorVisibleEvents } from './assetsService';
import type { DeploymentEvent } from './launchTypes';

function event(overrides: Partial<DeploymentEvent>): DeploymentEvent {
  return {
    id: `evt-${Math.random().toString(36).slice(2)}`,
    step: 'PREFLIGHT',
    status: 'SUCCESS',
    message: null,
    address: null,
    externalId: null,
    createdAt: '2026-08-10T00:00:00.000Z',
    ...overrides
  } as DeploymentEvent;
}

/**
 * El panel de préstamos muestra `find(status === 'FAILED').message` como último
 * error. El pseudo-evento de metadata va primero y lleva FAILED cuando el breaker
 * está activo, así que tapaba la causa real con un mensaje que no describe nada.
 */
describe('operatorVisibleEvents', () => {
  const metaEvent = event({
    step: 'PREFLIGHT',
    status: 'FAILED',
    externalId: 'AUTOMATION_META',
    message: 'Estado operativo automatizado actualizado.',
    address: JSON.stringify({ automationCircuitBreaker: true, automationFailureCount: 0 })
  });

  it('saca el pseudo-evento de metadata', () => {
    const visible = operatorVisibleEvents([metaEvent]);
    expect(visible).toHaveLength(0);
  });

  it('deja que el primer FAILED sea la falla real', () => {
    const realFailure = event({
      step: 'SECURITY_REPORT',
      status: 'FAILED',
      message: 'Security report falló: Token allowlist 0xbbbbbb...: No permitido.'
    });
    const visible = operatorVisibleEvents([metaEvent, realFailure]);
    const lastError = visible.find((e) => e.status === 'FAILED')?.message;
    expect(lastError).toContain('Token allowlist');
  });

  it('conserva los PREFLIGHT de verdad, que sí describen una falla', () => {
    const realPreflight = event({
      step: 'PREFLIGHT',
      status: 'FAILED',
      externalId: 'job-42',
      message: 'Preflight: el operador no tiene gas para firmar.'
    });
    const visible = operatorVisibleEvents([metaEvent, realPreflight]);
    expect(visible).toHaveLength(1);
    expect(visible[0]?.message).toContain('gas');
  });

  it('no toca una lista sin metadata', () => {
    const events = [
      event({ step: 'TOKEN_DEPLOY', status: 'SUCCESS' }),
      event({ step: 'VAULT_FUNDING', status: 'FAILED', message: 'balanceOf no decodifica' })
    ];
    expect(operatorVisibleEvents(events)).toEqual(events);
  });
});
