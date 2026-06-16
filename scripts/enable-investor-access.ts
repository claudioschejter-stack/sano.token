import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../packages/database/.env') });
config({ path: resolve(__dirname, '../.env') });
if (process.env.DIRECT_URL?.trim()) process.env.DATABASE_URL = process.env.DIRECT_URL;

import { prisma } from '@sanova/database';

const email = (process.argv[2] ?? process.env.SEED_INVESTOR_EMAIL ?? 'claudioschejter@hotmail.com')
  .trim()
  .toLowerCase();

async function main() {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { investorAccessEnabled: true }
  });

  console.log('[enable-investor-access] OK', {
    email: updated.email,
    investorAccessEnabled: updated.investorAccessEnabled,
    systemRole: updated.systemRole
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
