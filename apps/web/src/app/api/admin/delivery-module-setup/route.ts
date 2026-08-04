import { NextRequest, NextResponse } from 'next/server';
import { JsonRpcProvider, Wallet } from 'ethers';
import { prisma } from '@sanova/database';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import {
  deliveryOperatorModuleAddress,
  setupDeliveryOperatorModule
} from '../../../../lib/blockchain/deliveryOperatorModule';
import { resolveTreasuryOwnerSigner } from '../../../../lib/blockchain/treasuryOwnerSigner';
import { governanceSafeAddress } from '../../../../lib/blockchain/assetGovernance';
import { resolveChainId } from '../../../../lib/blockchain/explorerUrls';
import { privyOperatorWalletId, resolveRwaOperatorAddressEnv } from '../../../../lib/privy/config';
import { privyApiBase, privyHeaders } from '../../../../lib/privy/privyHttp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

function rpcUrl(): string {
  return process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org';
}

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

async function deliverableProjects(projectIds?: string[]) {
  return prisma.project.findMany({
    where: {
      contractAddress: { not: null },
      vaultAddress: { not: null },
      ...(projectIds?.length ? { id: { in: projectIds } } : {})
    },
    select: { id: true, title: true, contractAddress: true, vaultAddress: true }
  });
}

/** Admin: current state of automated share delivery. */
export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    moduleAddress: deliveryOperatorModuleAddress(),
    governanceSafe: governanceSafeAddress(),
    operatorEnvAddress: resolveRwaOperatorAddressEnv(),
    operatorWalletAddress: await privyWalletAddress(privyOperatorWalletId()),
    projects: await deliverableProjects()
  });
}

/**
 * Admin: deploy and wire the delivery operator module so investor share
 * delivery keeps running once the Safe moves above threshold 1.
 *
 * Body: `{ safeAddress?, projectIds?, operatorAddress?, moduleAddress? }`
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

  const safeAddress = body.safeAddress?.trim() || governanceSafeAddress();
  if (!safeAddress) {
    return NextResponse.json({ error: 'SAFE_ADDRESS_REQUIRED' }, { status: 400 });
  }

  const projects = await deliverableProjects(body.projectIds);
  const vaults = projects
    .filter((row) => row.contractAddress && row.vaultAddress)
    .map((row) => ({
      vaultAddress: row.vaultAddress!,
      kycTokenAddress: row.contractAddress!
    }));

  if (!vaults.length) {
    return NextResponse.json({ error: 'NO_VAULTS_TO_ALLOW' }, { status: 400 });
  }

  const operatorAddress =
    body.operatorAddress?.trim() ||
    (await privyWalletAddress(privyOperatorWalletId())) ||
    resolveRwaOperatorAddressEnv();

  if (!operatorAddress) {
    return NextResponse.json({ error: 'OPERATOR_ADDRESS_REQUIRED' }, { status: 400 });
  }

  const provider = new JsonRpcProvider(rpcUrl());
  try {
    const signer = await resolveTreasuryOwnerSigner(provider, resolveChainId());
    if (!signer) {
      return NextResponse.json(
        {
          error:
            'SAFE_OWNER_SIGNER_MISSING: configurá PRIVY_SAFE_OWNER_WALLET_ID + TREASURY_OWNER_ADDRESS'
        },
        { status: 400 }
      );
    }

    const deployKey =
      process.env.TOKEN_DEPLOY_PRIVATE_KEY?.trim() ||
      process.env.TREASURY_OWNER_PRIVATE_KEY?.trim() ||
      null;

    const result = await setupDeliveryOperatorModule({
      safeAddress,
      vaults,
      operatorAddress,
      moduleAddress: body.moduleAddress ?? null,
      signer,
      deploySigner: deployKey ? new Wallet(deployKey, provider) : null
    });

    const ok = result.steps.every((step) => step.ok);
    return NextResponse.json({ ok, result }, { status: ok ? 200 : 409 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DELIVERY_MODULE_SETUP_FAILED';
    console.error('[admin/delivery-module-setup]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    provider.destroy();
  }
}
