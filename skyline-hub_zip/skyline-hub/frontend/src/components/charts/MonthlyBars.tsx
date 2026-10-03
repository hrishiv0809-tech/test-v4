import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCurrency } from '@/lib/utils';

interface MonthlyBarsProps {
  data: { month: string; income: number; expenses: number }[];
  height?: number;
}

const labelFor = (month: string): string => {
  const [year, m] = month.split('-');
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleString('en-US', { month: 'short' });
};

export function MonthlyBars({ data, height = 300 }: MonthlyBarsProps): JSX.Element {
  if (!data.length) {
    return <div className="grid h-[220px] place-items-center text-sm text-muted-foreground">No transactions yet</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" />
        <XAxis dataKey="month" tickFormatter={labelFor} tick={{ fontSize: 12 }} stroke="rgb(var(--muted-fg))" />
        <YAxis tickFormatter={(v) => `$${Number(v)}`} tick={{ fontSize: 12 }} stroke="rgb(var(--muted-fg))" width={64} />
        <Tooltip
          formatter={(value, name) => [formatCurrency(Number(value)), name === 'income' ? 'Income' : 'Expenses']}
          labelFormatter={(label) => labelFor(String(label))}
          contentStyle={{ borderRadius: 12, border: '1px solid rgb(var(--border))', fontSize: 12 }}
        />
        <Legend
          verticalAlign="top"
          height={30}
          formatter={(value) => <span className="text-xs text-muted-foreground">{value === 'income' ? 'Income' : 'Expenses'}</span>}
        />
        <Bar dataKey="income" fill="#714B67" radius={[6, 6, 0, 0]} maxBarSize={38} />
        <Bar dataKey="expenses" fill="#F5B93A" radius={[6, 6, 0, 0]} maxBarSize={38} />
      </BarChart>
    </ResponsiveContainer>
  );
}
