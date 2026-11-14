import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, PointerEvent, ReactNode } from 'react';
import { Avatar, Button, Dropdown, Slider } from '@heroui/react';
import { Particles } from '@/components/ui/particles';
import { loadBenchmarks, loadPerson, loadTransactions, PEOPLE } from './data';
import type { Benchmarks, Month, Person, Transaction } from './data';
import { INSIGHTS } from './insights';
import type { InsightKey } from './insights';

function Markdown({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let key = 0;
  for (const line of text.split('\n')) {
    if (nodes.length) nodes.push(<br key={key++} />);
    const parts: ReactNode[] = [];
    let rest = line;
    while (rest) {
      const bold = rest.match(/^(.*?)\*\*(.+?)\*\*(.*)/s);
      const italic = rest.match(/^(.*?)\*(.+?)\*(.*)/s);
      const code = rest.match(/^(.*?)`(.+?)`(.*)/s);
      const first = [bold, italic, code]
        .filter(Boolean)
        .sort((a, b) => a![1].length - b![1].length)[0];
      if (!first) { parts.push(rest); break; }
      if (first[1]) parts.push(first[1]);
      if (first === bold) parts.push(<strong key={key++}>{first[2]}</strong>);
      else if (first === italic) parts.push(<em key={key++}>{first[2]}</em>);
      else parts.push(<code key={key++}>{first[2]}</code>);
      rest = first[3];
    }
    nodes.push(<span key={key++}>{parts}</span>);
  }
  return <>{nodes}</>;
}
import {
  answerQuestion, answerQuestionExtended, averageSpending, basketLabels, baskets, classify, euro, forecast, irregularCategories, monthLabel,
  parseAmount, peerBenchmark, sandboxBalance, scenario, spendingScenario,
} from './finance';
import type { Answer, Basket, Overrides, PriorMessage } from './finance';
import { Icon } from './Icons';
import { getPsd2Accounts, psd2InvestmentCents, psd2TotalCents } from './psd2';

const BalanceChart = lazy(() => import('./Charts').then(module => ({ default: module.BalanceChart })));
const SpendingChart = lazy(() => import('./Charts').then(module => ({ default: module.SpendingChart })));
const InvestmentChart = lazy(() => import('./Charts').then(module => ({ default: module.InvestmentChart })));
const SpendingInsights = lazy(() => import('./Charts').then(module => ({ default: module.SpendingInsights })));
const CashFlowChart = lazy(() => import('./Charts').then(module => ({ default: module.CashFlowChart })));
const BasketChart = lazy(() => import('./Charts').then(module => ({ default: module.BasketChart })));
const StockTickerLazy = lazy(() => import('./StockTicker').then(module => ({ default: module.StockTicker })));
const tabs = [
  { id: 'accounts', label: 'Accounts', icon: 'accounts' },
  { id: 'spending', label: 'Spending', icon: 'spending' },
  { id: 'payments', label: 'Payments', icon: 'payments' },
  { id: 'investments', label: 'Investments', icon: 'investments' },
] as const;
type Tab = typeof tabs[number]['id'];
type Page = Tab | 'ai' | 'ai-history';
type Payment = { id: number; recipient: string; amount: number };
type Period = { start: number; end: number };
type ChatMessage = { question: string; answer: Answer };
type ChatThread = { id: string; userId: string; title: string; period: string; endingMonth: string; messages: ChatMessage[] };

function PeriodSlider({ months, value, onPreview, onChange }: {
  months: Month[]; value: Period; onPreview: (value: Period) => void; onChange: (value: Period) => void;
}) {
  const last = months.length - 1;
  const [tooltip, setTooltip] = useState<{ pos: number; label: string } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeThumb = useRef<0 | 1>(1);
  const toPeriod = (values: number | number[]): Period => {
    if (!Array.isArray(values) || values.length !== 2 || !values.every(number => Number.isInteger(number) && number >= 0 && number <= last)
      || values[0] > values[1]) throw new Error('Invalid month range.');
    return { start: values[0], end: values[1] };
  };
  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const thumbs = (e.currentTarget as HTMLElement).querySelectorAll('[class*="slider__thumb"]');
    if (thumbs.length === 2) {
      const r0 = thumbs[0].getBoundingClientRect();
      const r1 = thumbs[1].getBoundingClientRect();
      const cx = e.clientX;
      const d0 = Math.abs(cx - (r0.left + r0.width / 2));
      const d1 = Math.abs(cx - (r1.left + r1.width / 2));
      activeThumb.current = d0 <= d1 ? 0 : 1;
    }
  };
  const handleChange = (values: number | number[]) => {
    const p = toPeriod(values);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const movedIndex = activeThumb.current === 0 ? p.start : p.end;
    setTooltip({ pos: movedIndex / last, label: monthLabel(months[movedIndex].month, true, '2-digit') });
    onPreview(p);
  };
  const handleChangeEnd = (values: number | number[]) => {
    onChange(toPeriod(values));
    hideTimer.current = setTimeout(() => setTooltip(null), 600);
  };
  const tooltipLeft = tooltip ? `calc(12px + ${tooltip.pos} * (100% - 24px))` : '50%';
  return <div style={{ position: 'relative', flex: 1 }} onPointerDown={handlePointerDown}>
    {tooltip && <div className="slider-tooltip" style={{ left: tooltipLeft }}>
      {tooltip.label}
    </div>}
    <Slider className="period-range" aria-label="Selected months" minValue={0} maxValue={last} step={1}
      value={[value.start, value.end]} onChange={handleChange} onChangeEnd={handleChangeEnd}>
      <Slider.Track>
        <Slider.Fill />
        <Slider.Thumb index={0} aria-label={`Starting month: ${monthLabel(months[value.start].month)}`} aria-describedby="period-help" />
        <Slider.Thumb index={1} aria-label={`Ending month: ${monthLabel(months[value.end].month)}`} aria-describedby="period-help" />
      </Slider.Track>
      <p id="period-help" className="sr-only">Choose the first and last month. Spending uses monthly averages. Forecasts and cash experiments start from the ending month's observed balance.</p>
    </Slider>
  </div>;
}

function PersonMenu({ userId, onSelect }: { userId: string; onSelect: (id: string) => void }) {
  const selected = PEOPLE.find(person => person.id === userId)!;
  return <Dropdown>
    <Dropdown.Trigger className="avatar-trigger" aria-label={`Switch demo person, currently ${selected.name}`}>
      <Avatar className={`demo-avatar ${selected.color}`} aria-hidden="true"><Avatar.Fallback>{selected.initials}</Avatar.Fallback></Avatar>
      <Icon name="dropdown" size={14} />
    </Dropdown.Trigger>
    <Dropdown.Popover className="person-menu" placement="bottom end">
      <Dropdown.Menu aria-label="Choose demo person" selectionMode="single" selectedKeys={new Set([userId])}
        onAction={key => {
          const id = String(key);
          if (!PEOPLE.some(person => person.id === id)) throw new Error('Unknown demo person selected.');
          onSelect(id);
        }}>
        {PEOPLE.map(person => <Dropdown.Item key={person.id} id={person.id} textValue={person.name}>
          <Avatar className={`demo-avatar ${person.color}`} aria-hidden="true"><Avatar.Fallback>{person.initials}</Avatar.Fallback></Avatar>
          <div className="person-menu-copy"><strong>{person.name}</strong><span>{person.description}</span><span className="person-menu-id">{person.id}</span></div>
          {person.id === userId && <Icon name="check" size={16} />}
        </Dropdown.Item>)}
      </Dropdown.Menu>
    </Dropdown.Popover>
  </Dropdown>;
}

function currentTab(): Page {
  const hash = window.location.hash.slice(1);
  if (hash === 'ai') return 'ai';
  if (hash === 'ai/history') return 'ai-history';
  const legacy: Record<string, Tab> = { overview: 'accounts', explore: 'spending', plan: 'spending', coach: 'spending' };
  return tabs.find(tab => tab.id === hash)?.id ?? legacy[hash] ?? 'accounts';
}

function Card({ title, children, className = '', onAsk }: { title: string; children: ReactNode; className?: string; onAsk?: () => void }) {
  return <section className={`card ${className}`}>
    {onAsk ? <div className="card-header"><h2>{title}</h2><button className="card-ask-btn" aria-label={`Ask AI about ${title}`} onClick={onAsk}><Icon name="sparkle" size={14} /></button></div> : <h2>{title}</h2>}
    {children}
  </section>;
}

