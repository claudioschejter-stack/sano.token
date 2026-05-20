'use client';

import { ErrorBoundary } from 'react-error-boundary';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { terminalChartPalette } from '../../utils/terminalChartPalette';
import { ChartErrorFallback } from './ChartErrorFallback';

export type MonthlyChartPoint = {
  month: string;
  dividendos: number;
  deuda: number;
};

type MonthlyCashFlowChartProps = {
  data: MonthlyChartPoint[];
  formatUsdc: (value: number) => string;
  dividendLabel: string;
  debtLabel: string;
};

function MonthlyCashFlowChartInner({
  data,
  formatUsdc,
  dividendLabel,
  debtLabel
}: MonthlyCashFlowChartProps) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={6}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={terminalChartPalette.border} />
          <XAxis
            dataKey="month"
            tick={{ fill: terminalChartPalette.muted, fontSize: 12 }}
            axisLine={{ stroke: terminalChartPalette.border }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: terminalChartPalette.muted, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => `$${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(value: number) => formatUsdc(value)}
            contentStyle={{
              borderRadius: '8px',
              border: `1px solid ${terminalChartPalette.border}`,
              backgroundColor: terminalChartPalette.card,
              color: terminalChartPalette.text,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)'
            }}
            labelStyle={{ color: terminalChartPalette.muted }}
            itemStyle={{ color: terminalChartPalette.text }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '12px', fontSize: '13px', color: terminalChartPalette.muted }}
            formatter={(value: string) => (value === 'dividendos' ? dividendLabel : debtLabel)}
          />
          <Bar
            dataKey="dividendos"
            name="dividendos"
            fill={terminalChartPalette.primary}
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
          <Bar
            dataKey="deuda"
            name="deuda"
            fill={terminalChartPalette.accent}
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyCashFlowChart(props: MonthlyCashFlowChartProps) {
  return (
    <ErrorBoundary fallbackRender={() => <ChartErrorFallback />}>
      <MonthlyCashFlowChartInner {...props} />
    </ErrorBoundary>
  );
}
