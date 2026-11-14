export interface Month {
  month: string;
  transactionCount: number;
  incomeCents: number;
  consumptionCents: number;
  investmentDepositsCents: number;
  investmentWithdrawalsCents: number;
  salarySweepsCents: number;
  surplusBeforeTransfersCents: number;
  netCashFlowCents: number;
  closingBalanceCents: number;
  balanceObservedAt: string;
  categorySpendingCents: Record<string, number>;
  mccSpendingCents: Record<string, number>;
  categoryCounts: Record<string, number>;
}

export interface Mortgage {
  decision: string;
  rejectionReason: string | null;
  propertyPriceCents: number | null;
  requestedLoanCents: number | null;
  equityCents: number | null;
  events: { timestamp: string; type: string }[];
}

export interface Person {
  schemaVersion: 1;
  userId: string;
  synthetic: true;
  demoToday: string;
  profile: { name: string; initials: string; color: string; description: string; age: number };
  coverage: { from: string; through: string; transactionCount: number; observedAccountCount: number };
  monthly: Month[];
  mortgages: Mortgage[];
  limitations: string[];
  hasSkippedRows: boolean;
}

export const PEOPLE = [
  { id: 'CUST00115', name: 'Alex', initials: 'AL', color: 'sage', description: 'Home & longer-term plans' },
  { id: 'CUST00047', name: 'Robin', initials: 'RO', color: 'lavender', description: 'Spending & transfers' },
  { id: 'CUST00050', name: 'Noa', initials: 'NO', color: 'peach', description: 'Life & investments' },
] as const;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cents(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function numbers(value: unknown): value is Record<string, number> {
  return record(value) && Object.values(value).every(cents);
}

function isMonth(value: unknown): value is Month {
  if (!record(value)) return false;
  const fields = ['transactionCount', 'incomeCents', 'consumptionCents',
    'investmentDepositsCents', 'investmentWithdrawalsCents', 'salarySweepsCents',
    'surplusBeforeTransfersCents', 'netCashFlowCents', 'closingBalanceCents'];
  return typeof value.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value.month)
    && typeof value.balanceObservedAt === 'string'
    && fields.every(key => cents(value[key]))
    && numbers(value.categorySpendingCents) && numbers(value.mccSpendingCents)
    && numbers(value.categoryCounts);
}

function isMortgage(value: unknown): value is Mortgage {
  return record(value) && typeof value.decision === 'string'
    && (value.rejectionReason === null || typeof value.rejectionReason === 'string')
    && ['propertyPriceCents', 'requestedLoanCents', 'equityCents'].every(key =>
      value[key] === null || cents(value[key]))
    && Array.isArray(value.events) && value.events.every(event =>
      record(event) && typeof event.timestamp === 'string' && typeof event.type === 'string');
}

export function isPerson(value: unknown): value is Person {
  if (!record(value) || !record(value.profile) || !record(value.coverage)) return false;
  const profile = value.profile;
  return value.schemaVersion === 1 && value.synthetic === true && typeof value.userId === 'string'
    && typeof value.demoToday === 'string'
    && ['name', 'initials', 'color', 'description'].every(key => typeof profile[key] === 'string')
    && cents(profile.age)
    && typeof value.coverage.from === 'string' && typeof value.coverage.through === 'string'
    && cents(value.coverage.transactionCount) && cents(value.coverage.observedAccountCount)
    && Array.isArray(value.monthly) && value.monthly.length >= 4 && value.monthly.every(isMonth)
    && value.monthly.every((month, index, months) => index === 0 || months[index - 1].month < month.month)
    && Array.isArray(value.mortgages) && value.mortgages.every(isMortgage)
    && Array.isArray(value.limitations) && value.limitations.every(item => typeof item === 'string')
    && typeof value.hasSkippedRows === 'boolean';
}

const cache = new Map<string, Person>();

export interface Transaction {
  id: string;
  timestamp: string;
  category: string;
  type: string;
  amountCents: number;
  balanceAfterCents: number;
}

export interface TransactionPage {
  schemaVersion: 1;
  synthetic: true;
  userId: string;
  month: string;
  transactions: Transaction[];
}

export function isTransactionPage(value: unknown): value is TransactionPage {
  if (!record(value) || value.schemaVersion !== 1 || value.synthetic !== true
    || typeof value.userId !== 'string' || typeof value.month !== 'string'
    || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value.month) || !Array.isArray(value.transactions)) return false;
  const month = value.month;
  return value.transactions.every((row, index, rows) => record(row)
    && typeof row.id === 'string' && typeof row.timestamp === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(row.timestamp)
    && row.timestamp.slice(0, 7) === month
    && typeof row.category === 'string' && typeof row.type === 'string'
    && cents(row.amountCents) && cents(row.balanceAfterCents)
    && (index === 0 || rows[index - 1].timestamp > row.timestamp))
    && new Set(value.transactions.map(row => row.id)).size === value.transactions.length;
}

const transactionCache = new Map<string, TransactionPage>();

export async function loadTransactions(id: string, month: Month, signal: AbortSignal): Promise<TransactionPage> {
  if (!PEOPLE.some(person => person.id === id) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month.month)) {
    throw new Error('Unknown demo person or transaction month.');
  }
  const key = `${id}/${month.month}`;
  const cached = transactionCache.get(key);
  if (cached) return cached;
  const response = await fetch(`${import.meta.env.BASE_URL}demo/transactions/${key}.json`, { signal });
  if (!response.ok) throw new Error(`Could not load transactions (${response.status}). Please try again.`);
  const value: unknown = await response.json();
  if (!isTransactionPage(value) || value.userId !== id || value.month !== month.month
    || value.transactions.length !== month.transactionCount
    || value.transactions.reduce((sum, row) => sum + row.amountCents, 0) !== month.netCashFlowCents) {
    throw new Error('The transaction page does not match this snapshot. Regenerate it with npm run data.');
  }
  transactionCache.set(key, value);
  return value;
}

export async function loadPerson(id: string, signal: AbortSignal): Promise<Person> {
  if (!PEOPLE.some(person => person.id === id)) throw new Error('Unknown demo person.');
  const cached = cache.get(id);
  if (cached) return cached;
  const response = await fetch(`${import.meta.env.BASE_URL}demo/${id}.json`, { signal });
  if (!response.ok) throw new Error(`Could not load demo data (${response.status}). Please try again.`);
  const value: unknown = await response.json();
  if (!isPerson(value) || value.userId !== id) throw new Error('The demo summary is invalid. Regenerate it with npm run data.');
  cache.set(id, value);
  return value;
}