function Money({ label, amount, detail, peerAmount, peerLabel }: { label: string; amount: number; detail?: string; peerAmount?: number; peerLabel?: string }) {
  const delta = peerAmount !== undefined ? amount - peerAmount : null;
  const deltaClass = delta === null ? '' : delta > 0 ? 'money-delta better' : delta < 0 ? 'money-delta worse' : 'money-delta neutral';
  return <div className="money">
    <span>{label}</span>
    <strong>{euro(amount)}</strong>
    {detail && <small>{detail}</small>}
    {peerAmount !== undefined && <small className={deltaClass}>
      {delta !== null && delta !== 0 ? `${delta > 0 ? '+' : ''}${euro(Math.abs(delta), true)} vs. ` : 'same as '}{peerLabel ?? 'peers'}
    </small>}
  </div>;
}

const PSD2_AI_EXPLAIN_DISCONNECTED = `**What is PSD2 open banking?**

Under the EU's PSD2 regulation, you can authorise S-Bank to securely fetch your account data from other Finnish and European banks — Nordea, OP, Danske Bank, and others.

Once connected, your full financial picture appears here: balances, account types, and a combined total across all your banks. This lets your AI coach answer questions like "What is my total savings across all banks?" or "How much could I invest if I pooled everything?"

Your data is fetched with your explicit consent and is never shared with third parties. Tap **+ Add bank** to simulate connecting an account.`;

const PSD2_AI_EXPLAIN_CONNECTED = `**Your connected bank accounts**

These accounts are linked via PSD2 open banking. S-Bank fetches a balance snapshot each time you open the app — balances are not live and may be a few hours old.

The combined total shown here includes your S-Bank balance plus all connected accounts. Your AI coach uses this full picture when you ask about total savings or cross-bank planning.

Tap **Remove banks** at any time to disconnect. Your S-Bank data is unaffected.`;

function Psd2Card({ userId, sBankBalanceCents, psd2Connected, psd2Loading, onConnect, onDisconnect, onAsk }: {
  userId: string;
  sBankBalanceCents: number;
  psd2Connected: boolean;
  psd2Loading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onAsk?: (q: string) => void;
}) {
  const accounts = getPsd2Accounts(userId);
  if (!accounts.length) return null;
  const connectedAccounts = accounts.filter(a => a.status === 'connected');
  const total = sBankBalanceCents + (psd2Connected ? psd2TotalCents(accounts) : 0);

  return <div className="psd2-card animate-in">
    <div className="psd2-header">
      <span className="psd2-title">Connected banks <span className="psd2-badge">PSD2</span></span>
      <div className="psd2-header-actions">
        {onAsk && <button className="card-ask-btn psd2-ai-btn" aria-label="Explain PSD2 open banking"
          onClick={() => onAsk(psd2Connected ? PSD2_AI_EXPLAIN_CONNECTED : PSD2_AI_EXPLAIN_DISCONNECTED)}>
          <Icon name="sparkle" size={14} />
        </button>}
        {psd2Connected
          ? <button className="psd2-remove" onClick={onDisconnect}>Remove banks</button>
          : <button className="psd2-add" onClick={onConnect} disabled={psd2Loading} aria-busy={psd2Loading}>
              {psd2Loading ? <span className="psd2-spinner" aria-label="Connecting…" /> : '+ Add bank'}
            </button>}
      </div>
    </div>
    {psd2Loading && !psd2Connected && (
      <div className="psd2-connecting animate-in">
        <span className="psd2-spinner-inline" />
        Fetching balances from connected banks…
      </div>
    )}
    {psd2Connected && <>
      <div className="psd2-accounts">
        {connectedAccounts.map((a, i) => <div key={i} className="psd2-row animate-in">
          <span className="psd2-bank">{a.flag} {a.bank}</span>
          <span className="psd2-type">{a.type}</span>
          <strong className="psd2-amount" style={{ color: '#176343' }}>{euro(a.balanceCents)}</strong>
          <span className="psd2-status synced">✓ synced {a.lastSyncedAt}</span>
        </div>)}
      </div>
      <div className="psd2-total">
        <span>Total across all banks</span>
        <strong style={{ color: '#176343' }}>{euro(total)}</strong>
      </div>
      <p className="note" style={{ marginTop: 4 }}>S-Bank balance + {connectedAccounts.length} connected account{connectedAccounts.length !== 1 ? 's' : ''} · balances are snapshots, not live.</p>
    </>}
    {!psd2Connected && !psd2Loading && (
      <p className="note psd2-cta">Link your other bank accounts via PSD2 to see your full financial picture and let the AI coach answer cross-bank questions.</p>
    )}
  </div>;
}

function InvestmentHeatmap({ person, start, end, onSelect }: {
  person: Person; start: string; end: string; onSelect: (month: string) => void;
}) {
  const largest = Math.max(1, ...person.monthly.map(month => Math.abs(month.investmentDepositsCents - month.investmentWithdrawalsCents)));
  return <>
    <p className="note">All observed months · select a cell to inspect that month. Color shows net transfers, not returns.</p>
    <div className="investment-heatmap" role="group" aria-label="Monthly investment transfer calendar">
      {person.monthly.map(month => {
        const net = month.investmentDepositsCents - month.investmentWithdrawalsCents;
        const level = net === 0 ? 0 : Math.min(3, Math.ceil(Math.abs(net) / largest * 3));
        return <button key={month.month} className={`heat-cell ${net >= 0 ? 'deposit' : 'withdrawal'} level-${level}`}
          aria-pressed={month.month >= start && month.month <= end}
          aria-label={`${monthLabel(month.month)}: deposits ${euro(month.investmentDepositsCents)}, withdrawals ${euro(month.investmentWithdrawalsCents)}, net contribution ${euro(net)}. Select this month.`}
          title={`${monthLabel(month.month)} · deposits ${euro(month.investmentDepositsCents)} · withdrawals ${euro(month.investmentWithdrawalsCents)}`}
          onClick={() => onSelect(month.month)}>
          <span>{monthLabel(month.month, true)}</span><strong>{net > 0 ? '+' : ''}{euro(net, true)}</strong>
        </button>;
      })}
    </div>
    <div className="chart-legend"><span><i style={{ background: '#176343' }} />Net contribution</span>
      <span><i style={{ background: '#305dc0' }} />Net withdrawal</span><span>No activity = grey</span></div>
  </>;
}

function CoachCard({ messages, onSend, onExpand, onClear, full = false, loading = false, loadingPhase }: {
  messages: ChatMessage[]; onSend: (question: string) => void; onExpand?: () => void; onClear?: () => void; full?: boolean; loading?: boolean; loadingPhase?: 'searching' | 'thinking' | null;
}) {
  const [input, setInput] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const history = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (history.current) history.current.scrollTop = history.current.scrollHeight;
  }, [messages.length, loading]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!input.trim()) return;
    onSend(input.trim()); setInput('');
  };
  const isExpanded = (!!messages.length || loading) && !collapsed;
  const hasContent = !!messages.length || loading;
  return <section className={`coach-card ${full ? 'full-coach' : ''} ${collapsed ? 'collapsed' : ''}`} aria-label="Money coach">
    <div className="coach-header">
      <form className="coach-input" onSubmit={submit}>
        <label htmlFor="coach-question" className="sr-only">Ask the money coach about your finances</label>
        <input id="coach-question" value={input} maxLength={500} onChange={event => setInput(event.target.value)}
          placeholder="Ask your money assistant" autoComplete="off" disabled={collapsed} />
        <Button type="submit" variant="ghost" isIconOnly isDisabled={!input.trim() || collapsed || loading} aria-label="Send question"><Icon name="arrow" size={18} /></Button>
        {onExpand && <Button variant="ghost" isIconOnly isDisabled={collapsed || loading} aria-label="Open full conversation" onPress={onExpand}><Icon name="expand" size={18} /></Button>}
        {hasContent && <Button variant="ghost" isIconOnly aria-label={collapsed ? 'Expand chat' : 'Collapse chat'} onPress={() => setCollapsed(v => !v)}><Icon name={collapsed ? 'dropdown' : 'chevron-up'} size={18} /></Button>}
      </form>
    </div>
    {isExpanded && <><div ref={history} className="coach-history" role="log" aria-label="Conversation history" aria-live="polite" aria-relevant="additions">
      {messages.map((message, index) => <div key={index} className="coach-exchange">
        <p className="coach-question">{message.question}</p>
        <div className="coach-answer"><p><Markdown text={message.answer.text} /></p>
          <details><summary>Source & limits</summary><p>{message.answer.evidence}</p><p>{message.answer.caveat}</p></details></div>
      </div>)}
      {loading && <div className="coach-exchange"><p className="coach-answer note" role="status">{loadingPhase === 'searching' ? 'Searching web…' : 'Thinking…'}</p></div>}
    </div>
    <div className="coach-footer">
      <span />
      {messages.length > 0 && onClear && <Button variant="ghost" className="coach-clear" onPress={onClear} aria-label="Clear conversation"><Icon name="reset" size={13} />Clear</Button>}
    </div></>}
  </section>;
}

