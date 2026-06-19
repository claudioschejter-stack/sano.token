import {
  AbstractSigner,
  type Provider,
  type TransactionRequest,
  type TransactionResponse
} from 'ethers';
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

  async sendTransaction(tx: TransactionRequest): Promise<TransactionResponse> {
    if (!tx.to) {
      throw new Error('PRIVY_SEND_TRANSACTION_TO_REQUIRED');
    }

    const hash = await privySendTransaction({
      walletId: this.walletId,
      chainId: this.chainId,
      to: String(tx.to),
      data: typeof tx.data === 'string' ? tx.data : tx.data ? String(tx.data) : '0x',
      value: typeof tx.value === 'bigint' ? tx.value : tx.value ? BigInt(tx.value) : 0n
    });

    const response = await this.provider!.getTransaction(hash);
    if (!response) {
      throw new Error(`PRIVY_TX_NOT_FOUND:${hash}`);
    }

    return response;
  }
}
