import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const query = process.argv[2]?.trim().toLowerCase() ?? 'bragadin';

async function main() {
  console.log(`[diagnose-registration] searching for "${query}"`);

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: query, mode: 'insensitive' } },
        { name: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query.replace(/\D/g, ''), mode: 'insensitive' } }
      ]
    },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      passwordHash: true,
      accountStatus: true,
      kycStatus: true,
      investorAccessEnabled: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: { updatedAt: 'desc' }
  });

  console.log(`Users matched: ${users.length}`);
  for (const user of users) {
    console.log(
      JSON.stringify(
        {
          ...user,
          hasPassword: Boolean(user.passwordHash),
          passwordHash: undefined
        },
        null,
        2
      )
    );
  }

  const attempts = await prisma.registrationAttempt.findMany({
    where: {
      email: { contains: query, mode: 'insensitive' }
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  });

  console.log(`Registration attempts matched: ${attempts.length}`);
  for (const attempt of attempts) {
    console.log(JSON.stringify(attempt, null, 2));
  }
}

main()
  .catch((error) => {
    console.error('[diagnose-registration] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
