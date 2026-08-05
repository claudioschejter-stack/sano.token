import { Interface, JsonRpcProvider, type Log } from 'ethers';
import { prisma } from '@sanova/database';
import { getLendingChainConfig } from '../lending/baseContracts';
import { usdcDecimals } from '../payments/paymentConfig';
import { readWithRetry } from '../blockchain/rpcRetry';
import { recordTokenMovement, type TokenMovementKindName } from './tokenMovementLedger';
import { platformAddressRegistry } from './platformAddressRegistry';
import { resolveLedgerStartBlock } from './ledgerWatermark';

/**
 * Index lending activity from Morpho's own events.
 *
 * Borrowing and repaying are not ERC-20 transfers of anything we own, and
 * collateral movements happen inside Morpho, so watching token contracts can
 * never see them. Without this the ledger recorded purchases and share
 * transfers and simply had no row for the loan that followed.
 */

const RPC_CHUNK = 9_500;
const DEFAULT_LOOKBACK = 40_000;
const MAX_SPAN_BLOCKS = 400_000;

const MORPHO_EVENTS = new Interface([
  'event Supply(bytes32 indexed id, address indexed caller, address indexed onBehalf, uint256 assets, uint256 shares)',
  'event Withdraw(bytes32 indexed id, address caller, address indexed onBehalf, address indexed receiver, uint256 assets, uint256 shares)',
  'event Borrow(bytes32 indexed id, address caller, address indexed onBehalf, address indexed receiver, uint256 assets, uint256 shares)',
  'event Repay(bytes32 indexed id, address indexed caller, address indexed onBehalf, uint256 assets, uint256 shares)',
  'event SupplyCollateral(bytes32 indexed id, address indexed caller, address indexed onBehalf, uint256 assets)',
  'event WithdrawCollateral(bytes32 indexed id, address caller, address indexed onBehalf, address indexed receiver, uint256 assets)',
  'event Liquidate(bytes32 indexed id, address indexed caller, address indexed borrower, uint256 repaidAssets, uint256 repaidShares, uint256 seizedAssets, uint256 badDebtAssets, uint256 badDebtShares)'
]);

const KIND_BY_EVENT: Record<string, TokenMovementKindName> = {
  Supply: 'MORPHO_SUPPLY',
  Withdraw: 'MORPHO_WITHDRAW',
  Borrow: 'MORPHO_BORROW',
  Repay: 'MORPHO_REPAY',
  SupplyCollateral: 'MORPHO_COLLATERAL_IN',
  WithdrawCollateral: 'MORPHO_COLLATERAL_OUT',
  Liquidate: 'MORPHO_LIQUIDATION'
};

/** Collateral moves in vault shares; everything else moves in USDC. */
const COLLATERAL_EVENTS = new Set(['SupplyCollateral', 'WithdrawCollateral']);

function amountOf(name: string, args: Record<string, unknown>): bigint {
  if (name === 'Liquidate') {
    return BigInt(String(args.repaidAssets ?? 0));
  }
  return BigInt(String(args.assets ?? 0));
}

export type IndexMorphoMovementsResult = {
  indexed: number;
  markets: number;
  skipped: string[];
};

export async function indexMorphoMovements(input?: {
  provider?: JsonRpcProvider;
  lookbackBlocks?: number;
}): Promise<IndexMorphoMovementsResult> {
  const projects = await prisma.project.findMany({
    where: { vaultAddress: { not: null } },
    select: { id: true, collateralTargets: true }
  });

  /** Only our markets: Morpho hosts thousands of unrelated ones. */
  const projectByMarketId = new Map<string, string>();
  for (const project of projects) {
    const targets = Array.isArray(project.collateralTargets)
      ? (project.collateralTargets as Array<Record<string, unknown>>)
      : [];
    for (const target of targets) {
      const externalId = typeof target.externalId === 'string' ? target.externalId.trim() : '';
      if (target.protocol === 'MORPHO' && /^0x[0-9a-fA-F]{64}$/.test(externalId)) {
        projectByMarketId.set(externalId.toLowerCase(), project.id);
      }
    }
  }

  const skipped: string[] = [];
  if (projectByMarketId.size === 0) {
    return { indexed: 0, markets: 0, skipped: ['sin mercados registrados'] };
  }

  const morpho = getLendingChainConfig().morpho;
  const ownProvider = input?.provider
    ? null
    : new JsonRpcProvider(
        process.env.LENDING_BASE_RPC_URL?.trim() ||
          process.env.BASE_RPC_URL?.trim() ||
          'https://mainnet.base.org'
      );
  const provider = input?.provider ?? ownProvider!;

  try {
    const registry = await platformAddressRegistry();
    const latest = await provider.getBlockNumber();
    const startBlock = await resolveLedgerStartBlock({
      contractAddress: morpho,
      latestBlock: latest,
      fallbackLookback: input?.lookbackBlocks ?? DEFAULT_LOOKBACK,
      maxSpan: MAX_SPAN_BLOCKS
    });

    let indexed = 0;

    for (let start = startBlock; start <= latest; start += RPC_CHUNK) {
      const end = Math.min(start + RPC_CHUNK - 1, latest);
      const logs = await readWithRetry(() =>
        provider.getLogs({ address: morpho, fromBlock: start, toBlock: end })
      );
      if (!logs) {
        skipped.push(`bloques ${start}-${end}`);
        continue;
      }

      for (const log of logs as Log[]) {
        let parsed;
        try {
          parsed = MORPHO_EVENTS.parseLog({ topics: [...log.topics], data: log.data });
        } catch {
          continue;
        }
        if (!parsed) continue;

        const kind = KIND_BY_EVENT[parsed.name];
        if (!kind) continue;

        const marketId = String(parsed.args.id ?? '').toLowerCase();
        const projectId = projectByMarketId.get(marketId);
        if (!projectId) continue;

        const args = parsed.args.toObject() as Record<string, unknown>;
        const onBehalf = typeof args.onBehalf === 'string' ? args.onBehalf : null;
        const borrower = typeof args.borrower === 'string' ? args.borrower : null;
        const counterparty = onBehalf ?? borrower ?? null;
        const entry = counterparty ? registry.get(counterparty.toLowerCase()) : undefined;

        const isCollateral = COLLATERAL_EVENTS.has(parsed.name);

        await recordTokenMovement({
          kind,
          // Morpho's own event names the operation; nothing is being inferred.
          authoritative: true,
          asset: isCollateral ? 'RWA_SHARE' : 'USDC',
          contractAddress: morpho,
          fromAddress: counterparty ?? morpho,
          toAddress: morpho,
          amountRaw: amountOf(parsed.name, args).toString(),
          decimals: isCollateral ? 18 : usdcDecimals(),
          txHash: log.transactionHash,
          logIndex: log.index,
          blockNumber: log.blockNumber,
          projectId,
          userId: entry?.userId ?? null,
          investorId: entry?.investorId ?? null,
          metadata: {
            source: 'morpho-indexer',
            event: parsed.name,
            marketId,
            counterparty,
            counterpartyRole: entry?.role ?? null
          }
        });
        indexed += 1;
      }
    }

    return { indexed, markets: projectByMarketId.size, skipped };
  } finally {
    ownProvider?.destroy();
  }
}
