"""Extract full backend records and UI summaries for three synthetic demo users."""

import argparse
import csv
import json
import re
import sys
from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CUSTOMER_IDS = ("CUST00115", "CUST00047", "CUST00050", "CUST00038", "CUST00117")
SCHEMAS = {
    "tx_customers_junction.csv": (
        "customer_id customer_postal_code customer_age".split()
    ),
    "tx_junction_transcations.csv": (
        "customer_id bank_account_id tx_date tx_timestamp category tx_amount_eur "
        "balance_after_eur transaction_type merchant_id mcc_code".split()
    ),
    "mtg_tx_customer_link_and_final_mtg_infio.csv": (
        "mortgage_customer_id customer_id final_decision rejection_reason "
        "final_property_price_eur final_requested_loan_eur final_equity_amount_eur "
        "final_collateral_value_eur required_monthly_income_eur lfinal_loan_to_value".split()
    ),
    "mtg_negotiation_history.csv": (
        "mortgage_customer_id timestamp event_type property_id property_type "
        "property_price_estimate loan_amount equity_amount collateral_type "
        "collateral_value collateral_status decision rejection_reason expense_type "
        "expense_amount note".split()
    ),
}
REQUIRED_VALUES = {
    "tx_customers_junction.csv": ("customer_id", "customer_age"),
    "tx_junction_transcations.csv": tuple(
        field for field in SCHEMAS["tx_junction_transcations.csv"]
        if field not in ("merchant_id", "mcc_code")
    ),
    "mtg_tx_customer_link_and_final_mtg_infio.csv": (
        "mortgage_customer_id", "customer_id", "final_decision"
    ),
    "mtg_negotiation_history.csv": (
        "mortgage_customer_id", "timestamp", "event_type"
    ),
}
HISTORY_NUMBERS = {
    "property_price_estimate", "loan_amount", "equity_amount",
    "collateral_value", "expense_amount",
}


def decimal_value(value):
    try:
        number = Decimal(value)
    except InvalidOperation as error:
        raise ValueError(f"invalid decimal: {value!r}") from error
    if not number.is_finite():
        raise ValueError(f"non-finite decimal: {value!r}")
    return number


def cents(value):
    scaled = decimal_value(value) * 100
    if scaled != scaled.to_integral_value():
        raise ValueError(f"amount has fractions of a cent: {value!r}")
    return int(scaled)


def timestamp(value):
    # Parse English month abbreviations without depending on the host locale.
    match = re.fullmatch(r"(\d{2})([A-Z]{3})(\d{2}):(\d{2}):(\d{2}):(\d{2})", value)
    if not match:
        raise ValueError(f"invalid timestamp: {value!r}")
    day, month, year, hour, minute, second = match.groups()
    months = "JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC".split()
    if month not in months:
        raise ValueError(f"invalid timestamp month: {month!r}")
    return datetime(
        2000 + int(year), months.index(month) + 1, int(day),
        int(hour), int(minute), int(second),
    ).isoformat()


def validate_row(filename, row):
    missing = [field for field in REQUIRED_VALUES[filename] if not row[field]]
    if missing:
        raise ValueError(f"missing required values: {', '.join(missing)}")
    if filename == "tx_customers_junction.csv":
        if int(row["customer_age"]) < 0:
            raise ValueError("customer age cannot be negative")
    elif filename == "tx_junction_transcations.csv":
        cents(row["tx_amount_eur"])
        cents(row["balance_after_eur"])
        if date.fromisoformat(row["tx_date"]).isoformat() != timestamp(row["tx_timestamp"])[:10]:
            raise ValueError("transaction date and timestamp disagree")
    elif filename == "mtg_negotiation_history.csv":
        timestamp(row["timestamp"])
    for field, value in row.items():
        if value and (
            field.endswith("_eur") or field == "lfinal_loan_to_value"
            or (filename == "mtg_negotiation_history.csv" and field in HISTORY_NUMBERS)
        ):
            decimal_value(value)


