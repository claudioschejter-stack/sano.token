import {
  AbstractSigner,
  type Provider,
  type TransactionRequest,
  type TransactionResponse,
  type TypedDataDomain,
  type TypedDataField
} from 'ethers';
import { privySponsorServerTransactions } from './config';
import { privySendTransaction } from './walletRpcApi';

/** Ethers signer backed by Privy server wallet RPC (no local private key). */
export class PrivyServerWalletSigner extends AbstractSigner {
  constructor(
    private readonly walletId: string,
    private readonly walletAddress: string,
    provider: Provider,
    private readonly chainId: number
  ) {
    super(provider);
  }

  async getAddress(): Promise<string> {
    return this.walletAddress;
  }

  connect(provider: Provider): PrivyServerWalletSigner {
    return new PrivyServerWalletSigner(this.walletId, this.walletAddress, provider, this.chainId);
  }

  async signTransaction(_tx: TransactionRequest): Promise<string> {
    throw new Error('PRIVY_SIGN_TRANSACTION_UNSUPPORTED');
  }

  async signMessage(_message: string | Uint8Array): Promise<string> {
    throw new Error('PRIVY_SIGN_MESSAGE_UNSUPPORTED');
  }

  async signTypedData(
    _domain: TypedDataDomain,
    _types: Record<string, TypedDataField[]>,
    _value: Record<string, unknown>
  ): Promise<string> {
    throw new Error('PRIVY_SIGN_TYPED_DATA_UNSUPPORTED');
  }

  async sendTransaction(tx: TransactionRequest): Promise<TransactionResponse> {
    if (!tx.to) {
      throw new Error('PRIVY_SEND_TRANSACTION_TO_REQUIRED');
    }

    const send = (sponsor: boolean) =>
      privySendTransaction({
        walletId: this.walletId,
        chainId: this.chainId,
        to: String(tx.to),
        data: typeof tx.data === 'string' ? tx.data : tx.data ? String(tx.data) : '0x',
        value: typeof tx.value === 'bigint' ? tx.value : tx.value ? BigInt(tx.value) : 0n,
        sponsor
      });

    // Server wallets rarely hold ETH; try app gas credits first, then own balance.
    let hash: string;
    if (privySponsorServerTransactions()) {
      try {
        hash = await send(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (!/sponsor|credit|gas/i.test(message)) {
          throw error;
        }
        console.warn('[PrivyServerWalletSigner] sponsored send failed, retrying unsponsored', message.slice(0, 200));
        hash = await send(false);
      }
    } else {
      hash = await send(false);
    }

    const startedAt = Date.now();
    while (Date.now() - startedAt < 60_000) {
      const response = await this.provider!.getTransaction(hash);
      if (response) {
        return response;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error(`PRIVY_TX_NOT_FOUND:${hash}`);
  }
}
