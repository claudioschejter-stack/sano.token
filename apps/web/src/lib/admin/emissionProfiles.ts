import type { AdminAssetRecord } from './assetsService';
import type { CollateralProtocol, TokenStandard } from './launchTypes';
import { isVaultTokenStandard } from './vaultStandards';
import { BASE_MAINNET_CHAIN_ID } from '../blockchain/supportedChains';

export type EmissionProfileId = 'BASE_MORPHO_4626' | 'CUSTOM';

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

export const EMISSION_PROFILES: Record<Exclude<EmissionProfileId, 'CUSTOM'>, EmissionProfile> = {
  BASE_MORPHO_4626: {
    id: 'BASE_MORPHO_4626',
    labelKey: 'emissionProfileBaseMorpho',
    descriptionKey: 'emissionProfileBaseMorphoDesc',
    chainId: BASE_MAINNET_CHAIN_ID,
    chainLabelKey: 'emissionChainBase',
    tokenStandard: 'ERC4626',
    collateralProtocols: ['MORPHO'],
    autoCollateral: true
  }
};

export const AUTOMATIC_EMISSION_PROFILE_IDS: Array<Exclude<EmissionProfileId, 'CUSTOM'>> = [
  'BASE_MORPHO_4626'
];

export const LEGACY_EMISSION_PROFILE_IDS: Array<Exclude<EmissionProfileId, 'CUSTOM'>> = [];

export const DEFAULT_EMISSION_PROFILE_ID: Exclude<EmissionProfileId, 'CUSTOM'> = 'BASE_MORPHO_4626';

export function getEmissionProfile(profileId: EmissionProfileId): EmissionProfile | null {
  if (profileId === 'CUSTOM') {
    return null;
  }
  return EMISSION_PROFILES[profileId];
}

export function collateralFlagsFromProtocols(protocols: CollateralProtocol[]): {
  collateralMorpho: boolean;
} {
  return {
    collateralMorpho: protocols.includes('MORPHO')
  };
}

export function inferEmissionProfileFromAsset(asset: AdminAssetRecord): EmissionProfileId {
  if (!isVaultTokenStandard(asset.tokenStandard)) {
    return 'CUSTOM';
  }

  const chainId = asset.chainId ?? BASE_MAINNET_CHAIN_ID;
  const hasMorpho = asset.collateralTargets.some((target) => target.protocol === 'MORPHO');

  if (asset.tokenStandard === 'ERC4626' && chainId === BASE_MAINNET_CHAIN_ID && hasMorpho) {
    return 'BASE_MORPHO_4626';
  }

  return 'CUSTOM';
}

export function autoCollateralProtocolsForAsset(asset: AdminAssetRecord): CollateralProtocol[] {
  const profileId = inferEmissionProfileFromAsset(asset);
  const profile = getEmissionProfile(profileId);
  if (profile) {
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

  return ['MORPHO'];
}
