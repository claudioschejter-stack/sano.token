import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AbiCoder, Interface } from 'ethers';

const MORPHO = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb';
const OUR_MARKET = '0x' + 'aa'.repeat(32);
const OTHER_MARKET = '0x' + 'cc'.repeat(32);
const INVESTOR = '0x1111111111111111111111111111111111111111';

const EVENTS = new Interface([
  'event Borrow(bytes32 indexed id, address caller, address indexed onBehalf, address indexed receiver, uint256 assets, uint256 shares)',
  'event Repay(bytes32 indexed id, address indexed caller, address indexed onBehalf, uint256 assets, uint256 shares)',
  'event SupplyCollateral(bytes32 indexed id, address indexed caller, address indexed onBehalf, uint256 assets)'
]);

const VAULT = '0x2222222222222222222222222222222222222222';

const recorded: Array<Record<string, unknown>> = [];
let logs: Array<{ topics: string[]; data: string; transactionHash: string; index: number; blockNumber: number }> = [];
let collateralTargets: unknown = [{ protocol: 'MORPHO', externalId: OUR_MARKET }];
let vaultShareDecimals: number | null = 18;

vi.mock('@sanova/database', () => ({
  prisma: {
    project: {
      findMany: async () => [{ id: 'proj-1', vaultAddress: VAULT, collateralTargets }]
    }
  }
}));
vi.mock('../blockchain/vaultShareUnits', () => ({
  readVaultShareDecimals: async () => vaultShareDecimals
}));

vi.mock('../lending/baseContracts', () => ({ getLendingChainConfig: () => ({ morpho: MORPHO }) }));
vi.mock('../payments/paymentConfig', () => ({ usdcDecimals: () => 6 }));
vi.mock('../blockchain/rpcRetry', () => ({
  readWithRetry: async (fn: () => Promise<unknown>) => fn()
}));
vi.mock('./ledgerWatermark', () => ({ resolveLedgerStartBlock: async () => 100 }));
vi.mock('./platformAddressRegistry', () => ({
  platformAddressRegistry: async () =>
    new Map([[INVESTOR.toLowerCase(), { address: INVESTOR, role: 'investor', userId: 'u1', investorId: 'i1' }]])
}));
vi.mock('./tokenMovementLedger', () => ({
  recordTokenMovement: async (input: Record<string, unknown>) => {
    recorded.push(input);
  }
}));

const { indexMorphoMovements } = await import('./indexMorphoMovements');

function log(name: 'Borrow' | 'Repay' | 'SupplyCollateral', marketId: string, index = 0) {
  const fragment = EVENTS.getEvent(name)!;
  if (name === 'Borrow') {
    return {
      topics: [fragment.topicHash, marketId, `0x${'0'.repeat(24)}${INVESTOR.slice(2)}`, `0x${'0'.repeat(24)}${INVESTOR.slice(2)}`],
      data: AbiCoder.defaultAbiCoder().encode(['address', 'uint256', 'uint256'], [INVESTOR, 250_000_000n, 1n]),
      transactionHash: `0xtx${index}`,
      index,
      blockNumber: 200 + index
    };
  }
  if (name === 'Repay') {
    return {
      topics: [fragment.topicHash, marketId, `0x${'0'.repeat(24)}${INVESTOR.slice(2)}`, `0x${'0'.repeat(24)}${INVESTOR.slice(2)}`],
      data: AbiCoder.defaultAbiCoder().encode(['uint256', 'uint256'], [100_000_000n, 1n]),
      transactionHash: `0xtx${index}`,
      index,
      blockNumber: 200 + index
    };
  }
  return {
    topics: [fragment.topicHash, marketId, `0x${'0'.repeat(24)}${INVESTOR.slice(2)}`, `0x${'0'.repeat(24)}${INVESTOR.slice(2)}`],
    data: AbiCoder.defaultAbiCoder().encode(['uint256'], [5n * 10n ** 18n]),
    transactionHash: `0xtx${index}`,
    index,
    blockNumber: 200 + index
  };
}

let lastLogQuery: { topics?: unknown } | null = null;

const provider = {
  getBlockNumber: async () => 300,
  getLogs: async (query: { topics?: unknown }) => {
    lastLogQuery = query;
    return logs;
  },
  getBlock: async (blockNumber: number) => ({ timestamp: 1_760_000_000 + blockNumber })
} as never;

beforeEach(() => {
  recorded.length = 0;
  logs = [];
  lastLogQuery = null;
  collateralTargets = [{ protocol: 'MORPHO', externalId: OUR_MARKET }];
  vaultShareDecimals = 18;
});

