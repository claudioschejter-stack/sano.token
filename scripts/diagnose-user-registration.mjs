import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const query = process.argv[2]?.trim().toLowerCase() ?? 'bragadin';

function buildUserWhere(queryText: string) {
  const phoneDigits = queryText.replace(/\D/g, '');
  const orFilters = [
    { email: { contains: queryText, mode: 'insensitive' } },
    { name: { contains: queryText, mode: 'insensitive' } }
  ];

  if (phoneDigits.length >= 4) {
    orFilters.push({ phone: { contains: phoneDigits, mode: 'insensitive' } });
  }

  return { OR: orFilters };
}

async function main() {
  console.log(`[diagnose-registration] searching for "${query}"`);

  const exactEmailUser = query.includes('@')
    ? await prisma.user.findUnique({
        where: { email: query },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          passwordHash: true,
          oauthProvider: true,
          accountStatus: true,
          kycStatus: true,
          investorAccessEnabled: true,
          emailVerifiedAt: true,
          phoneVerifiedAt: true,
          createdAt: true,
          updatedAt: true
        }
      })
    : null;

  if (exactEmailUser) {
    console.log('Exact email user:', {
      ...exactEmailUser,
      hasPassword: Boolean(exactEmailUser.passwordHash),
      passwordHash: undefined
    });
  } else if (query.includes('@')) {
    console.log('Exact email user: null');
  }

  const users = await prisma.user.findMany({
    where: buildUserWhere(query),
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      passwordHash: true,
      oauthProvider: true,
      accountStatus: true,
      kycStatus: true,
      investorAccessEnabled: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: { updatedAt: 'desc' },
    take: 20
  });

  console.log(`Users matched (fuzzy): ${users.length}`);
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

  const attemptTotal = await prisma.registrationAttempt.count();
  console.log(`RegistrationAttempt total rows: ${attemptTotal}`);

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

  const recentAttempts = await prisma.registrationAttempt.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  if (recentAttempts.length > 0) {
    console.log('Most recent registration attempts (any email):');
    for (const attempt of recentAttempts) {
      console.log(JSON.stringify(attempt, null, 2));
    }
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
