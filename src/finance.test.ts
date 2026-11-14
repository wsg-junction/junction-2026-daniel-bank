import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPerson, isTransactionPage } from './data.ts';
import type { Month } from './data.ts';
import { answerQuestion, averageSpending, baskets, classify, euro, forecast, nextMonth, parseAmount, sandboxBalance, scenario, spendingScenario } from './finance.ts';

function person(id: string) {
  const value: unknown = JSON.parse(readFileSync(new URL(`../public/demo/${id}.json`, import.meta.url), 'utf8'));
  assert.ok(isPerson(value), 'Generated summary must satisfy the client contract');
  return value;
}

test('restaurant what-if rounds cents and treats savings as hypothetical', () => {
  const alex = person('CUST00115');
  const month = alex.monthly.at(-1)!;
  const result = scenario(month, 'Restaurants', 20);
  assert.equal(result.baseline, 21951);
  assert.equal(result.saving, 4390);
  assert.equal(result.remaining, 17561);
  assert.equal(result.annual, 52680);
  assert.equal(scenario(month, 'Restaurants', 0).saving, 0);
  assert.equal(scenario(month, 'Restaurants', 100).remaining, 0);
  assert.throws(() => scenario(month, 'Restaurants', -1));
  assert.throws(() => scenario(month, 'Restaurants', NaN));
  assert.match(answerQuestion(alex, month, 'Reduce restaurants by -20%').text, /between/);
});

test('forecast backtests without looking beyond the chosen cutoff', () => {
  const alex = person('CUST00115');
  const cutoff = '2026-03';
  const expected = forecast(alex.monthly, cutoff);
  const altered = alex.monthly.map(month => month.month > cutoff
    ? { ...month, netCashFlowCents: 999999999, closingBalanceCents: 888888888 } : month);
  assert.deepEqual(forecast(altered, cutoff), expected);
  const window = alex.monthly.filter(month => month.month <= cutoff).slice(-3);
  assert.equal(expected.net, Math.round(window.reduce((sum, month) => sum + month.netCashFlowCents, 0) / 3));
  assert.equal(expected.points[0].central, window.at(-1)!.closingBalanceCents + expected.net);
  assert.equal(expected.points[2].high - expected.points[2].central, expected.sensitivity * 3);
  assert.ok(expected.points.every(point => point.low <= point.central && point.central <= point.high));
  assert.equal(nextMonth('2026-12', 1), '2027-01');
  assert.throws(() => forecast(alex.monthly, '2024-11'), /at least/);
  assert.match(answerQuestion(alex, alex.monthly[0], 'What is my forecast?').text, /not enough/);
});

test('multiple category reductions add rounded savings without altering recorded amounts', () => {
  const alex = person('CUST00115');
  const original = alex.monthly.at(-1)!;
  const snapshot = structuredClone(original);
  const reductions = { Restaurants: 20, Groceries: 15 };
  const combined = spendingScenario(original, reductions);
  const restaurants = scenario(original, 'Restaurants', 20).saving;
  const groceries = scenario(original, 'Groceries', 15).saving;
  assert.equal(combined.saving, restaurants + groceries);
  assert.equal(combined.savings.Restaurants, 4390);
  assert.equal(combined.month.consumptionCents, original.consumptionCents - combined.saving);
  assert.equal(Object.values(combined.month.categorySpendingCents).reduce((sum, value) => sum + value, 0),
    combined.month.consumptionCents);
  assert.equal(forecast(alex.monthly, original.month, combined.saving).points[2].central,
    forecast(alex.monthly, original.month).points[2].central + combined.saving * 3);
  assert.equal(spendingScenario(original, { ...reductions, Restaurants: 0 }).saving, groceries);
  assert.equal(spendingScenario(original, {}).saving, 0);
  const allRemoved = spendingScenario(original, Object.fromEntries(Object.keys(original.categorySpendingCents).map(name => [name, 100])));
  assert.equal(allRemoved.month.consumptionCents, 0);
  assert.deepEqual(original, snapshot);
  assert.throws(() => spendingScenario(original, { Restaurants: 101 }), /between/);
});

test('range spending averages include missing categories and reconcile rounded cents', () => {
  const original = person('CUST00115').monthly.at(-1)!;
  assert.deepEqual(averageSpending([original]), {
    categorySpendingCents: original.categorySpendingCents, consumptionCents: original.consumptionCents,
  });
  const months: Month[] = [
    { ...original, categorySpendingCents: { Restaurants: 1, Groceries: 2 } },
    { ...original, categorySpendingCents: { Restaurants: 2, Entertainment: 5 } },
  ];
  const baseline = averageSpending(months);
  assert.deepEqual(baseline.categorySpendingCents, { Restaurants: 2, Groceries: 1, Entertainment: 3 });
  assert.equal(baseline.consumptionCents, 6);
  const changed = spendingScenario({ ...original, ...baseline }, { Restaurants: 50, Entertainment: 100 });
  assert.equal(changed.saving, 4);
  assert.equal(changed.month.consumptionCents, 2);
  assert.throws(() => averageSpending([]), /at least one/);
});

