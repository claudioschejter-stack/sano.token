import type { MarketplaceListing } from '../types/marketplace';

export const MARKETPLACE_FALLBACK_LISTINGS: MarketplaceListing[] = [
  {
    id: 'proj-neuquen-corporate',
    title: 'Neuquén Capital — Complejo Habitacional Corporativo',
    description:
      'Torre residencial B2B con contratos corporativos indexados a operadoras del corredor neuquino. Flujo en USDC.',
    location: 'Av. Argentina 1400, Neuquén Capital, Neuquén, Argentina',
    imageUrl:
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
    mapEmbedUrl:
      'https://maps.google.com/maps?q=Neuquen%20Capital%20Argentina&hl=es&z=13&output=embed',
    apyPercent: 9.2,
    pricePerTokenUsd: 250,
    availableTokens: 3250,
    totalTokens: 10000,
    soldPercent: 68,
    fiscalRegime: 'LEY_19640',
    jurisdiction: 'AR'
  },
  {
    id: 'proj-rincon-logistics',
    title: 'Rincón de los Sauces — Base Logística Energética',
    description:
      'Nave logística y patio de maniobras arrendada a servicios de campo para operaciones shale en Vaca Muerta.',
    location: 'Ruta Provincial 227, Rincón de los Sauces, Neuquén, Argentina',
    imageUrl:
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80',
    mapEmbedUrl:
      'https://maps.google.com/maps?q=Rincon%20de%20los%20Sauces%20Neuquen&hl=es&z=14&output=embed',
    apyPercent: 11.5,
    pricePerTokenUsd: 120,
    availableTokens: 11400,
    totalTokens: 25000,
    soldPercent: 54,
    fiscalRegime: 'LEY_19640',
    jurisdiction: 'AR'
  },
  {
    id: 'proj-san-patricio-industrial',
    title: 'San Patricio del Chañar — Parque Industrial B2B',
    description:
      'Galpones industriales y oficinas técnicas con contratos largos a proveedores del ecosistema hidrocarburífero.',
    location: 'Parque Industrial, San Patricio del Chañar, Neuquén, Argentina',
    imageUrl:
      'https://images.unsplash.com/photo-1565793298595-6a879b980d1b?auto=format&fit=crop&w=1200&q=80',
    mapEmbedUrl:
      'https://maps.google.com/maps?q=San%20Patricio%20del%20Chanar%20Neuquen&hl=es&z=14&output=embed',
    apyPercent: 10.8,
    pricePerTokenUsd: 180,
    availableTokens: 8200,
    totalTokens: 18000,
    soldPercent: 61,
    fiscalRegime: 'LEY_19640',
    jurisdiction: 'AR'
  },
  {
    id: 'proj-plaza-huincul-b2b',
    title: 'Plaza Huincul — Centro de Servicios Operativos',
    description:
      'Complejo mixto de alojamiento y servicios B2B orientado a cuadrillas y contratistas del yacimiento.',
    location: 'Av. San Martín 800, Plaza Huincul, Neuquén, Argentina',
    imageUrl:
      'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80',
    mapEmbedUrl:
      'https://maps.google.com/maps?q=Plaza%20Huincul%20Neuquen&hl=es&z=14&output=embed',
    apyPercent: 9.8,
    pricePerTokenUsd: 95,
    availableTokens: 5400,
    totalTokens: 12000,
    soldPercent: 72,
    fiscalRegime: 'LEY_19640',
    jurisdiction: 'AR'
  },
  {
    id: 'proj-centenario-housing',
    title: 'Centenario — Módulos Habitacionales para Operadoras',
    description:
      'Desarrollo modular de housing corporativo con demanda inelástica de operadoras en expansión de Vaca Muerta.',
    location: 'Av. Centenario 1200, Centenario, Neuquén, Argentina',
    imageUrl:
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
    mapEmbedUrl:
      'https://maps.google.com/maps?q=Centenario%20Neuquen%20Argentina&hl=es&z=14&output=embed',
    apyPercent: 8.4,
    pricePerTokenUsd: 140,
    availableTokens: 2100,
    totalTokens: 8000,
    soldPercent: 86,
    fiscalRegime: 'LEY_19640',
    jurisdiction: 'AR'
  }
];
