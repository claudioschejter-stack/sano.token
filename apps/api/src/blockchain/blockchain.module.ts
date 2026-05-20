import { Module } from '@nestjs/common';
import { BlockchainListenerService } from './blockchain-listener.service';
import { BlockchainWriterModule } from './blockchain-writer.module';

@Module({
  imports: [BlockchainWriterModule],
  providers: [BlockchainListenerService],
  exports: [BlockchainListenerService, BlockchainWriterModule]
})
export class BlockchainModule {}
