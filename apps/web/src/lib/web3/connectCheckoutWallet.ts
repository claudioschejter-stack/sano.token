import type { Connector } from 'wagmi';
import { isAndroidDevice, isMobileDevice } from '../mobile/deviceConfig';
import { BASE_CHAIN_ID, onWagmiConfigMessage } from './config';
import { openMobileWalletWcDeepLink, type MobileWalletTarget } from './mobileWalletDeepLink';
import {
  pickAndroidCoinbaseWalletConnectConnector,
  pickAndroidMetaMaskWalletConnectConnector,
  pickBinanceConnector,
  pickCoinbaseConnector,
  pickDirectWalletConnectConnector,
  pickMetaMaskConnector,
  type CheckoutWalletOptionId
} from './walletConnectors';

export function isWalletConnectConnector(connector: Connector): boolean {
  return (
    connector.id === 'walletConnect' ||
    connector.type === 'walletConnect' ||
    connector.name.toLowerCase().includes('walletconnect')
  );
}

export function mobileWalletTargetForOption(
  optionId: CheckoutWalletOptionId
): MobileWalletTarget | null {
  if (!isMobileDevice() || isAndroidDevice()) {
    return null;
  }
  if (optionId === 'electronic_wallet') {
    return 'coinbase';
  }
  if (optionId === 'metamask_usdc') {
    return 'metamask';
  }
  return null;
}

export function shouldPreferWalletConnectForCheckout(_optionId: CheckoutWalletOptionId): boolean {
  return false;
}

export function resolveCheckoutWalletConnector(
  optionId: CheckoutWalletOptionId,
  connectors: readonly Connector[]
): Connector | undefined {
  if (isAndroidDevice()) {
    if (optionId === 'electronic_wallet') {
      return pickAndroidCoinbaseWalletConnectConnector(connectors);
    }
    if (optionId === 'metamask_usdc') {
      return pickAndroidMetaMaskWalletConnectConnector(connectors);
    }
  }

  const mobileTarget = mobileWalletTargetForOption(optionId);
  if (mobileTarget) {
    return pickDirectWalletConnectConnector(connectors);
  }

  switch (optionId) {
    case 'electronic_wallet':
      return pickCoinbaseConnector(connectors);
    case 'metamask_usdc':
      return pickMetaMaskConnector(connectors);
    case 'binance_usdc':
      return pickBinanceConnector(connectors);
    default:
      return undefined;
  }
}

type ConnectWalletSessionParams = {
  connector: Connector;
  connectAsync: (args: { connector: Connector; chainId?: number }) => Promise<{ accounts: readonly string[] }>;
  disconnectAsync: () => Promise<void>;
  isConnected: boolean;
  activeConnectorId?: string;
  resetConnect?: () => void;
  switchChainAsync?: (args: { chainId: number }) => Promise<unknown>;
  mobileTarget?: MobileWalletTarget | null;
};

export async function connectWalletSession({
  connector,
  connectAsync,
  disconnectAsync,
  isConnected,
  activeConnectorId,
  resetConnect,
  switchChainAsync,
  mobileTarget = null
}: ConnectWalletSessionParams): Promise<string | null> {
  const mobile = isMobileDevice();
  const useDirectMobileWallet = mobile && mobileTarget != null;

  if (!useDirectMobileWallet) {
    resetConnect?.();
  }

  const sameConnector = isConnected && activeConnectorId === connector.id;
  if (isConnected && !sameConnector) {
    try {
      await disconnectAsync();
    } catch {
      /* continue with connect */
    }
  } else if (useDirectMobileWallet && isConnected && sameConnector) {
    try {
      await disconnectAsync();
    } catch {
      /* stale WC session — start fresh pairing */
    }
  }

  const removeUriListener = useDirectMobileWallet
    ? onWagmiConfigMessage((message) => {
        if (message.type === 'display_uri' && typeof message.data === 'string') {
          openMobileWalletWcDeepLink(mobileTarget, message.data);
        }
      })
    : undefined;

  try {
    const result = await connectAsync(mobile ? { connector } : { connector, chainId: BASE_CHAIN_ID });
    const account = result.accounts[0] ?? null;

    if (account && switchChainAsync && !mobile) {
      try {
        await switchChainAsync({ chainId: BASE_CHAIN_ID });
      } catch {
        /* user may approve later or bridge from Polygon */
      }
    }

    return account;
  } finally {
    removeUriListener?.();
  }
}

type ConnectCheckoutWalletParams = {
  optionId: CheckoutWalletOptionId;
  connectors: readonly Connector[];
  connectAsync: ConnectWalletSessionParams['connectAsync'];
  disconnectAsync: ConnectWalletSessionParams['disconnectAsync'];
  isConnected: boolean;
  activeConnectorId?: string;
  resetConnect?: () => void;
  switchChainAsync?: ConnectWalletSessionParams['switchChainAsync'];
};

export async function connectCheckoutWallet(params: ConnectCheckoutWalletParams): Promise<string | null> {
  const connector = resolveCheckoutWalletConnector(params.optionId, params.connectors);
  if (!connector) {
    return null;
  }

  const mobileTarget = mobileWalletTargetForOption(params.optionId);

  return connectWalletSession({
    connector,
    connectAsync: params.connectAsync,
    disconnectAsync: params.disconnectAsync,
    isConnected: params.isConnected,
    activeConnectorId: params.activeConnectorId,
    resetConnect: params.resetConnect,
    switchChainAsync: params.switchChainAsync,
    mobileTarget
  });
}
