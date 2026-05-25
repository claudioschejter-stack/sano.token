import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const root = join(import.meta.dirname, '..');
const contractArg = process.argv[2]?.trim() || '0x6862355103f7cdA2baf3ead5f95356Ee5F4FC546';

function loadEnv(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv(join(root, '.env'));
loadEnv(join(root, '.env.local'));
loadEnv(join(root, 'apps/web/.env.local'));

const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({
    where: { contractAddress: { equals: contractArg, mode: 'insensitive' } }
  });

  if (!project) {
    throw new Error(`Proyecto no encontrado para ${contractArg}`);
  }

  console.log(`\nProyecto: ${project.id} — ${project.title}`);

  const { executeProjectVaultDeploy } = await import('../apps/web/src/lib/blockchain/projectTokenDeploy.ts');
  const result = await executeProjectVaultDeploy(project.id);

  console.log('\nResultado:', JSON.stringify(result, null, 2));

  if (result.status !== 'DEPLOYED' && result.status !== 'ALREADY_HAS_VAULT') {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
