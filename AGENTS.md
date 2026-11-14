# Personal Economic Trainer — Hackathon Brief

## Challenge
Build an AI-powered personal finance coach for S-Bank (S-Pankki) customers. The experience should let people explore and chat with their own transaction data in plain language, making everyday finances easier to understand and helping build healthier money habits.

## Product direction
- Prioritize a mobile app or a mobile-friendly web app that could be embedded in S-mobiili.
- Make exploration conversational and user-led (MyData), rather than limiting people to fixed, bank-selected charts.
- Explain financial concepts simply and ground answers in the user's data.
- Support questions ranging from transaction lookups (for example, taxi spending last month) to spending patterns, safe-to-spend/save guidance, and transparent what-if savings scenarios.
- Help users understand three spending baskets:
  1. Mandatory and regular (such as rent)
  2. Mandatory and irregular (such as an unexpected appliance repair)
  3. Everyday discretionary spending (such as coffees)
- Make assumptions and uncertainty clear, especially for estimates and recommendations. Avoid presenting guidance as guaranteed financial advice.

## Data and optional extensions
- The challenge provides a large synthetic transaction dataset modeled on S-Bank data. Treat it as synthetic; do not imply it is real customer data.
- Available files are in `assets/`:
  - `tx_junction_transcations.csv`
  - `tx_customers_junction.csv`
  - `mtg_tx_customer_link_and_final_mtg_infio.csv`
  - `mtg_negotiation_history.csv`
- Population benchmarks using open data (for example, Statistics Finland) are encouraged but optional.
- A multi-bank view using PSD2 data is an optional bonus, not a core requirement.

## Task-specific guidance
- Before working on CSV ingestion, demo-user selection, per-user JSON, financial calculations, financial chat, or the finance UI, read [data insights and strategy](docs/INSIGHTS.md).
- Keep that guidance updated when the source datasets or implemented data contract change. Its profiling results describe the inspected files, not permanent guarantees.

## Challenge context
The challenge is hosted by S-Bank, Finland's fourth-largest bank, whose S-mobiili app serves millions of customers. The goal is to explore how AI can make personal banking more conversational, insightful, and accessible, including for young adults.

Challenge and dataset source: <https://github.com/hackjunction/Junction-2026-S-pankki>

---

# Agent Implementation Guide

## Overview

The AI agent system enables real-time financial advice by analyzing user transaction data through context-aware conversations. Agents understand the user's current financial view (which tab they're on) and provide grounded, personalized insights.

## Architecture

### Agent Service (`src/agent.ts`)

The agent service manages all AI communication with the following responsibilities:

1. **Proxy endpoint management** with intelligent fallback
2. **Context building** that varies by tab/view
3. **Response parsing** into structured format
4. **Error handling** with graceful degradation

### Proxy Endpoints

The system uses S-Bank's AI proxy (`https://api.danielkalisch.de`) with two tiers:

| Endpoint | Model | Purpose | Fallback |
|----------|-------|---------|----------|
| `/nemotron/v1/chat/completions` | `nemotron-3.5-super-vl` | Primary: vision-capable, financial domain trained | On any error, try Gemma |
| `/v1/chat/completions` | `google/gemma-4-31B-it` | Fallback: reliable, open-weights, general purpose | If both fail, show error |

**Fallback Logic:**
```
Try Nemotron → Check response status and content → 
If error/empty → Try Gemma → Check response status and content →
If error/empty → Throw combined error
```

## Context Building

### How Context Works

Each tab provides different financial context to the agent, ensuring answers are relevant to the user's current exploration. This is **critical** for grounded, helpful responses.

#### Tab: Accounts (`accounts`)

**Purpose:** User is reviewing their account balance and transaction history.

**Context Provided:**
- Current account balance and observation date
- Last 3 months of income/consumption trends
- Average monthly income and spending
- Total transaction count
- Mortgage application status (if applicable)

**Example Agent Response:** "Your average monthly spending is €1,800, but this month you've only spent €1,200. You're €600 ahead of your usual pattern."

#### Tab: Spending (`spending`)

**Purpose:** User is analyzing spending categories and testing budget scenarios.

**Context Provided:**
- Current month's detailed breakdown
- Top 5 spending categories with transaction counts
- Comparison to 3-month average
- Income, consumption, and surplus figures
- Pre-transfer and post-transfer cash flow

