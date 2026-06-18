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

export function hasBinanceWeb3Provider(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return Boolean((window as Window & { BinanceChain?: unknown }).BinanceChain);
}

export function shouldPreferWalletConnectForCheckout(optionId: CheckoutWalletOptionId): boolean {
  if (!isMobileDevice()) {
    return optionId === 'binance_usdc' && !hasBinanceWeb3Provider();
  }
  if (optionId === 'binance_usdc') {
    return !hasBinanceWeb3Provider();
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

type ConnectCheckoutWalletParams = {
  optionId: CheckoutWalletOptionId;
  connectors: readonly Connector[];
  connectAsync: (args: { connector: Connector; chainId?: number }) => Promise<{ accounts: readonly string[] }>;
  disconnectAsync: () => Promise<void>;
  isConnected: boolean;
  activeConnectorId?: string;
  resetConnect?: () => void;
  switchChainAsync?: (args: { chainId: number }) => Promise<unknown>;
};

export async function connectCheckoutWallet({
  optionId,
  connectors,
  connectAsync,
  disconnectAsync,
  isConnected,
  activeConnectorId,
  resetConnect,
  switchChainAsync
}: ConnectCheckoutWalletParams): Promise<string | null> {
  const tryConnect = async (preferWalletConnect: boolean): Promise<string | null> => {
    const connector = resolveCheckoutWalletConnector(optionId, connectors, preferWalletConnect);
    if (!connector) {
      return null;
    }

    resetConnect?.();

    const sameConnector = isConnected && activeConnectorId === connector.id;
    if (isConnected && !sameConnector) {
      await disconnectAsync();
    }

    const mobile = isMobileDevice();
    const result = await connectAsync(
      mobile ? { connector } : { connector, chainId: BASE_CHAIN_ID }
    );
    const account = result.accounts[0] ?? null;

    if (account && mobile && switchChainAsync) {
      try {
        await switchChainAsync({ chainId: BASE_CHAIN_ID });
      } catch {
        /* bridge flow can start from Polygon */
      }
    }

    return account;
  };

  try {
    return await tryConnect(shouldPreferWalletConnectForCheckout(optionId));
  } catch (primaryError) {
    const wc = pickWalletConnectConnector(connectors);
    const usedWc = shouldPreferWalletConnectForCheckout(optionId);
    if (!isMobileDevice() || !wc || usedWc) {
      throw primaryError;
    }

    try {
      if (isConnected) {
        await disconnectAsync();
      }
      return await tryConnect(true);
    } catch {
      throw primaryError;
    }
  }
}
