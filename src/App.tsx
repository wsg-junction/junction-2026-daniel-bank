import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Button } from '@heroui/react';
import { loadPerson, PEOPLE } from './data';
import type { Month, Person } from './data';
import { BalanceChart, CashFlowChart, CategoryTrend, SpendingChart } from './Charts';
import {
  answerQuestion, basketColors, basketLabels, baskets, classify, euro, forecast,
  monthLabel, observations, palette, scenario,
} from './finance';
import type { Answer, Basket, Overrides } from './finance';
import { Icon } from './Icons';
import type { IconName } from './Icons';

const tabs = [
  { id: 'overview', label: 'Overview', icon: 'overview' },
  { id: 'explore', label: 'Explore', icon: 'explore' },
  { id: 'plan', label: 'Plan ahead', icon: 'plan' },
  { id: 'coach', label: 'Your coach', icon: 'sparkle' },
] as const;
type Tab = typeof tabs[number]['id'];

function currentTab(): Tab {
  const hash = window.location.hash.slice(1);
  return tabs.find(tab => tab.id === hash)?.id ?? 'overview';
}

function Card({ title, eyebrow, action, children, className = '' }: {
  title: string; eyebrow?: string; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return <section className={`card ${className}`}><div className="card-heading">
    <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2></div>{action}
  </div>{children}</section>;
}

function Metric({ label, value, detail, icon, color }: {
  label: string; value: number; detail: string; icon: IconName; color: string;
}) {
  return <div className={`metric ${color}`}><div className="metric-top"><span>{label}</span>
    <span className="metric-icon"><Icon name={icon} size={18} /></span></div>
    <strong>{euro(value)}</strong><p>{detail}</p></div>;
}

function Landscape() {
  return <div className="landscape" aria-hidden="true">
    <div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="sun" />
    <div className="hill hill-back" /><div className="hill hill-front" />
    <div className="plant plant-one"><i /><i /><i /><span /></div>
    <div className="plant plant-two"><i /><i /><span /></div>
    <div className="floating-token"><Icon name="leaf" size={24} /></div>
    <div className="floating-caption"><span className="tiny-spark"><Icon name="sparkle" size={14} /></span> Small steps. More possibilities.</div>
  </div>;
}

function MortgageCard({ person, month, ask }: { person: Person; month: Month; ask: (question: string) => void }) {
  const mortgage = person.mortgages[0];
  const events = mortgage?.events.filter(event => event.timestamp.slice(0, 7) <= month.month) ?? [];
  const hasDecision = events.some(event => event.type === 'loan_decision');
  const milestoneTypes = ['application_created', 'property_added', 'collateral_added', 'loan_calculation', 'loan_decision'];
  const milestones = events.filter(event => milestoneTypes.includes(event.type));
  return <Card title="A little context for big plans" eyebrow="Mortgage journey"
    action={<span className="icon-tile"><Icon name="house" /></span>}>
    {!mortgage || !events.length ? <div className="empty-mortgage"><span className="empty-icon"><Icon name="house" size={32} /></span>
      <h3>No application data in this period</h3><p>There is no mortgage history available here. That doesn't mean this person has no mortgage or housing costs.</p>
    </div> : <>
      <div className="mortgage-summary"><span className={`status-pill ${hasDecision && mortgage.decision === 'rejected' ? 'rejected' : ''}`}>
        <Icon name={hasDecision && mortgage.decision === 'approved' ? 'check' : 'info'} size={14} />
        {hasDecision ? `Application ${mortgage.decision}` : 'Application in progress'}
      </span>
        {hasDecision && <div><strong>{mortgage.requestedLoanCents === null ? 'Not provided' : euro(mortgage.requestedLoanCents, true)}</strong><span>Requested loan · not current debt</span></div>}
      </div>
      {hasDecision && mortgage.rejectionReason && <p className="note">Decision reason: {mortgage.rejectionReason.replaceAll('_', ' ')}.</p>}
      <ol className="timeline">{milestones.map((event, index) => <li key={`${event.timestamp}-${index}`}><span className="timeline-dot" />
        <div><strong>{event.type.replaceAll('_', ' ')}</strong><small>{event.timestamp.slice(0, 10)}</small></div></li>)}</ol>
      <Button variant="ghost" size="sm" className="text-button" onPress={() => ask('Explain my mortgage application')}>
        Understand this application <Icon name="arrow" size={16} /></Button>
    </>}
    <p className="note">Application records do not establish disbursement, repayment schedules, or current debt.</p>
  </Card>;
}

function Coach({ person, month, initialQuestion }: { person: Person; month: Month; initialQuestion: string | null }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ question: string; answer: Answer }[]>(() =>
    initialQuestion ? [{ question: initialQuestion, answer: answerQuestion(person, month, initialQuestion) }] : []);
  const latest = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ask = (question: string) => {
    if (!question.trim()) return;
    setMessages(items => [...items, { question, answer: answerQuestion(person, month, question) }]);
    setInput('');
  };
  useEffect(() => {
    if (messages.length) latest.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [messages.length]);
  const prompts = ['Where does my money go?', 'Why did my spending change?', 'Reduce restaurants by 20%', 'Explain my transfers', 'What is my forecast?', 'How much did I spend on taxis?'];
  const submit = (event: FormEvent) => { event.preventDefault(); ask(input); };
  return <div className="coach-layout">
    <div className="coach-main">
      <div className="coach-intro"><span className="coach-orb"><Icon name="sparkle" size={32} /></span>
        <span className="tag">Your money, in plain language</span><h2>Let's make sense<br />of your money.</h2>
        <p>No judgment. Just a clearer picture, one question at a time.</p></div>
      <div className="prompt-grid">{prompts.map(prompt => <Button key={prompt} variant="outline"
        className="prompt-button" onPress={() => ask(prompt)}>{prompt}<Icon name="arrow" size={16} /></Button>)}</div>
      <div className="messages" aria-live="polite" aria-relevant="additions">{messages.map((message, index) =>
        <div key={index} className="message-pair">
          <div className="user-message">{message.question}</div>
          <div className="coach-message"><span className="message-avatar"><Icon name="sparkle" size={18} /></span>
            <div><p>{message.answer.text}</p><div className="evidence"><Icon name="check" size={13} />{message.answer.evidence}</div>
              <details><summary>Source & limitations</summary><p className="note">{message.answer.caveat}</p></details></div></div>
        </div>)}</div><div ref={latest} />
      <form className="coach-form" onSubmit={submit}><label className="sr-only" htmlFor="coach-question">Ask about the selected person's finances</label>
        <input ref={inputRef} id="coach-question" value={input} onChange={event => setInput(event.target.value)}
          placeholder="Ask about spending, transfers, or a what-if…" maxLength={500} autoComplete="off" />
        <Button type="submit" isDisabled={!input.trim()} isIconOnly aria-label="Send question" className="send-button"><Icon name="arrow" /></Button></form>
      <p className="coach-disclosure">Local demo coach · calculated from your selected JSON · live AI is not connected</p>
    </div>
    <aside className="coach-context card"><p className="eyebrow">Your conversation context</p><h3>{person.profile.name}'s snapshot</h3>
      <span className={`avatar ${person.profile.color}`}>{person.profile.initials}</span>
      <dl><div><dt>Period</dt><dd>{monthLabel(month.month)}</dd></div><div><dt>Income</dt><dd>{euro(month.incomeCents)}</dd></div>
        <div><dt>Consumption</dt><dd>{euro(month.consumptionCents)}</dd></div><div><dt>Net cash flow</dt><dd>{euro(month.netCashFlowCents)}</dd></div></dl>
      <div className="context-note"><Icon name="info" /><p>Answers use this period. Changing person or month starts a fresh conversation. No banking data leaves this website.</p></div>
      <h4>What I won't guess</h4><p className="note">Merchant names, future bills, guaranteed returns, safe-to-spend amounts, or data from other accounts.</p>
    </aside>
  </div>;
}

function Dashboard({ person, tab, navigate }: { person: Person; tab: Tab; navigate: (tab: Tab) => void }) {
  const [period, setPeriod] = useState(person.monthly.at(-1)!.month);
  const [category, setCategory] = useState('Restaurants');
  const [reduction, setReduction] = useState(20);
  const [goal, setGoal] = useState('1000');
  const [overrides, setOverrides] = useState<Overrides>({});
  const [initialQuestion, setInitialQuestion] = useState<string | null>(null);
  const [coachSession, setCoachSession] = useState(0);
  const month = person.monthly.find(month => month.month === period)!;
  const history = person.monthly.filter(item => item.month <= period);
  const prediction = history.length >= 4 ? forecast(person.monthly, period) : null;
  const spending = Object.entries(month.categorySpendingCents).sort((a, b) => b[1] - a[1]);
  const allCategories = [...new Set(person.monthly.flatMap(month => Object.keys(month.categorySpendingCents)))].sort();
  const basketTotals = baskets(month, overrides);
  const simulation = scenario(month, category, reduction);
  const goalCents = Number(goal) * 100;
  const goalMonths = Number.isFinite(goalCents) && goalCents > 0 && simulation.saving > 0
    ? Math.ceil(goalCents / simulation.saving) : null;
  const ask = (question: string) => {
    setInitialQuestion(question); setCoachSession(value => value + 1); navigate('coach');
  };
  const changePeriod = (value: string) => {
    setPeriod(value); setInitialQuestion(null); setCoachSession(value => value + 1);
  };
  const sectionTitles = {
    overview: ['Your money, understood.', 'A little clarity today. A little more freedom tomorrow.'],
    explore: ['Follow your curiosity.', 'Look closer. Find the patterns behind the numbers.'],
    plan: ['Small changes. Big possibilities.', 'Explore what could happen, without guessing what will.'],
    coach: ['Meet your money coach.', 'A space to ask questions, explore, and learn.'],
  };
  return <>
    <header className="page-heading"><div><p className="eyebrow">MY FINANCIAL PICTURE</p>
      <h1>{sectionTitles[tab][0]}</h1><p>{sectionTitles[tab][1]}</p></div>
      <label className="period-control"><span>Viewing month</span>
        <select aria-label="Viewing month" value={period} onChange={event => changePeriod(event.target.value)}>
          {[...person.monthly].reverse().map(month => <option key={month.month} value={month.month}>{monthLabel(month.month)}</option>)}
        </select></label></header>
    {tab === 'overview' && <section className="welcome-banner"><div className="welcome-copy">
      <span className="tag"><span className="live-dot" />A moment for your money</span>
      <h2>Hey {person.profile.name},<br />let's grow your peace of mind.</h2>
      <p>You don't need to be a money expert.<br className="desktop-break" /> You just need a good place to start.</p>
      <Button className="primary-button" onPress={() => ask('Give me a spending summary')}><Icon name="sparkle" size={17} />Explore with your coach<Icon name="arrow" size={17} /></Button>
    </div><Landscape /></section>}
    {tab !== 'coach' && <div className="metrics-grid">
      <Metric label="Observed balance" value={month.closingBalanceCents} detail={`Recorded ${month.balanceObservedAt.slice(0, 10)} · not live`} icon="wallet" color="balance" />
      <Metric label="Money in" value={month.incomeCents} detail="Salary & other income · no transfers" icon="down" color="income" />
      <Metric label="Everyday spending" value={month.consumptionCents} detail="All consumption · transfers excluded" icon="up" color="spending" />
      <Metric label="Before transfers" value={month.surplusBeforeTransfersCents} detail="Income minus consumption · not savings" icon="leaf" color="surplus" />
    </div>}
    {tab === 'overview' && <>
      <div className="main-grid"><Card title="The bigger picture" eyebrow="Your observed balance"
        action={<Button variant="ghost" size="sm" className="text-button" onPress={() => navigate('plan')}>See forecast<Icon name="arrow" size={15} /></Button>}>
        <div className="chart-headline"><strong>{euro(month.closingBalanceCents)}</strong>
          <span className={`soft-badge ${month.netCashFlowCents < 0 ? 'negative' : ''}`}>{month.netCashFlowCents >= 0 ? '+' : ''}{euro(month.netCashFlowCents)} this month</span></div>
        <BalanceChart months={person.monthly} cutoff={period} /></Card>
        <Card title="Where it went" eyebrow={monthLabel(period)}>
          <SpendingChart month={month} selected="" onSelect={value => { setCategory(value); navigate('explore'); }} />
          <Button variant="ghost" size="sm" className="text-button full-link" onPress={() => navigate('explore')}>Explore all spending<Icon name="arrow" size={16} /></Button>
        </Card></div>
      <div className="section-heading"><div><p className="eyebrow">More than numbers</p><h2>A few things worth noticing</h2></div><span className="muted small">Based on {monthLabel(period)}</span></div>
      <div className="insights-grid">{observations(person, month).map(insight =>
        <button key={insight.title} className={`insight-card ${insight.tone}`} onClick={() => ask(insight.question)}>
          <span className="insight-icon"><Icon name={insight.tone === 'green' ? 'leaf' : insight.tone === 'purple' ? 'sparkle' : 'explore'} /></span>
          <h3>{insight.title}</h3><p>{insight.text}</p><span className="insight-action">Let's unpack this<Icon name="arrow" size={16} /></span>
        </button>)}</div>
      <div className="two-columns"><Card title="Income meets everyday life" eyebrow="Cash flow, clearly">
        <CashFlowChart months={person.monthly} cutoff={period} /></Card>
        <section className="scenario-teaser"><span className="tag"><Icon name="plan" size={15} />A small what-if</span>
          <h2>Same you.<br />A little more room.</h2><p>What if restaurant spending was 20% lower?</p>
          <strong>{euro(scenario(month, 'Restaurants', 20).saving)}<small>potentially freed up / month</small></strong>
          <Button variant="secondary" className="light-button" onPress={() => { setCategory('Restaurants'); setReduction(20); navigate('plan'); }}>Try your own scenario<Icon name="arrow" size={17} /></Button>
          <p className="tiny">Based on {monthLabel(period)}. A hypothetical change, not achieved savings.</p></section></div>
    </>}
    {tab === 'explore' && <>
      <div className="main-grid"><Card title="Your spending, unpacked" eyebrow="Consumption · not transfers">
        <SpendingChart month={month} selected={category} onSelect={setCategory} />
        <p className="note">Select a category below to see its full history. Merchant names are not present in the source.</p></Card>
        <Card title="Three baskets. A clearer picture." eyebrow="How your money works">
          <div className="basket-bar">{(Object.keys(basketTotals) as Basket[]).map(basket =>
            <span key={basket} style={{ width: `${month.consumptionCents ? basketTotals[basket] / month.consumptionCents * 100 : 0}%`, background: basketColors[basket] }} />)}</div>
          <div className="basket-list">{(Object.keys(basketLabels) as Basket[]).map(basket =>
            <div key={basket}><i style={{ background: basketColors[basket] }} /><span>{basketLabels[basket]}</span><strong>{euro(basketTotals[basket])}</strong></div>)}</div>
          <div className="context-note"><Icon name="info" /><p>Category-based suggestions, not proven necessities or recurring bills. Ambiguous spending stays unclassified. You can change each basket below.</p></div>
        </Card></div>
      <Card title="Every category has a story" eyebrow="Choose one to look closer" className="category-card">
        <div className="category-pills">{allCategories.map(value => <button key={value} onClick={() => setCategory(value)}
          aria-pressed={category === value} className={category === value ? 'active' : ''}>{value}</button>)}</div>
        <div className="category-detail"><div><h3>{category}</h3><strong>{euro(month.categorySpendingCents[category] ?? 0)}</strong>
          <p>{month.categoryCounts[category] ?? 0} identified payments in {monthLabel(period)}</p></div>
          <Button variant="outline" size="sm" onPress={() => ask(`How much did I spend on ${category}?`)}><Icon name="sparkle" size={16} />Explain this</Button></div>
        <CategoryTrend months={person.monthly} cutoff={period} category={category} />
        <p className="note">No category amount means no identified consumption in these records, not proof of no real-world obligations.</p>
      </Card>
      <Card title="Put spending in its place" eyebrow="Your context matters">
        <p className="note">Overrides apply to this person's categories for this session only. “Essential · irregular” is never inferred from category alone.</p>
        <div className="table-scroll"><table className="spending-table"><thead><tr><th>Category</th><th>Amount</th><th>Payments</th><th>Basket suggestion</th><th>Basis</th></tr></thead>
          <tbody>{spending.map(([name, amount], index) => <tr key={name}><td><button className="table-category" onClick={() => setCategory(name)}>
            <i style={{ background: palette[index % palette.length] }} />{name}</button></td><td>{euro(amount)}</td><td>{month.categoryCounts[name]}</td>
            <td><select aria-label={`${name} spending basket`} value={classify(name, overrides)}
              onChange={event => {
                const basket = event.target.value;
                if (basket === 'regular' || basket === 'irregular' || basket === 'everyday' || basket === 'unclassified') {
                  setOverrides(values => ({ ...values, [name]: basket }));
                }
              }}>{(Object.keys(basketLabels) as Basket[]).map(basket => <option key={basket} value={basket}>{basketLabels[basket]}</option>)}</select></td>
            <td><span className="basis-label">{overrides[name] ? 'Your choice' : classify(name, {}) === 'unclassified' ? 'Unknown' : 'Tentative'}</span></td></tr>)}</tbody></table></div>
      </Card>
      <Card title="Money moving is not money spent" eyebrow="Transfers, kept separate">
        <div className="transfer-grid"><div><span>Investment deposits</span><strong>{euro(month.investmentDepositsCents)}</strong><small>Outflow to investments</small></div>
          <div><span>Investment withdrawals</span><strong>{euro(month.investmentWithdrawalsCents)}</strong><small>Asset transfer, not income</small></div>
          <div><span>Salary sweeps</span><strong>{euro(month.salarySweepsCents)}</strong><small>Destination unknown</small></div>
          <div><span>Net cash flow</span><strong>{euro(month.netCashFlowCents)}</strong><small>Includes all transactions</small></div></div>
        <Button variant="ghost" size="sm" className="text-button" onPress={() => ask('Explain my transfers')}>Why this distinction matters<Icon name="arrow" size={16} /></Button>
      </Card>
    </>}
    {tab === 'plan' && <>
      <div className="two-columns plan-grid"><Card title="What if you changed one thing?" eyebrow="The possibility playground" className="simulator">
        <p className="card-description">Not a budget that tells you “no”. A little experiment that shows you what's possible.</p>
        <label className="field-label">Spending category<select value={category} aria-label="Scenario category"
          onChange={event => setCategory(event.target.value)}>{allCategories.map(name => <option key={name}>{name}</option>)}</select></label>
        <div className="slider-heading"><label htmlFor="reduction">Reduce spending by</label><strong>{reduction}%</strong></div>
        <input type="range" id="reduction" min="0" max="100" step="5" value={reduction} onChange={event => setReduction(Number(event.target.value))} />
        <div className="range-labels"><span>A tiny change</span><span>A fresh start</span></div>
        <div className="scenario-result"><span>Potential monthly breathing room</span><strong>{euro(simulation.saving)}</strong>
          <p>{euro(simulation.annual)} over 12 months if repeated</p></div>
        <div className="scenario-comparison"><div><span>Observed {category}</span><strong>{euro(simulation.baseline)}</strong></div>
          <Icon name="arrow" /><div><span>With your change</span><strong>{euro(simulation.remaining)}</strong></div></div>
        <p className="note">Baseline: {monthLabel(period)}. Other spending stays unchanged. A 12-month extrapolation is not a forecast of achieved savings.</p>
        <Button variant="ghost" className="text-button" onPress={() => ask(`Reduce ${category} by ${reduction}%`)}><Icon name="sparkle" size={16} />Explain my scenario<Icon name="arrow" size={16} /></Button>
      </Card>
      <section className="goal-card"><span className="goal-icon"><Icon name="plan" size={32} /></span><p className="eyebrow">Give the possibility a purpose</p>
        <h2>A weekend away?<br />A rainy-day cushion?</h2><p>Choose a target and see how this one change could contribute.</p>
        <label className="field-label" htmlFor="goal">Your hypothetical target, EUR<input id="goal" type="number" min="1" max="1000000" step="1"
          value={goal} onChange={event => setGoal(event.target.value)} /></label>
        {goalMonths ? <div className="goal-estimate"><strong>{goalMonths}<span>months</span></strong><p>at {euro(simulation.saving)} per month from this scenario alone</p></div>
          : <p className="goal-empty" role="status">{goalCents > 0 ? 'Increase the reduction or choose a category with observed spending to explore a timeline.' : 'Enter a positive target to see an estimate.'}</p>}
        <p className="tiny">An illustrative target, not a recorded account or existing goal. Assumes you set the saving aside each month. No interest, fees, or returns included.</p>
      </section></div>
      <Card title="A glimpse ahead, not a promise" eyebrow="Three-month balance scenario"
        action={<span className="soft-badge purple">Experimental baseline</span>}>
        {prediction && <div className="forecast-headline"><div><span>Next-month central scenario</span><strong>{euro(prediction.points[0].central)}</strong></div>
          <div><span>Sensitivity range</span><strong className="range-value">{euro(prediction.points[0].low, true)} — {euro(prediction.points[0].high, true)}</strong></div></div>}
        <BalanceChart months={person.monthly} cutoff={period} prediction />
        {prediction && <><div className="forecast-assumptions"><div><Icon name="explore" /><span>Trailing 3-month cash flow<strong>{euro(prediction.net)} / month</strong></span></div>
          <div><Icon name="plan" /><span>Historical one-month error<strong>{euro(prediction.mae)} · {prediction.backtestCount} checks</strong></span></div>
          <div><Icon name="info" /><span>Training period<strong>{monthLabel(prediction.window[0], true)} – {monthLabel(period, true)}</strong></span></div></div>
          <details className="method-details"><summary>How this projection works</summary>
            <p>We average the last three observed monthly net cash flows and add that amount to the selected month's observed balance for each future month. No observations after the selected month are used.</p>
            <p>Each historical check predicts a month using only its preceding three months. The displayed error is mean absolute error. The range uses the larger of that error and the largest cash-flow deviation in the training window, widening linearly over time. It is a sensitivity band, not a calibrated confidence interval.</p>
            <p>Average components: income {euro(prediction.income)}, consumption {euro(prediction.consumption)}, investment deposits {euro(prediction.deposits)}, withdrawals {euro(prediction.withdrawals)}, salary sweeps {euro(prediction.sweeps)}. Rounded component averages may differ from the net average by a few cents.</p>
            <p>Transfers are assumed to repeat. We do not predict bill dates, unobserved obligations, or investment returns. Negative projected balances are shown, not hidden. This is not a safe-to-spend allowance or financial advice.</p>
          </details></>}
      </Card>
      <MortgageCard person={person} month={month} ask={ask} />
    </>}
    {tab === 'coach' && <Coach key={`${period}-${coachSession}`} person={person} month={month} initialQuestion={initialQuestion} />}
    <footer className="page-footer"><span><Icon name="pocket" size={16} /> Made for a healthier relationship with money.</span>
      <details><summary>Synthetic demo · data & limitations</summary><p>Fictional display names. {person.userId} · age {person.profile.age} · {person.coverage.transactionCount} transactions · {person.coverage.observedAccountCount} observed account(s).
        Data coverage: {person.coverage.from} to {person.coverage.through}. Simulated today: {person.demoToday}. {person.limitations.join(' ')}
        {person.hasSkippedRows && ' Warning: this person has skipped source rows.'} Full transaction records stay outside the hosted bundle.</p></details></footer>
  </>;
}

export default function App() {
  const [userId, setUserId] = useState<string>(PEOPLE[0].id);
  const [person, setPerson] = useState<Person | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [tab, setTab] = useState<Tab>(currentTab);
  const heading = useRef<HTMLDivElement>(null);
  const selected = PEOPLE.find(person => person.id === userId)!;
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
    const changed = () => setTab(currentTab());
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  const navigate = (value: Tab) => {
    setTab(value); window.location.hash = value;
    window.scrollTo({ top: 0, behavior: 'instant' });
    heading.current?.focus({ preventScroll: true });
  };
  const nav = (mobile = false) => <nav aria-label={mobile ? 'Mobile navigation' : 'Main navigation'}>
    {tabs.map(item => <Button key={item.id} variant="ghost" className={`nav-item ${tab === item.id ? 'active' : ''}`}
      aria-current={tab === item.id ? 'page' : undefined} onPress={() => navigate(item.id)}>
      <Icon name={item.icon} size={mobile ? 21 : 19} /><span>{item.label}</span>
      {!mobile && tab === item.id && <span className="nav-active-dot" />}
    </Button>)}</nav>;
  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <aside className="sidebar"><a className="brand" href="#overview" onClick={() => navigate('overview')}>
      <span className="brand-icon"><Icon name="pocket" size={25} /></span>pocket<span className="brand-period">.</span></a>
      <p className="brand-caption">A little clarity goes a long way.</p>
      <div className="nav-label">YOUR SPACE</div>{nav()}
      <div className="sidebar-note"><div className="sidebar-note-icon"><Icon name="leaf" size={25} /></div>
        <h3>Progress, not perfection.</h3><p>You don't have to change everything. Start with understanding.</p>
        <Button variant="ghost" className="text-button" size="sm" onPress={() => navigate('plan')}>Find your next step<Icon name="arrow" size={15} /></Button></div>
      <div className="sidebar-bottom"><span className="demo-pill"><span className="live-dot" />Junction 2026 demo</span><p>Inspired by the S-Pankki challenge<br />Independent prototype · synthetic data</p></div>
    </aside>
    <div className="workspace"><div className="topbar">
      <a className="mobile-brand brand" href="#overview" onClick={() => navigate('overview')}><span className="brand-icon"><Icon name="pocket" size={22} /></span>pocket.</a>
      <div className="breadcrumb">Your space <Icon name="chevron" size={14} /><strong>{tabs.find(item => item.id === tab)?.label}</strong></div>
      <div className="topbar-right"><span className="historical-tag"><span className="live-dot" />Historical demo · Oct 2026</span>
        <label className="person-switcher"><span className={`avatar ${selected.color}`}>{selected.initials}</span>
          <span className="person-label"><small>Demo person</small><select aria-label="Choose demo person" value={userId} onChange={event => setUserId(event.target.value)}>
            {PEOPLE.map(person => <option key={person.id} value={person.id}>{person.name} · {person.description}</option>)}</select></span></label>
      </div>
    </div><main id="main" ref={heading} tabIndex={-1}>
      {person?.userId === userId ? <Dashboard key={userId} person={person} tab={tab} navigate={navigate} />
        : error ? <div className="load-state error-state" role="alert"><Icon name="info" size={40} /><h1>We couldn't load this snapshot.</h1>
          <p>{error}</p><Button onPress={() => setRetry(value => value + 1)}>Try again</Button></div>
          : <div className="load-state" role="status"><span className="loading-orb"><Icon name="pocket" size={32} /></span>
            <h2>A little clarity is on its way.</h2><p>Loading {selected.name}'s financial snapshot…</p></div>}
    </main></div><div className="mobile-nav">{nav(true)}</div>
  </div>;
}
