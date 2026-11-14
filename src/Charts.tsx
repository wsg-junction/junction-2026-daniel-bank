import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart,
  Line, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useState } from 'react';
import { Button } from '@heroui/react';
import type { Month } from './data';
import { averageSpending, basketColors, basketLabels, euro, forecast, monthLabel, palette, spendingScenario } from './finance';
import type { Basket } from './finance';

const tick = { fill: '#53616f', fontSize: 11, fontFamily: 'inherit' };
const grid = { stroke: '#edf0eb', strokeOpacity: 0.12, strokeDasharray: '3 5', vertical: false };
const tooltipStyle = { borderRadius: 14, border: '1px solid #e5ebe3', boxShadow: '0 8px 30px #173f3510', fontSize: 12 };
const moneyTick = (value: number) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value / 100);
const labelTick = (value: string) => monthLabel(value, true).split(' ')[0];
const formatTooltip = (value: unknown) => {
  if (typeof value === 'number') return euro(value);
  if (Array.isArray(value) && value.every(item => typeof item === 'number')) return value.map(item => euro(item)).join(' – ');
  return 'Not available';
};

export function BalanceChart({ months, cutoff, start, prediction = false, monthlySaving = 0, oneTimeOutflow = 0 }: {
  months: Month[]; cutoff: string; start?: string; prediction?: boolean; monthlySaving?: number; oneTimeOutflow?: number;
}) {
  const [showExpenses, setShowExpenses] = useState(false);
  const history = months.filter(month => month.month <= cutoff);
  const visible = start ? history.filter(month => month.month >= start) : history.slice(-6);
  const model = prediction && history.length >= 4 ? forecast(months, cutoff, monthlySaving, oneTimeOutflow) : null;
  const anchor = history.at(-1)!;
  const data = [
    ...visible.map(month => ({
      month: month.month,
      observed: month.closingBalanceCents,
      expenses: month.consumptionCents,
      predicted: model && month.month === cutoff ? month.closingBalanceCents - oneTimeOutflow : undefined,
      range: model && month.month === cutoff ? [month.closingBalanceCents - oneTimeOutflow, month.closingBalanceCents - oneTimeOutflow] : undefined,
    })),
    ...(model?.points.map(point => ({
      month: point.month, observed: undefined, expenses: undefined, predicted: point.central, range: [point.low, point.high],
    })) ?? []),
  ];
  return <>
    <label className="expense-toggle"><input type="checkbox" checked={showExpenses} onChange={event => setShowExpenses(event.target.checked)} />Show expenses</label>
    <div className="chart balance-chart" role="img" aria-label={`Observed month-end account balance up to ${monthLabel(cutoff)}${model ? ', followed by a three-month cash-flow scenario with sensitivity range' : ''}${showExpenses ? '. Recorded consumption is shown as muted red bars on the right-hand EUR scale; transfers are excluded' : ''}. Exact values are available in tooltips and the accessible table.`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart data={data} margin={{ top: 18, right: 6, left: 0, bottom: 0 }}>
          <defs><linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#73a981" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#73a981" stopOpacity={0.01} />
          </linearGradient></defs>
          <CartesianGrid {...grid} />
          <XAxis dataKey="month" tick={tick} tickFormatter={labelTick} axisLine={false} tickLine={false} dy={8} minTickGap={14} />
          <YAxis yAxisId="balance" tick={tick} tickFormatter={moneyTick} axisLine={false} tickLine={false} width={44} domain={['auto', 'auto']} />
          {showExpenses && <YAxis yAxisId="expenses" orientation="right" tick={{ ...tick, fill: '#995b56' }} tickFormatter={moneyTick}
            axisLine={false} tickLine={false} width={42} domain={['auto', 'auto']} />}
          <Tooltip formatter={formatTooltip} labelFormatter={label => monthLabel(String(label))}
            contentStyle={tooltipStyle} cursor={{ stroke: '#bfd1c1', strokeDasharray: '3 3' }} />
          {showExpenses && <Line yAxisId="expenses" dataKey="expenses" name="Recorded consumption" stroke="#ad6460" strokeWidth={2} dot={false} isAnimationActive={false} />}
          <Area yAxisId="balance" type="monotone" dataKey="observed" name="Observed balance" stroke="#397358" strokeWidth={2.8} fill="url(#balanceFill)"
            dot={visible.length === 1 ? { r: 4, fill: '#397358' } : false} isAnimationActive={false} />
          {model && <Area yAxisId="balance" type="linear" dataKey="range" name="Sensitivity range" stroke="none" fill="#305dc0" fillOpacity={0.13} isAnimationActive={false} />}
          {model && <Line yAxisId="balance" type="linear" dataKey="predicted" name="Your scenario" stroke="#305dc0" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 3, fill: '#305dc0' }} isAnimationActive={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    <div className="chart-legend"><span><i style={{ background: '#397358' }} />Observed balance</span>
      {model && <span><i style={{ background: '#305dc0' }} />Your scenario · not guaranteed</span>}
      {showExpenses && <span><i style={{ background: '#ad6460' }} />Expenses · right scale</span>}
      <span className="legend-unit">EUR</span>
    </div>
    {showExpenses && <p className="note">Expenses = recorded consumption, excluding investment transfers and salary sweeps. Right-hand scale is EUR per month, not an account balance. No future expense amounts are predicted.</p>}
    {prediction && !model && <p className="note">Choose a later month: at least four observed months are needed for a baseline and backtest.</p>}
    <div className="sr-only">
      <div className="table-scroll"><table><caption>Historical observations and hypothetical projections, EUR</caption>
        <thead><tr><th>Month</th><th>Observed</th><th>Scenario</th><th>Range</th>{showExpenses && <th>Recorded expenses</th>}</tr></thead>
        <tbody>{visible.map(month => <tr key={month.month}><td>{monthLabel(month.month, true)}</td>
          <td>{euro(month.closingBalanceCents)}</td><td>—</td><td>—</td>{showExpenses && <td>{euro(month.consumptionCents)}</td>}</tr>)}
          {model?.points.map(point => <tr key={point.month}><td>{monthLabel(point.month, true)}</td><td>—</td>
            <td>{euro(point.central)}</td><td>{euro(point.low)} – {euro(point.high)}</td>{showExpenses && <td>—</td>}</tr>)}</tbody>
      </table></div>
      <p className="note">Latest historical observation: {anchor.balanceObservedAt.replace('T', ' ')} (timezone unspecified).</p>
    </div>
  </>;
}

export function SpendingChart({ month, selected, onSelect, compact = false, savings = {}, averaged = false }: {
  month: Month; selected: string; onSelect: (category: string) => void; compact?: boolean; savings?: Record<string, number>; averaged?: boolean;
}) {
  const categories = Object.entries(month.categorySpendingCents)
    .sort((a, b) => (b[1] + (savings[b[0]] ?? 0)) - (a[1] + (savings[a[0]] ?? 0)))
    .map(([name, value], index) => ({ name, value, color: palette[index % palette.length] }));
  const categoryButton = (category: typeof categories[number]) => <button key={category.name}
    className={`category-button ${selected === category.name ? 'selected' : ''}`}
    onClick={() => onSelect(category.name)} aria-pressed={selected === category.name}>
    <i style={{ background: category.color }} /><span>{category.name}</span>
    <div className="category-values"><strong>{euro(category.value)}</strong>
      {(savings[category.name] ?? 0) > 0 && <strong className="category-saving">
        <span className="sr-only">Reduced by </span>−{euro(savings[category.name])}</strong>}</div>
  </button>;
  return <div className="spending-layout">
    <div className="donut-wrap" role="img" aria-label={`${averaged ? 'Average monthly consumption' : 'Consumption'} ${euro(month.consumptionCents)}. Category amounts in the adjacent buttons.`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <PieChart>
          <Pie data={categories} dataKey="value" nameKey="name" innerRadius="73%" outerRadius="96%" paddingAngle={3}
            cornerRadius={5} stroke="none" isAnimationActive={false}>
            {categories.map(category => <Cell key={category.name} fill={category.color}
              stroke={selected === category.name ? '#202c35' : 'none'} strokeWidth={selected === category.name ? 2 : 0} />)}
          </Pie>
          <Tooltip formatter={formatTooltip} contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-label"><span>{averaged ? 'Monthly average' : 'Total spending'}</span><strong>{euro(month.consumptionCents, true)}</strong><small>Consumption only</small></div>
    </div>
    <div className="category-legend">
      {!compact && categories.slice(0, 5).map(categoryButton)}
      {!compact && categories.length > 5 && <p className="note">All {categories.length} categories in the selector</p>}
      {compact && <>
        {categories.filter(category => (savings[category.name] ?? 0) > 0).map(categoryButton)}
        <details><summary>All category amounts</summary>{categories.map(categoryButton)}</details>
      </>}
    </div>
  </div>;
}

export function InvestmentChart({ months, cutoff, start }: { months: Month[]; cutoff: string; start?: string }) {
  const history = months.filter(month => month.month <= cutoff);
  const data = start ? history.filter(month => month.month >= start) : history.slice(-6);
  const hasTransfers = data.some(month => month.investmentDepositsCents || month.investmentWithdrawalsCents);
  return <>
    {hasTransfers ? <div className="chart" role="img" aria-label="Investment deposits and withdrawals in the selected months. These are transfers, not investment returns. Exact amounts below.">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} margin={{ top: 12, right: 0, left: 0, bottom: 0 }} barGap={4}>
          <CartesianGrid {...grid} />
          <XAxis dataKey="month" tick={tick} tickFormatter={labelTick} axisLine={false} tickLine={false} dy={8} />
          <YAxis tick={tick} tickFormatter={moneyTick} axisLine={false} tickLine={false} width={42} />
          <Tooltip formatter={formatTooltip} labelFormatter={label => monthLabel(String(label))} contentStyle={tooltipStyle} />
          <Bar dataKey="investmentDepositsCents" name="Deposits" fill="#176343" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          <Bar dataKey="investmentWithdrawalsCents" name="Withdrawals" fill="#305dc0" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div> : <p className="empty">No investment transfers observed in these months. This does not mean you have no investments.</p>}
    {hasTransfers && <div className="chart-legend"><span><i style={{ background: '#176343' }} />Deposits</span>
      <span><i style={{ background: '#305dc0' }} />Withdrawals</span><span className="legend-unit">EUR</span></div>}
    <details className="data-details"><summary>View exact transfer amounts</summary>
      <div className="table-scroll"><table><caption>Observed investment transfers, not returns</caption>
        <thead><tr><th>Month</th><th>Deposits</th><th>Withdrawals</th></tr></thead>
        <tbody>{data.map(month => <tr key={month.month}><td>{monthLabel(month.month, true)}</td>
          <td>{euro(month.investmentDepositsCents)}</td><td>{euro(month.investmentWithdrawalsCents)}</td></tr>)}</tbody>
      </table></div></details>
  </>;
}

export function SpendingInsights({ months, reductions, selected, peerSpendingCents, peerIncomeCents }: {
  months: Month[]; reductions: Record<string, number>; selected: string; peerSpendingCents?: number; peerIncomeCents?: number;
}) {
  const [view, setView] = useState<'trend' | 'radar'>('trend');
  const [showPeer, setShowPeer] = useState(true);
  const peerSpendingRate = (peerIncomeCents && peerIncomeCents > 0 && peerSpendingCents !== undefined)
    ? peerSpendingCents / peerIncomeCents : null;
  const data = months.map(month => {
    const adjusted = spendingScenario(month, reductions).month;
    return { month: month.month, recorded: month.consumptionCents, adjusted: adjusted.consumptionCents,
      category: adjusted.categorySpendingCents[selected] ?? 0,
      peerCurve: peerSpendingRate !== null ? Math.round(month.incomeCents * peerSpendingRate) : undefined };
  });
  const baseline = { ...months.at(-1)!, ...averageSpending(months) };
  const adjusted = spendingScenario(baseline, reductions).month;
  const profile = Object.entries(baseline.categorySpendingCents)
    .map(([category, recorded]) => ({ category, recorded, adjusted: adjusted.categorySpendingCents[category] }));
  const hasPeer = peerSpendingRate !== null;
  return <>
    <div className="chart-view-controls" role="group" aria-label="Spending visualization">
      <Button variant="outline" aria-pressed={view === 'trend'} onPress={() => setView('trend')}>Area trend</Button>
      <Button variant="outline" aria-pressed={view === 'radar'} onPress={() => setView('radar')}>Radar profile</Button>
    </div>
    {hasPeer && view === 'trend' && <label className="expense-toggle"><input type="checkbox" checked={showPeer} onChange={e => setShowPeer(e.target.checked)} />Show peer avg spending curve</label>}
    <div className="chart" role="img" aria-label={view === 'trend'
      ? `Recorded and adjusted total spending in the selected months, with adjusted ${selected} spending. Exact values below.`
      : 'Average monthly category spending: recorded versus with your reductions. Exact values below.'}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        {view === 'trend' ? <ComposedChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
          <defs><linearGradient id="spendingRecorded" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#305dc0" stopOpacity={0.22} /><stop offset="100%" stopColor="#305dc0" stopOpacity={0.01} />
          </linearGradient><linearGradient id="spendingAdjusted" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#176343" stopOpacity={0.3} /><stop offset="100%" stopColor="#176343" stopOpacity={0.01} />
          </linearGradient></defs>
          <CartesianGrid {...grid} />
          <XAxis dataKey="month" tick={tick} tickFormatter={labelTick} axisLine={false} tickLine={false} minTickGap={20} />
          <YAxis tick={tick} tickFormatter={moneyTick} axisLine={false} tickLine={false} width={44} />
          <Tooltip formatter={formatTooltip} labelFormatter={label => monthLabel(String(label))} contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey="recorded" name="Recorded total" stroke="#305dc0" fill="url(#spendingRecorded)" strokeWidth={2}
            dot={data.length === 1 ? { r: 4 } : false} isAnimationActive={false} />
          <Area type="monotone" dataKey="adjusted" name="With your reductions" stroke="#176343" fill="url(#spendingAdjusted)" strokeWidth={2}
            dot={data.length === 1 ? { r: 4 } : false} isAnimationActive={false} />
          <Line type="monotone" dataKey="category" name={`${selected} with reductions`} stroke="#a04b14" strokeDasharray="4 4" dot={{ r: 3 }} isAnimationActive={false} />
          {showPeer && hasPeer && <Line type="monotone" dataKey="peerCurve" name="Peer avg spending (% of your income)" stroke="#8b73b1" strokeDasharray="5 3" strokeWidth={1.5} dot={false} isAnimationActive={false} />}
        </ComposedChart> : <RadarChart data={profile} outerRadius="62%" margin={{ top: 16, bottom: 16, left: 24, right: 24 }}>
          <PolarGrid stroke="#dce2e8" />
          <PolarAngleAxis dataKey="category" tick={{ ...tick, fontSize: 10 }} tickFormatter={name => String(name).length > 12 ? `${String(name).slice(0, 10)}…` : String(name)} />
          <PolarRadiusAxis tick={false} axisLine={false} />
          <Radar name="Recorded average" dataKey="recorded" stroke="#305dc0" fill="#305dc0" fillOpacity={0.12} isAnimationActive={false} />
          <Radar name="With your reductions" dataKey="adjusted" stroke="#176343" fill="#176343" fillOpacity={0.2} isAnimationActive={false} />
          <Tooltip formatter={formatTooltip} contentStyle={tooltipStyle} />
        </RadarChart>}
      </ResponsiveContainer>
    </div>
    <div className="chart-legend"><span><i style={{ background: '#305dc0' }} />Recorded{view === 'radar' ? ' monthly average' : ' total'}</span>
      <span><i style={{ background: '#176343' }} />With reductions</span>
      {view === 'trend' && <span><i style={{ background: '#a04b14' }} />{selected} with reductions</span>}
      {view === 'trend' && showPeer && hasPeer && <span><i style={{ background: '#8b73b1' }} />Peer avg (% of income)</span>}
    </div>
    <p className="note">{view === 'trend' ? 'Your percentages are applied separately to each historical month. Change the category above to inspect its line.'
      : 'Each spoke is a category in EUR per month, not a spending score. Larger shapes mean higher spending, not better performance.'}</p>
    <details className="data-details"><summary>View exact spending insights</summary>
      <div className="table-scroll"><table><caption>{view === 'trend' ? 'Monthly consumption and hypothetical reductions, EUR' : 'Average monthly categories, EUR'}</caption>
        <thead>{view === 'trend' ? <tr><th>Month</th><th>Recorded total</th><th>With reductions</th><th>{selected} with reductions</th></tr>
          : <tr><th>Category</th><th>Recorded average</th><th>With reductions</th></tr>}</thead>
        <tbody>{view === 'trend' ? data.map(row => <tr key={row.month}><td>{monthLabel(row.month, true)}</td>
          <td>{euro(row.recorded)}</td><td>{euro(row.adjusted)}</td><td>{euro(row.category)}</td></tr>)
          : profile.map(row => <tr key={row.category}><td>{row.category}</td><td>{euro(row.recorded)}</td><td>{euro(row.adjusted)}</td></tr>)}</tbody>
      </table></div></details>
  </>;
}

export function CashFlowChart({ months, cutoff, peerIncomeCents, peerSpendingCents }: { months: Month[]; cutoff: string; peerIncomeCents?: number; peerSpendingCents?: number }) {
  const [showPeer, setShowPeer] = useState(false);
  const data = months.filter(month => month.month <= cutoff).slice(-6);
  const hasPeer = peerIncomeCents !== undefined || peerSpendingCents !== undefined;
  return <>
    {hasPeer && <label className="expense-toggle"><input type="checkbox" checked={showPeer} onChange={e => setShowPeer(e.target.checked)} />Show peer averages</label>}
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
          {showPeer && peerIncomeCents !== undefined && <ReferenceLine y={peerIncomeCents} stroke="#326e56" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: 'Peer income', position: 'insideTopRight', fontSize: 10, fill: '#326e56' }} />}
          {showPeer && peerSpendingCents !== undefined && <ReferenceLine y={peerSpendingCents} stroke="#8b73b1" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: 'Peer spending', position: 'insideTopRight', fontSize: 10, fill: '#8b73b1' }} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
    <div className="chart-legend"><span><i style={{ background: '#326e56' }} />Income</span>
      <span><i style={{ background: '#c8b9e4' }} />Consumption</span>
      {showPeer && hasPeer && <><span><i style={{ background: '#326e56', opacity: 0.4 }} />Peer avg income</span><span><i style={{ background: '#8b73b1', opacity: 0.4 }} />Peer avg spending</span></>}
      <span className="legend-unit">EUR</span></div>
    <details className="data-details"><summary>View exact cash flow</summary>
      <div className="table-scroll"><table><thead><tr><th>Month</th><th>Income</th><th>Consumption</th><th>Net after transfers</th></tr></thead>
        <tbody>{data.map(month => <tr key={month.month}><td>{monthLabel(month.month, true)}</td><td>{euro(month.incomeCents)}</td>
          <td>{euro(month.consumptionCents)}</td><td>{euro(month.netCashFlowCents)}</td></tr>)}</tbody></table></div>
    </details>
  </>;
}

export function BasketChart({ totals }: { totals: Record<Basket, number> }) {
  const data = (Object.keys(basketLabels) as Basket[])
    .filter(b => totals[b] > 0)
    .map(b => ({ name: basketLabels[b], value: totals[b], basket: b }));
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return null;
  return (
    <div className="chart basket-chart" role="img" aria-label="Spending basket donut chart. Exact values in the legend below.">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius="55%" outerRadius="80%" paddingAngle={2} startAngle={90} endAngle={-270}>
            {data.map(entry => <Cell key={entry.basket} fill={basketColors[entry.basket]} />)}
          </Pie>
          <Tooltip formatter={formatTooltip} contentStyle={tooltipStyle} itemStyle={{ color: '#3a4a40' }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="basket-legend">
        {data.map(d => (
          <div key={d.basket} className="basket-legend-item">
            <span className="basket-swatch" style={{ background: basketColors[d.basket] }} />
            <span className="basket-legend-label">{d.name}</span>
            <span className="basket-legend-pct">{Math.round(d.value / total * 100)}%</span>
            <span className="basket-legend-eur">{euro(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
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
