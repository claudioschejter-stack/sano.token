import { cookieStorage, createConfig, createStorage, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet, walletConnect } from '@wagmi/connectors';
import { isWalletConnectConfigured, walletConnectMetadata, walletConnectProjectId } from './walletConnect';

export { isWalletConnectConfigured, walletConnectAllowedOrigins } from './walletConnect';

const baseRpcUrl =
  process.env.NEXT_PUBLIC_BASE_RPC_URL?.trim() ||
  process.env.BASE_RPC_URL?.trim() ||
  'https://mainnet.base.org';

export const supportedChains = [base] as const;

const connectors = [
  coinbaseWallet({
    appName: walletConnectMetadata.name,
    preference: 'smartWalletOnly'
  }),
  ...(isWalletConnectConfigured
    ? [
        walletConnect({
          projectId: walletConnectProjectId,
          metadata: walletConnectMetadata,
          showQrModal: true,
          qrModalOptions: {
            themeMode: 'light',
            enableExplorer: true
          }
        })
      ]
    : [])
];

const wagmiStorage = createStorage({
  storage: cookieStorage
});

export const wagmiConfig = createConfig({
  chains: [base],
  connectors,
  transports: {
    [base.id]: http(baseRpcUrl)
  },
  ssr: true,
  storage: wagmiStorage
});

export const BASE_CHAIN_ID = base.id;

export const BASE_USDC_ADDRESS =
  process.env.NEXT_PUBLIC_BASE_USDC_ADDRESS?.trim() ||
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

export const PLATFORM_TREASURY_ADDRESS =
  process.env.NEXT_PUBLIC_TOKEN_TREASURY_ADDRESS?.trim() ||
  process.env.TOKEN_TREASURY_ADDRESS?.trim() ||
  '';
