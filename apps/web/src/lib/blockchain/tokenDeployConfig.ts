import { resolveChainId } from './explorerUrls';

export function isSanovaTokenDeployConfigured(): boolean {
  const privateKey = (process.env.TOKEN_DEPLOY_PRIVATE_KEY ?? process.env.PRIVATE_KEY)?.trim();
  const rpcUrl = (process.env.BASE_RPC_URL ?? process.env.POLYGON_RPC_URL)?.trim();
  return Boolean(privateKey && rpcUrl);
}

export function getTokenDeployStatus() {
  const privateKey = (process.env.TOKEN_DEPLOY_PRIVATE_KEY ?? process.env.PRIVATE_KEY)?.trim();
  const thirdweb = process.env.THIRDWEB_SECRET_KEY?.trim();

  return {
    configured: isSanovaTokenDeployConfigured() || Boolean(thirdweb && privateKey),
    sanovaDirect: isSanovaTokenDeployConfigured(),
    thirdweb: Boolean(thirdweb && privateKey),
    chainId: resolveChainId(),
    autoDeployDefault: isSanovaTokenDeployConfigured()
  };
}