**Example Agent Response:** "Restaurants are your largest flexible category at €320 this month. If you cut that by 25%, you'd free up €80 monthly—about €960 per year."

#### Tab: Payments (`payments`)

**Purpose:** User is simulating payment scenarios and testing cash impact.

**Context Provided:**
- Current account balance
- Average monthly payment patterns (last 6 months)
- Salary sweep activity (large transfers, usually to investment accounts)
- Reminder that this is a simulation

**Example Agent Response:** "A €500 payment would leave you with €2,100. Based on your average spending, that covers about 1.2 months of expenses."

#### Tab: Investments (`investments`)

**Purpose:** User is reviewing investment transfers and exploring savings scenarios.

**Context Provided:**
- Last 6 months of deposits and withdrawals
- Net investment contribution
- Current month's investment activity
- Clarity that this is transfers only (not holdings or performance)

**Example Agent Response:** "You've contributed €800 net over the last 6 months—about €130/month. That's a solid habit. Remember, I only see transfers, not what you're actually investing in."

### Context Builder Implementation

The `buildAgentContext()` function:

1. Takes the current user (`Person`), the ending month (`Month`), and active tab (`tab`)
2. Returns a **system message** that sets agent role and guidelines
3. Includes:
   - Synthetic data notice (critical!)
   - User profile summary
   - Tab-specific financial details
   - Instructions on:
     - Grounding answers in real data
     - Honesty about limitations
     - Avoiding guarantees
     - Clear explanations with numbers
     - EUR formatting
     - Distinguishing estimates from facts
     - Spending basket categories

Each tab has its own context builder:
- `buildAccountsContext()` – Balance, income, history, mortgages
- `buildSpendingContext()` – Categories, trends, surplus
- `buildPaymentsContext()` – Balance, payment patterns, simulation mode
- `buildInvestmentsContext()` – Deposits, withdrawals, transfers

## Message Flow

### When User Asks a Question

1. **Frontend captures question** in the coach card
2. **Finance module** (`answerQuestion` in `finance.ts`) was originally rule-based
3. **If live AI is enabled**, integrate like this:

```typescript
// In answerQuestion or new aiAnswerQuestion function
const context = buildAgentContext(person, month, currentTab);
const messages: AgentMessage[] = [
  context,
  { role: 'user', content: userQuestion },
];

const response = await callAgent(messages);
return {
  text: response.text,
  evidence: response.evidence,
  caveat: response.caveat,
};
```

4. **Agent responds** with grounded advice
5. **Response is displayed** with evidence and caveats visible

### Message Structure

Each message has:
- `role`: 'system' (context), 'user' (question), or 'assistant' (response)
- `content`: The actual text

The first message is always a system prompt that includes:
- Agent role (financial advisor for synthetic demo data)
- User profile (age, name, observation period)
- **Current tab context** (what data is available)
- **Behavioral guidelines** (be honest, ground in data, avoid guarantees)
- **Spending basket definitions** for categorization

## Response Parsing

`parseAgentResponse()` extracts structured information from AI responses:

### Expected Format (Optional Markers)

If the AI response includes structured markers, they're extracted:

```
Main answer text here.

[SOURCE]Based on your last 3 months of activity, which averaged €1,800/month spending.[/SOURCE]

[CAVEAT]This uses synthetic demo data. Actual savings depend on your circumstances and discipline.[/CAVEAT]
```

### Fallback Parsing

If markers aren't present:
- **text:** Full response from the AI
- **evidence:** Generic default: "Based on your recorded transaction data from this month and recent months."
- **caveat:** Generic default: "This is based on synthetic demo data. Not real financial advice. Consult a professional for major decisions."

This ensures the UI always has structured data to display, even if the AI doesn't format it perfectly.

## Error Handling

### Endpoint Failures

If an endpoint fails (network error, timeout, non-200 status):

1. **Log the error** via optional `onEndpointFail` callback
2. **Try the next endpoint** automatically
3. **If all fail**, throw combined error:
   ```
   "All AI endpoints failed. Last error: <last_error_message>"
   ```

### User-Facing Behavior

The coach card should:
1. Show loading state while calling agent
2. If successful: Display answer + evidence + caveats
3. If failed: Show friendly error (e.g., "I couldn't connect to the advisor right now. Try again?")
4. Fall back to local rule-based answers if live AI is unavailable

