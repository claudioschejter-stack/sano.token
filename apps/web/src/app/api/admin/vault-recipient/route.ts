import { NextRequest, NextResponse } from 'next/server';
import { JsonRpcProvider } from 'ethers';
import { prisma } from '@sanova/database';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { getLinkedWalletForUser } from '../../../../lib/investor/linkedWalletPolicy';
import {
  ensureVaultRecipientAllowed,
  readVaultRecipientState
} from '../../../../lib/blockchain/vaultRecipientAllowlist';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

function rpcUrl(): string {
  return (
    process.env.BASE_RPC_URL?.trim() ||
    process.env.LENDING_BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org'
  );
}

async function resolveWallet(input: { email?: string | null; wallet?: string | null }) {
  const wallet = input.wallet?.trim();
  if (wallet) return wallet;
  const email = input.email?.trim();
  if (!email) return '';
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true }
  });
  if (!user) return '';
  return (await getLinkedWalletForUser(user.id)) ?? '';
}

async function resolveVaults(projectId?: string | null) {
  const projects = await prisma.project.findMany({
    where: {
      vaultAddress: { not: null },
      ...(projectId?.trim() ? { id: projectId.trim() } : {})
    },
    select: { id: true, title: true, vaultAddress: true }
  });
  return projects.filter((row) => row.vaultAddress?.trim());
}

/**
 * Admin: whether each vault would accept this wallet as a share recipient, and
 * where its timelock stands.
 * `GET /api/admin/vault-recipient?email=…&projectId=…`
 */
export async function GET(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const wallet = await resolveWallet({
    email: url.searchParams.get('email'),
    wallet: url.searchParams.get('wallet')
  });
  if (!wallet) {
    return NextResponse.json({ error: 'WALLET_NOT_FOUND' }, { status: 404 });
  }

  const provider = new JsonRpcProvider(rpcUrl());
  try {
    const rows = [];
    for (const project of await resolveVaults(url.searchParams.get('projectId'))) {
      const state = await readVaultRecipientState({
        provider,
        vaultAddress: project.vaultAddress!.trim(),
        recipient: wallet
      });
      rows.push({ projectId: project.id, projectTitle: project.title, state });
    }
    return NextResponse.json({ ok: true, wallet, vaults: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'READ_FAILED';
    console.error('[admin/vault-recipient] GET', error);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    provider.destroy();
  }
}

/**
 * Admin: start or finish the vault's allowance for this recipient.
 * Body: `{ email | wallet, projectId? }`
 *
 * Idempotent: it applies the allowance when the timelock has run out, schedules
 * it when it has not, and does nothing when the wallet is already allowed.
 */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    wallet?: string;
    projectId?: string;
  };

  const wallet = await resolveWallet({ email: body.email, wallet: body.wallet });
  if (!wallet) {
    return NextResponse.json({ error: 'WALLET_NOT_FOUND' }, { status: 404 });
  }

  const provider = new JsonRpcProvider(rpcUrl());
  try {
    const results = [];
    for (const project of await resolveVaults(body.projectId)) {
      const outcome = await ensureVaultRecipientAllowed({
        provider,
        vaultAddress: project.vaultAddress!.trim(),
        recipient: wallet
      }).catch((error) => ({
        ok: false as const,
        code: 'ENSURE_FAILED',
        detail: error instanceof Error ? error.message.slice(0, 250) : undefined
      }));
      results.push({ projectId: project.id, projectTitle: project.title, outcome });
    }

    return NextResponse.json({
      ok: results.every((row) => row.outcome.ok),
      wallet,
      results
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ENSURE_FAILED';
    console.error('[admin/vault-recipient] POST', error);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    provider.destroy();
  }
}
