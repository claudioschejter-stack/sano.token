#!/usr/bin/env node
/**
 * Answer, for every deployed project: what does the security report complain
 * about, and is a 24h admin timelock actually running for it?
 *
 * The report alerts daily but says nothing about the clock, so there was no way
 * to tell "esperá el timelock" from "nadie lo arrancó" — and the deploy path
 * swallowed the revert that would have started it, so the second case is the
 * common one.
 *
 * Every read retries: a throttled `eth_call` on Base surfaces as
 * "missing revert data", which reads exactly like a contract that reverted.
 *
 * Usage: DATABASE_URL="$POSTGRES_URL" npx tsx scripts/ops/inspect-rwa-security-timelocks.ts
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { AbiCoder, Contract, JsonRpcProvider, getAddress, keccak256 } from 'ethers';

/**
 * Resolve the endpoint through the same module the server uses.
 *
 * This script had its own copy of the precedence rules and its own
 * `includes('mainnet.base.org')` check — and that substring comparison is the
 * bug CodeQL flagged in `baseRpc.ts`, reintroduced here by copying the logic.
 * Two implementations of one decision is how it happened twice.
 */
import {
  describeBaseRpc,
  resolveBaseMainnetRpcUrl
} from '../../apps/web/src/lib/blockchain/baseRpc';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env.local') });

const coder = AbiCoder.defaultAbiCoder();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UINT256_MAX = (1n << 256n) - 1n;

const ABI = [
  'function owner() view returns (address)',
  'function asset() view returns (address)',
  'function totalAssets() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function dailyWithdrawalLimit() view returns (uint256)',
  'function adminActionDelay() view returns (uint256)',
  'function adminActionReadyAt(bytes32) view returns (uint256)',
  'function setupExpiresAt() view returns (uint256)',
  'function externalContractAllowed(address) view returns (bool)',
  'function kycApproved(address) view returns (bool)'
];

/** Mirrors `allowedExternalContractsForChain(8453)`. */
const POLICY_ADDRESSES = [
  ['morpho', '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb'],
  ['morphoIrm', '0x46415998764C29aB2a25CbeA6254146D50D22687'],
  ['weth', '0x4200000000000000000000000000000000000006'],
  ['usdc', '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913']
] as const;

const TREASURY = getAddress('0xa993743CFB85E8d6481Ef60bb3D397F49604A592');

function allowActionId(account: string): string {
  return keccak256(
    coder.encode(
      ['string', 'address', 'bool'],
      ['SET_EXTERNAL_CONTRACT_ALLOWED', getAddress(account), true]
    )
  );
}

function limitActionId(limit: bigint): string {
  return keccak256(coder.encode(['string', 'uint256'], ['SET_DAILY_WITHDRAWAL_LIMIT', limit]));
}

async function read<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === 4) {
        console.log(
          `     (lectura ${label} falló: ${(error instanceof Error ? error.message : String(error)).slice(0, 70)})`
        );
        return null;
      }
      await sleep(1500 * (attempt + 1));
    }
  }
  return null;
}

function describeClock(readyAt: bigint | null, now: number): string {
  if (readyAt === null) return 'ilegible (RPC)';
  if (readyAt === 0n) return 'SIN AGENDAR — no hay reloj corriendo';
  const at = new Date(Number(readyAt) * 1000).toISOString();
  const hours = (Number(readyAt) - now) / 3600;
  return Number(readyAt) <= now
    ? `LISTO para aplicar (venció hace ${Math.abs(hours).toFixed(1)}h, ${at})`
    : `esperando ${hours.toFixed(1)}h más (hasta ${at})`;
}