test('forecast preserves a negative projected balance rather than clamping it', () => {
  const months = person('CUST00047').monthly.slice(0, 4).map(month =>
    ({ ...month, closingBalanceCents: 100, netCashFlowCents: -10000 }));
  const model = forecast(months, months.at(-1)!.month);
  assert.equal(model.points[0].central, -9900);
  assert.equal(model.mae, 0);
});

test('baskets reconcile consumption while ambiguity and person overrides are retained', () => {
  const alex = person('CUST00115');
  const month = alex.monthly.at(-1)!;
  const baseline = baskets(month, {});
  assert.equal(Object.values(baseline).reduce((sum, value) => sum + value), month.consumptionCents);
  assert.equal(baseline.irregular, 0);
  assert.equal(classify('Home & Tech', {}), 'unclassified');
  const revised = baskets(month, { 'Home & Tech': 'irregular' });
  assert.equal(revised.irregular, month.categorySpendingCents['Home & Tech'] ?? 0);
  assert.equal(baskets(person('CUST00047').monthly.at(-1)!, {}).regular, 0);
});

test('coach grounds answers in the selected person and keeps transfers distinct', () => {
  const robin = person('CUST00047');
  const month = robin.monthly.at(-1)!;
  assert.equal(month.surplusBeforeTransfersCents, 416933);
  assert.equal(month.netCashFlowCents, -42883);
  const answer = answerQuestion(robin, month, 'Explain my transfers');
  assert.ok(answer.text.includes(euro(459816)));
  assert.ok(answer.evidence.includes('CUST00047'));
  assert.match(answer.text, /destination is unknown/);
  const noa = person('CUST00050');
  assert.match(answerQuestion(noa, noa.monthly.at(-1)!, 'Explain my mortgage').text, /no mortgage decision/);
  assert.match(answerQuestion(robin, month, 'What is safe to spend?').text, /cannot responsibly/);
  assert.match(answerQuestion(robin, month, 'How much did I spend on taxis last month?').text, /month selected/);
  assert.match(answerQuestion(robin, month, 'Tell me about my dog').text, /Live AI is not connected/);
  assert.match(answerQuestion(robin, month, 'Where does my money go?').text, /consumption/);
  assert.match(answerQuestion(robin, robin.monthly[0], 'Explain my mortgage').text, /no mortgage decision/);
});

test('summary guard rejects malformed amounts and unordered history', () => {
  const alex = person('CUST00115');
  assert.equal(isPerson({ ...alex, monthly: [{ ...alex.monthly[0], incomeCents: 1.25 }, ...alex.monthly.slice(1)] }), false);
  assert.equal(isPerson({ ...alex, monthly: [...alex.monthly].reverse() }), false);
});

test('sandbox parses exact cents and shares one-time outflows with the adjusted forecast', () => {
  assert.equal(parseAmount('12.34'), 1234);
  assert.equal(parseAmount('0.01'), 1);
  assert.equal(parseAmount('10.1'), 1010);
  for (const invalid of ['0', '-1', '1.234', '', '1e3', 'Infinity']) assert.equal(parseAmount(invalid), null);
  const alex = person('CUST00115');
  const month = alex.monthly.at(-1)!;
  const saved = scenario(month, 'Restaurants', 20).saving;
  assert.equal(sandboxBalance(month.closingBalanceCents, 1234, 10000), 2918366);
  const base = forecast(alex.monthly, month.month);
  const changed = forecast(alex.monthly, month.month, saved, 11234);
  changed.points.forEach((point, index) => {
    const adjustment = saved * (index + 1) - 11234;
    assert.equal(point.central, base.points[index].central + adjustment);
    assert.equal(point.low, base.points[index].low + adjustment);
    assert.equal(point.high, base.points[index].high + adjustment);
  });
  assert.equal(changed.mae, base.mae, 'Sandbox edits must not modify historical backtest error');
  assert.throws(() => forecast(alex.monthly, month.month, -1));
  assert.throws(() => sandboxBalance(100, -1, 0));
});

test('monthly transaction guard rejects wrong-month, duplicate and fractional records', () => {
  const value: unknown = JSON.parse(readFileSync(new URL('../public/demo/transactions/CUST00115/2026-09.json', import.meta.url), 'utf8'));
  assert.ok(isTransactionPage(value));
  assert.equal(value.transactions.length, person('CUST00115').monthly.at(-1)!.transactionCount);
  const first = value.transactions[0];
  assert.equal(isTransactionPage({ ...value, month: '2026-08' }), false);
  assert.equal(isTransactionPage({ ...value, transactions: [first, first] }), false);
  assert.equal(isTransactionPage({ ...value, transactions: [{ ...first, amountCents: 1.5 }] }), false);
});
