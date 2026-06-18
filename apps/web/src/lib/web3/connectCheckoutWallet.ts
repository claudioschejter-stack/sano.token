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

type BinanceWindow = Window & {
  binancew3w?: { ethereum?: unknown };
  BinanceChain?: unknown;
};

export function hasBinanceWeb3Provider(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const w = window as BinanceWindow;
  return Boolean(w.binancew3w?.ethereum ?? w.BinanceChain);
}

export function shouldPreferWalletConnectForCheckout(optionId: CheckoutWalletOptionId): boolean {
  if (optionId === 'binance_usdc') {
    return !hasBinanceWeb3Provider();
  }
  if (isMobileDevice() && optionId === 'electronic_wallet') {
    return true;
  }
  return false;
}

export function resolveCheckoutWalletConnector(
  optionId: CheckoutWalletOptionId,
  connectors: readonly Connector[],
  preferWalletConnect = shouldPreferWalletConnectForCheckout(optionId)
): Connector | undefined {
  if (preferWalletConnect) {
    return pickWalletConnectConnector(connectors);
  }

  switch (optionId) {
    case 'electronic_wallet':
      return pickCoinbaseConnector(connectors);
    case 'metamask_usdc':
      return pickMetaMaskConnector(connectors);
    case 'binance_usdc':
      return hasBinanceWeb3Provider()
        ? pickBinanceConnector(connectors)
        : pickWalletConnectConnector(connectors) ?? pickBinanceConnector(connectors);
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

  const mobile = isMobileDevice();
  const result = await connectAsync(mobile ? { connector } : { connector, chainId: BASE_CHAIN_ID });
  const account = result.accounts[0] ?? null;

  if (account && switchChainAsync) {
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

async function connectWithPreference(
  optionId: CheckoutWalletOptionId,
  connectors: readonly Connector[],
  preferWalletConnect: boolean,
  session: Omit<ConnectCheckoutWalletParams, 'optionId' | 'connectors'>
): Promise<string | null> {
  const connector = resolveCheckoutWalletConnector(optionId, connectors, preferWalletConnect);
  if (!connector) {
    return null;
  }
  return connectWalletSession({ connector, ...session });
}

export async function connectCheckoutWallet(params: ConnectCheckoutWalletParams): Promise<string | null> {
  const preferWc = shouldPreferWalletConnectForCheckout(params.optionId);
  const session = {
    connectAsync: params.connectAsync,
    disconnectAsync: params.disconnectAsync,
    isConnected: params.isConnected,
    activeConnectorId: params.activeConnectorId,
    resetConnect: params.resetConnect,
    switchChainAsync: params.switchChainAsync
  };

  try {
    return await connectWithPreference(params.optionId, params.connectors, preferWc, session);
  } catch (primaryError) {
    const wc = pickWalletConnectConnector(params.connectors);
    if (!wc || preferWc) {
      throw primaryError;
    }
    try {
      return await connectWithPreference(params.optionId, params.connectors, true, session);
    } catch {
      throw primaryError;
    }
  }
}
