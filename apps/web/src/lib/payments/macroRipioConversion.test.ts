import { beforeEach, describe, expect, it, vi } from 'vitest';

const depositUpdates: Array<Record<string, unknown>> = [];
const ripioCalls: Array<Record<string, unknown>> = [];

let depositMeta: Record<string, unknown> = {};
let ripioReady = true;

vi.mock('@sanova/database', () => ({
  prisma: {
    platformDeposit: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === 'dep-1'
          ? {
              id: 'dep-1',
              amountUsd: { toNumber: () => 10 },
              metadata: depositMeta
            }
          : null,
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        depositUpdates.push(args.data);
        depositMeta = {
          ...depositMeta,
          ...((args.data.metadata as Record<string, unknown>) ?? {})
        };
        return { id: args.where.id };
      }
    },
    paymentIntent: {
      findFirst: async () => null,
      findUnique: async () => null,
      findMany: async () => [],
      update: async () => ({})
    }
  }
}));

vi.mock('./checkoutReferenceResolver', async () => {
  const actual = await vi.importActual<typeof import('./checkoutReferenceResolver')>(
    './checkoutReferenceResolver'
  );
  return {
    ...actual,
    resolveCheckoutReferenceByPartnerOrderId: async (ref: string) =>
      ref === 'dep-1' ? { kind: 'deposit' as const, depositId: 'dep-1' } : null
  };
});

vi.mock('./ripioClient', () => ({
  ripioConfigured: () => ripioReady
}));

vi.mock('./ripioOnRampAdapter', () => ({
  createRipioOnRampCheckout: async (input: Record<string, unknown>) => {
    ripioCalls.push(input);
    return {
      provider: 'ripio',
      providerPaymentId: 'tx-ripio-1',
      metadata: {
        ripioExternalRef: 'ext-ref-1',
        fiatAmount: String(input.fiatAmountArs ?? 10000),
        sandboxDepositSimulated: input.autoSimulateSandboxDeposit === true,
        fiatPaymentInstructions: { cvu: '0000465160000000070078' }
      }
    };
  }
}));

vi.mock('./cartCheckoutService', () => ({
  loadCartBatchIntentsAnyStatus: async () => [],
  confirmCartPurchaseBatch: async () => []
}));

vi.mock('./checkoutTreasurySettlement', () => ({
  settleOnRampCheckout: async () => ({ ok: true })
}));

vi.mock('./platformWalletService', () => ({
  confirmPlatformDeposit: async () => ({})
}));

vi.mock('./stablecoinNetworks', () => ({
  getStablecoinNetwork: () => ({
    id: 'BASE',
    kind: 'EVM',
    rpcUrl: null,
    tokenAddress: null,
    treasuryAddress: null,
    decimals: 6
  })
}));

vi.mock('./paymentConfig', () => ({
  paymentMinimumConfirmations: () => 1
}));

const { enqueueFiatToUsdcConversion } = await import('./postPaymentSettlementOrchestrator');

beforeEach(() => {
  depositUpdates.length = 0;
  ripioCalls.length = 0;
  depositMeta = { currency: 'ARS', localAmount: 10500 };
  ripioReady = true;
});

describe('enqueueFiatToUsdcConversion — Macro → Ripio', () => {
  it('creates a Ripio bank_transfer on-ramp with the exact Macro ARS amount', async () => {
    const result = await enqueueFiatToUsdcConversion({
      externalReference: 'dep-1',
      provider: 'macro_click',
      amountUsd: 10,
      userId: 'user-1',
      userEmail: 'ops@sanova.test',
      fiatCurrency: 'ARS',
      localAmount: 10500
    });

    expect(result.queued).toBe(true);
    expect(ripioCalls[0]).toMatchObject({
      depositId: 'dep-1',
      amountUsd: 10,
      fiatAmountArs: 10500,
      paymentOptionRail: 'bank_transfer',
      autoSimulateSandboxDeposit: true
    });
    expect(depositUpdates[0].metadata).toMatchObject({
      conversionProvider: 'ripio',
      macroRipioBridge: true,
      ripioExternalRef: 'ext-ref-1',
      awaitingTreasuryUsdc: true
    });
  });

  it('does not invent an ARS Ripio quote for Macro USD charges', async () => {
    const result = await enqueueFiatToUsdcConversion({
      externalReference: 'dep-1',
      provider: 'macro_click',
      amountUsd: 25,
      userId: 'user-1',
      userEmail: 'ops@sanova.test',
      fiatCurrency: 'USD',
      localAmount: 25
    });

    expect(ripioCalls).toHaveLength(0);
    expect(result.ripio).toBeUndefined();
    expect(depositUpdates[0].metadata).toMatchObject({
      conversionProvider: 'treasury_ops',
      conversionBlockedReason: 'RIPIO_ONRAMP_ARS_ONLY',
      awaitingTreasuryUsdc: true
    });
  });

  it('reuses an existing ripioExternalRef instead of creating a second order', async () => {
    depositMeta = { ripioExternalRef: 'already-queued', awaitingTreasuryUsdc: true };

    const result = await enqueueFiatToUsdcConversion({
      externalReference: 'dep-1',
      provider: 'macro_click',
      amountUsd: 10,
      userId: 'user-1',
      userEmail: 'ops@sanova.test',
      fiatCurrency: 'ARS',
      localAmount: 10500
    });

    expect(ripioCalls).toHaveLength(0);
    expect(result.ripio).toMatchObject({
      ripioExternalRef: 'already-queued',
      ripioIdempotentReuse: true
    });
    expect(depositUpdates).toHaveLength(0);
  });
});
