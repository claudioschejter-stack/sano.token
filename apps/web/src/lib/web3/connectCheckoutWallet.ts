import type { Connector } from 'wagmi';
import { isMobileDevice } from '../mobile/deviceConfig';
import { BASE_CHAIN_ID } from './config';
import {
  pickBinanceConnector,
  pickCoinbaseConnector,
  pickMetaMaskConnector,
  pickWalletConnectConnector,
  type CheckoutWalletOptionId
} from './walletConnectors';

export function isWalletConnectConnector(connector: Connector): boolean {
  return (
    connector.id === 'walletConnect' ||
    connector.type === 'walletConnect' ||
    connector.name.toLowerCase().includes('walletconnect')
  );
}

export function shouldPreferWalletConnectForCheckout(_optionId: CheckoutWalletOptionId): boolean {
  return false;
}

export function resolveCheckoutWalletConnector(
  optionId: CheckoutWalletOptionId,
  connectors: readonly Connector[]
): Connector | undefined {
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
};

export async function connectWalletSession({
  connector,
  connectAsync,
  disconnectAsync,
  isConnected,
  activeConnectorId,
  resetConnect,
  switchChainAsync
}: ConnectWalletSessionParams): Promise<string | null> {
  resetConnect?.();

  const sameConnector = isConnected && activeConnectorId === connector.id;
  if (isConnected && !sameConnector) {
    try {
      await disconnectAsync();
    } catch {
      /* continue with connect */
    }
  }

  const skipChainOnConnect = isMobileDevice() && isWalletConnectConnector(connector);
  const result = await connectAsync(
    skipChainOnConnect ? { connector } : { connector, chainId: BASE_CHAIN_ID }
  );
  const account = result.accounts[0] ?? null;

  if (account && switchChainAsync && !skipChainOnConnect) {
    try {
      await switchChainAsync({ chainId: BASE_CHAIN_ID });
    } catch {
      /* user may approve later or bridge from Polygon */
    }
  }

  return account;
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

  const session = {
    connectAsync: params.connectAsync,
    disconnectAsync: params.disconnectAsync,
    isConnected: params.isConnected,
    activeConnectorId: params.activeConnectorId,
    resetConnect: params.resetConnect,
    switchChainAsync: params.switchChainAsync
  };

  try {
    return await connectWalletSession({ connector, ...session });
  } catch (primaryError) {
    if (params.optionId !== 'metamask_usdc') {
      throw primaryError;
    }

    const wc = pickWalletConnectConnector(params.connectors);
    if (!wc) {
      throw primaryError;
    }

    try {
      return await connectWalletSession({ connector: wc, ...session });
    } catch {
      throw primaryError;
    }
  }
}