describe('indexMorphoMovements', () => {
  /**
   * The query used to have no topics, so it asked for every log Morpho Blue
   * emitted on Base. That response is far over any provider's cap, so every
   * chunk failed and the whole span came back as skipped — which is why no
   * lending movement was ever recorded in production.
   */
  it('pide solo los eventos de nuestros mercados, no todo lo de Morpho', async () => {
    logs = [log('Borrow', OUR_MARKET)];
    await indexMorphoMovements({ provider });

    const topics = lastLogQuery?.topics as Array<string[]> | undefined;
    expect(topics).toBeDefined();
    expect(topics).toHaveLength(2);
    // Seven event signatures, and the market ids Morpho indexes as first topic.
    expect(topics![0]).toHaveLength(7);
    expect(topics![1]).toEqual([OUR_MARKET]);
  });

  it('registra la fecha del bloque, que el log no trae', async () => {
    logs = [log('Borrow', OUR_MARKET)];
    await indexMorphoMovements({ provider });

    expect(recorded[0].occurredAt).toBeInstanceOf(Date);
  });

  it('escribe el movimiento aunque no se pueda leer la fecha del bloque', async () => {
    logs = [log('Borrow', OUR_MARKET)];
    const noBlocks = {
      getBlockNumber: async () => 300,
      getLogs: async () => logs,
      getBlock: async () => {
        throw new Error('RPC down');
      }
    } as never;

    const result = await indexMorphoMovements({ provider: noBlocks });

    expect(result.indexed).toBe(1);
    expect(recorded[0].occurredAt).toBeNull();
  });

  it('records a borrow, which no token transfer of ours would show', async () => {
    logs = [log('Borrow', OUR_MARKET)];
    const result = await indexMorphoMovements({ provider });

    expect(result.indexed).toBe(1);
    expect(recorded[0]).toMatchObject({
      kind: 'MORPHO_BORROW',
      asset: 'USDC',
      amountRaw: '250000000',
      projectId: 'proj-1',
      userId: 'u1',
      investorId: 'i1'
    });
  });

  it('records a repayment', async () => {
    logs = [log('Repay', OUR_MARKET)];
    const result = await indexMorphoMovements({ provider });
    expect(recorded[0]).toMatchObject({ kind: 'MORPHO_REPAY', amountRaw: '100000000' });
    expect(result.indexed).toBe(1);
  });

  it('books collateral in vault shares, not USDC', async () => {
    logs = [log('SupplyCollateral', OUR_MARKET)];
    await indexMorphoMovements({ provider });
    expect(recorded[0]).toMatchObject({
      kind: 'MORPHO_COLLATERAL_IN',
      asset: 'RWA_SHARE',
      decimals: 18
    });
  });

  /** Collateral is vault shares, so the unit comes from the vault. */
  it('books collateral in the vault own share unit', async () => {
    vaultShareDecimals = 21;
    logs = [log('SupplyCollateral', OUR_MARKET)];
    await indexMorphoMovements({ provider });
    expect(recorded[0]).toMatchObject({ asset: 'RWA_SHARE', decimals: 21 });
  });

  /**
   * These rows are permanent. Writing a guessed unit into the ledger becomes an
   * error nobody can detect afterwards, so the movement is skipped instead.
   */
  it('skips collateral rather than write a guessed unit into the ledger', async () => {
    vaultShareDecimals = null;
    logs = [log('SupplyCollateral', OUR_MARKET)];
    const result = await indexMorphoMovements({ provider });

    expect(recorded).toHaveLength(0);
    expect(result.skipped.join(' ')).toContain('decimals()');
  });

  it('ignores markets that are not ours', async () => {
    logs = [log('Borrow', OTHER_MARKET)];
    const result = await indexMorphoMovements({ provider });
    expect(result.indexed).toBe(0);
    expect(recorded).toHaveLength(0);
  });

  it('does nothing when no market id is registered', async () => {
    collateralTargets = [{ protocol: 'MORPHO', externalId: null }];
    const result = await indexMorphoMovements({ provider });
    expect(result).toMatchObject({ indexed: 0, markets: 0 });
  });

  it('attributes each movement to its project and market', async () => {
    logs = [log('Borrow', OUR_MARKET, 0), log('Repay', OUR_MARKET, 1)];
    await indexMorphoMovements({ provider });

    expect(recorded).toHaveLength(2);
    for (const row of recorded) {
      const metadata = row.metadata as Record<string, unknown>;
      expect(metadata.marketId).toBe(OUR_MARKET.toLowerCase());
      expect(metadata.counterpartyRole).toBe('investor');
      expect(row.projectId).toBe('proj-1');
    }
  });
});
