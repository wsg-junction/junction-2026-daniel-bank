# Data Insights and Demo Strategy

Related project guidance: [AGENTS.md](../AGENTS.md).

Read these insights before working on ingestion, per-user JSON, financial calculations, financial chat, or the finance UI, as directed by that guidance. Maintain this document when related data or behavior changes.

This is a proposed strategy, not an implemented pipeline or final API contract. Findings were verified against the local synthetic CSV files on 2026-11-13. Revalidate after source changes.

## CSV sources and joins

All sources are in [assets/](../assets/).

### Transactions: `tx_junction_transcations.csv`
Headers:
`customer_id`, `bank_account_id`, `tx_date`, `tx_timestamp`, `category`, `tx_amount_eur`, `balance_after_eur`, `transaction_type`, `merchant_id`, `mcc_code`.

Use for income, spending, balances, category trends, recurring-payment estimates, and scenario baselines. Amounts are signed: positive inflows and negative outflows.

### Customers: `tx_customers_junction.csv`
Headers: `customer_id`, `customer_postal_code`, `customer_age`.

Join transactions on `customer_id`. Age and postal code can support profiles or optional demographic benchmarks. Do not infer occupation, household size, or life stage from age alone.

### Mortgage links: `mtg_tx_customer_link_and_final_mtg_infio.csv`
Headers:
`mortgage_customer_id`, `customer_id`, `final_decision`, `rejection_reason`, `final_property_price_eur`, `final_requested_loan_eur`, `final_equity_amount_eur`, `final_collateral_value_eur`, `required_monthly_income_eur`, `lfinal_loan_to_value`.

Join to transactions/customers on `customer_id` and mortgage history on `mortgage_customer_id`. Preserve the source's `lfinal_loan_to_value` spelling when reading; a normalized JSON field can use `loanToValue`.

### Mortgage history: `mtg_negotiation_history.csv`
Headers:
`mortgage_customer_id`, `timestamp`, `event_type`, `property_id`, `property_type`, `property_price_estimate`, `loan_amount`, `equity_amount`, `collateral_type`, `collateral_value`, `collateral_status`, `decision`, `rejection_reason`, `expense_type`, `expense_amount`, `note`.

Use for chronological application milestones and assessed housing costs. This file was corrected from an earlier challenge-description text file into valid CSV.

## Verified coverage and quality

- 5,100 customer profiles; 142 customers have transaction rows, all with matching profiles.
- 97,193 complete transaction rows and one incomplete final row. The incomplete row is for `CUST00142`, dated 2025-03-16, and lacks category, amount, balance, transaction type, merchant ID, and MCC.
- 141 customers have activity across 24 months, October 2024 through September 2026; `CUST00142` has only six months of activity.
- Each transaction customer has one observed account. This does not establish their full financial picture.
- Complete transaction rows have no exact duplicates or equal timestamps within an account. Sorting by parsed timestamps yields zero balance-chain mismatches.
- 21,241 complete transaction rows have empty merchant IDs and MCCs.
- 200 mortgage links: 150 approved and 50 rejected. Only eight link customers have matching transaction data.
- 3,452 mortgage-history events cover all 200 linked mortgage customers, from 2026-01-02 through 2026-09-10.
- Merchant IDs are opaque identifiers, not human-readable names.
- MCC `4121` supports taxi-spending queries. The source does not specifically identify coffees.

Ingestion must validate required columns, row shapes, amounts, timestamps, and joins. Report invalid rows explicitly; do not silently drop them or turn missing amounts into zero. Either fail generation or use an explicitly selected quarantine mode with diagnostics.

## Recommended demo users

All three selected users have 24 months of transaction activity.

| Customer | Age | Transactions | Demo angle |
| --- | --- | --- | --- |
| `CUST00139` | 29 | 899 | Everyday spending patterns and reduction scenarios |
| `CUST00138` | 18 | 806 | Balancing essentials and investment transfers |
| `CUST00115` | 51 | 946 | Mortgage context and savings capacity |

Verified September 2026 figures, in EUR:

| Customer | Income | Consumption | Investment deposits | Latest observed balance |
| --- | --- | --- | --- | --- |
| `CUST00139` | 3318.79 | 2867.46 | 0.00 | 5284.09 |
| `CUST00138` | 2006.13 | 1892.23 | 263.60 | 6441.87 |
| `CUST00115` | 5314.99 | 2024.75 | 992.84 | 29296.00 |

Income here includes salary and other income. Consumption excludes investment deposits and salary sweeps. Latest balances are observed on 2026-09-30, not live balances.

