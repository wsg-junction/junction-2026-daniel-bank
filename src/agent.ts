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
export async function searchWebContext(question: string, _tab: string): Promise<string> {
  try {
    const q = encodeURIComponent(question);
    const res = await fetch(`${PROXY_BASE}/search?q=${q}`);
    if (!res.ok) return '';
    const data: {
      json_content?: {
        suggestions?: Array<{ name?: string; description?: string }>;
        sources?: Array<{ url?: string; title?: string }>;
      };
    } = await res.json();

    const suggestions = data.json_content?.suggestions ?? [];
    const sources = data.json_content?.sources ?? [];
    const chunks: string[] = [];
    for (const s of suggestions.slice(0, 5)) {
      if (s.description) chunks.push(s.name ? `${s.name}: ${s.description}` : s.description);
    }
    if (sources.length) chunks.push(`Source: ${sources[0].title ?? sources[0].url}`);
    const combined = chunks.join('\n');
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
export function buildAgentContext(person: Person, month: Month, tab: string, benchmarks?: Benchmarks): AgentMessage {
  const { euro } = getFormatters();
  const recent3 = person.monthly.slice(-3);
  const avgIncome = Math.round(recent3.reduce((s, m) => s + m.incomeCents, 0) / recent3.length);
  const avgSpending = Math.round(recent3.reduce((s, m) => s + m.consumptionCents, 0) / recent3.length);
  const allCats = Object.entries(month.categorySpendingCents).sort(([, a], [, b]) => b - a).map(([c, v]) => `${c} ${euro(v)}`).join(', ');
  const peer = benchmarks ? buildPeerSection(person, benchmarks) : '';
  const mortgage = person.mortgages[0];
  const mtg = mortgage?.requestedLoanCents ? ` Mortgage: ${mortgage.decision}, ${euro(mortgage.requestedLoanCents)}.` : '';

  let tabDetail = '';
  if (tab === 'spending') {
    const surplus = month.surplusBeforeTransfersCents;
    tabDetail = ` Surplus: ${euro(surplus)}.`;
  } else if (tab === 'payments') {
    const recent6 = person.monthly.slice(-6);
    const avgPay = Math.round(recent6.reduce((s, m) => s + m.consumptionCents, 0) / recent6.length);
    tabDetail = ` 6mo avg payments: ${euro(avgPay)}/mo.`;
  } else if (tab === 'investments') {
    const recent6 = person.monthly.slice(-6);
    const dep = recent6.reduce((s, m) => s + m.investmentDepositsCents, 0);
    const wdw = recent6.reduce((s, m) => s + m.investmentWithdrawalsCents, 0);
    tabDetail = ` 6mo investments: deposits ${euro(dep)}, withdrawals ${euro(wdw)}, net ${euro(dep - wdw)}.`;
  }

  const today = new Date().toISOString().slice(0, 10);
  return {
    role: 'system',
    content: `Financial coach, S-Bank demo (synthetic data, not real advice). Be concise, cite numbers, use EUR. Today: ${today}.
${person.profile.name}, ${person.profile.age}y, ${tab}, ${month.balanceObservedAt.slice(0, 7)}.
Balance ${euro(month.closingBalanceCents)}. Avg income ${euro(avgIncome)}/mo, spending ${euro(avgSpending)}/mo.${mtg}${tabDetail}
Categories: ${allCats}.${peer}`,
  };
}

function buildPeerSection(person: Person, benchmarks: Benchmarks): string {
  const group = benchmarks.ageGroups.find(g => person.profile.age >= g.min && person.profile.age <= g.max);
  if (!group) return '';
  const { euro } = getFormatters();
  return `\nPeers (age ${group.label}, n=${group.n}): avg income ${euro(group.avgIncomeCents)}, spending ${euro(group.avgSpendingCents)}, savings rate ${group.savingsRate}%.`;
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

export async function callAgent(
  messages: AgentMessage[],
  onEndpointFail?: (endpoint: string, error: string) => void,
  liveOnly = false,
): Promise<AgentResponse> {
  let lastError: Error | null = null;

  const endpoints = liveOnly ? ENDPOINTS.slice(0, 1) : ENDPOINTS;
  for (const endpoint of endpoints) {
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
          max_tokens: 3000,
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
