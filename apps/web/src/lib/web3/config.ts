import { cookieStorage, createConfig, createStorage, http } from 'wagmi';
import { base, polygon } from 'wagmi/chains';
import { getWagmiConnectorV2 } from '@binance/w3w-wagmi-connector-v2';
import { coinbaseWallet, metaMask, walletConnect } from '@wagmi/connectors';
import { isWalletConnectConfigured, walletConnectMetadata, walletConnectProjectId } from './walletConnect';

export { isWalletConnectConfigured, walletConnectAllowedOrigins } from './walletConnect';

const baseRpcUrl =
  process.env.NEXT_PUBLIC_BASE_RPC_URL?.trim() ||
  process.env.BASE_RPC_URL?.trim() ||
  'https://mainnet.base.org';

const polygonRpcUrl =
  process.env.NEXT_PUBLIC_POLYGON_RPC_URL?.trim() ||
  process.env.POLYGON_RPC_URL?.trim() ||
  'https://polygon-rpc.com';

export const supportedChains = [base, polygon] as const;

const createBinanceConnector = getWagmiConnectorV2();

const connectors = [
  coinbaseWallet({
    appName: walletConnectMetadata.name,
    appLogoUrl: walletConnectMetadata.icons[0],
    preference: 'all'
  }),
  metaMask({
    dappMetadata: {
      name: walletConnectMetadata.name,
      url: walletConnectMetadata.url
    }
  }),
  createBinanceConnector(),
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
  chains: supportedChains,
  connectors,
  transports: {
    [base.id]: http(baseRpcUrl),
    [polygon.id]: http(polygonRpcUrl)
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
