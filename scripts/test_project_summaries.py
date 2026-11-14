import json
import unittest

from extract_people import CUSTOMER_IDS, ROOT
from project_summaries import project, project_transactions


class ProjectionTests(unittest.TestCase):
    def test_summaries_preserve_totals_without_source_records(self):
        expected = {
            "CUST00115": (531499, 202475, 2929600),
            "CUST00047": (495385, 78452, 546267),
            "CUST00050": (164419, 84318, 871926),
        }
        for user_id in CUSTOMER_IDS:
            with self.subTest(user=user_id):
                person = json.loads((ROOT / "data" / "people" / f"{user_id}.json").read_text())
                summary = project(person)
                self.assertEqual(len(summary["monthly"]), 24)
                last = summary["monthly"][-1]
                self.assertEqual((last["incomeCents"], last["consumptionCents"],
                                  last["closingBalanceCents"]), expected[user_id])
                for original, month in zip(person["monthly"], summary["monthly"]):
                    self.assertTrue(all(month[key] == value for key, value in original.items()))
                    self.assertEqual(sum(month["categoryCounts"].values()),
                                     sum(1 for row in person["transactions"]
                                         if row["date"].startswith(month["month"])
                                         and row["amountCents"] < 0
                                         and row["type"] not in ("investment_deposit", "salary_sweep")))
                payload = json.dumps(summary, separators=(",", ":"))
                self.assertLess(len(payload.encode()), 40_000)
                for forbidden in ('"source"', '"transactions"', '"merchantId"', '"postalCode"', '"accountId"'):
                    self.assertNotIn(forbidden, payload)
                self.assertEqual(len(summary["mortgages"]), 0 if user_id == "CUST00050" else 1)

    def test_transaction_pages_are_complete_isolated_and_whitelisted(self):
        for user_id in CUSTOMER_IDS:
            person = json.loads((ROOT / "data" / "people" / f"{user_id}.json").read_text())
            for month in person["monthly"]:
                with self.subTest(user=user_id, month=month["month"]):
                    page = project_transactions(person, month["month"])
                    expected = [row for row in reversed(person["transactions"])
                                if row["date"][:7] == month["month"]]
                    self.assertEqual(page["userId"], user_id)
                    self.assertEqual(len(page["transactions"]), month["transactionCount"])
                    self.assertEqual(sum(row["amountCents"] for row in page["transactions"]),
                                     month["netCashFlowCents"])
                    for actual, original in zip(page["transactions"], expected):
                        self.assertEqual(set(actual), {
                            "id", "timestamp", "category", "type", "amountCents", "balanceAfterCents"})
                        self.assertTrue(all(original[key] == value for key, value in actual.items()))
                    self.assertLess(len(json.dumps(page, separators=(",", ":")).encode()), 25_000)


if __name__ == "__main__":
    unittest.main()