function CoachPage({ thread, threads, onSend, onChoose, onHistory, onBack, historyView, loading, loadingPhase }: {
  thread: ChatThread | null; threads: ChatThread[]; onSend: (question: string) => void;
  onChoose: (id: string) => void; onHistory: () => void; onBack: () => void; historyView: boolean; loading: boolean; loadingPhase?: 'searching' | 'thinking' | null;
}) {
  return <section className="coach-page">
    <div className="coach-page-heading">
      <Button variant="ghost" onPress={historyView ? onBack : onHistory}><Icon name="back" size={16} />{historyView ? 'Back to finances' : 'All chats'}</Button>
      <h1>{historyView ? 'Your conversations' : 'Your money coach'}</h1>
    </div>
    {historyView ? <>
      <p className="note">This person's conversations from this session. Refreshing clears them.</p>
      {threads.length ? <ul className="chat-thread-list">{[...threads].reverse().map(item => <li key={item.id}>
        <button onClick={() => onChoose(item.id)}><Icon name="chat" /><span><strong>{item.title}</strong>
          <small>{item.period} · {item.messages.length} {item.messages.length === 1 ? 'question' : 'questions'}</small></span><Icon name="chevron" size={18} /></button>
      </li>)}</ul> : <p className="empty">No conversations yet. Ask a question from a finance page to start one.</p>}
    </> : thread ? <>
      <p className="note">{thread.title} · {thread.period}. Answers use {monthLabel(thread.endingMonth)}.</p>
      <CoachCard key={thread.id} full messages={thread.messages} onSend={onSend} loading={loading} loadingPhase={loadingPhase} />
    </> : <p className="empty">Choose a conversation from All chats or start one from a finance page.</p>}
  </section>;
}

function BenchmarkCard({ person, benchmarks, months, onAsk }: { person: Person; benchmarks: Benchmarks; months: Month[]; onAsk?: (q: string) => void }) {
  const peer = peerBenchmark(person, benchmarks);
  if (!peer) return null;

  const recentMonths = months.slice(-3);
  const userAvgIncome = Math.round(recentMonths.reduce((s, m) => s + m.incomeCents, 0) / recentMonths.length);
  const userAvgSpending = Math.round(recentMonths.reduce((s, m) => s + m.consumptionCents, 0) / recentMonths.length);
  const userSavingsRate = userAvgIncome > 0 ? ((userAvgIncome - userAvgSpending) / userAvgIncome * 100) : 0;
  const userSpendingRate = userAvgIncome > 0 ? (userAvgSpending / userAvgIncome * 100) : 0;
  const peerSpendingRate = peer.avgIncomeCents > 0 ? (peer.avgSpendingCents / peer.avgIncomeCents * 100) : 0;
  const savingsDelta = userSavingsRate - peer.savingsRate;

  const totalDiscCents = recentMonths.reduce((s, m) => {
    const disc = ['Restaurants', 'Entertainment', 'Lifestyle', 'Travel'];
    return s + disc.reduce((a, c) => a + (m.categorySpendingCents[c] ?? 0), 0);
  }, 0);
  const userDiscPct = userAvgSpending > 0 ? (totalDiscCents / recentMonths.length / userAvgSpending * 100) : 0;
  const discDelta = userDiscPct - benchmarks.population.avgDiscretionaryPercentage;

  const tag = (delta: number, goodIfPositive: boolean, suffix = '') => {
    const good = (delta > 0) === goodIfPositive;
    const cls = Math.abs(delta) < 0.5 ? 'delta-tag neutral' : good ? 'delta-tag better' : 'delta-tag worse';
    const sign = delta > 0 ? '+' : '';
    return <span className={cls}>{sign}{delta.toFixed(1)}{suffix}</span>;
  };

  return <div className="benchmark-card animate-in">
    <div className="benchmark-header">
      <div>
        <span className="benchmark-title">You vs. peers aged {peer.label}</span>
        <span className="benchmark-meta">Based on {peer.n} customers · last 3 months · synthetic data</span>
      </div>
      {onAsk && <button className="card-ask-btn" aria-label="Ask AI about peer comparison"
        onClick={() => onAsk(`How do I compare to my peers aged ${peer.label}? My savings rate is ${userSavingsRate.toFixed(1)}% vs their ${peer.savingsRate}%, my spending rate is ${userSpendingRate.toFixed(1)}% vs their ${peerSpendingRate.toFixed(1)}%, and my income is ${euro(userAvgIncome)} vs their avg ${euro(peer.avgIncomeCents)}. What should I take from this?`)}>
        <Icon name="sparkle" size={14} />
      </button>}
    </div>
    <div className="benchmark-rows">
      <div className="benchmark-row">
        <div className="brow-labels">
          <span>Spending rate <small>(% of income)</small></span>
          <div className="brow-values">
            <strong>{userSpendingRate.toFixed(1)}%</strong>
            <span className="brow-peer">Peer avg {peerSpendingRate.toFixed(1)}%</span>
          </div>
        </div>
        <div className="brow-bars">
          <div className="bbar-track"><div className="bbar-fill you" style={{ width: `${Math.min(userSpendingRate, 100)}%` }} /><span className="bbar-label">You</span></div>
          <div className="bbar-track peer"><div className="bbar-fill peer" style={{ width: `${Math.min(peerSpendingRate, 100)}%` }} /><span className="bbar-label">Peers</span></div>
        </div>
      </div>
      <div className="benchmark-row">
        <div className="brow-labels">
          <span>Monthly income <small>(EUR)</small></span>
          <div className="brow-values">
            <strong>{euro(userAvgIncome, true)}</strong>
            <span className="brow-peer">Peer avg {euro(peer.avgIncomeCents, true)}</span>
          </div>
        </div>
        <div className="brow-bars">
          {(() => {
            const maxIncome = Math.max(userAvgIncome, peer.avgIncomeCents, 1);
            return <>
              <div className="bbar-track"><div className="bbar-fill you" style={{ width: `${userAvgIncome / maxIncome * 100}%` }} /><span className="bbar-label">You</span></div>
              <div className="bbar-track peer"><div className="bbar-fill peer" style={{ width: `${peer.avgIncomeCents / maxIncome * 100}%` }} /><span className="bbar-label">Peers</span></div>
            </>;
          })()}
        </div>
      </div>
    </div>
    <div className="benchmark-kpis">
      <div className="benchmark-kpi">
        <span className="bkpi-label">Savings rate</span>
        <strong className="bkpi-value">{userSavingsRate.toFixed(1)}%</strong>
        <div className="bkpi-peer">Peer avg {peer.savingsRate}% {tag(savingsDelta, true, 'pp')}</div>
      </div>
      <div className="benchmark-kpi">
        <span className="bkpi-label">Discretionary</span>
        <strong className="bkpi-value">{userDiscPct.toFixed(1)}%</strong>
        <div className="bkpi-peer">Pop. avg {benchmarks.population.avgDiscretionaryPercentage}% {tag(-discDelta, true, 'pp')}</div>
      </div>
      <div className="benchmark-kpi">
        <span className="bkpi-label">Monthly income</span>
        <strong className="bkpi-value">{euro(userAvgIncome, true)}</strong>
        <div className="bkpi-peer">Peer avg {euro(peer.avgIncomeCents, true)}</div>
      </div>
    </div>
  </div>;
}

