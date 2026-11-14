# AI Agent Implementation Setup Guide

## Quick Start

The AI agent system is **ready to use** but currently runs in **rule-based mode** (local, no API calls). To enable **live AI responses**, follow the integration steps below.

## File Structure

### Core Agent Files

- **[src/agent.ts](../src/agent.ts)** – Main agent service
  - Proxy endpoint configuration
  - Context builders for each tab
  - Message formatting and response parsing
  - Error handling and fallback logic

- **[src/finance.ts](../src/finance.ts)** – Extended with live AI support
  - `answerQuestion()` – Rule-based fallback (existing)
  - `answerQuestionExtended()` – Supports live AI (new, async)

- **[src/App.tsx](../src/App.tsx)** – Integration point
  - `sendQuestion()` function extracts tab from chat context
  - Ready to call `answerQuestionExtended()` when enabling live AI

- **[AGENTS.md](../AGENTS.md)** – Complete documentation
  - Architecture overview
  - Tab-specific context details
  - Message flow diagrams
  - Integration checklist
  - Testing guide

## Current Mode: Rule-Based (Local)

Today, the app uses local rule-based answers (no API calls):

```
User Question → finance.answerQuestion() → Pattern Matching & Logic → Answer
```

**Pros:**
- Fast, no network latency
- Works offline
- No API dependencies

**Cons:**
- Limited to predefined question patterns
- Cannot handle novel questions
- No learning across users

## Enable Live AI: Integration Steps

To switch from rule-based to live AI responses, follow these 4 steps:

### Step 1: Install Required Type (Already Done)

The agent types are already defined in [src/agent.ts](../src/agent.ts):

```typescript
export interface AgentMessage { role: 'user' | 'assistant' | 'system'; content: string; }
export interface AgentResponse { text: string; evidence: string; caveat: string; }
```

### Step 2: Update sendQuestion to Use Live AI

Modify [src/App.tsx](../src/App.tsx) `sendQuestion` function:

**Current (Rule-Based):**
```typescript
const sendQuestion = (question: string, id: string, context?: ChatThread) => {
  // ...
  const message = { question, answer: answerQuestion(person, month, question) };
  setChats(items => ({ ...items, [id]: { ...thread, messages: [...] } }));
};
```

**Desired (Live AI with Fallback):**
```typescript
const sendQuestion = async (question: string, id: string, context?: ChatThread) => {
  if (!person || person.userId !== userId) throw new Error('No selected person for this conversation.');
  const thread = chats[id] ?? context;
  if (!thread || thread.userId !== userId) throw new Error('Conversation does not belong to this person.');
  const month = person.monthly.find(item => item.month === thread.endingMonth);
  if (!month) throw new Error('Conversation period is unavailable.');
  
  const threadTab = id.split(':')[3] || 'accounts';
  
  // Use extended answer with live AI support
  const answer = await answerQuestionExtended(person, month, question, {
    enableLiveAI: true,  // Enable live AI calls
    currentTab: threadTab,  // Pass current tab for context
    onAgentError: (error) => {
      console.warn('[App] Agent error, using fallback:', error.message);
    },
  });
  
  const message = { question, answer };
  setChats(items => ({ ...items, [id]: { ...thread, messages: [...(items[id]?.messages ?? thread.messages), message] } }));
};
```

**Important:** You'll also need to:

1. Import `answerQuestionExtended`:
   ```typescript
   import { answerQuestion, answerQuestionExtended, ... } from './finance';
   ```

2. Add loading state to coach card while awaiting response (modify `CoachCard` component to show "Connecting..." during async call)

3. Update type of `sendQuestion` callback if needed (it becomes async)

### Step 3: Add Loading UI

The coach card should show loading state while awaiting the AI response:

```typescript
// In CoachCard component
const [isLoading, setIsLoading] = useState(false);

const submit = async (event: FormEvent) => {
  event.preventDefault();
  if (!input.trim()) return;
  setIsLoading(true);
  try {
    await onSend(input.trim());
    setInput('');
  } finally {
    setIsLoading(false);
  }
};

// Add loading indicator to button or input
<Button 
  type="submit" 
  isDisabled={!input.trim() || isLoading}
  aria-label={isLoading ? "Sending..." : "Send question"}
>
  {isLoading ? <Icon name="loading" /> : <Icon name="arrow" />}
</Button>
```

### Step 4: Test All Tabs

Once live AI is enabled, test each tab:

