# Data Insights and Demo Strategy

Related project guidance: [AGENTS.md](../AGENTS.md).

Read these insights before working on ingestion, per-user JSON, financial calculations, financial chat, or the finance UI, as directed by that guidance. Maintain this document when related data or behavior changes.

The extraction pipeline, version-1 backend JSON contract, compact static delivery, interactive finance UI, tentative spending baskets, experimental forecasting, and local rule-based coach are implemented. Recurrence detection, live AI, and reliable safe-to-spend guidance remain planned. Dataset profiling was performed on 2026-11-13; the current demo selection and generated files were verified on 2026-11-14. Revalidate after source changes.

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
5. Project compact summaries and whitelisted monthly transaction pages offline from those JSONs. Load only the selected person's summary and the requested month. A future authenticated backend should paginate real-customer detail and ground financial chat in its queries.

Do not ship the full dataset or the generated full-data person files to the frontend. A static prototype can load a separately projected per-user summary initially; a later API can expose that summary contract.

Summary sections and future extensions (not all implemented):
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
The implemented simulated "today" is 2026-10-01. The UI explicitly selects a historical month; the local coach rejects relative-date requests instead of guessing their reference period. These files do not support live November 2026 balances. Forecasts and comparisons must not use observations beyond their evaluation cutoff.

## Initial implementation scope

Prioritize monthly overview, spending baskets, restaurant scenarios, recurring-payment estimates, and grounded conversational queries. Add mortgage context for `CUST00115` and `CUST00047`, with a clear no-mortgage-data state for `CUST00050`. Population benchmarking and PSD2/multi-bank integration remain optional.

When implementing, verify exact selected-user counts and monetary totals, transfer handling, monthly reconciliation, malformed-row reporting, classification uncertainty, and forecast cutoff behavior. Measure generated summary payload sizes rather than assuming they are small.

## Saved next-step plan

1. Completed: extract the three full-data person JSONs and inspect counts, amounts, reconciliation, joins, and payload sizes.
2. Completed: run the focused extractor tests; all four passed.
3. Completed: compact summary projection and on-demand monthly transaction pages; full-data files remain backend-only.
4. Completed: mobile-first four-page UI, demo-person/month switchers, and explicit historical data disclosures.
5. Completed: tentative spending baskets with session overrides, deterministic category-reduction simulator, and linked experimental forecast.
6. Add recurring-payment estimates backed by transaction evidence.
7. Add grounded financial chat using backend query/calculation functions rather than frontend data dumps.
8. Define horizon, income/bill forecasting, buffer, and missing-input behavior before adding safe-to-spend/save estimates.

## Interactive static MVP

The website uses only our extracted person JSONs. [project_summaries.py](../scripts/project_summaries.py) reads them offline; neither the app nor this projection reads CSVs, calls external finance APIs, or sends financial data to an AI service.

Four pages:
- **Accounts:** ending-month observed balance with visible history chart across selected months, searchable and type-filterable recorded transactions across that range, ten visible records at a time. Cash-flow details sum the selected range; mortgage context is evaluated at its ending month.
- **Spending:** chart-first spending experiment with category and reduction controls immediately beside/below the donut. Each category retains its own reduction when selecting another category; rounded savings are summed across all reductions for consumption totals, spending baskets, and the three-month balance scenario. Reduced category rows remain visible with remaining amounts and green negative reduction amounts; all category amounts, basket overrides, and assumptions are expandable. Restore this category removes only the selected reduction; Reset all reductions clears the entire spending experiment. These changes are session-only and reset on person/month changes.
- **Payments:** explicit payment sandbox with recipient/positive-cent validation, balance checks, removable simulated payments, and expandable recorded outgoing-payment history. No transfer is executed.
- **Investments:** switch between an interactive full-history transfer heatmap and grouped deposit/withdrawal bars for selected months with exact-value table (or explicit no-observed-transfers state). Heatmap cells show net deposits minus withdrawals, use green/blue for contribution/withdrawal intensity, mark selected months, and select a single month when clicked. Totals and transaction history use the selected range. A one-time contribution slider updates cash balance and forecast, capped at EUR 1,000 or remaining sandbox cash. No holdings, returns, stock/ETF prices, or portfolio values are fabricated.

Payments and the extra investment contribution are one-time outflows shared across pages. Spending reductions repeat once per projected month; they do not retroactively alter the selected historical balance. Each page has distinct primary content, with no repeated sandbox banner or global balance comparison. Accounts shows the observed balance; payment and investment widgets show their relevant cash impacts. Restore spending, clear test payments, and reset contribution act only on their own experiment. All simulations and basket overrides are in memory and reset when changing person/month or refreshing. Recorded transactions and source JSONs are never modified. Alex, Robin, and Noa are fictional display names.

