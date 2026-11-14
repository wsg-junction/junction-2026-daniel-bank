# Pockets — Personal Economic Trainer

> AI-powered personal finance coach for S-Bank customers. Explore your transaction data in plain language, understand your spending, and build healthier money habits.

**Live demo:** https://pockets-s-pankki.web.app

Built for the Junction 2026 × S-Pankki hackathon challenge.

---

## What it does

Pockets lets you explore a synthetic S-Bank transaction history through four focused views and a conversational AI coach. All data is synthetic demo data — no real customer information is used.

### Accounts

- Observed account balance with the date it was recorded
- Balance history chart across selected months
- Cash flow chart showing income vs. spending, with peer benchmarks
- Range totals: total income, spending, and net cash flow for the selected period
- Mortgage context if applicable
- Full searchable transaction history

### Spending

- Interactive spending mix chart broken down by category
- **Spending playground** — drag a slider to simulate reducing any category and see how much you could free up monthly
- Multi-category reduction: adjust several categories independently, see the combined monthly saving
- Spending patterns card with trend insights
- **3-month balance forecast** — projects your balance forward using recent average cash flow, with a sensitivity band showing uncertainty
- Peer benchmarks: compare your income and spending against anonymised customers in the same age group
- **Three spending baskets** — classify each category as mandatory regular (rent), mandatory irregular (appliance repair), or everyday discretionary (coffee), with a basket breakdown chart

### Payments

- **Payment simulator** — enter a recipient and amount, see what your balance would look like afterward; no money is moved
- Stack multiple simulated payments and see the cumulative impact
- Balance forecast updates to reflect your test payments
- Recorded outgoing payment history for the selected period

### Investments

- **Investment heatmap** — calendar view showing transfer activity by month, click a month to jump to it
- Monthly bar chart of deposits and withdrawals
- Range totals for deposits, withdrawals, and salary sweeps
- **Contribution slider** — simulate setting aside a one-time amount and see remaining cash instantly
- Recorded investment transfer history
- Live stock ticker (market context, not portfolio data)

---

## AI Coach

Every tab has an embedded coach card. Ask anything in plain language:

- "What's my average monthly income?"
- "Which category should I reduce?"
- "Can I afford a €200 payment?"
- "Am I investing enough?"

The coach is **tab-aware** — it reads the context for whichever view you're on and grounds its answers in your actual figures. Responses include a source note (what data was used) and a caveat (synthetic data, not real financial advice).

The coach also auto-generates a tab insight when you switch tabs, so you always land with a relevant observation.

**Full conversation view** — expand the coach to a dedicated page with multi-turn history. Browse past conversations across tabs from the history view.

### How the AI works

Queries go through a two-tier proxy fallback:

1. **Nemotron** (`nemotron-3.5-super-vl`) — primary, vision-capable, financial domain; hosted on **Verda**
2. **Gemma** (`google/gemma-4-31B-it`) — fallback if Nemotron is unavailable; hosted on **Featherless**

If the coach can't reach either endpoint it falls back to local rule-based answers silently.

---

## Demo users

Five synthetic personas, each with a different financial profile:

| Name  | Profile                    |
|-------|----------------------------|
| Alex  | Saver · mortgage           |
| Robin | Spender · transfers        |
| Noa   | Young · investing          |
| Sam   | Family budget · mortgage   |
| Maya  | Young professional         |

---

## Tech stack

- **React + TypeScript** via Vite
- **Tailwind CSS v4** + HeroUI components
- **Firebase Hosting**
- **Verda** — hosts the Nvidia Nemotron proxy (primary AI model)
- **Featherless** — hosts the Gemma fallback proxy
- **Tiger** — converted the raw CSV transaction data to PostgreSQL for data analysis; powers the peer benchmark averages and spending suggestions
- **Craci** — CI/CD pipeline used to deploy the AI proxy server and backend
- Synthetic transaction data from the Junction 2026 S-Bank dataset

**Backend repo:** https://github.com/wsg-junction/junction-2026-backend-daniel

---

## Local development

```bash
npm install
npm run dev
```

## Deploy

```bash
npm run build
firebase deploy
```

Public dir is `dist/`. The `public/demo/` folder contains all runtime JSON — it is copied verbatim by the build.

---

> Synthetic demo data only. Not real financial advice. Consult a professional for major decisions.
