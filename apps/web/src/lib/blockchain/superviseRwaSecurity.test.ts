import { beforeEach, describe, expect, it, vi } from 'vitest';

const activated: string[] = [];
const released: string[] = [];
const repairCalls: string[] = [];

const alerts: Array<{ severity: string; message: string }> = [];

type Report = {
  ok: boolean;
  degraded: boolean;
  failures: Array<{ label: string; detail: string }>;
  unknowns: Array<{ label: string; detail: string }>;
};

let reports: Report[] = [];
let repairResult: {
  ok: boolean;
  steps: Array<{ label: string; contract: 'token' | 'vault'; move: string; detail: string }>;
  pending: string[];
} = { ok: true, steps: [], pending: [] };
let repairThrows = false;

vi.mock('../admin/automationCircuitBreaker', () => ({
  activateCircuitBreaker: async (projectId: string) => {
    activated.push(projectId);
    return null;
  },
  resetCircuitBreaker: async (projectId: string) => {
    released.push(projectId);
    return null;
  }
}));

vi.mock('../admin/automationAlerts', () => ({
  notifyAutomationIssue: async (input: { severity: string; message: string }) => {
    alerts.push(input);
  }
}));

vi.mock('./rwaSecurityReport', () => ({
  recordRwaSecurityReport: async () =>
    reports.shift() ?? { ok: true, degraded: false, failures: [], unknowns: [] }
}));

vi.mock('./repairRwaSecurityConfig', () => ({
  repairRwaSecurityConfig: async (asset: { id: string }) => {
    repairCalls.push(asset.id);
    if (repairThrows) throw new Error('signer exploded');
    return repairResult;
  }
}));

vi.mock('./treasuryOwnerSigner', () => ({ isTreasuryOwnerSignerConfigured: () => true }));

const { decideBreaker, isRepairableFailure, superviseRwaSecurity } = await import(
  './superviseRwaSecurity'
);

function asset(overrides: Record<string, unknown> = {}) {
  return { id: 'proj-1', title: 'Añelo', automationCircuitBreaker: false, ...overrides } as never;
}

function clean(): Report {
  return { ok: true, degraded: false, failures: [], unknowns: [] };
}

function withFailures(...labels: string[]): Report {
  return {
    ok: false,
    degraded: false,
    failures: labels.map((label) => ({ label, detail: 'No permitido.' })),
    unknowns: []
  };
}

beforeEach(() => {
  activated.length = 0;
  released.length = 0;
  repairCalls.length = 0;
  alerts.length = 0;
  reports = [];
  repairResult = { ok: true, steps: [], pending: [] };
  repairThrows = false;
});

describe('isRepairableFailure', () => {
  it('recognises the findings the repair converges on', () => {
    expect(isRepairableFailure('Vault allowlist 0x464159...')).toBe(true);
    expect(isRepairableFailure('Límite diario configurado')).toBe(true);
  });

  it('does not claim findings it cannot touch', () => {
    expect(isRepairableFailure('Vault no pausado')).toBe(false);
    expect(isRepairableFailure('Token owner treasury')).toBe(false);
    expect(isRepairableFailure('Treasury mantiene shares')).toBe(false);
  });
});

describe('decideBreaker', () => {
  it('does not block an asset whose repair is already scheduled on-chain', () => {
    expect(
      decideBreaker({
        failures: [{ label: 'Vault allowlist 0x464159...' }],
        repairInFlight: true,
        breakerActive: false,
        reportClean: false
      })
    ).toBe('unchanged');
  });

  it('blocks a repairable finding that nothing is working on', () => {
    expect(
      decideBreaker({
        failures: [{ label: 'Vault allowlist 0x464159...' }],
        repairInFlight: false,
        breakerActive: false,
        reportClean: false
      })
    ).toBe('activate');
  });

  it('blocks an anomaly the repair cannot touch even mid-repair', () => {
    expect(
      decideBreaker({
        failures: [{ label: 'Vault no pausado' }, { label: 'Vault allowlist 0x464159...' }],
        repairInFlight: true,
        breakerActive: false,
        reportClean: false
      })
    ).toBe('activate');
  });

  it('releases the asset once the report comes back clean', () => {
    expect(
      decideBreaker({ failures: [], repairInFlight: false, breakerActive: true, reportClean: true })
    ).toBe('release');
  });

  it('leaves a clean asset that was never blocked alone', () => {
    expect(
      decideBreaker({ failures: [], repairInFlight: false, breakerActive: false, reportClean: true })
    ).toBe('unchanged');
  });
});