function Transactions({ person, months, mode = 'all' }: { person: Person; months: Month[]; mode?: 'all' | 'payments' | 'investments' }) {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(10);
  useEffect(() => {
    const controller = new AbortController();
    setTransactions(null); setError(null);
    Promise.all([...months].reverse().map(month => loadTransactions(person.userId, month, controller.signal))).then(pages => {
      if (!controller.signal.aborted) setTransactions(pages.flatMap(page => page.transactions));
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        console.error('Failed to load transaction page:', error);
        setError(error instanceof Error ? error.message : 'Could not load transaction history.');
      }
    });
    return () => controller.abort();
  }, [person.userId, months, retry]);
  if (error) return <div role="alert" className="error"><p>{error}</p>
    <Button variant="outline" onPress={() => setRetry(value => value + 1)}>Retry transactions</Button></div>;
  if (!transactions) return <p className="note" role="status">Loading transactions for the selected months…</p>;
  const types = [...new Set(transactions.map(row => row.type))].sort();
  const rows = transactions.filter(row => {
    if (mode === 'payments' && (row.amountCents >= 0 || ['investment_deposit', 'salary_sweep'].includes(row.type))) return false;
    if (mode === 'investments' && !['investment_deposit', 'investment_withdrawal'].includes(row.type)) return false;
    return (filter === 'all' || row.type === filter)
      && `${row.category} ${row.type.replaceAll('_', ' ')} ${row.timestamp}`.toLowerCase().includes(search.toLowerCase());
  });
  return <>
    <div className="transaction-controls"><label>Search history<input type="search" value={search}
      placeholder="Category, type or date" onChange={event => { setSearch(event.target.value); setLimit(10); }} /></label>
      {mode === 'all' && <label>Transaction type<select value={filter} onChange={event => { setFilter(event.target.value); setLimit(10); }}>
        <option value="all">All types</option>{types.map(type => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}
      </select></label>}</div>
    <p className="note" role="status">{rows.length} matching records · newest first · merchant names unavailable</p>
    <ul className="transaction-list" aria-label={`Recorded ${mode === 'all' ? 'transactions' : mode} from ${monthLabel(months[0].month)} through ${monthLabel(months.at(-1)!.month)}`}>
      {rows.slice(0, limit).map(row => <li key={row.id}>
        <span className={`transaction-icon ${row.amountCents >= 0 ? 'incoming' : ''}`}><Icon name={row.amountCents >= 0 ? 'down' : 'up'} size={18} /></span>
        <div className="transaction-description"><strong>{row.category}</strong>
          <span>{row.type.replaceAll('_', ' ')} · <time dateTime={row.timestamp}>{row.timestamp.slice(0, 10)}</time></span></div>
        <strong className={`transaction-amount ${row.amountCents >= 0 ? 'incoming' : ''}`}>
          {row.amountCents > 0 ? '+' : ''}{euro(row.amountCents)}</strong>
      </li>)}</ul>
    {!rows.length && <p className="empty">No matching records in the selected months. Missing records do not prove no real-world activity.</p>}
    {rows.length > limit && <Button variant="outline" onPress={() => setLimit(value => value + 10)}
      aria-label="Show ten more recorded transactions">Show more ({rows.length - limit} remaining)</Button>}
  </>;
}

