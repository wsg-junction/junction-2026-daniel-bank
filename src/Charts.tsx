import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart,
  Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { Month } from './data';
import { euro, forecast, monthLabel, palette } from './finance';

const tick = { fill: '#7c8781', fontSize: 11, fontFamily: 'inherit' };
const grid = { stroke: '#edf0eb', strokeDasharray: '3 5', vertical: false };
const tooltipStyle = { borderRadius: 14, border: '1px solid #e5ebe3', boxShadow: '0 8px 30px #173f3510', fontSize: 12 };
const moneyTick = (value: number) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value / 100);
const labelTick = (value: string) => monthLabel(value, true).split(' ')[0];
const formatTooltip = (value: unknown) => {
  if (typeof value === 'number') return euro(value);
  if (Array.isArray(value) && value.every(item => typeof item === 'number')) return value.map(item => euro(item)).join(' – ');
  return 'Not available';
};

export function BalanceChart({ months, cutoff, prediction = false }: { months: Month[]; cutoff: string; prediction?: boolean }) {
  const history = months.filter(month => month.month <= cutoff);
  const model = prediction && history.length >= 4 ? forecast(months, cutoff) : null;
  const anchor = history.at(-1)!;
  const data = [
    ...history.slice(-6).map(month => ({
      month: month.month,
      observed: month.closingBalanceCents,
      predicted: model && month.month === cutoff ? month.closingBalanceCents : undefined,
      range: model && month.month === cutoff ? [month.closingBalanceCents, month.closingBalanceCents] : undefined,
    })),
    ...(model?.points.map(point => ({
      month: point.month, observed: undefined, predicted: point.central, range: [point.low, point.high],
    })) ?? []),
  ];
  return <>
    <div className="chart balance-chart" role="img" aria-label={`Observed month-end account balance up to ${monthLabel(cutoff)}${model ? ', followed by a three-month cash-flow scenario with sensitivity range' : ''}. Exact values in the table below.`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart data={data} margin={{ top: 18, right: 6, left: 0, bottom: 0 }}>
          <defs><linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#73a981" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#73a981" stopOpacity={0.01} />
          </linearGradient></defs>
          <CartesianGrid {...grid} />
          <XAxis dataKey="month" tick={tick} tickFormatter={labelTick} axisLine={false} tickLine={false} dy={8} minTickGap={14} />
          <YAxis tick={tick} tickFormatter={moneyTick} axisLine={false} tickLine={false} width={44} domain={['auto', 'auto']} />
          <Tooltip formatter={formatTooltip} labelFormatter={label => monthLabel(String(label))}
            contentStyle={tooltipStyle} cursor={{ stroke: '#bfd1c1', strokeDasharray: '3 3' }} />
          <Area type="monotone" dataKey="observed" name="Observed balance" stroke="#397358" strokeWidth={2.8} fill="url(#balanceFill)" isAnimationActive={false} />
          {model && <Area type="linear" dataKey="range" name="Sensitivity range" stroke="none" fill="#c7b9e4" fillOpacity={0.27} isAnimationActive={false} />}
          {model && <Line type="linear" dataKey="predicted" name="Baseline scenario" stroke="#a18ac5" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 3, fill: '#a18ac5' }} isAnimationActive={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    <div className="chart-legend"><span><i style={{ background: '#397358' }} />Observed balance</span>
      {model && <span><i style={{ background: '#c7b9e4' }} />Estimated · not guaranteed</span>}
      <span className="legend-unit">EUR</span>
    </div>
    {prediction && !model && <p className="note">Choose a later month: at least four observed months are needed for a baseline and backtest.</p>}
    <details className="data-details"><summary>View exact balances</summary>
      <div className="table-scroll"><table><caption>Historical observations and hypothetical projections, EUR</caption>
        <thead><tr><th>Month</th><th>Observed</th><th>Scenario</th><th>Range</th></tr></thead>
        <tbody>{history.slice(-6).map(month => <tr key={month.month}><td>{monthLabel(month.month, true)}</td>
          <td>{euro(month.closingBalanceCents)}</td><td>—</td><td>—</td></tr>)}
          {model?.points.map(point => <tr key={point.month}><td>{monthLabel(point.month, true)}</td><td>—</td>
            <td>{euro(point.central)}</td><td>{euro(point.low)} – {euro(point.high)}</td></tr>)}</tbody>
      </table></div>
      <p className="note">Latest historical observation: {anchor.balanceObservedAt.replace('T', ' ')} (timezone unspecified).</p>
    </details>
  </>;
}

export function SpendingChart({ month, selected, onSelect }: { month: Month; selected: string; onSelect: (category: string) => void }) {
  const categories = Object.entries(month.categorySpendingCents)
    .sort((a, b) => b[1] - a[1]).map(([name, value], index) => ({ name, value, color: palette[index % palette.length] }));
  return <div className="spending-layout">
    <div className="donut-wrap" role="img" aria-label={`Consumption ${euro(month.consumptionCents)}. Category amounts in the adjacent buttons.`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <PieChart>
          <Pie data={categories} dataKey="value" nameKey="name" innerRadius="73%" outerRadius="96%" paddingAngle={3}
            cornerRadius={5} stroke="none" isAnimationActive={false}>
            {categories.map(category => <Cell key={category.name} fill={category.color}
              opacity={selected && selected !== category.name ? 0.35 : 1} />)}
          </Pie>
          <Tooltip formatter={formatTooltip} contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-label"><span>Total spending</span><strong>{euro(month.consumptionCents, true)}</strong><small>Consumption only</small></div>
    </div>
    <div className="category-legend">
      {categories.slice(0, 5).map(category => <button key={category.name}
        className={`category-button ${selected === category.name ? 'selected' : ''}`}
        onClick={() => onSelect(category.name)} aria-pressed={selected === category.name}>
        <i style={{ background: category.color }} /><span>{category.name}</span><strong>{euro(category.value, true)}</strong>
      </button>)}
      {categories.length > 5 && <p className="note">+ {categories.length - 5} categories in Explore</p>}
    </div>
  </div>;
}

export function CashFlowChart({ months, cutoff }: { months: Month[]; cutoff: string }) {
  const data = months.filter(month => month.month <= cutoff).slice(-6);
  return <>
    <div className="chart cashflow-chart" role="img" aria-label="Six-month income and consumption comparison. Transfers are excluded. Exact numbers below.">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} margin={{ top: 12, right: 0, left: 0, bottom: 0 }} barGap={4}>
          <CartesianGrid {...grid} />
          <XAxis dataKey="month" tick={tick} tickFormatter={labelTick} axisLine={false} tickLine={false} dy={8} />
          <YAxis tick={tick} tickFormatter={moneyTick} axisLine={false} tickLine={false} width={42} />
          <Tooltip formatter={formatTooltip} labelFormatter={label => monthLabel(String(label))}
            contentStyle={tooltipStyle} cursor={{ fill: '#f4f6f1' }} />
          <Bar dataKey="incomeCents" name="Income" fill="#326e56" radius={[5, 5, 0, 0]} maxBarSize={22} isAnimationActive={false} />
          <Bar dataKey="consumptionCents" name="Consumption" fill="#c8b9e4" radius={[5, 5, 0, 0]} maxBarSize={22} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
    <div className="chart-legend"><span><i style={{ background: '#326e56' }} />Income</span>
      <span><i style={{ background: '#c8b9e4' }} />Consumption</span><span className="legend-unit">EUR</span></div>
    <details className="data-details"><summary>View exact cash flow</summary>
      <div className="table-scroll"><table><thead><tr><th>Month</th><th>Income</th><th>Consumption</th><th>Net after transfers</th></tr></thead>
        <tbody>{data.map(month => <tr key={month.month}><td>{monthLabel(month.month, true)}</td><td>{euro(month.incomeCents)}</td>
          <td>{euro(month.consumptionCents)}</td><td>{euro(month.netCashFlowCents)}</td></tr>)}</tbody></table></div>
    </details>
  </>;
}

export function CategoryTrend({ months, cutoff, category }: { months: Month[]; cutoff: string; category: string }) {
  const data = months.filter(month => month.month <= cutoff)
    .map(month => ({ month: month.month, amount: month.categorySpendingCents[category] ?? 0 }));
  return <>
    <div className="chart category-chart" role="img" aria-label={`${category} spending over ${data.length} observed months. A missing category means no identified consumption in these records.`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} margin={{ top: 18, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid {...grid} />
          <XAxis dataKey="month" tick={tick} tickFormatter={value => monthLabel(value, true)} axisLine={false} tickLine={false} minTickGap={35} dy={8} />
          <YAxis tick={tick} tickFormatter={moneyTick} axisLine={false} tickLine={false} width={42} />
          <Tooltip formatter={formatTooltip} labelFormatter={label => monthLabel(String(label))} contentStyle={tooltipStyle} />
          <Area dataKey="amount" name={category} type="monotone" stroke="#8b73b1" fill="#c7b9e4" fillOpacity={0.2} strokeWidth={2.5} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
    <details className="data-details"><summary>View monthly category totals</summary>
      <div className="table-scroll"><table><thead><tr><th>Month</th><th>{category}</th></tr></thead>
        <tbody>{data.map(month => <tr key={month.month}><td>{monthLabel(month.month, true)}</td><td>{euro(month.amount)}</td></tr>)}</tbody></table></div>
    </details>
  </>;
}
