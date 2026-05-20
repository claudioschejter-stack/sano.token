export type BlockchainEventPayload = Readonly<{
  txHash: string;
  amount: number;
  token: string;
  recipient: string;
}>;
