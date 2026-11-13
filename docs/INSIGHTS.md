# Data Insights and Demo Strategy

Related project guidance: [AGENTS.md](../AGENTS.md).

Read these insights before working on ingestion, per-user JSON, financial calculations, financial chat, or the finance UI, as directed by that guidance. Maintain this document when related data or behavior changes.

The extraction pipeline and version-1 backend JSON contract below are implemented. Spending classification, recurrence detection, forecasting, UI delivery, and chat remain planned. Dataset profiling was performed on 2026-11-13; the current demo selection and generated files were verified on 2026-11-14. Revalidate after source changes.

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

## Selected demo users

The user selected this trio on 2026-11-14 for maximum combined feature coverage. All three have 24 months of transaction activity. Together they cover all 15 transaction categories, all eight transaction types, and all 12 mortgage event types. No individual customer has every transaction category/type; no customer with a mortgage link has investment withdrawals.

| Customer | Age | Transactions | Demo angle |
| --- | --- | --- | --- |
| `CUST00115` | 51 | 946 | Housing, utilities, investment deposits, and an approved mortgage |
| `CUST00047` | 39 | 526 | Everyday spending, salary sweeps, and a rejected mortgage |
| `CUST00050` | 23 | 657 | Housing, utilities, investment deposits and withdrawals; no mortgage |

`CUST00047` has no observed housing or utility transactions. Do not infer zero obligations from that absence. Mortgage history fields are event-specific; an empty field often means not applicable rather than defective data. Coverage is across the full observed history, not necessarily every month.

Verified September 2026 figures, in EUR:

| Customer | Income | Consumption | Investment deposits | Latest observed balance |
| --- | --- | --- | --- | --- |
| `CUST00115` | 5314.99 | 2024.75 | 992.84 | 29296.00 |
| `CUST00047` | 4953.85 | 784.52 | 0.00 | 5462.67 |
| `CUST00050` | 1644.19 | 843.18 | 36.17 | 8719.26 |

Income here includes salary and other income. Consumption excludes investment deposits and salary sweeps. Latest balances are observed on 2026-09-30 for `CUST00115`, 2026-09-27 for `CUST00047`, and 2026-09-29 for `CUST00050`; they are not live balances.

`CUST00047` has a September surplus before transfers of EUR 4169.33, but net cash flow of EUR -428.83 after EUR 4598.16 in salary sweeps. The destination of those sweeps is unknown; do not call them consumption or confirmed savings.

`CUST00050` has September investment deposits of EUR 36.17 and investment withdrawals of EUR 816.82. Net cash flow is EUR 1581.66, but income minus consumption is only EUR 801.01. This supports explaining why investment withdrawals are not earnings.

`CUST00115` links to mortgage customer `C0987`: an approved application for a EUR 308,500 property, EUR 259,500 requested loan, EUR 49,000 equity, and approximately 84.12% loan-to-value. These are application facts, not a confirmed current mortgage balance or repayment schedule. Assessed expenses must not automatically be added to transaction spending or assumed to recur.

`CUST00047` links to mortgage customer `C0267`: a rejected application with reason `insufficient_collateral`. Both mortgage users have all 12 event types represented. `CUST00050` has no mortgage link or history; its `mortgages` array is empty.

The previous `CUST00139` and `CUST00138` demo files were removed when this selection was generated; `CUST00115` was retained and regenerated.

Use fictional demo names only when clearly labeled as fictional.

## Extraction and delivery strategy

1. Validate and normalize the CSVs offline, using exact decimal arithmetic.
2. Select the three customer IDs and join their profiles and optional mortgage records.
3. Generate one versioned full-data JSON file per person for the backend, including normalized transactions and derived monthly summaries.
4. Retain those files outside public/static frontend assets.
5. Add a delivery layer that serves only summaries and requested, paginated transaction detail. Financial chat should query the selected user's backend data rather than relying only on fixed summary charts.

Do not ship the full dataset or the generated full-data person files to the frontend. A static prototype can load a separately projected per-user summary initially; a later API can expose that summary contract.

Planned UI summary sections (not all implemented):
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

## Implemented extractor and backend files

Run [scripts/extract_people.py](../scripts/extract_people.py) with Python 3.9 or newer; it uses only the standard library. Default paths are relative to the script's project root, independent of the working directory.

From the Bank project directory:

```sh
python3 scripts/extract_people.py
```

Strict mode fails on malformed source data before writing any person files. The current transaction source has one truncated row, so generation requires this explicit opt-in:

```sh
python3 scripts/extract_people.py --skip-invalid-rows
```

