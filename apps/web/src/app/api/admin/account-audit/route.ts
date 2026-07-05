import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { prisma } from '@sanova/database';
import { isPendingInvestorWallet } from '../../../../lib/investor/provisionInvestorProfile';
import { isPrivyOperatorConfigured } from '../../../../lib/privy/config';
import { listRegistrationAttempts } from '../../../../lib/auth/registrationAttemptService';

export const dynamic = 'force-dynamic';

export type WalletStatus = 'REAL' | 'PENDING_PLACEHOLDER' | 'NONE';

export type AccountAuditUser = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  systemRole: string;
  accountStatus: string;
  kycStatus: string;
  hasPassword: boolean;
  investorAccessEnabled: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  walletAddress: string | null;
  walletStatus: WalletStatus;
  investorProfile: {
    id: string;
    walletAddress: string;
    walletStatus: WalletStatus;
    totalCapital: number;
  } | null;
  hasLinkedWallet: boolean;
  needsWalletProvisioning: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RegistrationAttemptRow = {
  id: string;
  email: string;
  success: boolean;
  errorCode: string | null;
  channel: string | null;
  ipCountry: string | null;
  createdAt: string;
};

export type PlatformConfig = {
  adminEmails: string;
  treasuryAddress: string | null;
  operatorAddress: string | null;
  privyTreasuryWalletId: boolean;
  privyOperatorWalletId: boolean;
  privySafeOwnerWalletId: boolean;
  privyAppId: boolean;
  isPrivyOperatorConfigured: boolean;
  privyEmbeddedWalletEnabled: boolean;
  turnstileSecretConfigured: boolean;
  turnstileSiteKeyConfigured: boolean;
  turnstileKeysInSync: boolean;
};

function resolveWalletStatus(address: string | null | undefined): WalletStatus {
  if (!address) return 'NONE';
  if (isPendingInvestorWallet(address)) return 'PENDING_PLACEHOLDER';
  return 'REAL';
}

function matchesSearch(
  user: {
    email: string;
    name: string | null;
    phone: string | null;
  },
  query: string
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  return (
    user.email.toLowerCase().includes(needle) ||
    (user.name?.toLowerCase().includes(needle) ?? false) ||
    (user.phone?.replace(/\D/g, '').includes(needle.replace(/\D/g, '')) ?? false)
  );
}

export async function GET(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        systemRole: true,
        accountStatus: true,
        kycStatus: true,
        passwordHash: true,
        investorAccessEnabled: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        walletAddress: true,
        createdAt: true,
        updatedAt: true,
        investor: {
          select: {
            id: true,
            walletAddress: true,
            totalCapital: true
          }
        }
      },
      orderBy: [{ systemRole: 'asc' }, { createdAt: 'desc' }]
    });

    const accounts: AccountAuditUser[] = users
      .filter((u) => matchesSearch(u, query))
      .map((u) => {
        const userWalletStatus = resolveWalletStatus(u.walletAddress);
        const investorWalletStatus = resolveWalletStatus(u.investor?.walletAddress);
        const hasLinkedWallet =
          userWalletStatus === 'REAL' || investorWalletStatus === 'REAL';
        const needsWalletProvisioning =
          u.systemRole === 'INVESTOR' &&
          u.kycStatus === 'APPROVED' &&
          !hasLinkedWallet;

        return {
          id: u.id,
          email: u.email,
          name: u.name,
          phone: u.phone,
          systemRole: u.systemRole,
          accountStatus: u.accountStatus,
          kycStatus: u.kycStatus,
          hasPassword: Boolean(u.passwordHash),
          investorAccessEnabled: u.investorAccessEnabled,
          emailVerified: Boolean(u.emailVerifiedAt),
          phoneVerified: Boolean(u.phoneVerifiedAt),
          walletAddress: u.walletAddress,
          walletStatus: userWalletStatus,
          investorProfile: u.investor
            ? {
                id: u.investor.id,
                walletAddress: u.investor.walletAddress,
                walletStatus: investorWalletStatus,
                totalCapital: Number(u.investor.totalCapital)
              }
            : null,
          hasLinkedWallet,
          needsWalletProvisioning,
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString()
        };
      });

    const turnstileSecretConfigured = Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
    const turnstileSiteKeyConfigured = Boolean(
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()
    );

    const platformConfig: PlatformConfig = {
      adminEmails: process.env.AUTH_ADMIN_EMAILS ? '✓ configured' : '✗ NOT SET',
      treasuryAddress: process.env.BASE_STABLECOIN_TREASURY_ADDRESS?.trim() || null,
      operatorAddress: process.env.RWA_OPERATOR_ADDRESS?.trim() || null,
      privyTreasuryWalletId: Boolean(process.env.PRIVY_TREASURY_WALLET_ID?.trim()),
      privyOperatorWalletId: Boolean(process.env.PRIVY_OPERATOR_WALLET_ID?.trim()),
      privySafeOwnerWalletId: Boolean(process.env.PRIVY_SAFE_OWNER_WALLET_ID?.trim()),
      privyAppId: Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim()),
      isPrivyOperatorConfigured: isPrivyOperatorConfigured(),
      privyEmbeddedWalletEnabled: true,
      turnstileSecretConfigured,
      turnstileSiteKeyConfigured,
      turnstileKeysInSync:
        turnstileSecretConfigured === turnstileSiteKeyConfigured
    };

    const registrationAttemptsRaw = await listRegistrationAttempts({
      query: query || undefined,
      limit: 100
    });

    const registrationAttempts: RegistrationAttemptRow[] = registrationAttemptsRaw.map((row) => ({
      id: row.id,
      email: row.email,
      success: row.success,
      errorCode: row.errorCode,
      channel: row.channel,
      ipCountry: row.ipCountry,
      createdAt: row.createdAt.toISOString()
    }));

    const summary = {
      total: accounts.length,
      byRole: accounts.reduce<Record<string, number>>((acc, u) => {
        acc[u.systemRole] = (acc[u.systemRole] ?? 0) + 1;
        return acc;
      }, {}),
      withRealWallet: accounts.filter((u) => u.hasLinkedWallet).length,
      withPlaceholderWallet: accounts.filter(
        (u) =>
          u.walletStatus === 'PENDING_PLACEHOLDER' ||
          u.investorProfile?.walletStatus === 'PENDING_PLACEHOLDER'
      ).length,
      withNoWallet: accounts.filter(
        (u) => u.walletStatus === 'NONE' && !u.investorProfile
      ).length,
      needingWalletProvisioning: accounts.filter((u) => u.needsWalletProvisioning).length,
      kycApproved: accounts.filter((u) => u.kycStatus === 'APPROVED').length,
      kycPending: accounts.filter((u) => u.kycStatus === 'PENDING').length,
      withPassword: accounts.filter((u) => u.hasPassword).length,
      suspended: accounts.filter((u) => u.accountStatus === 'SUSPENDED').length,
      failedRegistrationAttempts: registrationAttempts.filter((row) => !row.success).length
    };

    return NextResponse.json({
      ok: true,
      query: query || null,
      summary,
      platformConfig,
      accounts,
      registrationAttempts,
      auditedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[admin/account-audit]', error);
    return NextResponse.json({ error: 'Audit failed' }, { status: 500 });
  }
}