#### Test: Accounts Tab
- **Q:** "What's my average monthly income?"
- **Expected:** AI cites income figures and recent trends, grounds in agent context

#### Test: Spending Tab
- **Q:** "Where can I save money?"
- **Expected:** AI identifies spending categories and suggests flexibility

#### Test: Payments Tab
- **Q:** "Can I afford a €200 payment?"
- **Expected:** AI compares to available balance and average spending

#### Test: Investments Tab
- **Q:** "Am I investing enough?"
- **Expected:** AI discusses contribution amounts, clarifies transfers vs. performance

#### Test: Fallback
- **Disable Nemotron** in code (comment out or mock as failing)
- **Send a question** → Should fall back to Gemma seamlessly
- **Check console logs** → Should show endpoint switch

## Architecture Deep Dive

### Data Flow with Live AI

```
┌─────────────────────────────────────────────────────────┐
│ User Question                                           │
│ (e.g., "What am I spending on restaurants?")           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ answerQuestionExtended(person, month, question, options)│
│ • enableLiveAI: true                                    │
│ • currentTab: "spending"                                │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴──────────────┐
         │                          │
         ▼                          ▼
   ┌─────────────┐           ┌──────────────┐
   │ Live AI     │           │ Rule-Based   │
   │ Enabled?    │           │ Fallback     │
   │ Yes!        │           │ (always ok)  │
   └─────┬───────┘           └──────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ buildAgentContext(person, month, "spending")            │
│ • User profile (age, name, observation period)          │
│ • Spending breakdown (top 5 categories)                 │
│ • Income, consumption, surplus                          │
│ • System prompt with guidelines                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ callAgent([systemContext, userMessage])                 │
│ • Try POST /nemotron/v1/chat/completions               │
│ • Model: nemotron-3.5-super-vl                         │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴──────────────┐
         │                          │
         ▼                          ▼
   ┌──────────┐             ┌───────────────┐
   │ 200 OK   │             │ Error (any)   │
   │ Response │             │ Fall through  │
   └────┬─────┘             └───────┬───────┘
        │                           │
        ▼                           ▼
┌──────────────────┐        ┌────────────────────┐
│ Parse response   │        │ Try Gemma endpoint │
│ Extract text     │        │ (same flow)        │
│ Extract evidence │        └────────┬───────────┘
│ Extract caveat   │                 │
└────────┬─────────┘         ┌───────┴──────────┐
         │                   │                  │
         │             ┌─────▼──┐        ┌──────▼────┐
         │             │ Success│        │ Fail too  │
         │             └─────┬──┘        └──────┬────┘
         │                   │                  │
         └───────────┬───────┘          ┌──────▼────┐
                     │                  │ Throw err │
                     │                  │ Use rules │
                     ▼                  └───────────┘
            ┌─────────────────────┐
            │ AgentResponse       │
            │ {                   │
            │   text: "...",      │
            │   evidence: "...",  │
            │   caveat: "..."     │
            │ }                   │
            └────────────┬────────┘
                         │
                         ▼
            ┌─────────────────────────┐
            │ Display in Coach Card    │
            │ • Main answer           │
            │ • Evidence (collapsed)   │
            │ • Caveat (collapsed)     │
            └─────────────────────────┘
```

### Context by Tab

The agent receives **different context** based on which tab the user is viewing:

| Tab | Primary Context | Example Questions |
|-----|-----------------|-------------------|
| **Accounts** | Balance, income, history, mortgages | "What's my average income?", "Explain my mortgage" |
| **Spending** | Category breakdown, trends, surplus | "Where can I save?", "What did I spend on restaurants?" |
| **Payments** | Available balance, payment patterns | "Can I afford a €200 payment?", "What's my typical monthly outflow?" |
| **Investments** | Deposits, withdrawals, transfers | "Am I investing enough?", "What are my investment transfers?" |

## Proxy Endpoints Reference

### Primary Endpoint

```
POST https://api.danielkalisch.de/nemotron/v1/chat/completions
Content-Type: application/json

{
  "model": "nemotron-3.5-super-vl",
  "messages": [
    {
      "role": "system",
      "content": "You are a financial advisor..."
    },
    {
      "role": "user",
      "content": "What's my average monthly income?"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 500
}

Response: 200 OK
{
  "choices": [
    {
      "message": {
        "content": "Based on your data, your average monthly income is..."
      }
    }
  ]
}
```

### Fallback Endpoint

