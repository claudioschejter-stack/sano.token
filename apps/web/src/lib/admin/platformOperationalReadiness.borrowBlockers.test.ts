import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The report used to say an asset was not ready to borrow while every listed
 * check passed, which gives the answer and hides the reason. These cover the
 * conditions that had no check of their own.
 */

let asset: Record<string, unknown>;

vi.mock('./assetsService', () => ({
  listAdminAssets: async () => [asset]
}));
vi.mock('./emissionProfiles', () => ({
  inferEmissionProfileFromAsset: () => 'BASE_MORPHO_4626'
}));
vi.mock('./vaultStandards', () => ({
  isVaultTokenStandard: (standard: string) => standard === 'ERC4626'
}));
vi.mock('./erc4626LaunchGate', () => ({
  getErc4626OnChainIssues: () => [],
  isErc4626OnChainReady: () => true
}));
vi.mock('./erc4626MorphoGate', () => ({
  getMorphoPostDeployIssues: () => [],
  getTreasuryReadinessIssues: async () => []
}));
vi.mock('../blockchain/verifyTreasuryVaultShares', () => ({
  readTreasuryVaultReadiness: async () => ({ hasShares: true, kycApproved: true, treasury: '0xsafe' })
}));
vi.mock('../lending/morphoSeedLiquidity', () => ({
  resolveMorphoSeedUsdcForProject: () => 500
}));
vi.mock('../blockchain/treasuryPolicy', () => ({ resolveTreasuryAddress: () => '0xsafe' }));
vi.mock('../blockchain/treasuryOwnerSigner', () => ({
  isTreasuryOwnerSignerConfigured: () => true,
  resolveTreasuryOwnerAddress: () => '0xowner',
  resolveTreasuryOwnerSigner: async () => null
}));
vi.mock('../blockchain/morphoLiquiditySigner', () => ({
  isMorphoLiquiditySignerConfigured: () => true,
  resolveMorphoLiquidityAddress: () => '0xmorpho',
  resolveMorphoLiquiditySigner: async () => null
}));
vi.mock('../lending/baseContracts', () => ({ getLendingChainConfig: () => ({ chainId: 8453 }) }));
vi.mock('../resolvePublicApiUrl', () => ({ resolvePublicApiUrl: () => 'https://api.example.com' }));

const { auditPlatformOperationalReadiness } = await import('./platformOperationalReadiness');

async function reports() {
  const result = await auditPlatformOperationalReadiness();
  return result.projects;
}

function checkOf(report: { checks: Array<{ id: string; status: string; detail?: string }> }, id: string) {
  return report.checks.find((row) => row.id === id);
}

beforeEach(() => {
  asset = {
    id: 'proj-1',
    title: 'Activo',
    isActive: true,
    contractAddress: '0xtoken',
    vaultAddress: '0xvault',
    tokenStandard: 'ERC4626',
    tokenDeployStatus: 'DEPLOYED',
    vaultFundingStatus: 'FUNDED',
    morphoLiquidityStatus: 'LIQUID',
    automationCircuitBreaker: false,
    readyToBorrow: true,
    totalTokens: 100,
    pricePerToken: 10,
    collateralTargets: [
      { protocol: 'MORPHO', status: 'REGISTERED', oracleAddress: '0xoracle', externalId: '0xmarket' }
    ]
  };
});

describe('borrow blockers', () => {
  it('reports every condition as OK for an asset that is ready', async () => {
    const [report] = await reports();
    expect(checkOf(report, 'ready_to_borrow')?.status).toBe('OK');
    expect(report.checks.filter((row) => row.status === 'FAIL')).toHaveLength(0);
  });

  it('names an unfunded vault as the blocker', async () => {
    asset.vaultFundingStatus = 'PENDING';
    asset.readyToBorrow = false;

    const [report] = await reports();
    expect(checkOf(report, 'vault_funded')?.status).toBe('FAIL');
    expect(checkOf(report, 'ready_to_borrow')?.detail).toContain('vault_funded');
  });

  it('names an active circuit breaker as the blocker', async () => {
    asset.automationCircuitBreaker = true;
    asset.readyToBorrow = false;

    const [report] = await reports();
    expect(checkOf(report, 'automation_circuit_breaker')?.status).toBe('FAIL');
    expect(checkOf(report, 'ready_to_borrow')?.detail).toContain('automation_circuit_breaker');
  });

  it('names a missing oracle as the blocker', async () => {
    asset.collateralTargets = [{ protocol: 'MORPHO', status: 'REGISTERED', oracleAddress: null }];
    asset.readyToBorrow = false;

    const [report] = await reports();
    expect(checkOf(report, 'morpho_oracle')?.status).toBe('FAIL');
    expect(checkOf(report, 'ready_to_borrow')?.detail).toContain('morpho_oracle');
  });

  it('does not accept an address as proof the token is deployed', async () => {
    asset.tokenDeployStatus = 'PENDING';
    asset.readyToBorrow = false;

    const [report] = await reports();
    expect(checkOf(report, 'token_deployed')?.status).toBe('FAIL');
    expect(checkOf(report, 'token_deployed')?.detail).toContain('PENDING');
  });

  it('names a token standard that cannot be collateral', async () => {
    asset.tokenStandard = 'SANOVA_KYC';
    asset.readyToBorrow = false;

    const [report] = await reports();
    expect(checkOf(report, 'token_standard')?.status).toBe('FAIL');
    expect(checkOf(report, 'ready_to_borrow')?.detail).toContain('token_standard');
  });
});
