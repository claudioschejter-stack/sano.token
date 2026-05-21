'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { PRODUCTION_GROWTH_DATA } from '../../data/investmentThesisMock';
import { useTranslation } from '../../i18n/LocaleProvider';
import { tesisChartPalette } from '../../utils/tesisChartPalette';

export function TesisProductionChart() {
  const c = useTranslation().tesis.charts.production;

  return (
    <div className="h-72 w-full sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={PRODUCTION_GROWTH_DATA} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={tesisChartPalette.grid} />
          <XAxis
            dataKey="year"
            tick={{ fill: tesisChartPalette.muted, fontSize: 12 }}
            axisLine={{ stroke: tesisChartPalette.border }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: tesisChartPalette.muted, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v.toFixed(1)}`}
          />
          <Tooltip
            contentStyle={{
              borderRadius: '8px',
              border: `1px solid ${tesisChartPalette.border}`,
              backgroundColor: tesisChartPalette.card,
              color: tesisChartPalette.text
            }}
            formatter={(value: number) => [`${value.toFixed(2)} ${c.unitBoe}`, c.seriesTotal]}
            labelStyle={{ color: tesisChartPalette.muted }}
          />
          <Line
            type="monotone"
            dataKey="totalBoeD"
            name="totalBoeD"
            stroke={tesisChartPalette.accent}
            strokeWidth={2.5}
            dot={{ fill: tesisChartPalette.accent, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