## Security & Privacy

### What the Agent Sees

✅ **Accessible:**
- Synthetic demo user data (age, spending, income)
- Transaction categories and amounts
- Dates and balances
- Mortgage application status
- Spending patterns and trends

❌ **NOT accessible:**
- Real customer names or IDs (replaced with demo names)
- Live passwords or account credentials
- Merchant names (only categories and MCCs)
- Other users' data

### Data Handling

- Messages are sent to **third-party proxy** (`api.danielkalisch.de`), not S-Bank directly
- **Synthetic data only** in demo
- Each question is **independent**—no persistent history on the proxy
- **Clear disclaimers** in every response

## Integration Checklist

### To Enable Live AI Agent Responses

- [ ] Import `buildAgentContext` and `callAgent` from `agent.ts`
- [ ] Modify `answerQuestion()` in `finance.ts` to detect live AI mode
- [ ] On user question:
  - [ ] Build agent context for current tab
  - [ ] Create message array: `[system context, user message]`
  - [ ] Call `callAgent(messages)`
  - [ ] Return parsed response with text, evidence, caveat
- [ ] Update coach card to show loading state during API call
- [ ] Catch agent errors gracefully; fall back to rule-based responses
- [ ] Test all four tabs with various questions
- [ ] Verify synthetic data notice appears in responses

### Optional: Endpoint Debugging

Enable `onEndpointFail` callback to log which endpoints are used:

```typescript
callAgent(messages, (endpoint, error) => {
  console.log(`[Agent] ${endpoint} failed: ${error}`);
})
```

Monitor logs to confirm fallback chain works as expected.

## Testing the Agent

### Manual Testing

1. **Test Accounts Tab:**
   - Q: "What's my average monthly income?"
   - Expected: Cites recent months and specific EUR amount

2. **Test Spending Tab:**
   - Q: "Which category should I reduce?"
   - Expected: Identifies top categories, suggests flexibility, acknowledges essentials

3. **Test Payments Tab:**
   - Q: "Can I afford a €200 payment?"
   - Expected: Compares to balance, mentions simulation, explains remaining cash

4. **Test Investments Tab:**
   - Q: "Am I investing enough?"
   - Expected: Shows contribution amount, acknowledges transfers aren't performance, avoids guarantees

### Fallback Testing

1. **Disable Nemotron** in code (comment out or mock as failing)
2. **Send a question** → Should seamlessly fall back to Gemma
3. **Disable both** → Should show clear error message

## Maintenance & Updates

### When to Update Context Builders

- **Dataset changes:** If `tx_junction_transcations.csv` or customer data is updated, rerun data extraction and regenerate demo JSONs
- **New features:** If you add new tabs (e.g., "Alerts", "Goals"), create corresponding context builder
- **Category changes:** If spending categories expand (new categories in CSV), update `buildSpendingContext()` to include new ones

### Monitoring

- Check proxy logs for endpoint status
- Track response latency—if Nemotron is consistently slow, consider reversing fallback order
- Monitor for API changes (new model versions, new endpoints)

### Version Management

Agent context includes `SYNTHETIC DATA NOTICE` automatically. If context changes significantly, increment any versioning to track baseline assumptions.

## Future Extensions

### Multi-Turn Conversations

Currently, each agent call is independent (stateless). To enable true multi-turn:

1. **Persist message history** in chat thread state
2. **Include previous turns** in message array:
   ```typescript
   const messages = [
     context,
     ...previousMessages,  // Include all prior Q&A
     { role: 'user', content: newQuestion }
   ];
   ```
3. **Update context** if user switches tabs mid-conversation

### Continuous Context Refresh

If the app becomes truly real-time:

1. **Detect tab/month/user changes**
2. **Regenerate context** before the next agent call
3. **Clear message history** if user switches to a different person

### Grounding with Live Data

When moving beyond synthetic demo:

1. **Replace hardcoded demo data** in context with live account API calls
2. **Enforce data minimization**: Only send the selected month + essential profile
3. **Add authentication header** to proxy calls
4. **Add audit logging** for compliance

---

## Summary

The agent system is **tab-aware, context-rich, and gracefully degrading**. It provides personalized financial insights by understanding what the user is currently exploring and building relevant context from their transaction data. The dual-endpoint design ensures reliability, and structured response parsing keeps the UI consistent even with API variations.
