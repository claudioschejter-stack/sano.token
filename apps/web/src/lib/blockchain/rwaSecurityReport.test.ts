import { beforeEach, describe, expect, it, vi } from 'vitest';

const TOKEN = '0x481fAa4102Fb080e8291cA49d1e70bA42d36c8F1';
const VAULT = '0x125782B1302be9a2f58849f8A86F25F78009b367';
const TREASURY = '0xa993743CFB85E8d6481Ef60bb3D397F49604A592';
const MORPHO = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb';
const IRM = '0x46415998764C29aB2a25CbeA6254146D50D22687';

const breakerCalls: Array<{ projectId: string; reason: string }> = [];
const alerts: Array<Record<string, unknown>> = [];
const events: Array<Record<string, unknown>> = [];

/** null simulates an RPC read that never answered. */
let tokenAllowlist: Record<string, boolean | null> = {};
let vaultAllowlist: Record<string, boolean | null> = {};
let dailyLimit: bigint | null = 500n * 10n ** 18n;
let totalAssets: bigint | null = 5000n * 10n ** 18n;
let treasuryShares: bigint | null = 5000n * 10n ** 18n;

const UINT256_MAX = (1n << 256n) - 1n;

vi.mock('../admin/assetsService', () => ({
  appendDeploymentEvent: async (projectId: string, event: Record<string, unknown>) => {
    events.push({ projectId, ...event });
    return null;
  }
}));

vi.mock('../admin/automationCircuitBreaker', () => ({
  activateCircuitBreaker: async (projectId: string, reason: string) => {
    breakerCalls.push({ projectId, reason });
    return null;
  }
}));

vi.mock('../admin/automationAlerts', () => ({
  notifyAutomationIssue: async (input: Record<string, unknown>) => {
    alerts.push(input);
  }
}));

vi.mock('./explorerUrls', () => ({ resolveChainId: () => 8453 }));
vi.mock('./supportedChains', () => ({ resolveChainRpcUrl: () => 'https://rpc.test' }));
vi.mock('./treasuryPolicy', () => ({ resolveTreasuryAddress: () => TREASURY }));

vi.mock('./securityPolicy', () => ({
  allowedExternalContractsForChain: () => [MORPHO.toLowerCase(), IRM.toLowerCase()],
  operatorCustodianPolicy: () => ({ ok: true, message: 'Operador separado del custodio/Safe.' }),
  resolveDailyWithdrawalLimit: (assets: bigint) => assets / 10n
}));

vi.mock('./rpcRetry', () => ({
  readWithRetry: async (read: () => Promise<unknown>) => {
    try {
      return await read();
    } catch {
      return null;
    }
  }
}));

vi.mock('ethers', async () => {
  const actual = await vi.importActual<typeof import('ethers')>('ethers');
  class FakeContract {
    constructor(public address: string) {}
    private get isVault() {
      return this.address.toLowerCase() === VAULT.toLowerCase();
    }
    async owner() {
      return TREASURY;
    }
    async paused() {
      return false;
    }
    async totalAssets() {
      if (totalAssets === null) throw new Error('missing revert data');
      return totalAssets;
    }
    async balanceOf() {
      if (treasuryShares === null) throw new Error('missing revert data');
      return treasuryShares;
    }
    async dailyWithdrawalLimit() {
      if (dailyLimit === null) throw new Error('missing revert data');
      return dailyLimit;
    }
    async externalContractAllowed(address: string) {
      const table = this.isVault ? vaultAllowlist : tokenAllowlist;
      const value = table[address.toLowerCase()];
      if (value === null || value === undefined) throw new Error('missing revert data');
      return value;
    }
  }
  class FakeProvider {
    destroy() {}
  }
  return { ...actual, Contract: FakeContract, JsonRpcProvider: FakeProvider };
});

const { generateRwaSecurityReport, recordRwaSecurityReport } = await import('./rwaSecurityReport');