This warns on stderr and records skipped file/line/customer IDs and reasons in each person's `dataQuality`. The known skipped row belongs to none of the selected people. Optional `--assets-dir` and `--output-dir` arguments override input/output paths. Rerunning replaces the same three person files.

Generated backend files:
- [CUST00115.json](../data/people/CUST00115.json): 946 transactions; 720,196 bytes; one mortgage application with 21 history events.
- [CUST00047.json](../data/people/CUST00047.json): 526 transactions; 408,294 bytes; one mortgage application with 15 history events.
- [CUST00050.json](../data/people/CUST00050.json): 657 transactions; 490,744 bytes; no mortgage.

Version-1 structure:
- Metadata: `schemaVersion`, `userId`, `currency`, `synthetic`, `demoToday`, `timezone`.
- `profile`: normalized age/postal code and complete source customer row.
- `coverage`: observed range, transaction count, and observed account count.
- `accounts`: inferred opening balance, latest observed balance/time, and transaction count per account.
- `monthly`: 24 chronological monthly aggregates, including income, consumption, investment deposits/withdrawals, salary sweeps, net cash flow, and category/MCC consumption totals.
- `transactions`: all selected-user records, sorted chronologically, with normalized timestamps, integer-cent amounts/balances, category, type, merchant ID, MCC, and complete original fields under `source`.
- `mortgages`: zero or more complete source link records, each with its chronological matching history events and their complete source fields.
- `dataQuality`: valid source row counts, explicitly skipped source rows, whether skips affect the selected customer, and limitations.

Empty source values become `null`. Nonempty source fields retain their original strings for lossless values, including mortgage decimals with more than two decimal places. Thus the integer-cent rule applies to normalized transaction and summary amounts; raw `source` monetary fields are decimal strings, not floats. Transaction IDs identify source CSV line numbers and are not stable across source reordering.

The extractor validates headers, row shapes, required values, numeric/date fields, customer/history joins, and selected account balance continuity before writing outputs. It does not infer spending baskets, recurring commitments, financial advice, or mortgage repayments.

Generated outputs were checked against every matching source transaction, mortgage link, and history event for lossless record preservation, monthly cash-flow reconciliation, and combined category/type/event coverage. All four focused tests in [scripts/test_extract_people.py](../scripts/test_extract_people.py) passed again on 2026-11-14, covering full extraction and transfer calculations, mortgage isolation, explicit malformed-row handling, balance mismatches, and fractional-cent rejection:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts -p 'test_*.py' -v
```

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
Calculate scenarios deterministically against an explicit period or average, then let AI explain them. September restaurant spending for `CUST00115` is EUR 219.51; a 20% reduction gives EUR 43.90 potential savings rounded to cents, assuming other spending does not change. Do not present hypothetical savings as achieved savings.

### Safe-to-spend and safe-to-save
Proposed available-funds calculation:

`observed balance + forecast income - forecast essentials - planned transfers - chosen buffer`

Define the forecast horizon, recurrence method, expected payment timing, and buffer before implementing an estimate. Only include income expected within the horizon. Explain uncertainty and incomplete account coverage. Do not return a confident amount when required assumptions or inputs are missing.

### Historical demo clock
Use 2026-10-01 as the proposed simulated "today", making September 2026 "last month". Disclose the historical demo date; these files do not support live November 2026 balances. Forecasts and comparisons must not use observations beyond their evaluation cutoff.

## Initial implementation scope

Prioritize monthly overview, spending baskets, restaurant scenarios, recurring-payment estimates, and grounded conversational queries. Add mortgage context for `CUST00115` and `CUST00047`, with a clear no-mortgage-data state for `CUST00050`. Population benchmarking and PSD2/multi-bank integration remain optional.

When implementing, verify exact selected-user counts and monetary totals, transfer handling, monthly reconciliation, malformed-row reporting, classification uncertainty, and forecast cutoff behavior. Measure generated summary payload sizes rather than assuming they are small.

## Saved next-step plan

1. Completed: extract the three full-data person JSONs and inspect counts, amounts, reconciliation, joins, and payload sizes.
2. Completed: run the focused extractor tests; all four passed.
3. Next: expose a compact summary projection plus paginated transaction queries; keep full-data files backend-only.
4. Build a mobile-first UI with a demo-user switcher, monthly overview, spending breakdown, and explicit historical demo date.
5. Add explainable spending-basket classification with uncertainty/user overrides, then a deterministic restaurant-reduction simulator.
6. Add recurring-payment estimates backed by transaction evidence.
7. Add grounded financial chat using backend query/calculation functions rather than frontend data dumps.
8. Define horizon, income/bill forecasting, buffer, and missing-input behavior before adding safe-to-spend/save estimates.
