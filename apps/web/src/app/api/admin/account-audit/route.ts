import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { prisma } from '@sanova/database';
import { isPendingInvestorWallet } from '../../../../lib/investor/provisionInvestorProfile';
import { isPrivyOperatorConfigured } from '../../../../lib/privy/config';

export const dynamic = 'force-dynamic';

export type WalletStatus = 'REAL' | 'PENDING_PLACEHOLDER' | 'NONE';

export type AccountAuditUser = {
  id: string;
  email: string;
  name: string | null;
  systemRole: string;
  kycStatus: string;
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
};

function resolveWalletStatus(address: string | null | undefined): WalletStatus {
  if (!address) return 'NONE';
  if (isPendingInvestorWallet(address)) return 'PENDING_PLACEHOLDER';
  return 'REAL';
}

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        systemRole: true,
        kycStatus: true,
        emailVerifiedAt: true,
        phone: true,
        walletAddress: true,
        createdAt: true,
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

    const accounts: AccountAuditUser[] = users.map((u) => {
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
        systemRole: u.systemRole,
        kycStatus: u.kycStatus,
        emailVerified: Boolean(u.emailVerifiedAt),
        phoneVerified: Boolean(u.phone?.trim()),
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
        createdAt: u.createdAt.toISOString()
      };
    });

    const platformConfig: PlatformConfig = {
      adminEmails: process.env.AUTH_ADMIN_EMAILS ? '✓ configured' : '✗ NOT SET',
      treasuryAddress: process.env.BASE_STABLECOIN_TREASURY_ADDRESS?.trim() || null,
      operatorAddress: process.env.RWA_OPERATOR_ADDRESS?.trim() || null,
      privyTreasuryWalletId: Boolean(process.env.PRIVY_TREASURY_WALLET_ID?.trim()),
      privyOperatorWalletId: Boolean(process.env.PRIVY_OPERATOR_WALLET_ID?.trim()),
      privySafeOwnerWalletId: Boolean(process.env.PRIVY_SAFE_OWNER_WALLET_ID?.trim()),
      privyAppId: Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim()),
      isPrivyOperatorConfigured: isPrivyOperatorConfigured(),
      privyEmbeddedWalletEnabled: true
    };

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
      kycPending: accounts.filter((u) => u.kycStatus === 'PENDING').length
    };

    return NextResponse.json({
      ok: true,
      summary,
      platformConfig,
      accounts,
      auditedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[admin/account-audit]', error);
    return NextResponse.json({ error: 'Audit failed' }, { status: 500 });
  }
}
