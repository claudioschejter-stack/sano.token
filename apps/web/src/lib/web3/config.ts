import { cookieStorage, createConfig, createStorage, http } from 'wagmi';
import { base, polygon } from 'wagmi/chains';
import { getWagmiConnectorV2 } from '@binance/w3w-wagmi-connector-v2';
import { coinbaseWallet, metaMask, walletConnect } from '@wagmi/connectors';
import type { WalletConnectParameters } from '@wagmi/connectors';
import { isWalletConnectConfigured, walletConnectMetadata, walletConnectProjectId } from './walletConnect';
import {
  ANDROID_COINBASE_WC_CONNECTOR_ID,
  ANDROID_METAMASK_WC_CONNECTOR_ID,
  MOBILE_DIRECT_WALLET_CONNECT_ID,
  WC_REGISTRY_COINBASE_WALLET_ID,
  WC_REGISTRY_METAMASK_WALLET_ID
} from './walletConnectRegistry';

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

function wrapWalletConnectConnector(
  id: string,
  name: string,
  parameters: WalletConnectParameters
) {
  const factory = walletConnect(parameters);

  return (config: Parameters<typeof factory>[0]) => {
    const connector = factory(config);
    return {
      ...connector,
      id,
      name
    };
  };
}

function createMobileDirectWalletConnect() {
  return wrapWalletConnectConnector(MOBILE_DIRECT_WALLET_CONNECT_ID, 'WalletConnect Direct', {
    projectId: walletConnectProjectId,
    metadata: walletConnectMetadata,
    showQrModal: false,
    customStoragePrefix: 'sanova-mobile-direct',
    isNewChainsStale: false
  });
}

function createAndroidCoinbaseWalletConnect() {
  return wrapWalletConnectConnector(ANDROID_COINBASE_WC_CONNECTOR_ID, 'Coinbase Wallet (Android)', {
    projectId: walletConnectProjectId,
    metadata: walletConnectMetadata,
    showQrModal: true,
    customStoragePrefix: 'sanova-android-coinbase',
    isNewChainsStale: false,
    qrModalOptions: {
      themeMode: 'light',
      enableExplorer: true,
      explorerRecommendedWalletIds: [WC_REGISTRY_COINBASE_WALLET_ID]
    }
  });
}

function createAndroidMetaMaskWalletConnect() {
  return wrapWalletConnectConnector(ANDROID_METAMASK_WC_CONNECTOR_ID, 'MetaMask (Android)', {
    projectId: walletConnectProjectId,
    metadata: walletConnectMetadata,
    showQrModal: true,
    customStoragePrefix: 'sanova-android-metamask',
    isNewChainsStale: false,
    qrModalOptions: {
      themeMode: 'light',
      enableExplorer: true,
      explorerRecommendedWalletIds: [WC_REGISTRY_METAMASK_WALLET_ID]
    }
  });
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
        createAndroidCoinbaseWalletConnect(),
        createAndroidMetaMaskWalletConnect(),
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
