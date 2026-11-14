import type { Person, Month, Benchmarks } from './data';

/**
 * AI Agent Service
 * 
 * Handles communication with AI proxy endpoints with fallback logic.
 * Supports financial analysis and personalized advice based on user's transaction data.
 */

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AgentResponse {
  text: string;
  evidence: string;
  caveat: string;
}

export interface ChatCompletion {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface StockSearchResult {
  symbol: string;
  headline: string;
  url: string;
}

const CONTEXT_DEV_API = 'https://api.context.dev/v1/web/search';

const TAB_SEARCH_CONTEXT: Record<string, string> = {
  accounts:    'Finland personal banking savings account',
  spending:    'Finland budgeting personal finance tips 2024',
  payments:    'Finland payment methods cash flow planning',
  investments: 'Finland personal investing ETF funds stocks 2024',
};

const STOCK_SYMBOLS: Record<string, string> = {
  Nokia:   'NOKIA.HE',
  Nordea:  'NDA-FI.HE',
  Neste:   'NESTE.HE',
  Sampo:   'SAMPO.HE',
  Fortum:  'FORTUM.HE',
};

/**
 * Search for recent news headlines for Nordic stocks shown in the ticker.
 * Returns best-match headline per company, gracefully returns [] on any error.
 */
export async function searchStockPrices(): Promise<StockSearchResult[]> {
  const apiKey = (import.meta as { env?: Record<string, string> }).env?.VITE_CONTEXT_DEV_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch(CONTEXT_DEV_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'Nokia Nordea Neste Sampo Fortum Helsinki stock news today',
        numResults: 10,
        freshness: 'last_week',
        highlightsOptions: { enabled: true, maxCharacters: 400 },
      }),
    });
    if (!res.ok) return [];
    const data: { results?: Array<{ title: string; url: string; description: string }> } = await res.json();
    const results: StockSearchResult[] = [];
    for (const [name, symbol] of Object.entries(STOCK_SYMBOLS)) {
      const match = data.results?.find(r =>
        r.title.toLowerCase().includes(name.toLowerCase()) ||
        r.description.toLowerCase().includes(name.toLowerCase())
      );
      if (match) {
        results.push({ symbol, headline: match.title, url: match.url });
      }
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * Search for real-world financial context relevant to the user's question and current tab.
 * Returns a compact string for injection into the LLM system prompt.
 * Gracefully returns "" on any error or missing API key.
 */
export async function searchWebContext(question: string, tab: string): Promise<string> {
  const apiKey = (import.meta as { env?: Record<string, string> }).env?.VITE_CONTEXT_DEV_API_KEY;
  if (!apiKey) return '';

  try {
    const tabSuffix = TAB_SEARCH_CONTEXT[tab] ?? 'Finland personal finance';
    const query = `${question} ${tabSuffix}`;
    const res = await fetch(CONTEXT_DEV_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        numResults: 5,
        highlightsOptions: { enabled: true, maxCharacters: 800 },
      }),
    });
    if (!res.ok) return '';
    const data: {
      results?: Array<{ title: string; highlights?: { highlights?: string[] } }>
    } = await res.json();

    const chunks: string[] = [];
    for (const result of (data.results ?? []).slice(0, 3)) {
      const highlights = result.highlights?.highlights ?? [];
      if (highlights.length > 0) {
        chunks.push(`[${result.title}]\n${highlights[0]}`);
      }
    }
    const combined = chunks.join('\n\n');
    return combined.length > 1500 ? combined.slice(0, 1500) + '…' : combined;
  } catch {
    return '';
  }
}

// Proxy configuration
const PROXY_BASE = 'https://api.danielkalisch.de';

const ENDPOINTS = [
  {
    path: '/nemotron/v1/chat/completions',
    model: 'nemotron-3.5-super-vl',
    name: 'Nemotron (primary)',
  },
  {
    path: '/v1/chat/completions',
    model: 'google/gemma-4-31B-it',
    name: 'Gemma (fallback)',
  },
] as const;

/**
 * Build system context based on the current tab and user's financial data
 */
