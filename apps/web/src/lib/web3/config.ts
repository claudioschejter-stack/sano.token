import { cookieStorage, createConfig, createStorage, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet, walletConnect } from '@wagmi/connectors';
import {
  isWalletConnectConfigured,
  walletConnectMetadata,
  walletConnectProjectId
} from './walletConnect';

export {
  isWalletConnectConfigured,
  walletConnectAllowedOrigins,
  walletConnectProjectId
} from './walletConnect';

const baseRpcUrl =
  process.env.NEXT_PUBLIC_BASE_RPC_URL?.trim() ||
  process.env.BASE_RPC_URL?.trim() ||
  'https://mainnet.base.org';

/** Base mainnet — production RWA vault + USDC checkout. */
export const supportedChains = [base] as const;

const connectors = [
  coinbaseWallet({
    appName: walletConnectMetadata.name,
    /** Prioriza Smart Wallet de Coinbase. */
    preference: 'smartWalletOnly'
  }),
  ...(isWalletConnectConfigured
    ? [
        walletConnect({
          projectId: walletConnectProjectId,
          metadata: walletConnectMetadata,
          showQrModal: false
        })
      ]
    : [])
];

export const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors,
  transports: {
    [base.id]: http(baseRpcUrl)
  },
  ssr: true,
  storage: createStorage({
    storage: cookieStorage
  })
});

export const BASE_CHAIN_ID = base.id;

export const BASE_USDC_ADDRESS =
  (process.env.NEXT_PUBLIC_BASE_USDC_TOKEN_ADDRESS?.trim() ||
    process.env.BASE_USDC_TOKEN_ADDRESS?.trim() ||
    '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') as `0x${string}`;