`CUST00138` has a September surplus before transfers of EUR 113.90, but net cash flow of EUR -149.70 after investing. This supports explaining the difference between saving and consumption without labeling investment deposits as overspending.

`CUST00115` links to mortgage customer `C0987`: an approved application for a EUR 308,500 property, EUR 259,500 requested loan, EUR 49,000 equity, and approximately 84.12% loan-to-value. These are application facts, not a confirmed current mortgage balance or repayment schedule. Assessed expenses must not automatically be added to transaction spending or assumed to recur.

Use fictional demo names only when clearly labeled as fictional.

## Extraction and delivery strategy

1. Validate and normalize the CSVs offline, using exact decimal arithmetic.
2. Select the three customer IDs and join their profiles and optional mortgage records.
3. Generate a versioned summary JSON file per person for the UI.
4. Retain selected-user transaction detail on the backend, outside public/static frontend assets.
5. Serve summaries and requested, paginated transaction detail. Financial chat should query the selected user's backend data rather than relying only on fixed summary charts.

Do not ship the full dataset to the frontend. A static prototype can load per-user summaries initially; a later API should expose the same summary contract.

Proposed summary sections:
- `schemaVersion`, `userId`, `currency`, `synthetic`
- `profile`: age and optional postal code
- `coverage`: observed date range, transaction count, observed account count, data-quality limitations
- `balance`: amount and last observed timestamp
- `monthly`: all observed months with income, consumption, investment deposits/withdrawals, salary sweeps, net cash flow, and category/MCC totals
- `basketSummaries`: spending totals, classification confidence, and unclassified amounts
- `recurringCommitments`: estimated amount, cadence, expected next date, confidence, and supporting evidence
- `insights`: structured observations with periods, amounts, and evidence references
- `mortgage`: optional application summary and chronological milestones
- Future coach estimates: horizon, assumptions, buffer, forecast components, confidence, and unavailable-result reasons

Store money as integer cents, timestamps in a normalized format, and missing values as `null`. Keep postal codes and MCCs as strings. Parse source timestamps such as `30SEP26:15:56:46` with `%d%b%y:%H:%M:%S`; no timezone is supplied, so do not append `Z` or imply UTC.

## Financial semantics

### Income and transfers
- `salary` and `other_income` are income.
- `investment_withdrawal` is an asset transfer/inflow, not earnings.
- `investment_deposit` is a transfer/outflow, not consumption.
- `salary_sweep` is a separate outflow whose destination is not established by the source; do not automatically call it savings.
- Reconcile net cash flow using all signed amounts, including transfers.

### Three spending baskets
- Mandatory/regular: housing and recurring utilities are strong starting candidates.
- Mandatory/irregular: some healthcare or repairs may qualify, but category alone cannot prove necessity.
- Everyday/discretionary: restaurants and entertainment are useful starting candidates.

Groceries and transport need nuance. Distinguish necessity from recurrence; a grocery budget is not necessarily a fixed recurring bill. `Home & Tech` does not distinguish an appliance repair from an optional electronics purchase.

Store the classification basis and confidence, support user overrides, and retain an unclassified bucket. Do not force ambiguous transactions into a basket with false certainty. Recurring estimates must be supported by transaction patterns, not merely category labels.

### What-if scenarios
Calculate scenarios deterministically against an explicit period or average, then let AI explain them. September restaurant spending for `CUST00138` is EUR 212.95; a 20% reduction gives EUR 42.59 potential savings, assuming other spending does not change. Do not present hypothetical savings as achieved savings.

### Safe-to-spend and safe-to-save
Proposed available-funds calculation:

`observed balance + forecast income - forecast essentials - planned transfers - chosen buffer`

Define the forecast horizon, recurrence method, expected payment timing, and buffer before implementing an estimate. Only include income expected within the horizon. Explain uncertainty and incomplete account coverage. Do not return a confident amount when required assumptions or inputs are missing.

### Historical demo clock
Use 2026-10-01 as the proposed simulated "today", making September 2026 "last month". Disclose the historical demo date; these files do not support live November 2026 balances. Forecasts and comparisons must not use observations beyond their evaluation cutoff.

## Initial implementation scope

Prioritize monthly overview, spending baskets, restaurant scenarios, recurring-payment estimates, and grounded conversational queries. Add mortgage context for the third user. Population benchmarking and PSD2/multi-bank integration remain optional.

When implementing, verify exact selected-user counts and monetary totals, transfer handling, monthly reconciliation, malformed-row reporting, classification uncertainty, and forecast cutoff behavior. Measure generated summary payload sizes rather than assuming they are small.
