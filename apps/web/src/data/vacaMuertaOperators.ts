/** Major oil & gas operators with activity in Vaca Muerta, Neuquén. */
export const VACA_MUERTA_OPERATOR_COUNT = 24;

export type VacaMuertaOperator = {
  id: string;
  /** Used for accessibility only; not shown in the UI. */
  name: string;
  domain: string;
  /** Optional direct logo URL when Clearbit/favicon lookups are unreliable. */
  logoUrl?: string;
};

export const VACA_MUERTA_OPERATORS: VacaMuertaOperator[] = [
  { id: 'ypf', name: 'YPF', domain: 'ypf.com' },
  { id: 'chevron', name: 'Chevron', domain: 'chevron.com' },
  { id: 'shell', name: 'Shell', domain: 'shell.com' },
  { id: 'total', name: 'TotalEnergies', domain: 'totalenergies.com' },
  { id: 'exxon', name: 'ExxonMobil', domain: 'exxonmobil.com' },
  { id: 'pae', name: 'Pan American Energy', domain: 'pan-energy.com' },
  { id: 'pampa', name: 'Pampa Energía', domain: 'pampa.com.ar' },
  { id: 'vista', name: 'Vista Energy', domain: 'vistaenergy.com' },
  { id: 'tecpetrol', name: 'Tecpetrol', domain: 'tecpetrol.com' },
  { id: 'pluspetrol', name: 'Pluspetrol', domain: 'pluspetrol.com' },
  { id: 'cgc', name: 'CGC', domain: 'cgc.energy' },
  { id: 'equinor', name: 'Equinor', domain: 'equinor.com' },
  { id: 'bp', name: 'BP', domain: 'bp.com' },
  { id: 'geopark', name: 'GeoPark', domain: 'geopark.com' },
  { id: 'qatarenergy', name: 'QatarEnergy', domain: 'qatarenergy.qa' },
  { id: 'petronas', name: 'Petronas', domain: 'petronas.com' },
  { id: 'madalena', name: 'Madalena Energy', domain: 'madalenaenergy.com' },
  { id: 'gyp', name: 'GyP', domain: 'gyp.com.ar' },
  { id: 'murphy', name: 'Murphy Oil', domain: 'murphyoilcorp.com' },
  { id: 'conocophillips', name: 'ConocoPhillips', domain: 'conocophillips.com' },
  { id: 'repsol', name: 'Repsol', domain: 'repsol.com' },
  { id: 'eni', name: 'Eni', domain: 'eni.com' },
  { id: 'apache', name: 'Apache Corporation', domain: 'apacorp.com' },
  { id: 'harbour', name: 'Harbour Energy', domain: 'harbourenergy.com' }
];
