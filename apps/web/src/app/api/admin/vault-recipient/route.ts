import { NextRequest, NextResponse } from 'next/server';
import { JsonRpcProvider } from 'ethers';
import { prisma } from '@sanova/database';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { getLinkedWalletForUser } from '../../../../lib/investor/linkedWalletPolicy';
import {
  ensureVaultRecipientAllowed,
  readVaultRecipientState,
  setVaultAdminDelay
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

/** Every KYC-approved investor with a real wallet linked. */
async function allApprovedInvestorWallets(): Promise<Array<{ email: string; wallet: string }>> {
  const users = await prisma.user.findMany({
    where: { kycStatus: 'APPROVED' },
    select: { id: true, email: true }
  });

  const rows: Array<{ email: string; wallet: string }> = [];
  for (const user of users) {
    const wallet = await getLinkedWalletForUser(user.id).catch(() => null);
    if (wallet) {
      rows.push({ email: user.email ?? user.id, wallet });
    }
  }
  return rows;
}

/**
 * Admin: start or finish the vault's allowance for a recipient.
 * Body: `{ email | wallet, projectId? }`, or `{ scope: 'all_investors' }` to do
 * it for every KYC-approved investor at once, or
 * `{ action: 'lower_delay', delaySeconds? }` to shorten the vault's timelock.
 *
 * Idempotent: it applies the allowance when the timelock has run out, schedules
 * it when it has not, and does nothing when the wallet is already allowed. The
 * bulk mode exists because the timelock is per address but the clocks run in
 * parallel — scheduling everyone at once costs one wait, not one each.
 */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    wallet?: string;
    projectId?: string;
    scope?: 'all_investors';
    action?: 'lower_delay';
    delaySeconds?: number;
  };

  const provider = new JsonRpcProvider(rpcUrl());
  try {
    const vaults = await resolveVaults(body.projectId);

    if (body.action === 'lower_delay') {
      const results = [];
      for (const project of vaults) {
        const outcome = await setVaultAdminDelay({
          provider,
          vaultAddress: project.vaultAddress!.trim(),
          delaySeconds: body.delaySeconds
        }).catch((error) => ({
          ok: false as const,
          code: 'DELAY_FAILED',
          detail: error instanceof Error ? error.message.slice(0, 250) : undefined
        }));
        results.push({ projectId: project.id, projectTitle: project.title, outcome });
      }
      return NextResponse.json({
        ok: results.every((row) => row.outcome.ok),
        action: 'lower_delay',
        results
      });
    }

    const targets =
      body.scope === 'all_investors'
        ? await allApprovedInvestorWallets()
        : await (async () => {
            const wallet = await resolveWallet({ email: body.email, wallet: body.wallet });
            return wallet ? [{ email: body.email?.trim() ?? wallet, wallet }] : [];
          })();

    if (!targets.length) {
      return NextResponse.json({ error: 'WALLET_NOT_FOUND' }, { status: 404 });
    }

    const results = [];
    for (const target of targets) {
      for (const project of vaults) {
        const outcome = await ensureVaultRecipientAllowed({
          provider,
          vaultAddress: project.vaultAddress!.trim(),
          recipient: target.wallet
        }).catch((error) => ({
          ok: false as const,
          code: 'ENSURE_FAILED',
          detail: error instanceof Error ? error.message.slice(0, 250) : undefined
        }));
        results.push({
          email: target.email,
          wallet: target.wallet,
          projectId: project.id,
          projectTitle: project.title,
          outcome
        });
      }
    }

    return NextResponse.json({
      ok: results.every((row) => row.outcome.ok),
      investors: targets.length,
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