function Workbench({ person, months, tab, onChooseMonth, benchmarks, onAsk, onInjectMessage }: { person: Person; months: Month[]; tab: Tab; onChooseMonth: (month: string) => void; benchmarks: Benchmarks | null; onAsk?: (question: string) => void; onInjectMessage?: (question: string, answer: Answer) => void }) {
  const month = months.at(-1)!;
  const start = months[0].month;
  const spendingBaseline = { ...month, ...averageSpending(months) };
  const rangeTotals = months.reduce((totals, item) => ({
    income: totals.income + item.incomeCents,
    consumption: totals.consumption + item.consumptionCents,
    cashFlow: totals.cashFlow + item.netCashFlowCents,
    deposits: totals.deposits + item.investmentDepositsCents,
    withdrawals: totals.withdrawals + item.investmentWithdrawalsCents,
    sweeps: totals.sweeps + item.salarySweepsCents,
  }), { income: 0, consumption: 0, cashFlow: 0, deposits: 0, withdrawals: 0, sweeps: 0 });
  const peer = benchmarks ? peerBenchmark(person, benchmarks) : null;
  const peerLabel = peer ? `peers ${peer.label}` : undefined;
  const [category, setCategory] = useState('Restaurants');
  const [reductions, setReductions] = useState<Record<string, number>>({});
  const [overrides, setOverrides] = useState<Overrides>(() => {
    const irregular = irregularCategories(person.monthly);
    const auto: Overrides = {};
    for (const cat of irregular) if (classify(cat, {}) === 'unclassified') auto[cat] = 'irregular';
    return auto;
  });
  const [payments, setPayments] = useState<Payment[]>([]);
  const [recipient, setRecipient] = useState('');
  const [paymentInput, setPaymentInput] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [contribution, setContribution] = useState(0);
  const [notice, setNotice] = useState('');
  const [investmentView, setInvestmentView] = useState<'calendar' | 'chart'>('calendar');
  const [psd2Connected, setPsd2Connected] = useState(false);
  const [psd2Loading, setPsd2Loading] = useState(false);
  const psd2Accounts = getPsd2Accounts(person.userId);
  const psd2Bonus = psd2Connected ? psd2TotalCents(psd2Accounts) : 0;
  const handlePsd2Connect = () => {
    setPsd2Loading(true);
    setTimeout(() => { setPsd2Loading(false); setPsd2Connected(true); }, 2200);
  };
  const handlePsd2Disconnect = () => { setPsd2Connected(false); };
  // Effective balance includes PSD2 bonus from connected external accounts
  const effectiveClosingBalance = month.closingBalanceCents + psd2Bonus;
  const recent3 = person.monthly.slice(-3);
  const avgConsumption = Math.round(recent3.reduce((s, m) => s + m.consumptionCents, 0) / recent3.length);
  const avgIncome = Math.round(recent3.reduce((s, m) => s + m.incomeCents, 0) / recent3.length);
  const avgSurplus = avgIncome - avgConsumption;
  const [safeBase, setSafeBase] = useState<'all' | 'salary'>('all');
  const safeBaseAmount = safeBase === 'all' ? effectiveClosingBalance : month.incomeCents;
  const safeToSpend = Math.max(0, safeBaseAmount - Math.round(avgConsumption * 0.5));
  const safeToSave = Math.min(
    Math.max(0, safeBaseAmount - Math.round(avgConsumption * 1.2)),
    Math.max(0, avgSurplus * 3),
  );
  const paymentTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const outflow = paymentTotal + contribution;
  const balance = sandboxBalance(effectiveClosingBalance, paymentTotal, contribution);
  // Patch the ending month's balance into person.monthly so every chart picks up the outflow and PSD2 bonus automatically.
  const sandboxMonthly = (outflow > 0 || psd2Bonus > 0)
    ? person.monthly.map(m => m.month === month.month
        ? {
            ...m,
            closingBalanceCents: balance,
            netCashFlowCents: m.netCashFlowCents - outflow + psd2Bonus,
            consumptionCents: m.consumptionCents + outflow,
            surplusBeforeTransfersCents: m.surplusBeforeTransfersCents - outflow,
            categorySpendingCents: outflow > 0 ? {
              ...m.categorySpendingCents,
              'Payments (simulated)': outflow,
            } : m.categorySpendingCents,
          }
        : m)
    : person.monthly;
  const reduction = reductions[category] ?? 0;
  const simulation = scenario(spendingBaseline, category, reduction);
  const combined = spendingScenario(spendingBaseline, reductions);
  const revisedMonth = combined.month;
  const reducedCount = Object.values(combined.savings).filter(amount => amount > 0).length;
  const model = sandboxMonthly.filter(item => item.month <= month.month).length >= 4
    ? forecast(sandboxMonthly, month.month, combined.saving) : null;
  const baseline = model && outflow > 0 ? forecast(person.monthly, month.month) : null;
  const categories = [...new Set(person.monthly.filter(item => item.month <= month.month)
    .flatMap(item => Object.keys(item.categorySpendingCents)))].sort();
  const basketTotals = baskets(revisedMonth, overrides);
  const addPayment = (event: FormEvent) => {
    event.preventDefault();
    const amount = parseAmount(paymentInput);
    if (!recipient.trim() || recipient.trim().length > 60 || amount === null) {
      setPaymentError('Enter a recipient and a positive EUR amount with at most two decimal places.'); return;
    }
    if (amount > balance) {
      setPaymentError('This payment exceeds the cash available in your experiment. Remove a test payment, reduce your contribution, or enter a smaller amount.'); return;
    }
    setPayments(items => [...items, { id: (items.at(-1)?.id ?? 0) + 1, recipient: recipient.trim(), amount }]);
    setPaymentError(null); setPaymentInput(''); setRecipient('');
    setNotice(`Simulated payment of ${euro(amount)} added. No money was sent.`);
  };
  return <>
    <p className="sr-only" role="status" aria-live="polite">{notice}</p>
    {tab === 'accounts' && <>
      <Card title="Account balance" className="animate-in hero-card" onAsk={onAsk && (() => onAsk('Give me a quick summary of my account balance and recent cash flow trend.'))}>
        <div className="account-balance"><Money
          label={outflow > 0 || psd2Bonus > 0 ? 'Balance after your experiments' : 'Observed account balance'}
          amount={outflow > 0 || psd2Bonus > 0 ? balance : month.closingBalanceCents}
          detail={outflow > 0 || psd2Bonus > 0
            ? `${euro(month.closingBalanceCents)} S-Bank${psd2Bonus > 0 ? ` + ${euro(psd2Bonus)} connected banks` : ''}${outflow > 0 ? ` − ${euro(outflow)} in experiments` : ''} · not a live balance`
            : `Recorded ${month.balanceObservedAt.slice(0, 10)} · not a live balance`} /></div>
        <Suspense fallback={<p role="status">Loading chart…</p>}><BalanceChart months={sandboxMonthly} start={start} cutoff={month.month} /></Suspense>
        <details><summary>Cash flow & mortgage context</summary>
          <Suspense fallback={<p role="status">Loading chart…</p>}><CashFlowChart months={sandboxMonthly} cutoff={month.month} peerIncomeCents={peer?.avgIncomeCents} peerSpendingCents={peer?.avgSpendingCents} /></Suspense>
          <div className="stat-row">
            <Money label="Income in selected months" amount={rangeTotals.income} peerAmount={peer ? peer.avgIncomeCents * months.length : undefined} peerLabel={peerLabel} />
            <Money label="Spending in selected months" amount={rangeTotals.consumption} peerAmount={peer ? peer.avgSpendingCents * months.length : undefined} peerLabel={peerLabel} />
            <Money label="Net cash flow, including transfers" amount={rangeTotals.cashFlow} />
          </div>
          <p className="note">{person.coverage.observedAccountCount} observed account · EUR · synthetic data.
            {answerQuestion(person, month, 'Explain my mortgage').text}</p>
        </details>
        {outflow > 0 && <details><summary>How your experiments affect cash</summary>
          <p className="note">Test payments of {euro(paymentTotal)} and an extra contribution of {euro(contribution)} would leave {euro(balance)}.
            The recorded balance and transaction history are unchanged.</p></details>}
      </Card>
      {benchmarks && <BenchmarkCard person={person} benchmarks={benchmarks} months={months} onAsk={onAsk} />}
      <Psd2Card userId={person.userId} sBankBalanceCents={month.closingBalanceCents}
        psd2Connected={psd2Connected} psd2Loading={psd2Loading}
        onConnect={handlePsd2Connect} onDisconnect={handlePsd2Disconnect}
        onAsk={onInjectMessage ? (text: string) => onInjectMessage(
          psd2Connected ? 'Tell me about my connected bank accounts' : 'What is PSD2 open banking?',
          { text, evidence: 'Based on your PSD2-connected accounts in this demo.', caveat: 'This is an explanation of the PSD2 feature, not a financial recommendation.' }
        ) : onAsk} />
      <Card title="Transactions" className="animate-in"><Transactions person={person} months={months} /></Card>
    </>}
    {tab === 'spending' && <>
      <Card title={combined.saving ? 'Your spending experiment' : 'Spending mix'} className="animate-in hero-card spending-card" onAsk={onAsk && (() => onAsk('What does my current spending mix look like? Any category I should watch?'))}>
        <div className="spending-playground">
        <Suspense fallback={<p role="status">Loading chart…</p>}><SpendingChart compact averaged={months.length > 1} month={revisedMonth}
          savings={combined.savings} selected={category} onSelect={setCategory} /></Suspense>
        <div className="spending-controls">
        <label className="field">Spending category<select value={category} onChange={event => setCategory(event.target.value)}>
          {categories.map(name => <option key={name}>{name}</option>)}</select></label>
        <div className="slider-label"><label htmlFor="reduction">Monthly reduction{months.length > 1 ? ' · on average' : ''}</label><strong>{reduction}%</strong></div>
        <input id="reduction" type="range" min="0" max="100" step="5" value={reduction}
          aria-valuetext={`${reduction} percent reduction, freeing ${euro(simulation.saving)} per month`}
          onChange={event => {
            const value = Number(event.target.value);
            setReductions(values => ({ ...values, [category]: value }));
          }} />
        <div className="result compact-result" role="status" aria-live="polite"><span>Total potentially freed up each month</span><strong>{euro(combined.saving)}</strong>
          <p>Across {reducedCount} reduced {reducedCount === 1 ? 'category' : 'categories'}</p>
          <p>{category}: {euro(simulation.baseline)} → {euro(simulation.remaining)}</p></div>
        <div className="reduction-actions">
        <Button variant="outline" isDisabled={reduction === 0} onPress={() => {
          setReductions(values => ({ ...values, [category]: 0 })); setNotice(`${category} reduction reset.`);
        }}><Icon name="reset" size={16} />Restore this category</Button>
        {Object.values(reductions).some(value => value > 0) && <Button variant="ghost" onPress={() => {
          setReductions({}); setNotice('All spending reductions reset.');
        }}>Reset all reductions</Button>}
        </div>
        </div></div>
        <details><summary>What this experiment assumes</summary>
          <p className="note">Baseline: {months.length} selected {months.length === 1 ? 'month' : 'months'}, {monthLabel(start)} through {monthLabel(month.month)}.
            Average monthly consumption: {euro(spendingBaseline.consumptionCents)}. With your changes: {euro(revisedMonth.consumptionCents)}.
            Each category is averaged over all selected months, including months with no observed spending in that category, and rounded to cents; totals sum those rounded averages.
            Each category keeps its own reduction when you switch categories. All reductions repeat monthly; other spending stays unchanged.
            Green negative amounts show hypothetical reductions, not achieved savings or a safe-to-spend amount.</p></details>
      </Card>
      <Card title="Spending patterns" className="animate-in" onAsk={onAsk && (() => onAsk('What patterns stand out in my spending?'))}>
        <Suspense fallback={<p role="status">Loading spending insights…</p>}><SpendingInsights
          months={months} reductions={reductions} selected={category} peerSpendingCents={peer?.avgSpendingCents} peerIncomeCents={peer?.avgIncomeCents} /></Suspense>
      </Card>
      <Card title="Three months ahead" className="animate-in" onAsk={onAsk && (() => onAsk('What does my 3-month balance forecast look like and how reliable is it?'))}>
        {model ? <><Suspense fallback={<p role="status">Loading chart…</p>}><BalanceChart months={sandboxMonthly} cutoff={month.month}
            start={start} prediction monthlySaving={combined.saving} /></Suspense>
          <div className="comparison" role="status" aria-live="polite">
            {baseline && <Money label="Next month, no payments" amount={baseline.points[0].central} />}
            <Money label={baseline ? 'Next month, with payments' : 'Next month'} amount={model.points[0].central} detail={outflow > 0 ? `${euro(outflow)} already in starting balance` : undefined} /></div>
          <details><summary>Assumptions & uncertainty</summary><p className="note">Average net cash flow from the last three observed months through the selected month: {euro(model.net)} per month, including transfers.
            {combined.saving > 0 && ` Your combined reductions add ${euro(combined.saving)} each future month.`}
            {outflow > 0 && ` Sandbox payments and investment contribution (${euro(outflow)}) are already reflected in the starting balance.`}
            {` Historical one-month mean absolute error: ${euro(model.mae)} over ${model.backtestCount} checks. No data after the selected month is used.
            The range uses the larger of that error and the largest training-window deviation, widening linearly. It is a sensitivity band, not a confidence interval.
            No bill dates, missing obligations, returns or fees are predicted. Negative forecasts are retained.`}</p></details></>
          : <p className="empty">Select a later month. At least four observed months are needed for a forecast and historical check.</p>}
      </Card>
      {benchmarks && <BenchmarkCard person={person} benchmarks={benchmarks} months={months} onAsk={onAsk} />}
      <Card title="Safe to spend now" className="animate-in" onAsk={onAsk && (() => onAsk('What is safe for me to spend right now without risking next month?'))}>
        <div className="safe-toggle" role="group" aria-label="Base amount for calculation">
          <button className={safeBase === 'all' ? 'safe-toggle-btn active' : 'safe-toggle-btn'} onClick={() => setSafeBase('all')}>All savings</button>
          <button className={safeBase === 'salary' ? 'safe-toggle-btn active' : 'safe-toggle-btn'} onClick={() => setSafeBase('salary')}>This month's salary</button>
        </div>
        <div className="account-balance">
          <Money label="You can spend up to" amount={safeToSpend} />
        </div>
        <p className="note">{safeBase === 'all' ? `Balance ${euro(effectiveClosingBalance)}` : `This month's income ${euro(month.incomeCents)}`} minus a half-month buffer {euro(Math.round(avgConsumption * 0.5))} (½ × avg monthly spending). Estimate only — upcoming bills and irregular costs are not known.</p>
      </Card>
      <details className="basket-details"><summary>Sort spending into three baskets</summary>
        <p className="note">Tentative suggestions, not proven necessities. You decide what fits; ambiguous categories stay unclassified.</p>
        <Suspense fallback={null}><BasketChart totals={basketTotals} /></Suspense>
        <div className="basket-fields">{Object.keys(spendingBaseline.categorySpendingCents).sort().map(name =>
          <label key={name}>{name}<select value={classify(name, overrides)} aria-label={`${name} spending basket`} onChange={event => {
            const value = event.target.value;
            if (value === 'regular' || value === 'irregular' || value === 'everyday' || value === 'unclassified') {
              setOverrides(items => ({ ...items, [name]: value }));
            }
          }}>{(Object.keys(basketLabels) as Basket[]).map(basket => <option key={basket} value={basket}>{basketLabels[basket]}</option>)}</select></label>)}</div>
      </details>
    </>}
    {tab === 'payments' && <>
      <div className="widget-grid"><Card title="Try a payment" className="animate-in hero-card" onAsk={onAsk && (() => onAsk('How would a payment affect my available cash right now?'))}>
        <p className="note">See how a payment would affect your cash. This is a simulation; no money is sent.</p>
        <p className="note">Uses the observed balance at {monthLabel(month.month)}, the ending month chosen on Accounts or Spending.</p>
        <form onSubmit={addPayment} className="payment-form">
          <label>Demo recipient<input value={recipient} maxLength={60} onChange={event => setRecipient(event.target.value)}
            placeholder="e.g. Shared dinner" required aria-invalid={!!paymentError} aria-describedby={paymentError ? 'payment-error' : undefined} /></label>
          <label>Amount, EUR<input value={paymentInput} inputMode="decimal" onChange={event => setPaymentInput(event.target.value)}
            placeholder="0.00" required aria-invalid={!!paymentError} aria-describedby={paymentError ? 'payment-error' : undefined} /></label>
          {paymentError && <p id="payment-error" className="error" role="alert">{paymentError}</p>}
          <Button type="submit" className="primary-button"><Icon name="payments" size={18} />Simulate payment</Button>
        </form>
      </Card><Card title="Payment impact" className="animate-in" onAsk={onAsk && (() => onAsk('What is the impact of my simulated payments on my balance?'))}>
        <div key={paymentTotal} className="balance-flash" style={{ borderRadius: 8 }}><Money label="Total test payments" amount={paymentTotal} /></div>
        {!payments.length ? <p className="empty">Enter a payment to build your test list and see what would be left afterward.</p>
          : <ul className="sandbox-payments">{payments.map(payment => <li key={payment.id}>
            <div><strong>{payment.recipient}</strong><span>Simulation only · {euro(payment.amount)}</span></div>
            <Button variant="ghost" isIconOnly aria-label={`Remove simulated payment to ${payment.recipient}`} onPress={() => {
              setPayments(items => items.filter(item => item.id !== payment.id)); setNotice('Simulated payment removed.');
            }}><Icon name="close" size={18} /></Button></li>)}</ul>}
        {payments.length > 0 && <><div key={balance} className="payment-impact balance-flash" role="status" aria-live="polite">
          <Money label="Cash left after your experiments" amount={balance} detail={contribution > 0
            ? `Also includes your ${euro(contribution)} investment contribution` : 'After the test payments above'} /></div>
          <Button variant="outline" onPress={() => {
            setPayments([]); setPaymentError(null); setNotice('All test payments cleared.');
          }}><Icon name="reset" size={16} />Clear test payments</Button></>}
        <p className="note">Switching person or month, or refreshing, clears them. No payment network is connected.</p>
      </Card></div>
      {model && <Card title="Balance forecast with your payments" className="animate-in">
        <Suspense fallback={<p role="status">Loading chart…</p>}><BalanceChart months={sandboxMonthly} cutoff={month.month}
          start={start} prediction monthlySaving={combined.saving} /></Suspense>
        <div className="comparison" role="status" aria-live="polite">
          {baseline && <Money label="Next month, no payments" amount={baseline.points[0].central} />}
          <Money label="Next month, with payments" amount={model.points[0].central} detail={`${euro(outflow)} deducted from starting balance`} /></div>
        <p className="note">Forecast uses last 3 months' average cash flow. Payments reduce the starting balance once; spending patterns are unchanged.</p>
      </Card>}
      <details className="history-details"><summary>Recorded outgoing payments · {monthLabel(start, true)}–{monthLabel(month.month, true)}</summary>
        <Transactions person={person} months={months} mode="payments" /></details>
    </>}
    {tab === 'investments' && <>
      <Suspense fallback={null}><StockTickerLazy /></Suspense>
      <div className="widget-grid"><Card title="Investment transfers" className="animate-in hero-card" onAsk={onAsk && (() => onAsk('Walk me through my investment transfer activity and what the numbers mean.'))}>
        <div className="chart-view-controls" role="group" aria-label="Investment visualization">
          <Button variant="outline" aria-pressed={investmentView === 'calendar'} onPress={() => setInvestmentView('calendar')}>Heatmap</Button>
          <Button variant="outline" aria-pressed={investmentView === 'chart'} onPress={() => setInvestmentView('chart')}>Monthly bars</Button>
        </div>
        {investmentView === 'calendar' ? <InvestmentHeatmap person={person} start={start} end={month.month} onSelect={onChooseMonth} />
          : <Suspense fallback={<p role="status">Loading chart…</p>}><InvestmentChart months={sandboxMonthly} start={start} cutoff={month.month} /></Suspense>}
        <div className="comparison"><Money label="Deposits in selected months" amount={rangeTotals.deposits} />
          <Money label="Withdrawals in selected months" amount={rangeTotals.withdrawals} /></div>
        {(() => { const extInv = psd2Connected ? psd2InvestmentCents(getPsd2Accounts(person.userId)) : 0; return extInv > 0 && <div className="psd2-ext-investments"><span>External depot balance (via PSD2)</span><strong style={{ color: '#176343' }}>{euro(extInv)}</strong><small>snapshot · not included in transfer chart above</small></div>; })()}
        <details><summary>Transfers are not investment performance</summary>
          <p className="note">These are transfers, not earnings or everyday spending. No holdings, portfolio value or investment performance are provided.
            Salary sweeps in the selected months: {euro(rangeTotals.sweeps)}. Their destination is unknown; they are not confirmed investment deposits.</p></details>
      </Card><Card title="Try setting money aside" className="animate-in" onAsk={onAsk && (() => onAsk('How much am I regularly setting aside, and what could I reasonably afford to contribute?'))}>
        <div className="slider-label"><label htmlFor="contribution">One-time contribution</label><strong>{euro(contribution)}</strong></div>
        <input id="contribution" type="range" min="0" max={Math.min(100000, Math.max(0, month.closingBalanceCents - paymentTotal))}
          step="1" value={contribution} aria-valuetext={`${euro(contribution)} one-time contribution`}
          onChange={event => setContribution(Number(event.target.value))} />
        <div className="result" role="status" aria-live="polite"><span>Cash remaining after your contribution</span><strong>{euro(balance)}</strong>
          <p>{euro(contribution)} set aside · no returns assumed</p></div>
        {paymentTotal > 0 && <p className="note">Also accounts for {euro(paymentTotal)} in test payments.</p>}
        <Button variant="outline" isDisabled={contribution === 0} onPress={() => {
          setContribution(0); setNotice('Extra investment contribution reset.');
        }}><Icon name="reset" size={16} />Reset contribution</Button>
        <p className="note">Uses {monthLabel(month.month)}'s ending balance. Capped at €1,000 or remaining cash, whichever is lower. Not a recommended allocation. No investment order is placed.</p>
      </Card></div>
      <Card title="Safe to save this month" className="animate-in" onAsk={onAsk && (() => onAsk('How much could I safely set aside this month without struggling next month?'))}>
        <div className="safe-toggle" role="group" aria-label="Base amount for calculation">
          <button className={safeBase === 'all' ? 'safe-toggle-btn active' : 'safe-toggle-btn'} onClick={() => setSafeBase('all')}>All savings</button>
          <button className={safeBase === 'salary' ? 'safe-toggle-btn active' : 'safe-toggle-btn'} onClick={() => setSafeBase('salary')}>This month's salary</button>
        </div>
        <div className="account-balance">
          <Money label="You could set aside up to" amount={safeToSave} />
        </div>
        <p className="note">{safeBase === 'all' ? `Balance ${euro(effectiveClosingBalance)}` : `This month's income ${euro(month.incomeCents)}`} minus next month's expected costs {euro(Math.round(avgConsumption * 1.2))} (avg + 20% buffer), capped at 3× avg surplus {euro(Math.max(0, avgSurplus * 3))}. Estimate only — not investment advice.</p>
      </Card>
      <Card title="Recorded investment transfers" className="animate-in"><Transactions person={person} months={months} mode="investments" /></Card>
    </>}
  </>;
}

