import { describe, expect, it } from 'vitest';
import {
  AUTOMATIC_EMISSION_PROFILE_IDS,
  collateralFlagsFromProtocols,
  DEFAULT_EMISSION_PROFILE_ID,
  getEmissionProfile,
  inferEmissionProfileFromAsset,
  type EmissionProfileId
} from './emissionProfiles';
import type { AdminAssetRecord } from './assetsService';

function minimalAsset(overrides: Partial<AdminAssetRecord> = {}): AdminAssetRecord {
  return {
    id: 'test-project',
    title: 'Test',
    description: 'Desc',
    location: 'AR',
    latitude: null,
    longitude: null,
    image: null,
    mediaGallery: [],
    contracts: { trust: null, purchase: null, lease: null, smartContract: null },
    tokenName: 'Test',
    tokenSymbol: 'TST',
    tokenStandard: 'ERC4626',
    tokenInstrumentType: 'EQUITY',
    maturityDate: null,
    equitySharePercent: 100,
    tokenDeployStatus: 'NOT_REQUESTED',
    collateralTargets: [{ protocol: 'MORPHO', status: 'READY', readinessScore: 100, missingRequirements: [] }],
    deploymentEvents: [],
    centrifugeChecklist: {
      spvDocumented: false,
      legalAuditDone: false,
      navOracleConfigured: false,
      kycPolicyActive: false,
      liquidityPlanDocumented: false,
      smartContractVerified: false
    },
    spvEntityName: null,
    navOracleUrl: null,
    totalTokens: 1000,
    availableTokens: 1000,
    pricePerToken: 1,
    targetYield: 9,
    fiscalRegime: 'LEY_19640',
    jurisdiction: 'AR',
    contractAddress: null,
    vaultAddress: null,
    vaultFundingStatus: 'NOT_REQUIRED',
    vaultFundingAmount: null,
    vaultFundingTxHash: null,
    vaultFundingError: null,
    chainId: 8453,
    isActive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

describe('emissionProfiles', () => {
  it('exposes three automatic profiles', () => {
    expect(AUTOMATIC_EMISSION_PROFILE_IDS).toHaveLength(3);
    expect(DEFAULT_EMISSION_PROFILE_ID).toBe('PLUME_RWA_7540');
  });

  it('maps Plume ERC-7540 asset to PLUME_RWA_7540', () => {
    const asset = minimalAsset({
      tokenStandard: 'ERC7540',
      chainId: 98866,
      collateralTargets: [
        { protocol: 'MORPHO', status: 'READY', readinessScore: 100, missingRequirements: [] },
        { protocol: 'CENTRIFUGE', status: 'READY', readinessScore: 100, missingRequirements: [] }
      ]
    });
    expect(inferEmissionProfileFromAsset(asset)).toBe('PLUME_RWA_7540');
  });

  it('maps Base ERC-4626 + Morpho + Centrifuge to BASE_FULL_4626', () => {
    const asset = minimalAsset({
      collateralTargets: [
        { protocol: 'MORPHO', status: 'READY', readinessScore: 100, missingRequirements: [] },
        { protocol: 'CENTRIFUGE', status: 'READY', readinessScore: 100, missingRequirements: [] }
      ]
    });
    expect(inferEmissionProfileFromAsset(asset)).toBe('BASE_FULL_4626');
  });

  it('maps Base ERC-4626 + Morpho only to BASE_MORPHO_4626', () => {
    const asset = minimalAsset();
    expect(inferEmissionProfileFromAsset(asset)).toBe('BASE_MORPHO_4626');
  });

  it('returns CUSTOM for non-vault standards', () => {
    const asset = minimalAsset({ tokenStandard: 'SANOVA_KYC' });
    expect(inferEmissionProfileFromAsset(asset)).toBe('CUSTOM');
  });

  it('builds collateral flags from profile protocols', () => {
    const profile = getEmissionProfile('PLUME_RWA_7540');
    expect(profile).not.toBeNull();
    const flags = collateralFlagsFromProtocols(profile!.collateralProtocols);
    expect(flags.collateralMorpho).toBe(true);
    expect(flags.collateralCentrifuge).toBe(true);
    expect(flags.collateralMaple).toBe(false);
  });

  it('resolves profile metadata for each automatic id', () => {
    for (const id of AUTOMATIC_EMISSION_PROFILE_IDS) {
      const profile = getEmissionProfile(id as EmissionProfileId);
      expect(profile?.id).toBe(id);
      expect(profile?.autoCollateral).toBe(true);
      expect(profile?.collateralProtocols.length).toBeGreaterThan(0);
    }
  });
});
