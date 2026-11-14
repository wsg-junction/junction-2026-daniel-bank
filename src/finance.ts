import type { Month, Person } from './data.ts';

export const euro = (cents: number, compact = false) =>
  new Intl.NumberFormat('en-FI', {
    style: 'currency', currency: 'EUR',
    maximumFractionDigits: compact ? 0 : 2,
    minimumFractionDigits: compact ? 0 : 2,
  }).format(cents / 100);

export function monthLabel(month: string, short = false) {
  return new Intl.DateTimeFormat('en-GB', { month: short ? 'short' : 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${month}-01T12:00:00Z`));
}

export function nextMonth(month: string, offset: number) {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7);
}

export const palette = ['#326e56', '#9cbf89', '#c7b9e4', '#e8b58e', '#e2cd79', '#8eacb6', '#c9cfcb', '#a8a19a'];
export type Basket = 'regular' | 'irregular' | 'everyday' | 'unclassified';
export type Overrides = Record<string, Basket>;
export const basketLabels: Record<Basket, string> = {
  regular: 'Essential · regular',
  irregular: 'Essential · irregular',
  everyday: 'Everyday · flexible',
  unclassified: 'Needs your context',
};
export const basketColors: Record<Basket, string> = {
  regular: '#326e56', irregular: '#e8b58e', everyday: '#b1a0d5', unclassified: '#c9cfcb',
};

export function classify(category: string, overrides: Overrides): Basket {
  if (overrides[category]) return overrides[category];
  if (['Housing', 'Utilities'].includes(category)) return 'regular';
  if (['Restaurants', 'Entertainment', 'Lifestyle', 'Travel'].includes(category)) return 'everyday';
  return 'unclassified';
}

export function baskets(month: Month, overrides: Overrides) {
  const totals: Record<Basket, number> = { regular: 0, irregular: 0, everyday: 0, unclassified: 0 };
  for (const [category, amount] of Object.entries(month.categorySpendingCents)) {
    totals[classify(category, overrides)] += amount;
  }
  return totals;
}

export function scenario(month: Month, category: string, reduction: number) {
  if (!Number.isFinite(reduction) || reduction < 0 || reduction > 100) {
    throw new Error('Reduction must be between 0 and 100 percent.');
  }
  const baseline = month.categorySpendingCents[category] ?? 0;
  const saving = Math.round(baseline * reduction / 100);
  return { baseline, saving, remaining: baseline - saving, annual: saving * 12 };
}

const mean = (values: number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

export function forecast(months: Month[], cutoff: string) {
  const history = months.filter(month => month.month <= cutoff);
  if (history.length < 4 || history.at(-1)?.month !== cutoff) {
    throw new Error('A forecast requires the selected month and at least three preceding months.');
  }
  const window = history.slice(-3);
  const net = mean(window.map(month => month.netCashFlowCents));
  const income = mean(window.map(month => month.incomeCents));
  const consumption = mean(window.map(month => month.consumptionCents));
  const deposits = mean(window.map(month => month.investmentDepositsCents));
  const withdrawals = mean(window.map(month => month.investmentWithdrawalsCents));
  const sweeps = mean(window.map(month => month.salarySweepsCents));
  const errors: number[] = [];
  for (let i = 3; i < history.length; i++) {
    const prediction = mean(history.slice(i - 3, i).map(month => month.netCashFlowCents));
    errors.push(Math.abs(history[i].netCashFlowCents - prediction));
  }
  const mae = mean(errors);
  const sensitivity = Math.max(mae, ...window.map(month => Math.abs(month.netCashFlowCents - net)));
  const balance = history.at(-1)!.closingBalanceCents;
  return {
    window: window.map(month => month.month), net, income, consumption, deposits, withdrawals, sweeps,
    mae, backtestCount: errors.length, sensitivity,
    points: [1, 2, 3].map(step => ({
      month: nextMonth(cutoff, step),
      central: balance + net * step,
      low: balance + (net - sensitivity) * step,
      high: balance + (net + sensitivity) * step,
    })),
  };
}

export function observations(person: Person, month: Month) {
  const previous = person.monthly.find(item => item.month === nextMonth(month.month, -1));
  const spending = Object.entries(month.categorySpendingCents).sort((a, b) => b[1] - a[1]);
  const insights: { title: string; text: string; tone: 'green' | 'peach' | 'purple'; question: string }[] = [];
  if (previous && previous.consumptionCents > 0) {
    const difference = month.consumptionCents - previous.consumptionCents;
    const percent = Math.abs(difference / previous.consumptionCents * 100).toFixed(0);
    insights.push({
      title: `Spending ${difference <= 0 ? 'eased' : 'rose'} ${percent}%`,
      text: `${euro(Math.abs(difference))} ${difference <= 0 ? 'less' : 'more'} consumption than ${monthLabel(previous.month, true)}. Transfers are excluded.`,
      tone: 'green', question: 'Why did my spending change?',
    });
  }
  if (month.salarySweepsCents > 0) {
    insights.push({ title: 'Your money is moving',
      text: `${euro(month.salarySweepsCents)} in salary sweeps. This is not consumption; the destination is unknown.`,
      tone: 'purple', question: 'Explain my transfers' });
  } else if (month.investmentWithdrawalsCents > 0) {
    insights.push({ title: 'Transfers are not earnings',
      text: `${euro(month.investmentWithdrawalsCents)} came from investments. It raises cash flow, not earned income.`,
      tone: 'purple', question: 'Explain my transfers' });
  } else {
    insights.push({ title: 'Make room for future you',
      text: `${euro(month.investmentDepositsCents)} transferred into investments this month. Deposits are not everyday spending.`,
      tone: 'purple', question: 'Explain my transfers' });
  }
  if (spending[0]) insights.push({
    title: `${spending[0][0]} is your largest category`,
    text: `${euro(spending[0][1])}, or ${Math.round(spending[0][1] / month.consumptionCents * 100)}% of this month's consumption.`,
    tone: 'peach', question: `How much did I spend on ${spending[0][0]}?`,
  });
  return insights;
}

