import { Module } from '@nestjs/common';
import { BlockchainWriterService } from './blockchain-writer.service';

@Module({
  providers: [BlockchainWriterService],
  exports: [BlockchainWriterService]
})
export class BlockchainWriterModule {}