describe('superviseRwaSecurity', () => {
  it('schedules the timelock and keeps the asset unblocked while it runs', async () => {
    reports = [withFailures('Vault allowlist 0x464159...')];
    repairResult = {
      ok: true,
      steps: [
        { label: 'allowlist 0x464159...', contract: 'vault', move: 'SCHEDULE', detail: 'programado' }
      ],
      pending: ['allowlist 0x464159...: timelock iniciado']
    };

    const result = await superviseRwaSecurity(asset());

    expect(repairCalls).toEqual(['proj-1']);
    expect(result.repaired).toEqual(['vault/allowlist 0x464159...: SCHEDULE']);
    expect(result.breaker).toBe('unchanged');
    expect(activated).toHaveLength(0);
  });

  it('re-checks after applying and releases the breaker when it comes back clean', async () => {
    reports = [withFailures('Vault allowlist 0x464159...'), clean()];
    repairResult = {
      ok: true,
      steps: [
        { label: 'allowlist 0x464159...', contract: 'vault', move: 'EXECUTE', detail: 'aplicado' }
      ],
      pending: []
    };

    const result = await superviseRwaSecurity(asset({ automationCircuitBreaker: true }));

    expect(result.ok).toBe(true);
    expect(result.breaker).toBe('release');
    expect(released).toEqual(['proj-1']);
  });

  it('does not attempt a repair for an anomaly it cannot fix', async () => {
    reports = [withFailures('Vault no pausado')];

    const result = await superviseRwaSecurity(asset());

    expect(repairCalls).toHaveLength(0);
    expect(result.breaker).toBe('activate');
    expect(activated).toEqual(['proj-1']);
  });

  it('still blocks the asset when the repair itself fails', async () => {
    reports = [withFailures('Vault allowlist 0x464159...')];
    repairThrows = true;

    const result = await superviseRwaSecurity(asset());

    expect(result.repairError).toContain('signer exploded');
    expect(result.breaker).toBe('activate');
  });

  it('leaves the chain alone when auto-repair is turned off', async () => {
    reports = [withFailures('Vault allowlist 0x464159...')];

    const result = await superviseRwaSecurity(asset(), { autoRepair: false });

    expect(repairCalls).toHaveLength(0);
    expect(result.breaker).toBe('activate');
  });

  it('sends a single alert describing the finding and what was done about it', async () => {
    reports = [withFailures('Vault allowlist 0x464159...')];
    repairResult = {
      ok: true,
      steps: [
        { label: 'allowlist 0x464159...', contract: 'vault', move: 'SCHEDULE', detail: 'programado' }
      ],
      pending: ['allowlist 0x464159...: timelock iniciado']
    };

    await superviseRwaSecurity(asset());

    expect(alerts).toHaveLength(1);
    expect(alerts[0].message).toContain('Anomalías confirmadas');
    expect(alerts[0].message).toContain('Reparación automática');
    expect(alerts[0].message).toContain('Esperando timelock');
    // Nothing is broken beyond repair, so this is not a page-the-owner event.
    expect(alerts[0].severity).toBe('warning');
  });

  it('stays quiet when there is nothing to say', async () => {
    reports = [clean()];

    const result = await superviseRwaSecurity(asset());

    expect(result.ok).toBe(true);
    expect(alerts).toHaveLength(0);
  });
});
