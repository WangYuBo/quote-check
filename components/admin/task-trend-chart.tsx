'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export function TaskTrendChart({ data }: { data: { date: string; count: number }[] }) {
  const chartData = data.map((d) => ({
    date: d.date?.slice(5) ?? '',
    count: d.count,
  }));

  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-[hsl(var(--shadcn-border))]" />
          <XAxis
            dataKey="date"
            className="text-xs text-[hsl(var(--shadcn-muted-foreground))]"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            className="text-xs text-[hsl(var(--shadcn-muted-foreground))]"
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--shadcn-popover))',
              border: '1px solid hsl(var(--shadcn-border))',
              borderRadius: '0.5rem',
            }}
          />
          <Bar dataKey="count" fill="hsl(var(--shadcn-primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
