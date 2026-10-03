import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCurrency, formatDate } from '@/lib/utils';

interface RevenueAreaProps {
  data: { date: string; revenue: number }[];
  height?: number;
}

export function RevenueArea({ data, height = 260 }: RevenueAreaProps): JSX.Element {
  if (!data.length) {
    return <div className="grid h-[200px] place-items-center text-sm text-muted-foreground">No sales recorded yet</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#714B67" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#714B67" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" />
        <XAxis dataKey="date" tickFormatter={(v) => formatDate(String(v), 'MMM d')} tick={{ fontSize: 12 }} stroke="rgb(var(--muted-fg))" />
        <YAxis tickFormatter={(v) => `$${Number(v)}`} tick={{ fontSize: 12 }} stroke="rgb(var(--muted-fg))" width={64} />
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value)), 'Revenue']}
          labelFormatter={(label) => formatDate(String(label), 'MMM d, yyyy')}
          contentStyle={{ borderRadius: 12, border: '1px solid rgb(var(--border))', fontSize: 12 }}
        />
        <Area type="monotone" dataKey="revenue" stroke="#714B67" strokeWidth={2} fill="url(#revenueFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
