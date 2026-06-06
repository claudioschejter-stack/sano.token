/* eslint-disable @typescript-eslint/no-require-imports */
const tokenAbi = require('@sanova/contracts/abi/sanova-asset-token.abi') as {
  SANOVA_ASSET_TOKEN_ABI: readonly string[];
};
const escrowAbi = require('@sanova/contracts/abi/escrow-lending-pool.abi') as {
  ESCROW_LENDING_POOL_ABI: readonly string[];
};

export const ERC3643_ASSET_ABI = tokenAbi.SANOVA_ASSET_TOKEN_ABI;
export const ESCROW_LENDING_POOL_ABI = escrowAbi.ESCROW_LENDING_POOL_ABI;
