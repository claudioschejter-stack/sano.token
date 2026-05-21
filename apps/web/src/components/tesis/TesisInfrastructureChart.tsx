'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { INFRASTRUCTURE_DONUT_DATA, INFRASTRUCTURE_GAP_DATA } from '../../data/investmentThesisMock';
import { useTranslation } from '../../i18n/LocaleProvider';
import { tesisChartPalette } from '../../utils/tesisChartPalette';

export function TesisInfrastructureChart() {
  const c = useTranslation().tesis.charts.infrastructure;
  const segmentLabels: Record<string, string> = {
    corporate: c.segmentCorporate,
    logistics: c.segmentLogistics,
    housing: c.segmentHousing
  };

  const barData = INFRASTRUCTURE_GAP_DATA.map((row) => ({
    segment: segmentLabels[row.segmentKey],
    demand: row.demandKsqm,
    supply: row.supplyKsqm
  }));

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-5 lg:items-center">
      <div className="h-64 w-full lg:col-span-3 lg:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={tesisChartPalette.grid} />
            <XAxis
              dataKey="segment"
              tick={{ fill: tesisChartPalette.muted, fontSize: 11 }}
              axisLine={{ stroke: tesisChartPalette.border }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: tesisChartPalette.muted, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}k`}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '8px',
                border: `1px solid ${tesisChartPalette.border}`,
                backgroundColor: tesisChartPalette.card,
                color: tesisChartPalette.text
              }}
              formatter={(value: number, name: string) => [
                `${value} ${c.unitSqm}`,
                name === 'demand' ? c.legendDemand : c.legendSupply
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px', color: tesisChartPalette.muted }}
              formatter={(value: string) => (value === 'demand' ? c.legendDemand : c.legendSupply)}
            />
            <Bar
              dataKey="demand"
              name="demand"
              fill={tesisChartPalette.demand}
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
            />
            <Bar
              dataKey="supply"
              name="supply"
              fill={tesisChartPalette.supply}
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col items-center lg:col-span-2">
        <p className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-slate-400">
          {c.donutTitle}
        </p>
        <div className="h-48 w-full max-w-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[...INFRASTRUCTURE_DONUT_DATA]}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="58%"
                outerRadius="85%"
                paddingAngle={2}
              >
                {[...INFRASTRUCTURE_DONUT_DATA].map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: '8px',
                  border: `1px solid ${tesisChartPalette.border}`,
                  backgroundColor: tesisChartPalette.card,
                  color: tesisChartPalette.text
                }}
                formatter={(value: number) => [`${value}%`, '']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-center text-sm text-slate-400">{c.donutCaption}</p>
      </div>
    </div>
  );
}