function asset() {
  return {
    id: 'proj-urban-view',
    title: 'APART HOTEL URBAN VIEW - AÑELO',
    chainId: 8453,
    contractAddress: TOKEN,
    vaultAddress: VAULT
  } as never;
}

function allAllowed() {
  return { [MORPHO.toLowerCase()]: true, [IRM.toLowerCase()]: true };
}

function checkOf(report: { checks: Array<{ label: string; status: string; detail: string }> }, needle: string) {
  return report.checks.find((check) => check.label.includes(needle));
}

beforeEach(() => {
  breakerCalls.length = 0;
  alerts.length = 0;
  events.length = 0;
  tokenAllowlist = allAllowed();
  vaultAllowlist = allAllowed();
  dailyLimit = 500n * 10n ** 18n;
  totalAssets = 5000n * 10n ** 18n;
  treasuryShares = 5000n * 10n ** 18n;
});

describe('generateRwaSecurityReport', () => {
  it('passes when the contracts answer as configured', async () => {
    const report = await generateRwaSecurityReport(asset());
    expect(report.ok).toBe(true);
    expect(report.degraded).toBe(false);
    expect(report.failures).toHaveLength(0);
  });

  it('marks a read it could not perform as unknown, not as a violation', async () => {
    vaultAllowlist = { ...allAllowed(), [IRM.toLowerCase()]: null };

    const report = await generateRwaSecurityReport(asset());
    const check = checkOf(report, `Vault allowlist ${IRM.slice(0, 8)}`);

    expect(check?.status).toBe('unknown');
    expect(check?.detail).not.toContain('No permitido');
    expect(report.failures).toHaveLength(0);
    expect(report.degraded).toBe(true);
    expect(report.ok).toBe(false);
  });

  it('still reports a genuine "no" as a violation', async () => {
    vaultAllowlist = { ...allAllowed(), [IRM.toLowerCase()]: false };

    const report = await generateRwaSecurityReport(asset());
    const check = checkOf(report, `Vault allowlist ${IRM.slice(0, 8)}`);

    expect(check?.status).toBe('fail');
    expect(check?.detail).toBe('No permitido.');
    expect(report.failures).toHaveLength(1);
  });

  it('names the unlimited daily withdrawal limit instead of printing uint256 max', async () => {
    dailyLimit = UINT256_MAX;

    const report = await generateRwaSecurityReport(asset());
    const check = checkOf(report, 'Límite diario');

    expect(check?.status).toBe('fail');
    expect(check?.detail).toContain('sin límite');
    expect(check?.detail).not.toContain(UINT256_MAX.toString());
  });
});

describe('recordRwaSecurityReport', () => {
  it('does not block the asset when the only problem is an unreadable contract', async () => {
    vaultAllowlist = { [MORPHO.toLowerCase()]: null, [IRM.toLowerCase()]: null };
    tokenAllowlist = { [MORPHO.toLowerCase()]: null, [IRM.toLowerCase()]: null };

    await recordRwaSecurityReport(asset(), { activateBreaker: true });

    expect(breakerCalls).toHaveLength(0);
    expect(alerts[0]).toMatchObject({ severity: 'warning' });
  });

  it('blocks the asset when an anomaly is confirmed on-chain', async () => {
    vaultAllowlist = { ...allAllowed(), [IRM.toLowerCase()]: false };

    await recordRwaSecurityReport(asset(), { activateBreaker: true });

    expect(breakerCalls).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ severity: 'critical' });
  });

  it('records which checks were unreadable so the alert can be audited later', async () => {
    dailyLimit = null;

    await recordRwaSecurityReport(asset(), { activateBreaker: true });

    const report = events.find((event) => event.step === 'SECURITY_REPORT');
    expect(String(report?.externalId)).toContain('Límite diario configurado');
    expect(breakerCalls).toHaveLength(0);
  });
});
