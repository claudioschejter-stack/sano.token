import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const root = join(import.meta.dirname, '..');

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

const vaultAddress = '0x6921C1eB0f15bb9D797c4A5575d0B04c38BCeC8D';
const vaultExplorerUrl = `https://sepolia.basescan.org/address/${vaultAddress}`;
const projectId = 'proj-apart-hotel-urban-view';

const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      vaultAddress,
      contractSmartUrl: vaultExplorerUrl,
      tokenDeployStatus: 'DEPLOYED',
      chainId: 84532
    }
  });

  console.log('Vault guardado en DB:', updated.vaultAddress);
  console.log('Explorer:', vaultExplorerUrl);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
