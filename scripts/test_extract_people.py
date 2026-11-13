import csv
import json
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from io import StringIO
from pathlib import Path

from extract_people import CUSTOMER_IDS, SCHEMAS, extract


class ExtractionTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.assets = self.root / "assets"
        self.assets.mkdir()
        self.output = self.root / "people"
        self.sources = {name: [] for name in SCHEMAS}
        for customer_id in CUSTOMER_IDS:
            self.sources["tx_customers_junction.csv"].append({
                "customer_id": customer_id, "customer_postal_code": "00530", "customer_age": "29",
            })
            for day, category, kind, amount, balance in [
                (1, "Salary", "salary", "100.00", "110.00"),
                (2, "Housing", "housing_payment", "-20.00", "90.00"),
                (3, "Invest Deposit", "investment_deposit", "-5.00", "85.00"),
                (4, "Invest Withdraw", "investment_withdrawal", "3.00", "88.00"),
                (5, "Salary Sweep", "salary_sweep", "-1.00", "87.00"),
            ]:
                self.sources["tx_junction_transcations.csv"].append({
                    "customer_id": customer_id, "bank_account_id": f"ACC-{customer_id}",
                    "tx_date": f"2026-09-{day:02}", "tx_timestamp": f"{day:02}SEP26:12:00:00",
                    "category": category, "tx_amount_eur": amount,
                    "balance_after_eur": balance, "transaction_type": kind,
                    "merchant_id": "", "mcc_code": "",
                })
        self.sources["mtg_tx_customer_link_and_final_mtg_infio.csv"] = [{
            "mortgage_customer_id": "C0001", "customer_id": CUSTOMER_IDS[2],
            "final_decision": "approved", "required_monthly_income_eur": "4777.03467672831",
        }]
        self.sources["mtg_negotiation_history.csv"] = [{
            "mortgage_customer_id": "C0001", "timestamp": "01JAN26:12:00:00",
            "event_type": "application_created", "note": "Application started.",
        }]
        self.write_sources()

    def write_sources(self):
        for name, headers in SCHEMAS.items():
            with (self.assets / name).open("w", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=headers)
                writer.writeheader()
                writer.writerows(self.sources[name])

    def run_extract(self, skip=False):
        with redirect_stdout(StringIO()):
            return extract(self.assets, self.output, skip)

    def test_full_records_summaries_and_mortgage_isolation(self):
        people = self.run_extract()
        self.assertEqual(len(list(self.output.glob("*.json"))), 3)
        for customer_id, person in people.items():
            self.assertEqual(json.loads((self.output / f"{customer_id}.json").read_text()), person)
            self.assertEqual(person["profile"]["postalCode"], "00530")
            self.assertEqual(len(person["transactions"]), 5)
            self.assertTrue(all(tx["source"]["customer_id"] == customer_id for tx in person["transactions"]))
            self.assertIsNone(person["transactions"][0]["merchantId"])
            self.assertEqual(person["accounts"][0]["inferredOpeningBalanceCents"], 1000)
            self.assertEqual(person["accounts"][0]["latestBalanceCents"], 8700)
            month = person["monthly"][0]
            self.assertEqual(month["incomeCents"], 10000)
            self.assertEqual(month["consumptionCents"], 2000)
            self.assertEqual(month["investmentDepositsCents"], 500)
            self.assertEqual(month["investmentWithdrawalsCents"], 300)
            self.assertEqual(month["salarySweepsCents"], 100)
            self.assertEqual(month["netCashFlowCents"], 7700)
        self.assertEqual(people[CUSTOMER_IDS[0]]["mortgages"], [])
        mortgage = people[CUSTOMER_IDS[2]]["mortgages"][0]
        self.assertEqual(mortgage["source"]["required_monthly_income_eur"], "4777.03467672831")
        self.assertEqual(mortgage["events"][0]["timestamp"], "2026-01-01T12:00:00")
        self.assertEqual(mortgage["events"][0]["source"]["note"], "Application started.")

    def test_malformed_rows_fail_by_default_and_are_explicit_when_skipped(self):
        with (self.assets / "tx_junction_transcations.csv").open("a") as handle:
            handle.write(f"{CUSTOMER_IDS[0]},ACC-BAD,2026-09-06,06SEP26:12:00:00\n")
        with self.assertRaisesRegex(ValueError, "wrong number of columns"):
            self.run_extract()
        self.assertFalse(self.output.exists())
        warning = StringIO()
        with redirect_stderr(warning):
            people = self.run_extract(skip=True)
        self.assertIn("WARNING:", warning.getvalue())
        self.assertEqual(len(people[CUSTOMER_IDS[0]]["dataQuality"]["skippedSourceRows"]), 1)
        self.assertTrue(people[CUSTOMER_IDS[0]]["dataQuality"]["selectedCustomerHasSkippedRows"])
        self.assertFalse(people[CUSTOMER_IDS[1]]["dataQuality"]["selectedCustomerHasSkippedRows"])

    def test_balance_mismatch_prevents_output(self):
        self.sources["tx_junction_transcations.csv"][1]["balance_after_eur"] = "91.00"
        self.write_sources()
        with self.assertRaisesRegex(ValueError, "balance mismatch"):
            self.run_extract()
        self.assertFalse(self.output.exists())

    def test_fractional_cents_are_rejected(self):
        self.sources["tx_junction_transcations.csv"][0]["tx_amount_eur"] = "100.001"
        self.write_sources()
        with self.assertRaisesRegex(ValueError, "fractions of a cent"):
            self.run_extract()
        self.assertFalse(self.output.exists())


if __name__ == "__main__":
    unittest.main()
