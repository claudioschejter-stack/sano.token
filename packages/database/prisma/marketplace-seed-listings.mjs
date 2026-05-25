/** Marketplace demo listings — aligned with apps/web/src/data/marketplaceFallback.ts */
export const MARKETPLACE_SEED_LISTINGS = [
  {
    id: 'proj-neuquen-corporate',
    title: 'Neuquén Capital — Complejo Habitacional Corporativo',
    description:
      'Torre residencial B2B con contratos corporativos indexados a operadoras del corredor neuquino. Flujo en USDC.',
    location: 'Av. Argentina 1400, Neuquén Capital, Neuquén, Argentina',
    image:
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
    totalTokens: 10000,
    availableTokens: 3250,
    pricePerToken: 250,
    targetYield: 9.2,
    tokenInstrumentType: 'EQUITY',
    equitySharePercent: 100,
    fiscalRegime: 'LEY_19640',
    jurisdiction: 'AR'
  },
  {
    id: 'proj-rincon-logistics',
    title: 'Rincón de los Sauces — Base Logística Energética',
    description:
      'Nave logística y patio de maniobras arrendada a servicios de campo para operaciones shale en Vaca Muerta.',
    location: 'Ruta Provincial 227, Rincón de los Sauces, Neuquén, Argentina',
    image:
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80',
    totalTokens: 25000,
    availableTokens: 11400,
    pricePerToken: 120,
    targetYield: 11.5,
    tokenInstrumentType: 'DEBT',
    maturityDate: new Date('2029-06-30T00:00:00.000Z'),
    fiscalRegime: 'LEY_19640',
    jurisdiction: 'AR'
  },
  {
    id: 'proj-san-patricio-industrial',
    title: 'San Patricio del Chañar — Parque Industrial B2B',
    description:
      'Galpones industriales y oficinas técnicas con contratos largos a proveedores del ecosistema hidrocarburífero.',
    location: 'Parque Industrial, San Patricio del Chañar, Neuquén, Argentina',
    image:
      'https://images.unsplash.com/photo-1565793298595-6a879b980d1b?auto=format&fit=crop&w=1200&q=80',
    totalTokens: 18000,
    availableTokens: 8200,
    pricePerToken: 180,
    targetYield: 10.8,
    tokenInstrumentType: 'EQUITY',
    equitySharePercent: 100,
    fiscalRegime: 'LEY_19640',
    jurisdiction: 'AR'
  },
  {
    id: 'proj-plaza-huincul-b2b',
    title: 'Plaza Huincul — Centro de Servicios Operativos',
    description:
      'Complejo mixto de alojamiento y servicios B2B orientado a cuadrillas y contratistas del yacimiento.',
    location: 'Av. San Martín 800, Plaza Huincul, Neuquén, Argentina',
    image:
      'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80',
    totalTokens: 12000,
    availableTokens: 5400,
    pricePerToken: 95,
    targetYield: 9.8,
    tokenInstrumentType: 'EQUITY',
    equitySharePercent: 100,
    fiscalRegime: 'LEY_19640',
    jurisdiction: 'AR'
  },
  {
    id: 'proj-centenario-housing',
    title: 'Centenario — Módulos Habitacionales para Operadoras',
    description:
      'Desarrollo modular de housing corporativo con demanda inelástica de operadoras en expansión de Vaca Muerta.',
    location: 'Av. Centenario 1200, Centenario, Neuquén, Argentina',
    image:
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
    totalTokens: 8000,
    availableTokens: 2100,
    pricePerToken: 140,
    targetYield: 8.4,
    tokenInstrumentType: 'DEBT',
    maturityDate: new Date('2028-12-31T00:00:00.000Z'),
    fiscalRegime: 'LEY_19640',
    jurisdiction: 'AR'
  },
  {
    id: 'proj-anelo-services',
    title: 'Añelo — Hub de Servicios Petroleros',
    description:
      'Complejo de oficinas, talleres y alojamiento B2B en el corazón operativo de Vaca Muerta, con contratos indexados a operadoras.',
    location: 'Ruta Nacional 151, Añelo, Neuquén, Argentina',
    image:
      'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
    totalTokens: 14000,
    availableTokens: 8120,
    pricePerToken: 165,
    targetYield: 10.2,
    tokenInstrumentType: 'EQUITY',
    equitySharePercent: 100,
    fiscalRegime: 'LEY_19640',
    jurisdiction: 'AR'
  }
];

export const LEGACY_MARKETPLACE_PROJECT_IDS = [
  'proj-anelo-tower',
  'proj-mendoza-logistics',
  'proj-punta-este-residences'
];