def load_sources(assets_dir, skip_invalid_rows):
    sources, diagnostics, counts = {}, [], {}
    for filename, headers in SCHEMAS.items():
        records = []
        with (assets_dir / filename).open(newline="", encoding="utf-8-sig") as handle:
            reader = csv.DictReader(handle)
            if reader.fieldnames != headers:
                raise ValueError(f"{filename}: unexpected headers: {reader.fieldnames}")
            for row in reader:
                try:
                    if None in row or any(value is None for value in row.values()):
                        raise ValueError("row has the wrong number of columns")
                    validate_row(filename, row)
                except ValueError as error:
                    issue = {
                        "file": filename,
                        "line": reader.line_num,
                        "customerId": row.get("customer_id"),
                        "mortgageCustomerId": row.get("mortgage_customer_id"),
                        "reason": str(error),
                    }
                    if not skip_invalid_rows:
                        raise ValueError(
                            f"{filename}:{reader.line_num}: {error}. "
                            "Fix the source or explicitly use --skip-invalid-rows."
                        ) from error
                    diagnostics.append(issue)
                    print(f"WARNING: {filename}:{reader.line_num}: {error}", file=sys.stderr)
                    continue
                records.append({
                    "line": reader.line_num,
                    "row": {key: value if value != "" else None for key, value in row.items()},
                })
        sources[filename] = records
        counts[filename] = len(records)
    return sources, diagnostics, counts


def monthly_summary(transactions):
    months = defaultdict(list)
    for transaction in transactions:
        months[transaction["date"][:7]].append(transaction)
    summaries = []
    for month, rows in sorted(months.items()):
        income = consumption = deposits = withdrawals = sweeps = 0
        category_spending, mcc_spending = defaultdict(int), defaultdict(int)
        for row in rows:
            amount, kind = row["amountCents"], row["type"]
            if kind in ("salary", "other_income"):
                income += amount
            elif kind == "investment_deposit":
                deposits -= amount
            elif kind == "investment_withdrawal":
                withdrawals += amount
            elif kind == "salary_sweep":
                sweeps -= amount
            if amount < 0 and kind not in ("investment_deposit", "salary_sweep"):
                consumption -= amount
                category_spending[row["category"]] -= amount
                if row["mcc"] is not None:
                    mcc_spending[row["mcc"]] -= amount
        summaries.append({
            "month": month,
            "transactionCount": len(rows),
            "incomeCents": income,
            "consumptionCents": consumption,
            "investmentDepositsCents": deposits,
            "investmentWithdrawalsCents": withdrawals,
            "salarySweepsCents": sweeps,
            "surplusBeforeTransfersCents": income - consumption,
            "netCashFlowCents": sum(row["amountCents"] for row in rows),
            "categorySpendingCents": dict(sorted(category_spending.items())),
            "mccSpendingCents": dict(sorted(mcc_spending.items())),
        })
    return summaries


