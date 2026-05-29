import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../packages/database/.env') });
config({ path: resolve(__dirname, '../.env') });
if (process.env.DIRECT_URL?.trim()) process.env.DATABASE_URL = process.env.DIRECT_URL;

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const projectId = process.argv[2] ?? 'proj-apart-hotel-urban-view-anelo-mplonxbv';

async function main() {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  console.log(JSON.stringify(project, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
