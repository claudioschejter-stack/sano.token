/** Major oil & gas operators with activity in Vaca Muerta, Neuquén. */
export const VACA_MUERTA_OPERATOR_COUNT = 24;

export type VacaMuertaOperator = {
  id: string;
  /** Used for accessibility only; not shown in the UI. */
  name: string;
  domain: string;
  /** Local color logo in /public/logos/operators */
  logoUrl: string;
  /** Optional Tailwind classes to fine-tune logo fit inside the card */
  logoClassName?: string;
};

export const VACA_MUERTA_OPERATORS: VacaMuertaOperator[] = [
  {
    id: 'ypf',
    name: 'YPF',
    domain: 'ypf.com',
    logoUrl: '/logos/operators/ypf.svg',
    logoClassName: 'mx-auto h-9 w-auto max-w-[7rem] object-contain sm:h-10 sm:max-w-[7.5rem]'
  },
  { id: 'chevron', name: 'Chevron', domain: 'chevron.com', logoUrl: '/logos/operators/chevron.png' },
  { id: 'shell', name: 'Shell', domain: 'shell.com', logoUrl: '/logos/operators/shell.png' },
  { id: 'total', name: 'TotalEnergies', domain: 'totalenergies.com', logoUrl: '/logos/operators/total.png' },
  { id: 'exxon', name: 'ExxonMobil', domain: 'exxonmobil.com', logoUrl: '/logos/operators/exxon.svg' },
  {
    id: 'pae',
    name: 'Pan American Energy',
    domain: 'pan-energy.com',
    logoUrl: '/logos/operators/pae.svg',
    logoClassName: 'mx-auto h-9 w-auto max-w-[8.75rem] object-contain sm:h-10 sm:max-w-[9.25rem]'
  },
  { id: 'pampa', name: 'Pampa Energía', domain: 'pampa.com.ar', logoUrl: '/logos/operators/pampa.svg' },
  { id: 'vista', name: 'Vista Energy', domain: 'vistaenergy.com', logoUrl: '/logos/operators/vista.png' },
  { id: 'tecpetrol', name: 'Tecpetrol', domain: 'tecpetrol.com', logoUrl: '/logos/operators/tecpetrol.svg' },
  {
    id: 'pluspetrol',
    name: 'Pluspetrol',
    domain: 'pluspetrol.com',
    logoUrl: '/logos/operators/pluspetrol.svg',
    logoClassName:
      'mx-auto h-[calc(2rem+2mm)] w-auto max-w-[calc(7.75rem+2mm)] object-contain sm:h-[calc(2.25rem+2mm)] sm:max-w-[calc(8.25rem+2mm)]'
  },
  { id: 'cgc', name: 'CGC', domain: 'cgc.energy', logoUrl: '/logos/operators/cgc.png' },
  { id: 'equinor', name: 'Equinor', domain: 'equinor.com', logoUrl: '/logos/operators/equinor.png' },
  { id: 'bp', name: 'BP', domain: 'bp.com', logoUrl: '/logos/operators/bp.png' },
  { id: 'geopark', name: 'GeoPark', domain: 'geopark.com', logoUrl: '/logos/operators/geopark.png' },
  { id: 'qatarenergy', name: 'QatarEnergy', domain: 'qatarenergy.qa', logoUrl: '/logos/operators/qatarenergy.svg' },
  { id: 'petronas', name: 'Petronas', domain: 'petronas.com', logoUrl: '/logos/operators/petronas.svg' },
  { id: 'madalena', name: 'Madalena Energy', domain: 'madalenaenergy.com', logoUrl: '/logos/operators/madalena.png' },
  { id: 'gyp', name: 'GyP', domain: 'gyp.com.ar', logoUrl: '/logos/operators/gyp.png' },
  { id: 'murphy', name: 'Murphy Oil', domain: 'murphyoilcorp.com', logoUrl: '/logos/operators/murphy.png' },
  {
    id: 'conocophillips',
    name: 'ConocoPhillips',
    domain: 'conocophillips.com',
    logoUrl: '/logos/operators/conocophillips.png'
  },
  { id: 'repsol', name: 'Repsol', domain: 'repsol.com', logoUrl: '/logos/operators/repsol.png' },
  { id: 'eni', name: 'Eni', domain: 'eni.com', logoUrl: '/logos/operators/eni.png' },
  { id: 'apache', name: 'Apache Corporation', domain: 'apacorp.com', logoUrl: '/logos/operators/apache.svg' },
  { id: 'harbour', name: 'Harbour Energy', domain: 'harbourenergy.com', logoUrl: '/logos/operators/harbour.png' }
];
