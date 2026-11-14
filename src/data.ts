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