export function buildAgentContext(person: Person, month: Month, tab: string, webContext?: string, benchmarks?: Benchmarks): AgentMessage {
  const summaryText = buildContextSummary(person, month, tab);

  const webSection = webContext
    ? `\n\n## Live web context\nCurrent financial information from web search to help ground your answer:\n<webcontext>\n${webContext}\n</webcontext>\nCite relevant facts. Prioritize the user's own transaction data for personal questions; use web context for general financial knowledge, rates, and market conditions.`
    : '';

  const peerSection = benchmarks ? buildPeerSection(person, benchmarks) : '';

  return {
    role: 'system',
    content: `You are a friendly financial advisor for S-Bank's personal finance app. You help customers understand their money through their transaction data.

SYNTHETIC DATA NOTICE: This is synthetic, fictional data created for the S-Bank hackathon. Do not treat it as real customer information.

USER PROFILE:
- Age: ${person.profile.age}
- Demo name: ${person.profile.name}
- Observed period: ${person.coverage.from} to ${person.coverage.through}
- ${person.coverage.transactionCount} recorded transactions across ${person.coverage.observedAccountCount} observed account(s)

CURRENT TAB & CONTEXT:
The user is viewing the "${tab}" tab on ${new Date(month.balanceObservedAt).toLocaleDateString()}.
${summaryText}${peerSection}${webSection}

IMPORTANT GUIDELINES:
1. Ground all answers in the user's actual transaction data shown above
2. Be honest about data limitations: you only see this one account, synthetic data, and recorded history
3. Avoid guarantees or promises about investment returns, bill payments, or future income
4. Explain what you're calculating: show your reasoning with specific numbers
5. Use EUR for all currency; convert cents to euros (divide by 100)
6. For estimates, state your assumptions clearly
7. Keep answers concise and conversational
8. When uncertain, say so and explain why the data doesn't provide a clear answer
9. Suggest checking with a financial advisor for major decisions
10. Never present this as guaranteed financial advice
11. When comparing to peers, always mention the group size (n=X) and that this is synthetic data

SPENDING BASKETS (help users categorize):
- Essential & regular: Housing, Utilities, Insurance
- Essential & irregular: Car repairs, Medical, Appliances
- Everyday & flexible: Restaurants, Entertainment, Lifestyle, Travel
- Needs context: Other categories without clear pattern

When discussing spending, help categorize it into these baskets and highlight where the user might find flexibility.`,
  };
}

function buildPeerSection(person: Person, benchmarks: Benchmarks): string {
  const group = benchmarks.ageGroups.find(g => person.profile.age >= g.min && person.profile.age <= g.max);
  if (!group) return '';
  const { euro } = getFormatters();
  return `

PEER BENCHMARKS — age group ${group.label} (n=${group.n} customers in this synthetic dataset):
- Avg monthly income: ${euro(group.avgIncomeCents)}
- Avg monthly spending: ${euro(group.avgSpendingCents)}
- Avg savings rate: ${group.savingsRate}%
- Top spending categories for this age group: ${group.topCats.join(', ')}
- Population-wide discretionary spending (Restaurants + Entertainment + Lifestyle): ${benchmarks.population.avgDiscretionaryPercentage}% of total spending on average

Use these benchmarks to give the user context on whether their patterns are typical or unusual for their age group. Always note that these are from a synthetic dataset of ${benchmarks.population.n} customers. Don't over-index on small differences; flag meaningful gaps (e.g. >5pp difference in savings rate).`;
}

/**
 * Build a detailed context summary based on the current tab
 */
function buildContextSummary(person: Person, month: Month, tab: string): string {
  const { euro, monthLabel } = getFormatters();
  
  switch (tab) {
    case 'accounts':
      return buildAccountsContext(person, month, euro, monthLabel);
    case 'spending':
      return buildSpendingContext(person, month, euro, monthLabel);
    case 'payments':
      return buildPaymentsContext(person, month, euro);
    case 'investments':
      return buildInvestmentsContext(person, month, euro, monthLabel);
    default:
      return buildDefaultContext(person, month, euro, monthLabel);
  }
}