Decorative page headings/taglines have been removed. Page-level headings remain screen-reader-only, with visible page identity in navigation. A slim white sub-bar contains the HeroUI/React Aria month-range slider, without tick dots or repeated date labels. Dates appear in the top bar in compact form (for example, Aug 26 – Sept 26); the same button hides/reopens the slider. The sub-bar hides after scrolling down and reappears near the top, unless a slider handle has focus. The visible handles are 12px with 24px interaction areas. Dragging previews the range in the top bar; charts and experiments update when the gesture completes, avoiding repeated remounts and fetches while dragging. Handles remain keyboard-operable and cannot cross.

The slider is hidden on Payments and full-chat views. Payments discloses that experiments use the last selected ending-month balance. The default range is the newest two months. Each person has one observed account; no additional accounts or multi-person comparisons are invented.

The compact date range is centered in the app bar between the logo and avatar. The finance pages' compact coach card scrolls with the content until it reaches the app bar, then stays pinned directly underneath. Its sticky offset follows the actual app-bar height, including when the month slider opens/closes or screen size changes. Expanded message history scrolls separately; the full-conversation page is not sticky.

Spending scenarios use average monthly category spending across the selected months. Missing categories in a month contribute zero to the observed average, not to assumed real-world obligations. Each average is rounded to cents; consumption totals sum those rounded category averages, so totals may differ by a few cents from rounding the overall consumption average. Reductions apply to these baselines, while the forecast still uses the last three observed cash-flow months through the range's endpoint. Range/person changes reset experiments.

The Spending patterns widget toggles between an area trend and a radar profile. The trend compares recorded monthly consumption with percentages applied independently to each month, and overlays the selected category after reductions; it is historical scenario exploration, not a forecast. Radar spokes compare recorded and reduced category monthly averages in EUR, not a financial-health score. Both react to range, category, and reduction controls and have exact-value tables.

The forecast averages the last three observed monthly net cash flows through the cutoff, then adds that average for each future month. It includes transfers. Historical one-month errors use only each evaluated month's preceding three months. The sensitivity band is the larger of mean absolute error and the largest training-window deviation, widening linearly; it is not a confidence interval. Sandbox outflows shift all projections once; spending savings accumulate monthly. No future bill timing, missing obligations, fees, or investment returns are guessed, and negative forecasts remain visible. Fewer than four observed months produces an explicit unavailable state.

An expandable local coach provides deterministic explanations with period/person evidence and limitations. It explicitly explains the range's ending month, not range averages or sandbox changes, and is not connected to live AI. Unsupported questions are explicitly identified. Live banking, authenticated access, actual payments/trades, recurrence estimates, and safe-to-spend guidance are not implemented.

### Static delivery and budgets

- Summaries: Alex 23,229 bytes, Robin 18,259 bytes, Noa 18,712 bytes, enforced below 40 KB each.
- 24 monthly transaction pages per person, under 25 KB each; verified maximums are 8,635 / 4,782 / 6,316 bytes.
- Transaction pages whitelist only ID, timestamp, category, type, signed amount cents, and observed balance cents. Raw source fields, account IDs, merchant IDs, postal codes, and full backend JSONs are excluded.
- Runtime guards check identity, selected month, chronological order, unique transaction IDs, integer cents, record counts, and net-cash-flow reconciliation. Failures show explicit retry controls; aborts prevent stale person/month data.
- Transaction history loads only the selected person's requested monthly pages when its screen is rendered, combines them newest-first, and searches/filters across the selected range. Loaded pages are cached; raw backend JSONs remain outside hosting.
- Charts load in a separate JavaScript chunk. Only HeroUI Button styles and shared theme/base utilities are imported. Icons use the existing Lucide dependency.

The hosted data is intentionally public **synthetic** data. Monthly files are independently addressable; lazy loading reduces downloads, not access permissions. Real banking records require an authenticated backend and must not be placed in public static assets.

### Development and hosting

```sh
npm run dev        # regenerate public JSONs and start Vite
npm run build      # regenerate JSONs, typecheck, and build dist
npm test           # calculation, sandbox, and runtime-contract tests
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts -p 'test_*.py' -v
```

[firebase.json](../firebase.json) is configured to host `dist` with SPA rewrites. After selecting your Firebase project, deploy with `firebase deploy --only hosting --project YOUR_PROJECT_ID` using your Firebase CLI. No deployment or project selection has been performed.

Accessibility includes native labeled form controls, keyboard-operable sliders, named navigation landmarks, current-page indicators, a skip link, focus outlines, live result/error announcements, decorative hidden Lucide icons, adjacent exact-value chart tables, and reduced-motion handling. Narrow layouts use zero-minimum grid tracks, wrapping transaction rows, and constrained controls; only exact-value table wrappers scroll horizontally.