function Dashboard({ person, tab, period, onPeriodChange, messages, onSend, onExpand, onClear, onAsk, onInjectMessage, loading, loadingPhase, benchmarks }: {
  person: Person; tab: Tab; period: Period; onPeriodChange: (period: Period) => void;
  messages: ChatMessage[]; onSend: (question: string) => void; onExpand: () => void; onClear: () => void; onAsk: (question: string) => void; onInjectMessage?: (question: string, answer: Answer) => void; loading: boolean; loadingPhase?: 'searching' | 'thinking' | null; benchmarks: Benchmarks | null;
}) {
  const months = useMemo(() => person.monthly.slice(period.start, period.end + 1), [person, period.start, period.end]);
  return <>
    <h1 className="sr-only">{tabs.find(item => item.id === tab)!.label}</h1>
    <div className="dashboard-layout">
      <div className="dashboard-main">
        <Workbench key={`${period.start}-${period.end}`} person={person} months={months} tab={tab} benchmarks={benchmarks} onAsk={onAsk} onInjectMessage={onInjectMessage} onChooseMonth={month => {
          const index = person.monthly.findIndex(item => item.month === month);
          if (index < 0) throw new Error('Unknown investment calendar month.');
          onPeriodChange({ start: index, end: index });
        }} />
        <footer><details><summary>Synthetic demo · sources & limitations</summary><p className="note">Fictional display names. {person.userId} · age {person.profile.age}.
          Data from {person.coverage.from} to {person.coverage.through}; {person.coverage.transactionCount} transactions.
          Historical demo clock: {person.demoToday}. Experiments change only this session; switching person/month or refreshing resets them.
          Compact monthly records load on demand from our extracted JSONs; full source records are not hosted.
          {person.limitations.join(' ')} {person.hasSkippedRows && 'Warning: this person has skipped source rows.'}</p></details></footer>
      </div>
      <div className="dashboard-coach">
        <CoachCard key={`${tab}-${period.start}-${period.end}`} messages={messages} onSend={onSend} onExpand={onExpand} onClear={onClear} loading={loading} loadingPhase={loadingPhase} />
      </div>
    </div>
  </>;
}

