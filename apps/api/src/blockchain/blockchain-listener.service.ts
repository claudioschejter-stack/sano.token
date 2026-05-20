import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Contract, JsonRpcProvider, formatUnits } from 'ethers';
import { DIVIDEND_PROCESSED_EVENT, type DividendProcessedEvent } from '../events/dividend.events';
import { PrismaService } from '../prisma/prisma.service';
import { type BlockchainEventPayload } from './blockchain-event.payload';
import { ERC3643_ASSET_ABI } from './erc3643-asset.abi';
import { ESCROW_LENDING_POOL_ABI } from './escrow-lending-pool.abi';

export type { BlockchainEventPayload } from './blockchain-event.payload';

type EthersEventPayload = {
  log?: {
    transactionHash?: string;
    address?: string;
  };
};

type AssetTransferEvent = EthersEventPayload & {
  log: {
    transactionHash?: string;
    address: string;
  };
};

type KycEventPayload = EthersEventPayload & {
  log: {
    transactionHash?: string;
    address: string;
  };
};

type AssetSubscription = {
  address: string;
  contract: Contract;
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const DEFAULT_TOKEN_DECIMALS = 18;
const DEFAULT_RECONNECT_DELAY_MS = 5_000;
const DEFAULT_HEARTBEAT_MS = 30_000;
const USD_MICRO_UNITS = 1_000_000;
const LIQUIDATED_CASH_STATUS = 'LIQUIDATED_CASH';
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 200;

/** Campos adicionales enviados por el listener on-chain (no forman parte del contrato público). */
type DividendIngestionPayload = BlockchainEventPayload &
  Readonly<{
    amortizedAmountUsd?: number;
    yieldAmountUsd?: number;
    contractAddress?: string;
  }>;

type ClaimTransactionInput = {
  txHash?: string;
  eventName: string;
  contractAddress?: string;
  payload?: Prisma.InputJsonValue;
};

@Injectable()
export class BlockchainListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BlockchainListenerService.name);
  private provider?: JsonRpcProvider;
  private escrowContract?: Contract;
  private liquidityAssetAddress?: string;
  private assetSubscriptions: AssetSubscription[] = [];
  private reconnectTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  private isDestroyed = false;
  private isConnecting = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async onModuleInit() {
    await this.connectListeners();
  }

  private async connectListeners() {
    if (this.isDestroyed || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    const rpcUrl =
      this.config.get<string>('NEXT_PUBLIC_RPC_URL') ??
      this.config.get<string>('BLOCKCHAIN_RPC_URL') ??
      this.config.get<string>('POLYGON_RPC_URL') ??
      this.config.get<string>('BASE_RPC_URL');

    if (!rpcUrl) {
      this.logger.warn('Blockchain listener disabled. Set NEXT_PUBLIC_RPC_URL or BLOCKCHAIN_RPC_URL.');
      this.isConnecting = false;
      return;
    }

    try {
      this.teardownListeners();
      this.provider = new JsonRpcProvider(rpcUrl);
      await this.provider.getBlockNumber();

      await this.subscribeEscrowEvents();
      await this.subscribeAssetEvents();
      this.startHeartbeat();

      this.logger.log('Blockchain listener connected and synchronized.');
    } catch (error) {
      this.logger.error(`RPC listener connection failed: ${this.errorMessage(error)}`);
      this.scheduleReconnect();
    } finally {
      this.isConnecting = false;
    }
  }

  private async subscribeEscrowEvents() {
    const escrowAddress = this.config.get<string>('ESCROW_LENDING_POOL_ADDRESS');

    if (!this.provider || !escrowAddress) {
      this.logger.warn('Escrow listener disabled. Set ESCROW_LENDING_POOL_ADDRESS.');
      return;
    }

    this.escrowContract = new Contract(escrowAddress, ESCROW_LENDING_POOL_ABI, this.provider);
    this.liquidityAssetAddress = await this.escrowContract.liquidityAsset();

    this.escrowContract.on(
      'CollateralLocked',
      (borrower: string, amount: bigint, event: EthersEventPayload) => {
        this.logger.log(
          `CollateralLocked borrower=${borrower} amount=${amount.toString()} tx=${event.log?.transactionHash}`
        );
      }
    );

    this.escrowContract.on(
      'LoanIssued',
      (borrower: string, amount: bigint, event: EthersEventPayload) => {
        this.logger.log(
          `LoanIssued borrower=${borrower} amount=${amount.toString()} tx=${event.log?.transactionHash}`
        );
      }
    );

    this.escrowContract.on(
      'LoanRepaid',
      (borrower: string, amount: bigint, event: EthersEventPayload) => {
        this.logger.log(
          `LoanRepaid borrower=${borrower} amount=${amount.toString()} tx=${event.log?.transactionHash}`
        );
      }
    );

    this.escrowContract.on(
      'YieldDistributedAndAmortized',
      (
        borrower: string,
        yieldAmount: bigint,
        amortizedAmount: bigint,
        cashAmount: bigint,
        event: EthersEventPayload
      ) => {
        const txHash = event.log?.transactionHash;
        if (!txHash) {
          this.logger.warn('YieldDistributedAndAmortized ignored. Missing transaction hash.');
          return;
        }

        const cashAmountUsd = this.parseUsdMicroAmount(cashAmount);
        const amortizedAmountUsd = this.parseUsdMicroAmount(amortizedAmount);
        const yieldAmountUsd = this.parseUsdMicroAmount(yieldAmount);

        const ingestionPayload: DividendIngestionPayload = {
          txHash,
          recipient: borrower,
          amount: cashAmountUsd.toNumber(),
          token:
            this.liquidityAssetAddress ??
            this.config.get<string>('LIQUIDITY_ASSET_ADDRESS') ??
            'unknown',
          amortizedAmountUsd: amortizedAmountUsd.toNumber(),
          yieldAmountUsd: yieldAmountUsd.toNumber(),
          contractAddress:
            event.log?.address ?? this.config.get<string>('ESCROW_LENDING_POOL_ADDRESS') ?? 'unknown'
        };

        this.processDividendEvent(ingestionPayload);
      }
    );

    this.logger.log(`Listening to EscrowLendingPool at ${escrowAddress}`);
  }

  private async subscribeAssetEvents() {
    if (!this.provider) {
      return;
    }

    const assetAddresses = await this.resolveAssetTokenAddresses();

    if (!assetAddresses.length) {
      this.logger.warn('Asset token listener disabled. Set ERC3643_TOKEN_ADDRESSES or Project.contractAddress.');
      return;
    }

    this.assetSubscriptions = assetAddresses.map((address) => {
      const contract = new Contract(address, ERC3643_ASSET_ABI, this.provider);

      contract.on('Transfer', (from: string, to: string, value: bigint, event: AssetTransferEvent) => {
        void this.handleAssetTransfer({ tokenAddress: address, from, to, value, event });
      });

      contract.on('KycUpdated', (account: string, approved: boolean, event: KycEventPayload) => {
        void this.handleKycWhitelistEvent(account, approved, event, 'KycUpdated');
      });

      return { address, contract };
    });

    this.logger.log(`Listening to ${this.assetSubscriptions.length} ERC-3643 asset token(s).`);
  }

  private async resolveAssetTokenAddresses(): Promise<string[]> {
    const configured = [
      this.config.get<string>('ERC3643_TOKEN_ADDRESSES'),
      this.config.get<string>('ASSET_TOKEN_ADDRESSES'),
      this.config.get<string>('TOKEN_CONTRACT_ADDRESSES')
    ]
      .filter(Boolean)
      .flatMap((value) => value!.split(','))
      .map((address) => address.trim())
      .filter(Boolean);

    if (configured.length) {
      return [...new Set(configured.map((address) => address.toLowerCase()))];
    }

    const projects = await this.prisma.project.findMany({
      where: {
        contractAddress: {
          not: null
        }
      },
      select: {
        contractAddress: true
      }
    });

    return [
      ...new Set(
        projects
          .map((project) => project.contractAddress?.trim().toLowerCase())
          .filter((address): address is string => Boolean(address))
      )
    ];
  }

  private async handleAssetTransfer({
    tokenAddress,
    from,
    to,
    value,
    event
  }: {
    tokenAddress: string;
    from: string;
    to: string;
    value: bigint;
    event: AssetTransferEvent;
  }) {
    try {
      const txHash = event.log?.transactionHash;
      const tokenAmount = this.parseTokenAmount(value);

      if (tokenAmount <= 0) {
        return;
      }

      const project = await this.prisma.project.findFirst({
        where: {
          contractAddress: {
            equals: tokenAddress,
            mode: 'insensitive'
          }
        },
        select: {
          id: true,
          title: true,
          pricePerToken: true
        }
      });

      if (!project) {
        this.logger.warn(`Transfer ignored. No Project.contractAddress found for token=${tokenAddress}`);
        return;
      }

      await this.prisma.$transaction(async (tx) => {
        const claimed = await this.claimBlockchainTransaction(tx, {
          txHash,
          eventName: 'Transfer',
          contractAddress: tokenAddress,
          payload: {
            from,
            to,
            value: value.toString(),
            tokenAmount,
            projectId: project.id
          }
        });

        if (!claimed) {
          return;
        }

        if (!this.isZeroAddress(from)) {
          const sender = await tx.investor.findFirst({
            where: {
              walletAddress: {
                equals: from,
                mode: 'insensitive'
              }
            },
            select: { id: true }
          });

          if (sender) {
            await this.reduceInvestorAssetPosition(tx, sender.id, project.id, tokenAmount);
            await this.recalculateInvestorRisk(tx, sender.id);
          }
        }

        if (!this.isZeroAddress(to)) {
          const receiver = await tx.investor.findFirst({
            where: {
              walletAddress: {
                equals: to,
                mode: 'insensitive'
              }
            },
            select: { id: true }
          });

          if (receiver) {
            const existingInvestment =
              txHash &&
              (await tx.investment.findFirst({
                where: {
                  investorId: receiver.id,
                  projectId: project.id,
                  txHash
                },
                select: { id: true }
              }));

            if (!existingInvestment) {
              await tx.investment.create({
                data: {
                  investorId: receiver.id,
                  projectId: project.id,
                  tokenCount: tokenAmount,
                  purchasePriceUsd: project.pricePerToken.mul(tokenAmount),
                  status: 'ACTIVE',
                  txHash
                }
              });
            }

            await this.recalculateInvestorRisk(tx, receiver.id);
          }
        }
      });

      this.logger.log(
        `Transfer indexed asset=${project.title} from=${from} to=${to} tokens=${tokenAmount} tx=${event.log?.transactionHash}`
      );
    } catch (error) {
      this.logger.error(`Failed to index Transfer event: ${this.errorMessage(error)}`);
      this.scheduleReconnect();
    }
  }

  private async reduceInvestorAssetPosition(
    tx: Prisma.TransactionClient,
    investorId: string,
    projectId: string,
    tokenAmount: number
  ) {
    let remaining = tokenAmount;
    const positions = await tx.investment.findMany({
      where: {
        investorId,
        projectId,
        status: 'ACTIVE'
      },
      orderBy: {
        purchasedAt: 'asc'
      },
      select: {
        id: true,
        tokenCount: true
      }
    });

    for (const position of positions) {
      if (remaining <= 0) {
        break;
      }

      const consumed = Math.min(position.tokenCount, remaining);
      const nextTokenCount = position.tokenCount - consumed;

      await tx.investment.update({
        where: { id: position.id },
        data: {
          tokenCount: nextTokenCount,
          status: nextTokenCount === 0 ? 'LIQUIDATED' : 'ACTIVE'
        }
      });

      remaining -= consumed;
    }
  }

  private async recalculateInvestorRisk(tx: Prisma.TransactionClient, investorId: string) {
    const investor = await tx.investor.findUnique({
      where: { id: investorId },
      select: {
        marginDebt: true,
        investments: {
          where: {
            status: 'ACTIVE'
          },
          include: {
            project: {
              select: {
                pricePerToken: true
              }
            }
          }
        }
      }
    });

    if (!investor) {
      return;
    }

    const totalCapital = investor.investments.reduce(
      (sum, investment) => sum.plus(investment.project.pricePerToken.mul(investment.tokenCount)),
      new Prisma.Decimal(0)
    );

    const ltv = totalCapital.gt(0)
      ? investor.marginDebt.div(totalCapital).mul(100).toDecimalPlaces(4)
      : new Prisma.Decimal(0);

    await tx.investor.update({
      where: { id: investorId },
      data: {
        totalCapital,
        ltv
      }
    });
  }

  private async handleKycWhitelistEvent(
    investorAddress: string,
    approved: boolean,
    event: KycEventPayload,
    eventName = 'KycUpdated'
  ) {
    try {
      const txHash = event.log?.transactionHash;
      const updated = await this.prisma.$transaction(async (tx) => {
        const claimed = await this.claimBlockchainTransaction(tx, {
          txHash,
          eventName,
          contractAddress: event.log.address,
          payload: {
            investorAddress,
            approved
          }
        });

        if (!claimed) {
          return { count: 0 };
        }

        return tx.investor.updateMany({
          where: {
            walletAddress: {
              equals: investorAddress,
              mode: 'insensitive'
            }
          },
          data: {
            kycStatus: approved ? 'APPROVED' : 'REJECTED',
            kycVerifiedAt: approved ? new Date() : null
          }
        });
      });

      this.logger.log(
        `KYC whitelist event investor=${investorAddress} approved=${approved} updated=${updated.count} tx=${event.log?.transactionHash}`
      );
    } catch (error) {
      this.logger.error(`Failed to index KYC event: ${this.errorMessage(error)}`);
      this.scheduleReconnect();
    }
  }

  /**
   * Punto de entrada no bloqueante: libera el event loop y delega la ingesta con reintentos.
   */
  processDividendEvent(payload: BlockchainEventPayload): void {
    this.logger.debug(
      `Dividend event queued txHash=${payload.txHash} recipient=${payload.recipient} amount=${payload.amount}`
    );

    setImmediate(() => {
      void this.executeIngestionWithRetry(this.toIngestionPayload(payload), 0);
    });
  }

  private async executeIngestionWithRetry(
    payload: DividendIngestionPayload,
    attempt: number
  ): Promise<void> {
    try {
      await this.persistDividendIngestion(payload);
      this.logger.log(
        `Dividend ingestion succeeded txHash=${payload.txHash} recipient=${payload.recipient} attempt=${attempt}`
      );
    } catch (error) {
      if (!this.isDatabaseSaturationError(error)) {
        this.logger.error(
          `Dividend ingestion failed (non-retriable) txHash=${payload.txHash} attempt=${attempt}: ${this.errorMessage(error)}`
        );
        return;
      }

      if (attempt >= MAX_RETRIES) {
        this.logger.error(
          `CRITICAL: Dividend ingestion exhausted retries txHash=${payload.txHash} recipient=${payload.recipient} attempts=${attempt + 1}: ${this.errorMessage(error)}`
        );
        return;
      }

      const delayMs = BASE_BACKOFF_MS * 2 ** attempt;
      this.logger.warn(
        `Dividend ingestion retry scheduled txHash=${payload.txHash} attempt=${attempt + 1} delayMs=${delayMs}: ${this.errorMessage(error)}`
      );

      await this.delay(delayMs);
      await this.executeIngestionWithRetry(payload, attempt + 1);
    }
  }

  private async persistDividendIngestion(payload: DividendIngestionPayload): Promise<void> {
    const existingDistribution = await this.prisma.dividendDistribution.findUnique({
      where: { txHash: payload.txHash },
      select: { id: true }
    });

    if (existingDistribution) {
      this.logger.debug(`Dividend ingestion skipped (idempotent) txHash=${payload.txHash}`);
      return;
    }

    const cashAmountUsd = new Prisma.Decimal(payload.amount);
    const amortizedAmountUsd = new Prisma.Decimal(payload.amortizedAmountUsd ?? 0);
    const contractAddress =
      payload.contractAddress ?? this.config.get<string>('ESCROW_LENDING_POOL_ADDRESS') ?? 'unknown';
    const defaultAssetId = this.config.get<string>('DEFAULT_YIELD_ASSET_ID') ?? 'ESCROW';
    let processedEvent: DividendProcessedEvent | null = null;

    await this.prisma.$transaction(async (tx) => {
      const claimed = await this.claimBlockchainTransaction(tx, {
        txHash: payload.txHash,
        eventName: 'YieldDistributedAndAmortized',
        contractAddress,
        payload: {
          recipient: payload.recipient,
          token: payload.token,
          amount: payload.amount,
          yieldAmountUsd: payload.yieldAmountUsd ?? 0,
          amortizedAmountUsd: payload.amortizedAmountUsd ?? 0
        }
      });

      if (!claimed) {
        return;
      }

      const investor = await tx.investor.findFirst({
        where: {
          walletAddress: {
            equals: payload.recipient,
            mode: 'insensitive'
          }
        },
        select: {
          id: true,
          marginDebt: true,
          totalCapital: true
        }
      });

      if (!investor) {
        this.logger.warn(`Dividend event ignored. Wallet ${payload.recipient} has no investor profile.`);
        return;
      }

      const nextMarginDebt = Prisma.Decimal.max(new Prisma.Decimal(0), investor.marginDebt.minus(amortizedAmountUsd));
      const nextLtv = investor.totalCapital.gt(0)
        ? nextMarginDebt.div(investor.totalCapital).mul(100).toDecimalPlaces(4)
        : new Prisma.Decimal(0);

      if (cashAmountUsd.gt(0)) {
        const createdDistribution = await tx.dividendDistribution.create({
          data: {
            assetId: defaultAssetId,
            userId: investor.id,
            amount: cashAmountUsd,
            currency: 'USD',
            txHash: payload.txHash,
            status: LIQUIDATED_CASH_STATUS,
            appliedToMargin: false
          }
        });

        processedEvent = {
          txHash: payload.txHash,
          amount: payload.amount,
          token: payload.token,
          recipient: payload.recipient,
          distributionId: createdDistribution.id,
          assetId: defaultAssetId,
          receivedAt: new Date().toISOString()
        };

        this.eventEmitter.emit(DIVIDEND_PROCESSED_EVENT, processedEvent);
      }

      await tx.investor.update({
        where: { id: investor.id },
        data: {
          marginDebt: nextMarginDebt,
          ltv: nextLtv
        }
      });
    });
  }

  private toIngestionPayload(payload: BlockchainEventPayload): DividendIngestionPayload {
    return payload as DividendIngestionPayload;
  }

  private isDatabaseSaturationError(error: unknown): boolean {
    if (error instanceof PrismaClientKnownRequestError) {
      return ['P1001', 'P1002', 'P1008', 'P1017', 'P2024', 'P2034'].includes(error.code);
    }

    const message = this.errorMessage(error).toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('too many clients') ||
      message.includes('deadlock') ||
      message.includes('pool')
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private async claimBlockchainTransaction(
    tx: Prisma.TransactionClient,
    input: ClaimTransactionInput
  ): Promise<boolean> {
    if (!input.txHash) {
      this.logger.warn(`Skipping ${input.eventName}. Missing transaction hash.`);
      return false;
    }

    try {
      await tx.blockchainEvent.create({
        data: {
          txHash: input.txHash,
          eventName: input.eventName,
          contractAddress: input.contractAddress ?? 'unknown',
          payload: input.payload
        }
      });

      return true;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        this.logger.warn(
          `Event already processed txHash=${input.txHash} event=${input.eventName} contract=${input.contractAddress}`
        );
        return false;
      }

      throw error;
    }
  }

  private parseTokenAmount(value: bigint): number {
    const decimals = Number(this.config.get<string>('ASSET_TOKEN_DECIMALS') ?? DEFAULT_TOKEN_DECIMALS);
    return Math.trunc(Number(formatUnits(value, Number.isFinite(decimals) ? decimals : DEFAULT_TOKEN_DECIMALS)));
  }

  private parseUsdMicroAmount(value: bigint): Prisma.Decimal {
    return new Prisma.Decimal(value.toString()).div(USD_MICRO_UNITS);
  }

  private isZeroAddress(address: string): boolean {
    return address.toLowerCase() === ZERO_ADDRESS;
  }

  private startHeartbeat() {
    if (this.heartbeatTimer || !this.provider) {
      return;
    }

    const intervalMs = Number(this.config.get<string>('RPC_HEARTBEAT_MS') ?? DEFAULT_HEARTBEAT_MS);

    this.heartbeatTimer = setInterval(() => {
      void this.provider
        ?.getBlockNumber()
        .catch((error) => {
          this.logger.warn(`RPC heartbeat failed: ${this.errorMessage(error)}`);
          this.scheduleReconnect();
        });
    }, Number.isFinite(intervalMs) ? intervalMs : DEFAULT_HEARTBEAT_MS);
  }

  private scheduleReconnect() {
    if (this.isDestroyed || this.reconnectTimer) {
      return;
    }

    this.teardownListeners();

    const delayMs = Number(this.config.get<string>('RPC_RECONNECT_DELAY_MS') ?? DEFAULT_RECONNECT_DELAY_MS);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connectListeners();
    }, Number.isFinite(delayMs) ? delayMs : DEFAULT_RECONNECT_DELAY_MS);
  }

  private teardownListeners() {
    this.escrowContract?.removeAllListeners();
    this.escrowContract = undefined;
    this.liquidityAssetAddress = undefined;

    for (const subscription of this.assetSubscriptions) {
      subscription.contract.removeAllListeners();
    }

    this.assetSubscriptions = [];

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    this.provider?.destroy();
    this.provider = undefined;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  onModuleDestroy() {
    this.isDestroyed = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    this.teardownListeners();
  }
}
