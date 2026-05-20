import type { MarketplaceListing } from '../types/marketplace';

export const MARKETPLACE_FALLBACK_LISTINGS: MarketplaceListing[] = [
  {
    id: 'proj-anelo-tower',
    title: 'Anelo Tower — Oficinas Premium',
    description: 'Activo corporativo tokenizado en microcentro porteño.',
    location: 'Av. Corrientes 1200, Buenos Aires, Argentina',
    imageUrl:
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
    mapEmbedUrl:
      'https://maps.google.com/maps?q=Av.%20Corrientes%201200%20Buenos%20Aires&hl=es&z=14&output=embed',
    apyPercent: 9.2,
    pricePerTokenUsd: 250,
    availableTokens: 3250,
    totalTokens: 10000,
    soldPercent: 68,
    fiscalRegime: 'LEY_19640',
    jurisdiction: 'AR'
  },
  {
    id: 'proj-mendoza-logistics',
    title: 'Mendoza Logistics Hub',
    description: 'Centro logístico con flujo de caja mensual en stablecoins.',
    location: 'Luján de Cuyo, Mendoza, Argentina',
    imageUrl:
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80',
    mapEmbedUrl:
      'https://maps.google.com/maps?q=Lujan%20de%20Cuyo%20Mendoza&hl=es&z=14&output=embed',
    apyPercent: 11.5,
    pricePerTokenUsd: 120,
    availableTokens: 11400,
    totalTokens: 25000,
    soldPercent: 54,
    fiscalRegime: 'LEY_19640',
    jurisdiction: 'AR'
  },
  {
    id: 'proj-punta-este-residences',
    title: 'Punta del Este Residences',
    description: 'Residencial de lujo con liquidez secundaria vía SanovaAMM.',
    location: 'Parada 5, Punta del Este, Uruguay',
    imageUrl:
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
    mapEmbedUrl:
      'https://maps.google.com/maps?q=Punta%20del%20Este%20Uruguay&hl=es&z=14&output=embed',
    apyPercent: 8.4,
    pricePerTokenUsd: 500,
    availableTokens: 1120,
    totalTokens: 8000,
    soldPercent: 86,
    fiscalRegime: 'GENERAL',
    jurisdiction: 'UY'
  }
];
