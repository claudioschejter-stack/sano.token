import { cookieStorage, createConfig, createStorage, http } from 'wagmi';
import { base, polygon } from 'wagmi/chains';
import { getWagmiConnectorV2 } from '@binance/w3w-wagmi-connector-v2';
import { coinbaseWallet, metaMask, walletConnect } from '@wagmi/connectors';
import { isWalletConnectConfigured, walletConnectMetadata, walletConnectProjectId } from './walletConnect';
import { MOBILE_DIRECT_WALLET_CONNECT_ID } from './mobileWalletDeepLink';

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

function createMobileDirectWalletConnect() {
  const factory = walletConnect({
    projectId: walletConnectProjectId,
    metadata: walletConnectMetadata,
    showQrModal: false,
    customStoragePrefix: 'sanova-mobile-direct',
    isNewChainsStale: false
  });

  return (config: Parameters<typeof factory>[0]) => {
    const connector = factory(config);
    return {
      ...connector,
      id: MOBILE_DIRECT_WALLET_CONNECT_ID,
      name: 'WalletConnect Direct'
    };
  };
}

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
    },
    useDeeplink: false
  }),
  createBinanceConnector(),
  ...(isWalletConnectConfigured
    ? [
        createMobileDirectWalletConnect(),
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

type WagmiConfigMessage = { type: string; data?: unknown };

/** WalletConnect emits pairing URIs through wagmi's internal config emitter. */
export function onWagmiConfigMessage(listener: (message: WagmiConfigMessage) => void): () => void {
  const config = wagmiConfig as typeof wagmiConfig & {
    emitter: {
      on: (event: 'message', fn: (message: WagmiConfigMessage) => void) => () => void;
    };
  };
  return config.emitter.on('message', listener);
}

export const BASE_CHAIN_ID = base.id;

export const BASE_USDC_ADDRESS =
  process.env.NEXT_PUBLIC_BASE_USDC_ADDRESS?.trim() ||
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

export const PLATFORM_TREASURY_ADDRESS =
  process.env.NEXT_PUBLIC_TOKEN_TREASURY_ADDRESS?.trim() ||
  process.env.TOKEN_TREASURY_ADDRESS?.trim() ||
  '';
