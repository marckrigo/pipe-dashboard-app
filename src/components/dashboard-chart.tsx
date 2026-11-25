import { memo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChartRow, ChartType } from '../helpers/chart-data';

/** One palette for every chart type: colors stay distinguishable through the eighth slice. */
const COLORS = [
  '#4f46e5',
  '#0d9488',
  '#f59e0b',
  '#e11d48',
  '#7c3aed',
  '#059669',
  '#ea580c',
  '#0284c7',
];

const CHART_MARGIN = { top: 12, right: 16, left: 0, bottom: 4 };
const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  fontSize: 13,
};

function tick(value: string): string {
  return value.length > 14 ? `${value.slice(0, 13)}…` : value;
}

type DashboardChartProps = {
  type: ChartType;
  data: ChartRow[];
};

/**
 * Keep Recharts isolated here so PipeDashboard only handles controls and data. `ResponsiveContainer`
 * must live here because Recharts clones its child with browser-measured width/height, and pie
 * `Cell`s must be direct children of `Pie`.
 */
export const DashboardChart = memo(function DashboardChart({ type, data }: DashboardChartProps) {
  function buildChart() {
    const grid = <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />;
    // Every group still gets a bar/point; only axis labels are sampled to keep them readable.
    const xAxis = (
      <XAxis
        dataKey="name"
        tickFormatter={tick}
        interval="preserveStartEnd"
        minTickGap={18}
        height={50}
        tick={{ fontSize: 11, fill: '#64748b' }}
      />
    );
    const yAxis = <YAxis tick={{ fontSize: 11, fill: '#64748b' }} width={36} />;

    if (type === 'pie') {
      return (
        <PieChart margin={CHART_MARGIN}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius="68%"
            paddingAngle={2}
            stroke="#fff"
            strokeWidth={2}
            labelLine={false}
            label
            isAnimationActive={false}
          >
            {data.map((row, index) => (
              <Cell key={row.name} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend />
        </PieChart>
      );
    }

    if (type === 'bar') {
      return (
        <BarChart data={data} margin={CHART_MARGIN}>
          {grid}
          {xAxis}
          {yAxis}
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#eef2ff' }} />
          <Bar
            dataKey="value"
            name="Cards"
            radius={[6, 6, 0, 0]}
            maxBarSize={48}
            isAnimationActive={false}
          >
            {data.map((row, index) => (
              <Cell key={row.name} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      );
    }

    if (type === 'line') {
      return (
        <LineChart data={data} margin={CHART_MARGIN}>
          {grid}
          {xAxis}
          {yAxis}
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Line
            type="monotone"
            dataKey="value"
            name="Cards"
            stroke={COLORS[0]}
            strokeWidth={2.5}
            dot={{ r: 3, fill: COLORS[0] }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      );
    }

    return (
      <AreaChart data={data} margin={CHART_MARGIN}>
        <defs>
          <linearGradient id="dashboardAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS[0]} stopOpacity={0.45} />
            <stop offset="100%" stopColor={COLORS[0]} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {grid}
        {xAxis}
        {yAxis}
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Area
          type="monotone"
          dataKey="value"
          name="Cards"
          stroke={COLORS[0]}
          strokeWidth={2.5}
          fill="url(#dashboardAreaFill)"
          isAnimationActive={false}
        />
      </AreaChart>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      {buildChart()}
    </ResponsiveContainer>
  );
});
