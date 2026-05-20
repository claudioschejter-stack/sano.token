/** Fuente única de verdad para colores del terminal (Tailwind + Recharts). */
export const terminalChartPalette = {
  bg: '#0A0E17',
  card: '#111827',
  border: '#1F2937',
  text: '#E2E8F0',
  primary: '#3B82F6',
  accent: '#F97316',
  success: '#22C55E',
  warning: '#FBBF24',
  muted: '#6B7280'
} as const;

export type TerminalChartPalette = typeof terminalChartPalette;
