import type { AdminAssetRecord } from './assetsService';
import type { CollateralProtocol, TokenStandard } from './launchTypes';
import { isVaultTokenStandard } from './vaultStandards';
import { PLUME_MAINNET_CHAIN_ID } from '../blockchain/supportedChains';

export type EmissionProfileId =
  | 'BASE_MORPHO_4626'
  | 'BASE_FULL_4626'
  | 'PLUME_RWA_7540'
  | 'CUSTOM';

export type EmissionProfile = {
  id: EmissionProfileId;
  labelKey: string;
  descriptionKey: string;
  chainId: number;
  chainLabelKey: string;
  tokenStandard: TokenStandard;
  collateralProtocols: CollateralProtocol[];
  autoCollateral: boolean;
};

const BASE_CHAIN_ID = 8453;

export const EMISSION_PROFILES: Record<Exclude<EmissionProfileId, 'CUSTOM'>, EmissionProfile> = {
  BASE_MORPHO_4626: {
    id: 'BASE_MORPHO_4626',
    labelKey: 'emissionProfileBaseMorpho',
    descriptionKey: 'emissionProfileBaseMorphoDesc',
    chainId: BASE_CHAIN_ID,
    chainLabelKey: 'emissionChainBase',
    tokenStandard: 'ERC4626',
    collateralProtocols: ['MORPHO'],
    autoCollateral: true
  },
  BASE_FULL_4626: {
    id: 'BASE_FULL_4626',
    labelKey: 'emissionProfileBaseFull',
    descriptionKey: 'emissionProfileBaseFullDesc',
    chainId: BASE_CHAIN_ID,
    chainLabelKey: 'emissionChainBase',
    tokenStandard: 'ERC4626',
    collateralProtocols: ['MORPHO', 'CENTRIFUGE'],
    autoCollateral: true
  },
  PLUME_RWA_7540: {
    id: 'PLUME_RWA_7540',
    labelKey: 'emissionProfilePlumeRwa',
    descriptionKey: 'emissionProfilePlumeRwaDesc',
    chainId: PLUME_MAINNET_CHAIN_ID,
    chainLabelKey: 'emissionChainPlume',
    tokenStandard: 'ERC7540',
    collateralProtocols: ['MORPHO', 'CENTRIFUGE'],
    autoCollateral: true
  }
};

/** Profiles offered in admin launch UI (Base + Morpho only). */
export const AUTOMATIC_EMISSION_PROFILE_IDS: Array<Exclude<EmissionProfileId, 'CUSTOM'>> = [
  'BASE_MORPHO_4626'
];

/** Legacy profiles kept for inferring existing assets — not shown as defaults. */
export const LEGACY_EMISSION_PROFILE_IDS: Array<Exclude<EmissionProfileId, 'CUSTOM'>> = [
  'BASE_FULL_4626',
  'PLUME_RWA_7540'
];

export const DEFAULT_EMISSION_PROFILE_ID: Exclude<EmissionProfileId, 'CUSTOM'> = 'BASE_MORPHO_4626';

export function getEmissionProfile(
  profileId: EmissionProfileId
): EmissionProfile | null {
  if (profileId === 'CUSTOM') {
    return null;
  }
  return EMISSION_PROFILES[profileId];
}

export function collateralFlagsFromProtocols(protocols: CollateralProtocol[]): {
  collateralCentrifuge: boolean;
  collateralSky: boolean;
  collateralMorpho: boolean;
  collateralAaveHorizon: boolean;
  collateralMaple: boolean;
  collateralClearpool: boolean;
  collateralFigure: boolean;
} {
  const set = new Set(protocols);
  return {
    collateralCentrifuge: set.has('CENTRIFUGE'),
    collateralSky: set.has('SKY'),
    collateralMorpho: set.has('MORPHO'),
    collateralAaveHorizon: set.has('AAVE_HORIZON'),
    collateralMaple: set.has('MAPLE'),
    collateralClearpool: set.has('CLEARPOOL'),
    collateralFigure: set.has('FIGURE')
  };
}

export function inferEmissionProfileFromAsset(asset: AdminAssetRecord): EmissionProfileId {
  if (!isVaultTokenStandard(asset.tokenStandard)) {
    return 'CUSTOM';
  }

  const chainId = asset.chainId ?? BASE_CHAIN_ID;
  const protocols = new Set(asset.collateralTargets.map((target) => target.protocol));

  if (asset.tokenStandard === 'ERC7540' && chainId === PLUME_MAINNET_CHAIN_ID) {
    return 'PLUME_RWA_7540';
  }

  if (asset.tokenStandard === 'ERC4626' && chainId === BASE_CHAIN_ID) {
    if (protocols.has('CENTRIFUGE') && protocols.has('MORPHO')) {
      return 'BASE_FULL_4626';
    }
    if (protocols.has('MORPHO')) {
      return 'BASE_MORPHO_4626';
    }
  }

  return 'CUSTOM';
}

export function autoCollateralProtocolsForAsset(asset: AdminAssetRecord): CollateralProtocol[] {
  const profileId = inferEmissionProfileFromAsset(asset);
  const profile = getEmissionProfile(profileId);
  if (profile?.autoCollateral) {
    return profile.collateralProtocols;
  }

  return asset.collateralTargets
    .map((target) => target.protocol)
    .filter((protocol): protocol is CollateralProtocol => protocol === 'MORPHO');
}

export function ensureVaultCollateralProtocols(
  protocols: CollateralProtocol[] | undefined,
  tokenStandard: TokenStandard
): CollateralProtocol[] {
  if (!isVaultTokenStandard(tokenStandard)) {
    return protocols ?? [];
  }

  const set = new Set(protocols ?? []);
  set.add('MORPHO');
  return Array.from(set);
}
