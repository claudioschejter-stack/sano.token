import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { ESCROW_LENDING_POOL_ABI } from '@sanova/blockchain';

@Injectable()
export class BlockchainWriterService {
  private readonly logger = new Logger(BlockchainWriterService.name);

  constructor(private readonly config: ConfigService) {}

  async executeDistributeYieldAndAmortize(borrower: string, yieldAmount: bigint) {
    const rpcUrl =
      this.config.get<string>('NEXT_PUBLIC_RPC_URL') ??
      this.config.get<string>('BLOCKCHAIN_RPC_URL') ??
      this.config.get<string>('POLYGON_RPC_URL') ??
      this.config.get<string>('BASE_RPC_URL');

    const escrowAddress = this.config.get<string>('ESCROW_LENDING_POOL_ADDRESS');
    const privateKey = this.config.get<string>('TREASURY_PRIVATE_KEY') ?? this.config.get<string>('PRIVATE_KEY');

    if (!rpcUrl || !escrowAddress || !privateKey) {
      this.logger.warn(
        `Skipping on-chain yield distribution for ${borrower}. Missing RPC, escrow address, or treasury private key.`
      );

      return {
        status: 'SKIPPED_CONFIGURATION',
        borrower,
        yieldAmount: yieldAmount.toString()
      };
    }

    const provider = new JsonRpcProvider(rpcUrl);

    try {
      const signer = new Wallet(privateKey, provider);
      const escrow = new Contract(escrowAddress, ESCROW_LENDING_POOL_ABI, signer);
      const tx = await escrow.distributeYieldAndAmortize(borrower, yieldAmount);
      const receipt = await tx.wait();

      return {
        status: 'SUBMITTED',
        borrower,
        yieldAmount: yieldAmount.toString(),
        txHash: receipt?.hash ?? tx.hash
      };
    } finally {
      provider.destroy();
    }
  }
}