export interface Answer { text: string; evidence: string; caveat: string }

export function answerQuestion(person: Person, month: Month, question: string): Answer {
  const q = question.toLowerCase().trim();
  const evidence = `${monthLabel(month.month)} · ${month.transactionCount} observed transactions · ${person.userId}`;
  const caveat = 'Synthetic, historical data from observed accounts only. This is a local data explanation, not financial advice.';
  const result = (text: string): Answer => ({ text, evidence, caveat });
  const explicitDate = q.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/);
  const mentionedMonth = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
    .findIndex(name => q.includes(name));
  if ((explicitDate && explicitDate[0] !== month.month)
      || (mentionedMonth >= 0 && mentionedMonth + 1 !== Number(month.month.slice(5)))
      || /\b(last year|this week|last week|next week|last month|this month|today|yesterday)\b/.test(q)) {
    return result('I answer for the month selected at the top of the app. Select the period you want, then ask again without a relative date. I do not have live or weekly transaction detail in this demo.');
  }
  if (/safe|afford/.test(q)) return result(
    'I cannot responsibly say what is safe to spend from this account alone. We would need your upcoming bills, expected payment dates, other accounts, and chosen emergency buffer. The Plan view shows a cash-flow scenario, not a safe-to-spend allowance.');
  if (/forecast|predict|next three|next month/.test(q)) {
    if (person.monthly.filter(item => item.month <= month.month).length < 4) {
      return result('There is not enough preceding history for this forecast. Choose a month with at least four observed months, so a three-month baseline can be backtested.');
    }
    const model = forecast(person.monthly, month.month);
    return result(`If the last three months repeat, the average monthly cash-flow change is ${euro(model.net)}. The next-month balance scenario is ${euro(model.points[0].central)}, with a sensitivity range of ${euro(model.points[0].low)}–${euro(model.points[0].high)}. Past one-month prediction error averaged ${euro(model.mae)} over ${model.backtestCount} checks. This includes investment transfers and salary sweeps; it is not guaranteed.`);
  }
  if (/mortgage|loan|collateral/.test(q)) {
    const mortgage = person.mortgages[0];
    const decision = mortgage?.events.find(event => event.type === 'loan_decision' && event.timestamp.slice(0, 7) <= month.month);
    if (!mortgage || !decision) return result('There is no mortgage decision observed by the selected month. Missing application data does not mean you have no mortgage.');
    return result(`The application was ${mortgage.decision}${mortgage.rejectionReason ? ` (${mortgage.rejectionReason.replaceAll('_', ' ')})` : ''}. Requested loan: ${mortgage.requestedLoanCents === null ? 'not provided' : euro(mortgage.requestedLoanCents)}. These are application facts, not a current debt balance or proof of disbursement.`);
  }
  if (/transfer|sweep|invest/.test(q)) return result(
    `Investment deposits: ${euro(month.investmentDepositsCents)}. Investment withdrawals: ${euro(month.investmentWithdrawalsCents)}. Salary sweeps: ${euro(month.salarySweepsCents)}. Deposits and sweeps are not consumption, and withdrawals are not earnings. The sweep destination is unknown. Net cash flow after all transactions: ${euro(month.netCashFlowCents)}.`);
  if (/why|change|compare/.test(q)) {
    const previous = person.monthly.find(item => item.month === nextMonth(month.month, -1));
    if (!previous) return result('There is no preceding month available for this comparison.');
    const categories = new Set([...Object.keys(previous.categorySpendingCents), ...Object.keys(month.categorySpendingCents)]);
    const changes = [...categories].map(category => ({
      category, delta: (month.categorySpendingCents[category] ?? 0) - (previous.categorySpendingCents[category] ?? 0),
    })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3);
    return result(`Consumption changed by ${euro(month.consumptionCents - previous.consumptionCents)} versus ${monthLabel(previous.month)}. Largest category changes: ${changes.map(item => `${item.category} ${item.delta >= 0 ? '+' : ''}${euro(item.delta)}`).join('; ')}. These describe the change, not its cause.`);
  }
  const category = Object.keys(month.categorySpendingCents).find(name => q.includes(name.toLowerCase()))
    ?? (/dining|restaurant/.test(q) ? 'Restaurants' : undefined);
  if (/save|reduc|cut|what if/.test(q)) {
    const percentMatch = q.match(/(-?\d+(?:\.\d+)?)\s*%/);
    const reduction = percentMatch ? Number(percentMatch[1]) : 20;
    if (reduction < 0 || reduction > 100) return result('Choose a reduction between 0% and 100%.');
    const model = scenario(month, category ?? 'Restaurants', reduction);
    return result(`Reducing ${category ?? 'Restaurants'} by ${reduction}% against ${euro(model.baseline)} would free up ${euro(model.saving)} for one month. Repeating the same saving for 12 months would total ${euro(model.annual)}. Other spending is assumed unchanged. This is hypothetical, not money already saved.`);
  }
  if (/taxi|taxis/.test(q)) {
    const taxi = month.mccSpendingCents['4121'];
    return result(taxi === undefined
      ? 'No taxi spending with MCC 4121 is identified in this month. Transactions without MCC codes could include taxis, so absence is not proof of zero spending.'
      : `${euro(taxi)} of taxi spending is identified by MCC 4121. Transactions with missing MCC codes may not be included.`);
  }
  if (category) return result(
    `${category}: ${euro(month.categorySpendingCents[category] ?? 0)} across ${month.categoryCounts[category] ?? 0} observed payments. It accounts for ${month.consumptionCents ? Math.round((month.categorySpendingCents[category] ?? 0) / month.consumptionCents * 100) : 0}% of consumption. Merchant names are not available.`);
  if (/income|salary|earn/.test(q)) return result(
    `Income from salary and other income is ${euro(month.incomeCents)}. After ${euro(month.consumptionCents)} of consumption, the surplus before transfers is ${euro(month.surplusBeforeTransfersCents)}. Investment withdrawals are excluded from income.`);
  if (/balance|cash flow/.test(q)) return result(
    `The last observed balance for this month is ${euro(month.closingBalanceCents)}, recorded ${month.balanceObservedAt.slice(0, 10)}. Net cash flow for the month is ${euro(month.netCashFlowCents)}. This is not a live balance.`);
  if (/spend|summary|overview|tip|habit|explain|where.*money/.test(q)) return result(
    `You received ${euro(month.incomeCents)} in income and used ${euro(month.consumptionCents)} for consumption. Your surplus before transfers was ${euro(month.surplusBeforeTransfersCents)}. ${observations(person, month).map(item => item.text).join(' ')} Try the restaurant slider in Plan to explore a change without treating investment transfers as spending.`);
  return result('I can explain spending categories, income, transfers, taxis, monthly changes, mortgage application facts, and the forecast, or calculate a restaurant reduction such as “Reduce restaurants by 20%”. Live AI is not connected; I cannot answer unsupported questions or invent missing details.');
}
