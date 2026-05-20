import { PrismaClient, FiscalRegime } from '@prisma/client';

const prisma = new PrismaClient();

const listings = [
  {
    id: 'proj-anelo-tower',
    title: 'Anelo Tower — Oficinas Premium',
    description:
      'Activo corporativo tokenizado en microcentro porteño con renta indexada en USD y régimen Ley 19.640.',
    location: 'Av. Corrientes 1200, Buenos Aires, Argentina',
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
    totalTokens: 10000,
    availableTokens: 3250,
    pricePerToken: 250,
    targetYield: 9.2,
    fiscalRegime: FiscalRegime.LEY_19640,
    jurisdiction: 'AR'
  },
  {
    id: 'proj-mendoza-logistics',
    title: 'Mendoza Logistics Hub',
    description:
      'Centro logístico climatizado con contratos take-or-pay y flujo de caja mensual en stablecoins.',
    location: 'Luján de Cuyo, Mendoza, Argentina',
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80',
    totalTokens: 25000,
    availableTokens: 11400,
    pricePerToken: 120,
    targetYield: 11.5,
    fiscalRegime: FiscalRegime.LEY_19640,
    jurisdiction: 'AR'
  },
  {
    id: 'proj-punta-este-residences',
    title: 'Punta del Este Residences',
    description:
      'Desarrollo residencial de lujo con pool de liquidez secundaria SanovaAMM y salida instantánea al tesoro.',
    location: 'Parada 5, Punta del Este, Uruguay',
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
    totalTokens: 8000,
    availableTokens: 1120,
    pricePerToken: 500,
    targetYield: 8.4,
    fiscalRegime: FiscalRegime.GENERAL,
    jurisdiction: 'UY'
  }
];

async function main() {
  for (const listing of listings) {
    await prisma.project.upsert({
      where: { id: listing.id },
      create: listing,
      update: {
        ...listing,
        isActive: true
      }
    });
  }

  console.log(`[seed] Upserted ${listings.length} marketplace projects.`);
}

main()
  .catch((error) => {
    console.error('[seed] Failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