def build_people(sources, diagnostics, counts):
    profiles = {}
    for record in sources["tx_customers_junction.csv"]:
        row = record["row"]
        if row["customer_id"] in profiles:
            raise ValueError(f"duplicate customer profile: {row['customer_id']}")
        profiles[row["customer_id"]] = row
    links = sources["mtg_tx_customer_link_and_final_mtg_infio.csv"]
    mortgage_ids = {record["row"]["mortgage_customer_id"] for record in links}
    for record in links:
        if record["row"]["customer_id"] not in profiles:
            raise ValueError(f"mortgage link has unknown customer: {record['row']['customer_id']}")
    for record in sources["mtg_negotiation_history.csv"]:
        if record["row"]["mortgage_customer_id"] not in mortgage_ids:
            raise ValueError("mortgage event has no matching mortgage link")
    grouped = defaultdict(list)
    for record in sources["tx_junction_transcations.csv"]:
        row = record["row"]
        if row["customer_id"] not in profiles:
            raise ValueError(f"transaction has unknown customer: {row['customer_id']}")
        if row["customer_id"] in CUSTOMER_IDS:
            grouped[row["customer_id"]].append(record)
    people = {}
    for customer_id in CUSTOMER_IDS:
        if customer_id not in profiles or not grouped[customer_id]:
            raise ValueError(f"selected customer lacks a profile or transactions: {customer_id}")
        transactions, accounts = [], defaultdict(list)
        records = sorted(grouped[customer_id], key=lambda record: timestamp(record["row"]["tx_timestamp"]))
        for record in records:
            row = record["row"]
            transaction = {
                "id": f"tx-line-{record['line']}",
                "accountId": row["bank_account_id"],
                "date": row["tx_date"],
                "timestamp": timestamp(row["tx_timestamp"]),
                "category": row["category"],
                "amountCents": cents(row["tx_amount_eur"]),
                "balanceAfterCents": cents(row["balance_after_eur"]),
                "type": row["transaction_type"],
                "merchantId": row["merchant_id"],
                "mcc": row["mcc_code"],
                "source": row,
            }
            transactions.append(transaction)
            accounts[transaction["accountId"]].append(transaction)
        account_summaries = []
        for account_id, rows in sorted(accounts.items()):
            for previous, current in zip(rows, rows[1:]):
                if previous["timestamp"] == current["timestamp"]:
                    raise ValueError(f"{customer_id}/{account_id}: ambiguous transaction order")
                if previous["balanceAfterCents"] + current["amountCents"] != current["balanceAfterCents"]:
                    raise ValueError(f"{customer_id}/{account_id}: balance mismatch at {current['id']}")
            account_summaries.append({
                "accountId": account_id,
                "inferredOpeningBalanceCents": rows[0]["balanceAfterCents"] - rows[0]["amountCents"],
                "latestBalanceCents": rows[-1]["balanceAfterCents"],
                "observedAt": rows[-1]["timestamp"],
                "transactionCount": len(rows),
            })
        mortgages = []
        for record in links:
            link = record["row"]
            if link["customer_id"] == customer_id:
                events = [
                    {"timestamp": timestamp(event["row"]["timestamp"]), "source": event["row"]}
                    for event in sources["mtg_negotiation_history.csv"]
                    if event["row"]["mortgage_customer_id"] == link["mortgage_customer_id"]
                ]
                mortgages.append({"source": link, "events": sorted(events, key=lambda event: event["timestamp"])})
        people[customer_id] = {
            "schemaVersion": 1,
            "userId": customer_id,
            "currency": "EUR",
            "synthetic": True,
            "demoToday": "2026-10-01",
            "timezone": None,
            "profile": {
                "age": int(profiles[customer_id]["customer_age"]),
                "postalCode": profiles[customer_id]["customer_postal_code"],
                "source": profiles[customer_id],
            },
            "coverage": {
                "from": transactions[0]["date"],
                "through": transactions[-1]["date"],
                "transactionCount": len(transactions),
                "observedAccountCount": len(accounts),
            },
            "accounts": account_summaries,
            "monthly": monthly_summary(transactions),
            "transactions": transactions,
            "mortgages": mortgages,
            "dataQuality": {
                "validSourceRowCounts": counts,
                "skippedSourceRows": diagnostics,
                "selectedCustomerHasSkippedRows": any(
                    issue["customerId"] == customer_id
                    or issue["mortgageCustomerId"] in {
                        mortgage["source"]["mortgage_customer_id"] for mortgage in mortgages
                    }
                    for issue in diagnostics
                    if issue["customerId"] is not None or issue["mortgageCustomerId"] is not None
                ),
                "limitations": [
                    "Historical synthetic data; balances are not live.",
                    "Only observed accounts are included.",
                    "Source timestamps have no specified timezone.",
                    "Mortgage records describe applications, not confirmed current debt.",
                ],
            },
        }
    return people


def extract(assets_dir, output_dir, skip_invalid_rows=False):
    people = build_people(*load_sources(assets_dir, skip_invalid_rows))
    output_dir.mkdir(parents=True, exist_ok=True)
    for customer_id, person in people.items():
        path = output_dir / f"{customer_id}.json"
        payload = json.dumps(person, ensure_ascii=True, indent=2, allow_nan=False) + "\n"
        path.write_text(payload, encoding="utf-8")
        print(f"{path}: {len(person['transactions'])} transactions, {len(payload.encode('utf-8')):,} bytes")
    return people


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assets-dir", type=Path, default=ROOT / "assets")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "data" / "people")
    parser.add_argument(
        "--skip-invalid-rows", action="store_true",
        help="Explicitly skip invalid source rows, warning on stderr and recording them in each JSON.",
    )
    args = parser.parse_args()
    try:
        extract(args.assets_dir, args.output_dir, args.skip_invalid_rows)
    except (ValueError, OSError) as error:
        parser.exit(1, f"ERROR: {error}\n")


if __name__ == "__main__":
    main()
