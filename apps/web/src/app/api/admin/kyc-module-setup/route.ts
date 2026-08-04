import { NextRequest, NextResponse } from 'next/server';
import { Contract, JsonRpcProvider, getAddress } from 'ethers';
import { prisma } from '@sanova/database';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import {
  kycOperatorModuleAddress,
  setupKycOperatorModule
} from '../../../../lib/blockchain/kycOperatorModule';
import { privyOperatorWalletId, resolveRwaOperatorAddressEnv } from '../../../../lib/privy/config';
import { privyApiBase, privyHeaders } from '../../../../lib/privy/privyHttp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const BASE_MAINNET_RPC = 'https://mainnet.base.org';

async function privyWalletAddress(walletId: string): Promise<string | null> {
  if (!walletId) return null;
  try {
    const response = await fetch(`${privyApiBase()}/v1/wallets/${walletId}`, {
      headers: privyHeaders(),
      cache: 'no-store'
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { address?: string };
    return payload.address?.trim() ?? null;
  } catch {
    return null;
  }
}

async function tokenOwners(tokens: string[]) {
  const provider = new JsonRpcProvider(process.env.BASE_RPC_URL?.trim() || BASE_MAINNET_RPC);
  const out: Array<{ token: string; owner: string | null }> = [];
  try {
    for (const token of tokens) {
      try {
        const contract = new Contract(
          token,
          ['function owner() view returns (address)'],
          provider
        );
        out.push({ token, owner: getAddress((await contract.owner()) as string) });
      } catch {
        out.push({ token, owner: null });
      }
    }
  } finally {
    provider.destroy();
  }
  return out;
}

/** Admin: current state of the two-tier whitelisting setup. */
export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const projects = await prisma.project.findMany({
    where: { isActive: true, contractAddress: { not: null } },
    select: { id: true, title: true, contractAddress: true, vaultAddress: true }
  });

  const tokens = projects
    .map((row) => row.contractAddress)
    .filter((row): row is string => Boolean(row));

  return NextResponse.json({
    ok: true,
    moduleAddress: kycOperatorModuleAddress(),
    operatorEnvAddress: resolveRwaOperatorAddressEnv(),
    operatorWalletAddress: await privyWalletAddress(privyOperatorWalletId()),
    projects,
    tokenOwners: await tokenOwners(tokens)
  });
}

/**
 * Admin: deploy and wire the KYC operator module so the Safe keeps ownership
 * (mint / pause / ownership) while the operator can only whitelist investors.
 *
 * Body: `{ safeAddress, projectIds?, operatorAddress?, moduleAddress? }`
 */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    safeAddress?: string;
    projectIds?: string[];
    operatorAddress?: string;
    moduleAddress?: string;
  };

  if (!body.safeAddress?.trim()) {
    return NextResponse.json({ error: 'SAFE_ADDRESS_REQUIRED' }, { status: 400 });
  }

  const projects = await prisma.project.findMany({
    where: {
      isActive: true,
      contractAddress: { not: null },
      ...(body.projectIds?.length ? { id: { in: body.projectIds } } : {})
    },
    select: { id: true, contractAddress: true }
  });

  const tokenAddresses = projects
    .map((row) => row.contractAddress)
    .filter((row): row is string => Boolean(row));

  if (!tokenAddresses.length) {
    return NextResponse.json({ error: 'NO_TOKENIZED_PROJECTS' }, { status: 400 });
  }

  const operatorAddress =
    body.operatorAddress?.trim() ||
    (await privyWalletAddress(privyOperatorWalletId())) ||
    resolveRwaOperatorAddressEnv();

  if (!operatorAddress) {
    return NextResponse.json({ error: 'OPERATOR_ADDRESS_REQUIRED' }, { status: 400 });
  }

  try {
    const result = await setupKycOperatorModule({
      safeAddress: body.safeAddress.trim(),
      tokenAddresses,
      operatorAddress,
      moduleAddress: body.moduleAddress ?? null
    });

    const ok = result.steps.every((step) => step.ok);
    return NextResponse.json({ ok, result }, { status: ok ? 200 : 409 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'KYC_MODULE_SETUP_FAILED';
    console.error('[admin/kyc-module-setup]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
