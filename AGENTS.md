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
