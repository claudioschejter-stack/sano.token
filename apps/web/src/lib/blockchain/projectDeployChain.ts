import { resolveChainId } from './deployAssetToken';

/** Prefer per-project chain when set; otherwise fall back to server deploy env. */
export function resolveProjectDeployChainId(projectChainId?: number | null): number {
  if (projectChainId != null && Number.isInteger(projectChainId) && projectChainId > 0) {
    return projectChainId;
  }
  return resolveChainId();
}
