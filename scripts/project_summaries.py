"""Project summaries and lazy monthly transaction pages from synthetic person JSONs."""

import json
from collections import Counter
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from extract_people import CUSTOMER_IDS, ROOT


DEMO_PROFILES = {
    "CUST00115": {"name": "Alex", "initials": "AL", "color": "sage", "description": "Home & longer-term plans"},
    "CUST00047": {"name": "Robin", "initials": "RO", "color": "lavender", "description": "Everyday spending & transfers"},
    "CUST00050": {"name": "Noa", "initials": "NO", "color": "peach", "description": "Everyday life & investments"},
    "CUST00038": {"name": "Sam", "initials": "SA", "color": "sky", "description": "Family budget · mortgage"},
    "CUST00117": {"name": "Maya", "initials": "MA", "color": "rose", "description": "Young professional"},
}


def money(value):
    return None if value is None else int(
        (Decimal(value) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    )


def project_transactions(person, month):
    return {
        "schemaVersion": 1,
        "synthetic": True,
        "userId": person["userId"],
        "month": month,
        "transactions": [
            {key: row[key] for key in
             ("id", "timestamp", "category", "type", "amountCents", "balanceAfterCents")}
            for row in reversed(person["transactions"]) if row["date"][:7] == month
        ],
    }


def project(person):
    monthly = []
    for original in person["monthly"]:
        month = original["month"]
        rows = [row for row in person["transactions"] if row["date"].startswith(month)]
        spending_rows = [row for row in rows if row["amountCents"] < 0
                         and row["type"] not in ("investment_deposit", "salary_sweep")]
        balances = {}
        for account in person["accounts"]:
            observed = [row for row in person["transactions"]
                        if row["accountId"] == account["accountId"] and row["date"][:7] <= month]
            if not observed:
                raise ValueError(f"No balance for {account['accountId']} at {month}")
            balances[account["accountId"]] = observed[-1]["balanceAfterCents"]
        monthly.append({
            **original,
            "closingBalanceCents": sum(balances.values()),
            "balanceObservedAt": max(row["timestamp"] for row in rows),
            "categoryCounts": dict(Counter(row["category"] for row in spending_rows)),
        })
    mortgages = []
    for mortgage in person["mortgages"]:
        source = mortgage["source"]
        mortgages.append({
            "decision": source["final_decision"],
            "rejectionReason": source["rejection_reason"],
            "propertyPriceCents": money(source["final_property_price_eur"]),
            "requestedLoanCents": money(source["final_requested_loan_eur"]),
            "equityCents": money(source["final_equity_amount_eur"]),
            "events": [{"timestamp": event["timestamp"], "type": event["source"]["event_type"]}
                       for event in mortgage["events"]],
        })
    return {
        "schemaVersion": 1,
        "userId": person["userId"],
        "synthetic": True,
        "demoToday": person["demoToday"],
        "profile": {**DEMO_PROFILES[person["userId"]], "age": person["profile"]["age"]},
        "coverage": person["coverage"],
        "monthly": monthly,
        "mortgages": mortgages,
        "limitations": person["dataQuality"]["limitations"],
        "hasSkippedRows": person["dataQuality"]["selectedCustomerHasSkippedRows"],
    }


def main():
    output = ROOT / "public" / "demo"
    output.mkdir(parents=True, exist_ok=True)
    for customer_id in CUSTOMER_IDS:
        source = ROOT / "data" / "people" / f"{customer_id}.json"
        person = json.loads(source.read_text(encoding="utf-8"))
        summary = project(person)
        payload = json.dumps(summary, separators=(",", ":"), allow_nan=False) + "\n"
        if len(payload.encode("utf-8")) > 40_000:
            raise ValueError(f"Summary exceeds the 40 KB per-person budget: {customer_id}")
        (output / f"{customer_id}.json").write_text(payload, encoding="utf-8")
        pages = output / "transactions" / customer_id
        pages.mkdir(parents=True, exist_ok=True)
        largest = 0
        for month in summary["monthly"]:
            page = json.dumps(project_transactions(person, month["month"]),
                              separators=(",", ":"), allow_nan=False) + "\n"
            size = len(page.encode("utf-8"))
            if size > 25_000:
                raise ValueError(f"Transaction page exceeds 25 KB: {customer_id}/{month['month']}")
            (pages / f"{month['month']}.json").write_text(page, encoding="utf-8")
            largest = max(largest, size)
        print(f"{customer_id}: {len(payload.encode('utf-8')):,} summary bytes; "
              f"24 lazy transaction pages, largest {largest:,} bytes")


if __name__ == "__main__":
    main()
