import type { BlockchainEventPayload } from '../blockchain/blockchain-event.payload';

export const DIVIDEND_PROCESSED_EVENT = 'dividend.processed' as const;

export type DividendProcessedEvent = BlockchainEventPayload &
  Readonly<{
    distributionId: string;
    assetId: string;
    receivedAt: string;
  }>;

export type FinanceStreamMessage = Readonly<{
  type: 'DIVIDEND_PROCESSED';
  payload: DividendProcessedEvent;
}>;
