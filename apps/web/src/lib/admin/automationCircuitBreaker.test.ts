import { beforeEach, describe, expect, it, vi } from 'vitest';

const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
const events: Array<{ id: string; step: string; status: string; message: string }> = [];

vi.mock('./assetsService', () => ({
  appendDeploymentEvent: async (
    id: string,
    event: { step: string; status: string; message: string }
  ) => {
    events.push({ id, ...event });
  },
  updateAdminAsset: async (id: string, patch: Record<string, unknown>) => {
    updates.push({ id, patch });
    return { id, title: 'Activo', ...patch };
  }
}));
vi.mock('./automationAlerts', () => ({ notifyCircuitBreaker: async () => undefined }));

const { activateCircuitBreaker, resetCircuitBreaker, shouldBlockAutomation } = await import(
  './automationCircuitBreaker'
);

function asset(overrides: Record<string, unknown> = {}) {
  return {
    automationCircuitBreaker: false,
    automationFailureCount: 0,
    ...overrides
  } as never;
}

beforeEach(() => {
  updates.length = 0;
  events.length = 0;
  vi.unstubAllEnvs();
});

describe('shouldBlockAutomation', () => {
  it('lets a healthy asset through', () => {
    expect(shouldBlockAutomation(asset())).toBeNull();
  });

  it('blocks on the breaker and on accumulated failures separately', () => {
    expect(shouldBlockAutomation(asset({ automationCircuitBreaker: true }))).toContain(
      'Circuit breaker'
    );
    expect(shouldBlockAutomation(asset({ automationFailureCount: 5 }))).toContain('fallos');
  });
});

describe('resetCircuitBreaker', () => {
  it('clears the breaker', async () => {
    const result = await resetCircuitBreaker('proj-1', 'pago resuelto');
    expect(result?.automationCircuitBreaker).toBe(false);
    expect(updates[0].patch.automationCircuitBreaker).toBe(false);
  });

  it('also clears the failure count, which would trip it again on its own', async () => {
    await resetCircuitBreaker('proj-1', 'pago resuelto');
    expect(updates[0].patch.automationFailureCount).toBe(0);
  });

  it('leaves the release in the project history with its reason', async () => {
    await resetCircuitBreaker('proj-1', 'pago resuelto');
    expect(events[0]).toMatchObject({ step: 'CIRCUIT_BREAKER', status: 'SUCCESS' });
    expect(events[0].message).toContain('pago resuelto');
  });

  it('produces an asset that no longer blocks automation', async () => {
    const result = await resetCircuitBreaker('proj-1', 'pago resuelto');
    expect(shouldBlockAutomation(result as never)).toBeNull();
  });

  it('still blocks when automation is disabled platform-wide', async () => {
    vi.stubEnv('AUTOMATION_DISABLED', '1');
    const result = await resetCircuitBreaker('proj-1', 'pago resuelto');
    expect(shouldBlockAutomation(result as never)).toContain('AUTOMATION_DISABLED');
  });
});

describe('activateCircuitBreaker', () => {
  it('records why it tripped', async () => {
    await activateCircuitBreaker('proj-1', 'demasiados fallos de settle');
    expect(updates[0].patch.automationCircuitBreaker).toBe(true);
    expect(events[0]).toMatchObject({ step: 'CIRCUIT_BREAKER', status: 'FAILED' });
  });
});
