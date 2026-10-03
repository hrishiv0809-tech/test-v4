import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/utils';

export const SOURCE_COLORS: Record<string, string> = {
  DUES: '#714B67',
  TICKET: '#9d6f92',
  MERCH: '#F5B93A',
  FUNDRAISER: '#4c8c74',
  DONATION: '#5b7cc0',
  REIMBURSEMENT: '#c25b5b',
  OTHER: '#9ca3af',
};

interface IncomeDonutProps {
  data: { source: string; amount: number }[];
  height?: number;
}

export function IncomeDonut({ data, height = 280 }: IncomeDonutProps): JSX.Element {
  const total = data.reduce((sum, d) => sum + d.amount, 0);
  if (!data.length || total === 0) {
    return <div className="grid h-[220px] place-items-center text-sm text-muted-foreground">No income recorded in this period</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="amount"
          nameKey="source"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((entry) => (
            <Cell key={entry.source} fill={SOURCE_COLORS[entry.source] ?? '#9ca3af'} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [formatCurrency(Number(value)), String(name).replace(/_/g, ' ').toLowerCase()]}
          contentStyle={{ borderRadius: 12, border: '1px solid rgb(var(--border))', fontSize: 12 }}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value) => <span className="text-xs capitalize text-muted-foreground">{String(value).replace(/_/g, ' ').toLowerCase()}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