export default function App() {
  const [userId, setUserId] = useState<string>(PEOPLE[0].id);
  const [person, setPerson] = useState<Person | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [tab, setTab] = useState<Page>(currentTab);
  const [selection, setSelection] = useState<Period | null>(null);
  const [periodPreview, setPeriodPreview] = useState<Period | null>(null);
  const [rangeHidden, setRangeHidden] = useState(false);
  const lastMonth = (person?.monthly.length ?? 1) - 1;
  const period = selection ?? { start: Math.max(0, lastMonth - 11), end: lastMonth };
  const displayedPeriod = periodPreview ?? period;
  const [chats, setChats] = useState<Record<string, ChatThread>>({});
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [returnPage, setReturnPage] = useState<Tab>('accounts');
  const [aiMode, setAiMode] = useState<'live' | 'web' | 'local'>('live');
  const [loadingChat, setLoadingChat] = useState<string | null>(null);
  const [loadingPhase, setLoadingPhase] = useState<'searching' | 'thinking' | null>(null);
  const [darkMode, setDarkMode] = useState(() => document.documentElement.getAttribute('data-mode') === 'dark');
  const [benchmarks, setBenchmarks] = useState<Benchmarks | null>(null);
  const sessionVisited = useRef<Set<string>>(new Set());
  const isFinancePage = tab !== 'ai' && tab !== 'ai-history';
  const chatKey = `${userId}:${period.start}:${period.end}:${tab}`;
  const activeThread = activeChat && chats[activeChat]?.userId === userId ? chats[activeChat] : null;
  const createThread = (): ChatThread => {
    if (!person || person.userId !== userId || !isFinancePage) throw new Error('No finance context for this conversation.');
    return {
      id: chatKey, userId, title: `${tabs.find(item => item.id === tab)!.label} chat`,
      period: `${monthLabel(person.monthly[period.start].month, true)} – ${monthLabel(person.monthly[period.end].month, true)}`,
      endingMonth: person.monthly[period.end].month, messages: [],
    };
  };
  const sendQuestion = (question: string, id: string, context?: ChatThread) => {
    if (!person || person.userId !== userId) throw new Error('No selected person for this conversation.');
    const thread = chats[id] ?? context;
    if (!thread || thread.userId !== userId) throw new Error('Conversation does not belong to this person.');
    const month = person.monthly.find(item => item.month === thread.endingMonth);
    if (!month) throw new Error('Conversation period is unavailable.');
    const currentTab = thread.id.split(':')[3] ?? 'accounts';
    setLoadingChat(id);
    const history: PriorMessage[] = (chats[id]?.messages ?? thread.messages).slice(-6);
    const webContextPromise = aiMode === 'web'
      ? (setLoadingPhase('searching'), import('./agent').then(m => m.searchWebContext(question, currentTab)).catch(() => ''))
      : Promise.resolve('');
    webContextPromise.then(webContext => {
      setLoadingPhase('thinking');
      return answerQuestionExtended(person, month, question, {
        enableLiveAI: aiMode !== 'local',
        liveOnly: aiMode === 'live',
        currentTab,
        webContext,
        benchmarks: benchmarks ?? undefined,
        history,
      });
    }).then(answer => {
      const message = { question, answer };
      setChats(items => ({ ...items, [id]: { ...thread, messages: [...(items[id]?.messages ?? thread.messages), message] } }));
    }).finally(() => { setLoadingChat(null); setLoadingPhase(null); });
  };
  const main = useRef<HTMLElement>(null);
  const appHeader = useRef<HTMLElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = appHeader.current;
    const container = workspace.current;
    if (!bar || !container) return;
    const observer = new ResizeObserver(([entry]) => {
      container.style.setProperty('--app-bar-height', `${entry.borderBoxSize[0].blockSize}px`);
    });
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    loadBenchmarks().then(setBenchmarks).catch(() => { /* benchmarks are optional; fail silently */ });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setPerson(null); setError(null);
    loadPerson(userId, controller.signal).then(value => {
      if (!controller.signal.aborted) setPerson(value);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        console.error('Failed to load Pocket demo summary:', error);
        setError(error instanceof Error ? error.message : 'Could not load the demo summary.');
      }
    });
    return () => controller.abort();
  }, [userId, retry]);
  useEffect(() => {
    const changed = () => { if (window.location.hash !== '#main') setTab(currentTab()); };
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  useEffect(() => {
    const onScroll = () => {
      if (document.activeElement?.closest('#month-subbar')) return;
      if (window.scrollY > 100) setRangeHidden(true);
      else if (window.scrollY < 16) setRangeHidden(false);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    if (darkMode) {
      document.documentElement.setAttribute('data-mode', 'dark');
      localStorage.setItem('pocket-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-mode', 'light');
      localStorage.setItem('pocket-theme', 'light');
    }
  }, [darkMode]);
  useEffect(() => {
    if (!isFinancePage || !person) return;
    const key = `${userId}:${tab}` as InsightKey;
    if (sessionVisited.current.has(key)) return;
    sessionVisited.current.add(key);
    const insight = INSIGHTS[key];
    if (!insight) return;
    const thread: ChatThread = {
      id: chatKey, userId, title: `${tabs.find(item => item.id === tab)!.label} chat`,
      period: '', endingMonth: person.monthly[period.end]?.month ?? '',
      messages: [{ question: '✦ Tab insight', answer: { text: insight, evidence: 'Based on your synthetic demo transaction history.', caveat: 'This is synthetic demo data. Not real financial advice.' } }],
    };
    setChats(items => ({ ...items, [chatKey]: items[chatKey] ?? thread }));
  }, [tab, userId, person]);
  const navigate = (value: Page) => {
    setTab(value); window.location.hash = value === 'ai-history' ? 'ai/history' : value;
    window.scrollTo({ top: 0, behavior: 'instant' }); main.current?.focus({ preventScroll: true });
  };
  const nav = (mobile = false) => <nav aria-label={mobile ? 'Mobile navigation' : 'Main navigation'}>
    {tabs.map(item => <a key={item.id} href={`#${item.id}`} className={`nav-item ${tab === item.id ? 'active' : ''}`}
      aria-current={tab === item.id ? 'page' : undefined} onClick={event => { event.preventDefault(); navigate(item.id); }}>
      <Icon name={item.icon} size={21} /><span>{item.label}</span></a>)}</nav>;
  return <><Particles
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      accent={0.58}
      accentColor="oklch(55% 0.1 155)"
      color="oklch(72% 0.06 155)"
      count={200}
      depth={1}
      direction={60}
      size={2.3}
      twinkle={0}
      intensity={1}
      drift={0.85}
      variety={0.44}
      speed={0.45}
      softness={0}
      opacity={1}
      interactive={false}
    />
  <div className="app-shell"><a className="skip-link" href="#main">Skip to content</a>
    <aside className="sidebar"><a className="brand" href="#accounts" aria-label="Pocket home" onClick={event => {
      event.preventDefault(); navigate('accounts');
    }}>pocket.</a>
      <p className="brand-caption">Your money. Made clearer.</p>{nav()}
      <p className="sidebar-disclosure">S-Pankki challenge<br />Independent synthetic prototype</p>
    </aside>
    <div ref={workspace} className="workspace"><header ref={appHeader} className="app-header"><div className="topbar">
      <a className="brand header-brand" href="#accounts" aria-label="Pocket home" onClick={event => {
        event.preventDefault(); navigate('accounts');
      }}>pocket.</a>
      <div className="header-actions">
        <span className="historical-tag">Synthetic demo</span>
        <button className="theme-toggle" aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setDarkMode(v => !v)}>
          <Icon name={darkMode ? 'sun' : 'moon'} size={16} />
        </button>
        <Dropdown>
          <Dropdown.Trigger className="ai-mode-trigger" aria-label={`AI mode: ${aiMode === 'live' ? 'Live AI' : aiMode === 'web' ? 'AI + Web' : 'Local only'}`}>
            <span className={`ai-mode-badge ${aiMode}`}>{aiMode === 'live' ? '✦ Live AI' : aiMode === 'web' ? '✦ AI + Web' : '⊙ Local'}</span>
            <Icon name="dropdown" size={14} />
          </Dropdown.Trigger>
          <Dropdown.Popover className="person-menu" placement="bottom end">
            <Dropdown.Menu aria-label="AI mode" selectionMode="single" selectedKeys={new Set([aiMode])}
              onAction={key => { const k = String(key); if (k === 'live' || k === 'web' || k === 'local') setAiMode(k); }}>
              <Dropdown.Item key="live" id="live" textValue="Live AI (Nemotron only)">
                <div className="person-menu-copy"><strong>Live AI</strong><span>Nemotron only, no web search</span></div>
                {aiMode === 'live' && <Icon name="check" size={16} />}
              </Dropdown.Item>
              <Dropdown.Item key="web" id="web" textValue="AI + Web (Nemotron + web search)">
                <div className="person-menu-copy"><strong>AI + Web</strong><span>Nemotron + live web context</span></div>
                {aiMode === 'web' && <Icon name="check" size={16} />}
              </Dropdown.Item>
              <Dropdown.Item key="local" id="local" textValue="Local rules only">
                <div className="person-menu-copy"><strong>Local only</strong><span>Rule-based, no API calls</span></div>
                {aiMode === 'local' && <Icon name="check" size={16} />}
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
        <PersonMenu userId={userId} onSelect={id => { setSelection(null); setPeriodPreview(null); setRangeHidden(false); setUserId(id); }} />
      </div>
    </div></header>
    {isFinancePage && tab !== 'payments' && person?.userId === userId && <div id="month-subbar" className="range-subbar" hidden={rangeHidden}>
      <span className="range-label">{monthLabel(person.monthly[displayedPeriod.start].month, true, '2-digit')} – {monthLabel(person.monthly[displayedPeriod.end].month, true, '2-digit')}</span>
      <PeriodSlider months={person.monthly} value={displayedPeriod} onPreview={setPeriodPreview} onChange={value => {
        setPeriodPreview(null); setSelection(value);
      }} />
    </div>}
    <main id="main" ref={main} tabIndex={-1}>{person?.userId === userId
      ? isFinancePage ? <Dashboard key={userId} person={person} tab={tab} period={period} onPeriodChange={setSelection}
        messages={chats[chatKey]?.messages ?? []} onSend={question => sendQuestion(question, chatKey, createThread())}
        loading={loadingChat === chatKey} loadingPhase={loadingChat === chatKey ? loadingPhase : null} benchmarks={benchmarks}
        onClear={() => setChats(items => { const next = { ...items }; delete next[chatKey]; return next; })}
        onAsk={question => sendQuestion(question, chatKey, createThread())}
        onInjectMessage={(question, answer) => {
          const thread = chats[chatKey] ?? createThread();
          setChats(items => ({ ...items, [chatKey]: { ...thread, messages: [...(items[chatKey]?.messages ?? thread.messages), { question, answer }] } }));
        }}
        onExpand={() => {
          const thread = chats[chatKey] ?? createThread();
          setChats(items => ({ ...items, [chatKey]: items[chatKey] ?? thread }));
          setActiveChat(chatKey); setReturnPage(tab); navigate('ai');
        }} />
        : <CoachPage thread={activeThread} threads={Object.values(chats).filter(thread => thread.userId === userId)}
          historyView={tab === 'ai-history'} loading={activeChat ? loadingChat === activeChat : false}
          loadingPhase={activeChat && loadingChat === activeChat ? loadingPhase : null} onSend={question => {
            if (!activeThread) throw new Error('No conversation selected.');
            sendQuestion(question, activeThread.id);
          }} onChoose={id => { setActiveChat(id); navigate('ai'); }}
          onHistory={() => navigate('ai-history')} onBack={() => navigate(returnPage)} />
      : error ? <div className="load-state" role="alert"><h1>Snapshot unavailable</h1><p>{error}</p>
        <Button onPress={() => setRetry(value => value + 1)}>Try again</Button></div>
        : <div className="load-state" role="status">Loading {PEOPLE.find(item => item.id === userId)!.name}'s snapshot…</div>}
    </main></div><div className="mobile-nav">{nav(true)}</div>
  </div></>;
}
