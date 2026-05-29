import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../packages/database/.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    where: { tokenStandard: 'ERC4626' },
    select: {
      id: true,
      title: true,
      tokenStandard: true,
      chainId: true,
      tokenDeployStatus: true,
      contractAddress: true,
      vaultAddress: true,
      vaultFundingStatus: true,
      morphoLiquidityStatus: true,
      automationMeta: true,
      collateralTargets: true
    }
  });
  console.log(JSON.stringify(projects, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