```
POST https://api.danielkalisch.de/v1/chat/completions
Content-Type: application/json

{
  "model": "google/gemma-4-31B-it",
  "messages": [...],  // Same format
  "temperature": 0.7,
  "max_tokens": 500
}
```

## Monitoring & Debugging

### Enable Endpoint Logging

Add this to `callAgent`:

```typescript
const response = await callAgent(messages, (endpoint, error) => {
  console.log(`[Agent] ${endpoint} failed: ${error}`);
  // Could also send to analytics
});
```

### Check Console for Errors

- **Network errors:** Browser DevTools → Network tab
- **API errors:** Browser DevTools → Console tab, search "Agent"
- **Response parsing:** Check if response has `choices[0].message.content`

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "All AI endpoints failed" | Network error or proxy down | Check proxy URL, firewall rules |
| Empty content error | Endpoint returned invalid JSON | Verify endpoint URL and headers |
| Fallback activates too often | Nemotron endpoint is slow/unreliable | Consider reversing fallback order |
| Context missing data | Tab not recognized | Check tab name in `buildAgentContext` |

## Performance Considerations

### Latency

- **Nemotron:** ~1-3 seconds (more capable)
- **Gemma:** ~500ms-2s (lighter)
- **Fallback retry:** Adds time if first endpoint fails

**Optimization:** Consider showing "Thinking..." animation during the wait.

### Token Limits

- Both endpoints limited to `max_tokens: 500` (configurable)
- Estimated ~350-400 tokens per response
- System context is ~300-400 tokens

**If responses are cut off:** Increase `max_tokens` in `callAgent()` function.

### Caching

Currently **no caching** of agent responses. To optimize:

```typescript
const responseCache = new Map<string, AgentResponse>();
const cacheKey = `${person.userId}:${month.month}:${question}`;

if (responseCache.has(cacheKey)) {
  return responseCache.get(cacheKey)!;
}

const response = await callAgent(messages);
responseCache.set(cacheKey, response);
return response;
```

## Security Notes

### Data Sent to Proxy

✅ **Sent to API:**
- Synthetic demo user profile
- Transaction categories and amounts
- Dates and balances
- Spending patterns
- User question

❌ **NOT sent:**
- Real customer names or IDs (replaced with demo names like "Alex")
- Bank credentials or account numbers
- Merchant names (only categories)
- Other users' data

### HTTPS Only

All proxy calls use HTTPS. If deployed to production, verify:
- SSL certificate is valid
- No man-in-the-middle proxy
- Request/response are encrypted in transit

### Synthetic Data Disclaimer

Every system context includes:

> SYNTHETIC DATA NOTICE: This is synthetic, fictional data created for the S-Bank hackathon. Do not treat it as real customer information.

Ensure this disclaimer appears in every agent response.

## Future Enhancements

### 1. Multi-Turn Conversations

Currently stateless. To enable context carry-over:

```typescript
// Store message history in chat thread
const messages = [
  context,
  ...thread.messages.flatMap(msg => [
    { role: 'user', content: msg.question },
    { role: 'assistant', content: msg.answer.text }
  ]),
  { role: 'user', content: newQuestion }
];
```

### 2. Function Calling

Extend agent to call tool functions:

```typescript
// Agent response: "Let me check your spending breakdown..."
// Triggers: calculateSpendingByCategory(person, month)
// Response: Structured data → Agent formats into natural language
```

### 3. Vision Capability

Nemotron supports image input. Future use:

```typescript
// User uploads receipt photo
// Agent extracts merchant, amount, category
// Suggests if typical or unusual
```

### 4. Streaming Responses

Instead of waiting for full response:

```typescript
const stream = await fetch(...);
const reader = stream.getReader();
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  // Display partial response as it arrives
}
```

## Support & Troubleshooting

### Questions About Agent?

Refer to [AGENTS.md](../AGENTS.md) for:
- Complete architecture overview
- Tab-specific context details
- Integration checklist
- Testing guide
- Maintenance procedures

### Issues?

1. **Check proxy status:** `curl https://api.danielkalisch.de/nemotron/v1/chat/completions` (should give 405 Method Not Allowed or auth error, not connection refused)
2. **Test with simpler question:** "What's my income?" vs. complex multi-part questions
3. **Review agent context:** Print `buildAgentContext()` output to console
4. **Check response parsing:** Ensure response includes `choices[0].message.content`

---

**Ready to enable live AI?** Follow the 4 integration steps above, then test with the provided questions. Questions? See [AGENTS.md](../AGENTS.md).