function buildAccountsContext(person: Person, month: Month, euro: (cents: number) => string, monthLabel: (month: string) => string): string {
  const recentMonths = person.monthly.slice(-3);
  const avgIncome = Math.round(recentMonths.reduce((sum, m) => sum + m.incomeCents, 0) / recentMonths.length);
  const avgConsumption = Math.round(recentMonths.reduce((sum, m) => sum + m.consumptionCents, 0) / recentMonths.length);

  let context = `TAB: Accounts & Balance

Account Balance: ${euro(month.closingBalanceCents)} (observed ${month.balanceObservedAt.slice(0, 10)})

Recent 3 months activity (${monthLabel(recentMonths[0].month)} to ${monthLabel(month.month)}):
- Average monthly income: ${euro(avgIncome)}
- Average monthly consumption: ${euro(avgConsumption)}
- Average net cash flow: ${euro(Math.round(recentMonths.reduce((sum, m) => sum + m.netCashFlowCents, 0) / recentMonths.length))}
- Total transactions: ${recentMonths.reduce((sum, m) => sum + m.transactionCount, 0)}`;

  if (person.mortgages.length > 0) {
    const mortgage = person.mortgages[0];
    context += `

Mortgage Application Status: ${mortgage.decision}`;
    if (mortgage.decision === 'approved' && mortgage.requestedLoanCents) {
      context += `
- Property: ${euro(mortgage.propertyPriceCents ?? 0)}
- Loan requested: ${euro(mortgage.requestedLoanCents)}
- Equity: ${euro(mortgage.equityCents ?? 0)}`;
    }
  }

  return context;
}

function buildSpendingContext(person: Person, month: Month, euro: (cents: number) => string, monthLabel: (month: string) => string): string {
  const lastThree = person.monthly.slice(-3);
  const avgSpending = Math.round(lastThree.reduce((sum, m) => sum + m.consumptionCents, 0) / lastThree.length);
  
  const categories = Object.entries(month.categorySpendingCents)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  let context = `TAB: Spending & Analysis

Current month: ${monthLabel(month.month)}
- Total consumption: ${euro(month.consumptionCents)}
- Average over last 3 months: ${euro(avgSpending)}
- Transaction count this month: ${month.transactionCount}

Top 5 spending categories this month:`;
  
  categories.forEach(([category, amount]) => {
    const count = month.categoryCounts[category] || 0;
    context += `\n- ${category}: ${euro(amount)} (${count} transactions)`;
  });

  const surplus = month.surplusBeforeTransfersCents;
  context += `\n\nFinancial snapshot for ${monthLabel(month.month)}:
- Income: ${euro(month.incomeCents)}
- Consumption: ${euro(month.consumptionCents)}
- Surplus before transfers: ${euro(surplus)}
- Net cash flow (after transfers): ${euro(month.netCashFlowCents)}`;

  return context;
}

function buildPaymentsContext(person: Person, month: Month, euro: (cents: number) => string): string {
  const recentPayments = person.monthly.slice(-6);
  const avgPaymentMonth = recentPayments.filter(m => m.consumptionCents > 0);
  const avgPayment = avgPaymentMonth.length > 0
    ? Math.round(avgPaymentMonth.reduce((sum, m) => sum + m.consumptionCents, 0) / avgPaymentMonth.length)
    : 0;

  return `TAB: Payments & Transfers

Current balance: ${euro(month.closingBalanceCents)}
Average monthly payments: ${euro(avgPayment)}

Last 6 months payment activity:
- Total payments: ${euro(recentPayments.reduce((sum, m) => sum + m.consumptionCents, 0))}
- Salary sweeps detected: ${euro(recentPayments.reduce((sum, m) => sum + m.salarySweepsCents, 0))}

Context: User is exploring payment simulations to test financial scenarios.`;
}

