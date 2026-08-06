import { prisma, Prisma } from '@sanova/database';
import {
  createBridgeKycLink,
  getBridgeApiKey,
  getOrCreateBridgeCustomer,
  isBridgeCustomerReady
} from './bridgeClient';

/**
 * The investor's second onboarding, the one Bridge requires.
 *
 * Bridge verifies its own customers before issuing a virtual account, and does
 * not accept another provider's verification: importing what Didit already
 * cleared is only possible under Bridge's reliance model, which a developer has
 * to be approved for. Until that approval exists, an investor we verified still
 * has to complete Bridge's hosted flow once.
 *
 * What that means for onboarding: this belongs next to the Didit step, not in
 * the checkout. Asked at onboarding it is one more form in a moment the investor
 * already accepted is paperwork. Asked at checkout it is a form standing between
 * somebody and a purchase they decided to make.
 *
 * Nothing here blocks anything. An investor without Bridge can still pay with
 * crypto or, in Argentina, with Macro — Bridge only gates Bridge's rails.
 */

export type BridgeOnboardingState = {
  /** Bridge can issue virtual accounts for this investor right now. */
  ready: boolean;
  status: 'not_configured' | 'not_started' | 'pending' | 'approved' | 'rejected';
  customerId: string | null;
  /** Where to send the investor when there is something left to do. */
  kycLink: string | null;
  tosLink: string | null;
  endorsements: string[];
};

const NOT_CONFIGURED: BridgeOnboardingState = {
  ready: false,
  status: 'not_configured',
  customerId: null,
  kycLink: null,
  tosLink: null,
  endorsements: []
};

/** How long a stored status is trusted before asking Bridge again. */
const STATUS_TTL_MS = 5 * 60 * 1000;

function mapStatus(kycStatus: string | null | undefined): BridgeOnboardingState['status'] {
  const value = (kycStatus ?? '').toLowerCase();
  if (value === 'approved' || value === 'active') return 'approved';
  if (value === 'rejected' || value === 'offboarded') return 'rejected';
  if (!value || value === 'not_started') return 'not_started';
  return 'pending';
}

function toState(row: {
  customerId: string;
  kycStatus: string;
  tosStatus: string;
  kycLink: string | null;
  tosLink: string | null;
  endorsements: unknown;
}): BridgeOnboardingState {
  const status = mapStatus(row.kycStatus);
  return {
    ready: status === 'approved' && row.tosStatus.toLowerCase() === 'approved',
    status,
    customerId: row.customerId,
    kycLink: row.kycLink,
    tosLink: row.tosLink,
    endorsements: Array.isArray(row.endorsements) ? (row.endorsements as string[]) : []
  };
}

/** Read what we know, without asking Bridge. */
export async function readBridgeOnboarding(userId: string): Promise<BridgeOnboardingState> {
  if (!getBridgeApiKey()) {
    return NOT_CONFIGURED;
  }
  const row = await prisma.bridgeCustomer.findUnique({ where: { userId } }).catch(() => null);
  return row ? toState(row) : { ...NOT_CONFIGURED, status: 'not_started' };
}

/**
 * Make sure the investor exists on Bridge and the stored status is current.
 *
 * Safe to call repeatedly and from anywhere: it only talks to Bridge when the
 * stored status is stale or missing, and it never throws — a Bridge outage must
 * not take down KYC approval or a checkout page.
 */
export async function ensureBridgeOnboarding(input: {
  userId: string;
  email: string;
  fullName: string;
  /** Skip the cache: use after the investor says they finished the hosted flow. */
  refresh?: boolean;
}): Promise<BridgeOnboardingState> {
  const apiKey = getBridgeApiKey();
  if (!apiKey) {
    return NOT_CONFIGURED;
  }

  const existing = await prisma.bridgeCustomer
    .findUnique({ where: { userId: input.userId } })
    .catch(() => null);

  const fresh =
    existing?.lastCheckedAt &&
    Date.now() - existing.lastCheckedAt.getTime() < STATUS_TTL_MS &&
    mapStatus(existing.kycStatus) === 'approved';

  if (existing && fresh && !input.refresh) {
    return toState(existing);
  }

  try {
    const { customer, kycLink } = await getOrCreateBridgeCustomer({
      apiKey,
      userId: input.userId,
      email: input.email,
      fullName: input.fullName
    });

    let link = kycLink;
    if (!isBridgeCustomerReady(customer, link) && !link?.kyc_link) {
      // A returning customer mid-verification needs a link to come back to.
      link = await createBridgeKycLink({
        apiKey,
        fullName: input.fullName,
        email: input.email
      }).catch(() => undefined);
    }

    const kycStatus = link?.kyc_status ?? customer.status ?? 'not_started';
    const tosStatus = link?.tos_status ?? 'pending';
    const endorsements = Array.isArray(customer.endorsements)
      ? customer.endorsements
          .map((row) => (typeof row === 'string' ? row : row?.name))
          .filter((name): name is string => Boolean(name))
      : [];

    const saved = await prisma.bridgeCustomer.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        customerId: customer.id,
        kycStatus,
        tosStatus,
        kycLink: link?.kyc_link ?? null,
        tosLink: link?.tos_link ?? null,
        endorsements: endorsements as Prisma.InputJsonValue,
        lastCheckedAt: new Date()
      },
      update: {
        customerId: customer.id,
        kycStatus,
        tosStatus,
        kycLink: link?.kyc_link ?? null,
        tosLink: link?.tos_link ?? null,
        endorsements: endorsements as Prisma.InputJsonValue,
        lastCheckedAt: new Date()
      }
    });

    return toState(saved);
  } catch (error) {
    console.error('[bridgeCustomerService] ensure failed', input.userId, error);
    // Fall back to what we knew: a Bridge outage is not a change of status.
    return existing ? toState(existing) : { ...NOT_CONFIGURED, status: 'not_started' };
  }
}

/**
 * Start Bridge onboarding for an investor Didit already approved.
 *
 * Best-effort by design, like the on-chain allowlist: a Bridge failure must not
 * hold up KYC approval, and the investor can complete it later from onboarding
 * or the first time they pick a Bridge rail.
 */
export async function startBridgeOnboardingAfterKyc(userId: string): Promise<void> {
  if (!getBridgeApiKey()) return;

  const user = await prisma.user
    .findUnique({ where: { id: userId }, select: { email: true, name: true } })
    .catch(() => null);

  if (!user?.email) return;

  await ensureBridgeOnboarding({
    userId,
    email: user.email,
    fullName: user.name?.trim() || user.email
  }).catch((error) => {
    console.error('[bridgeCustomerService] start after KYC failed', userId, error);
    return NOT_CONFIGURED;
  });
}