async function main() {
  const prisma = new PrismaClient();
  const projects = await prisma.project.findMany({
    where: { contractAddress: { not: null } },
    select: { id: true, title: true, contractAddress: true, vaultAddress: true }
  });

  const rpc = resolveBaseMainnetRpcUrl();
  const described = describeBaseRpc();

  if (described.dedicated) {
    console.log(`RPC: ${described.provider} (${described.url ?? 'n/a'})`);
  } else {
    console.log(
      'RPC: endpoint público de Base — limita ráfagas de eth_call, esperá lecturas ilegibles.\n' +
        'Para un resultado fiable: ALCHEMY_API_KEY=... npx tsx scripts/ops/inspect-rwa-security-timelocks.ts'
    );
  }

  // The pauses exist only to stay under the public endpoint's burst limit; a
  // dedicated one turns a 30-second run into a couple of seconds.
  const throttle = described.dedicated ? async () => {} : sleep;

  const provider = new JsonRpcProvider(rpc, 8453, { staticNetwork: true });
  const now = Math.floor(Date.now() / 1000);

  for (const project of projects) {
    console.log(`\n════════ ${project.id} — ${project.title}`);

    const contracts: Array<{ label: 'token' | 'vault'; address: string }> = [
      { label: 'token', address: project.contractAddress! }
    ];
    if (project.vaultAddress) {
      contracts.push({ label: 'vault', address: project.vaultAddress });
    }

    for (const { label, address } of contracts) {
      const contract = new Contract(getAddress(address), ABI, provider);
      await throttle(1000);

      const owner = await read('owner', () => contract.owner() as Promise<string>);
      const delay = await read('adminActionDelay', () => contract.adminActionDelay() as Promise<bigint>);
      const setup = await read('setupExpiresAt', () => contract.setupExpiresAt() as Promise<bigint>);

      console.log(`\n── ${label} ${address}`);
      console.log(
        `   owner=${owner ?? '?'}${owner && owner.toLowerCase() === TREASURY.toLowerCase() ? ' (treasury OK)' : ' (NO es la treasury)'}`
      );
      console.log(
        `   timelock=${delay === null ? '?' : `${Number(delay) / 3600}h`} ventana de setup=${
          setup === null ? '?' : Number(setup) > now ? 'ABIERTA (sin timelock)' : 'cerrada'
        }`
      );

      for (const [name, policyAddress] of POLICY_ADDRESSES) {
        await throttle(900);
        const allowed = await read(name, () =>
          contract.externalContractAllowed(getAddress(policyAddress)) as Promise<boolean>
        );
        if (allowed === true) {
          console.log(`   allowlist ${name}: permitido`);
          continue;
        }
        if (allowed === null) {
          console.log(`   allowlist ${name}: ILEGIBLE (no concluir que falta)`);
          continue;
        }
        await throttle(900);
        const readyAt = await read(`${name}-clock`, () =>
          contract.adminActionReadyAt(allowActionId(policyAddress)) as Promise<bigint>
        );
        console.log(`   allowlist ${name}: FALTA → ${describeClock(readyAt, now)}`);
      }

      if (label !== 'vault') continue;

      await throttle(900);
      const totalAssets = await read('totalAssets', () => contract.totalAssets() as Promise<bigint>);
      const limit = await read('dailyWithdrawalLimit', () => contract.dailyWithdrawalLimit() as Promise<bigint>);
      const treasuryShares = await read('treasuryShares', () => contract.balanceOf(TREASURY) as Promise<bigint>);

      console.log(
        `   totalAssets=${totalAssets?.toString() ?? '?'} treasuryShares=${treasuryShares?.toString() ?? '?'}`
      );

      if (limit === null || totalAssets === null) {
        console.log('   límite diario: ILEGIBLE');
        continue;
      }

      const target = totalAssets / 10n;
      if (limit > 0n && limit <= target) {
        console.log(`   límite diario: OK (${limit.toString()} <= ${target.toString()})`);
        continue;
      }

      await throttle(900);
      const readyAt = await read('limit-clock', () =>
        contract.adminActionReadyAt(limitActionId(target)) as Promise<bigint>
      );
      console.log(
        `   límite diario: ${limit === UINT256_MAX ? 'SIN LÍMITE (uint256 max)' : limit.toString()} → objetivo ${target.toString()} → ${describeClock(readyAt, now)}`
      );
    }
  }

  provider.destroy();
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