function buildInvestmentsContext(person: Person, month: Month, euro: (cents: number) => string, monthLabel: (month: string) => string): string {
  const recentInvestments = person.monthly.slice(-6);
  const totalDeposits = recentInvestments.reduce((sum, m) => sum + m.investmentDepositsCents, 0);
  const totalWithdrawals = recentInvestments.reduce((sum, m) => sum + m.investmentWithdrawalsCents, 0);
  const netInvestment = totalDeposits - totalWithdrawals;

  return `TAB: Investments & Long-term Savings

Last 6 months investment activity:
- Total deposits: ${euro(totalDeposits)}
- Total withdrawals: ${euro(totalWithdrawals)}
- Net contributions: ${euro(netInvestment)}

Current month (${monthLabel(month.month)}):
- Investment deposits: ${euro(month.investmentDepositsCents)}
- Investment withdrawals: ${euro(month.investmentWithdrawalsCents)}

Note: This shows transfers only, not investment performance or holdings value.`;
}

function buildDefaultContext(person: Person, month: Month, euro: (cents: number) => string, monthLabel: (month: string) => string): string {
  return `TAB: General Information

User: ${person.profile.name} (age ${person.profile.age})
Current month: ${monthLabel(month.month)}
Account balance: ${euro(month.closingBalanceCents)}
Monthly income: ${euro(month.incomeCents)}
Monthly consumption: ${euro(month.consumptionCents)}`;
}

/**
 * Helper to get formatting functions (avoiding import cycle)
 */
function getFormatters() {
  const euro = (cents: number) =>
    new Intl.NumberFormat('en-FI', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(cents / 100);

  return { euro, monthLabel: (month: string) =>
    new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${month}-01T12:00:00Z`))
  };
}

/**
 * Call the AI proxy with fallback logic
 * Tries Nemotron first, falls back to Gemma on any error
 */
export async function callAgent(
  messages: AgentMessage[],
  onEndpointFail?: (endpoint: string, error: string) => void
): Promise<AgentResponse> {
  let lastError: Error | null = null;

  for (const endpoint of ENDPOINTS) {
    try {
      const response = await fetch(`${PROXY_BASE}${endpoint.path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: endpoint.model,
          messages,
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const error = new Error(`${endpoint.name} returned ${response.status}`);
        lastError = error;
        onEndpointFail?.(endpoint.name, error.message);
        continue;
      }

      const data: ChatCompletion = await response.json();
      const text = data.choices?.[0]?.message?.content || '';

      if (!text) {
        const error = new Error(`${endpoint.name} returned empty content`);
        lastError = error;
        onEndpointFail?.(endpoint.name, error.message);
        continue;
      }

      // Success - parse response
      return parseAgentResponse(text);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      onEndpointFail?.(endpoint.name, lastError.message);
      // Continue to next endpoint
    }
  }

  // All endpoints failed
  throw new Error(`All AI endpoints failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Parse AI response into structured format with evidence and caveats
 */
function parseAgentResponse(text: string): AgentResponse {
  // Look for structured response markers
  const evidenceMatch = text.match(/\[SOURCE\](.*?)\[\/SOURCE\]/s);
  const caveatMatch = text.match(/\[CAVEAT\](.*?)\[\/CAVEAT\]/s);

  let mainText = text;
  let evidence = '';
  let caveat = '';

  if (evidenceMatch) {
    evidence = evidenceMatch[1].trim();
    mainText = mainText.replace(/\[SOURCE\](.*?)\[\/SOURCE\]/s, '').trim();
  }

  if (caveatMatch) {
    caveat = caveatMatch[1].trim();
    mainText = mainText.replace(/\[CAVEAT\](.*?)\[\/CAVEAT\]/s, '').trim();
  }

  // If no structured markers, use defaults
  if (!evidence) {
    evidence = 'Based on your recorded transaction data from this month and recent months.';
  }

  if (!caveat) {
    caveat = 'This is based on synthetic demo data. Not real financial advice. Consult a professional for major decisions.';
  }

  return {
    text: mainText || 'I could not generate a response. Please try again.',
    evidence,
    caveat,
  };
}

/**
 * Format a message for display with agent metadata
 */
export function formatAgentMessage(response: AgentResponse): string {
  return response.text;
}
