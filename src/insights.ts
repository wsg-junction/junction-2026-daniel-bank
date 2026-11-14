// ponytail: flat lookup, add generative fallback if insight variety matters
export type InsightKey = `${string}:${string}`;

export const INSIGHTS: Record<InsightKey, string> = {
  // Alex (CUST00115) — age 51, group 46–55, approved mortgage
  // savings rate 61.9% vs peer 10.4%, income €4,751 vs peer €7,811
  // balance grew €3,551 → €29,296 (+€25,745), investing €850/mo every month
  'CUST00115:accounts': 'Your balance grew from €3,551 to €29,296 over the observed period — a gain of over €25k. Your savings rate of ~62% is far above the 10.4% average for your age group. Mortgage approved for a €259,500 loan — check the cash flow chart to see how income and spending stack up.',
  'CUST00115:spending': 'Housing (€1,062/mo) and Utilities (€214/mo) dominate your spending — you run a very lean discretionary budget at 13.1% of spend vs. a population average of 21.7%. Your spending rate is just 38% of income, compared to 89% for peers aged 46–55. Lots of room in the forecast.',
  'CUST00115:payments': 'With an average monthly consumption of €1,809 and a balance above €29k, you have a very healthy buffer. No salary sweeps detected — income flows straight into the account. The simulator here is low-risk territory for you.',
  'CUST00115:investments': 'You have invested every single month in the observed period — €850 net per month on average, €5,100 total over 6 months. That consistency compounds. Worth checking whether the allocation still matches the mortgage timeline.',

  // Robin (CUST00047) — age 39, group 36–45, rejected mortgage
  // €28,803 salary sweeps in 6mo, balance fell €9,235 → €5,463 (-€3,773)
  // consumption only €466/mo avg but huge sweeps moving money out
  // spending rate 8.8% of income (vs peer 94.1%) — almost all income leaves as sweeps
  'CUST00047:accounts': 'Your balance has dropped from €9,235 to €5,463 — down €3,773. Income looks strong at €5,310/mo but €28,803 left as salary sweeps over 6 months. Mortgage application was rejected — the cash flow chart shows how much is swept out each month vs. what stays.',
  'CUST00047:spending': 'Recorded consumption is unusually low at €466/mo — just 8.8% of income — with Entertainment and Home & Tech as the top categories. But 59.9% of that spending is discretionary, well above the 21.7% population average. Most of your money moves via salary sweeps, not regular spending.',
  'CUST00047:payments': 'Your visible payments are minimal — average recorded consumption is only €466/mo. However, €28,803 in salary sweeps over 6 months means a large share of income is moving to accounts not captured here. That is likely relevant context for the rejected mortgage application.',
  'CUST00047:investments': 'No investment transfers recorded in the observed period. Your 6-month net contribution is €0. The €28,803 in salary sweeps may be going to investments via a separate account — but from this view, no transfers are visible. Worth verifying where those sweeps land.',

  // Noa (CUST00050) — age 23, group 18–25
  // savings rate 36.1% vs peer 9.7%, balance €1,703 → €8,719 (+€7,016)
  // investing every month but net -€568 (withdrawals > deposits in 6mo)
  // income €1,884 vs peer €3,984 (well below peer)
  'CUST00050:accounts': 'Balance grew from €1,703 to €8,719 — up €7,016. At 23, a 36.1% savings rate is well above your age group average of 9.7%. Income is €1,884/mo vs. a peer average of €3,984 — lower than peers, but your spending discipline more than makes up for it.',
  'CUST00050:spending': 'Housing takes €719/mo — 60% of your total spend. With an income of €1,884, that is a high housing burden. Groceries (€98) and Restaurants (€87) are next. Discretionary is 17.2% of spend, just below the 21.7% population average — you are running lean outside of housing.',
  'CUST00050:payments': 'Monthly consumption averages €1,205 and your balance is €8,719 — about 7 months of expenses as a buffer. No salary sweeps detected. The payment simulator gives you a safe space to test what a bigger expense would do to that buffer.',
  'CUST00050:investments': 'Investment activity every month for 6 months — but net withdrawals of €568 mean more came out than went in over the period. Average net is −€95/mo. Check whether that reflects rebalancing or if the direction should flip as the balance grows.',

  // Sam (CUST00038) — age 40, group 36–45, approved mortgage
  // savings rate 32.1% vs peer 5.6%, balance €20,719 → €25,762 (+€5,043)
  // income €3,083 vs peer €6,684 (well below peer, but very lean spend)
  // no investment transfers, no salary sweeps
  'CUST00038:accounts': 'Balance grew from €20,719 to €25,762 — up €5,043 over 6 months. A 32.1% savings rate is well above the 5.6% average for your age group, even on an income of €3,083/mo vs. a peer average of €6,684. Mortgage approved for a €168,000 loan.',
  'CUST00038:spending': 'Housing (€904/mo) dominates at 43% of total spend. Groceries (€333) and Transportation (€238) follow. You run a disciplined budget — total consumption at €2,094/mo is just 68% of what peers your age spend on average (€6,288). Utilities and Health round out the top 5.',
  'CUST00038:payments': 'Monthly consumption averages €2,094 and your balance is €25,762 — over 12 months of expenses as a buffer. No salary sweeps detected. That level of cushion makes large one-off payments low-risk — use the simulator to check any upcoming cost.',
  'CUST00038:investments': 'No investment transfers recorded in the observed period. Your savings show up entirely as balance growth — €5,043 over 6 months. If that cash is sitting uninvested, it may be worth exploring whether some of it could be working harder.',

  // Maya (CUST00117) — age 25, group 18–25
  // savings rate 47.2% vs peer 9.7%, balance €20,614 → €27,106 (+€6,492)
  // income €2,794 vs peer €3,984, no mortgage, no investment transfers
  'CUST00117:accounts': 'Balance grew from €20,614 to €27,106 — up €6,492 over 6 months. At 25, a 47.2% savings rate is exceptional — nearly 5× the 9.7% average for your age group. Income is €2,794/mo vs. a peer average of €3,984, but spending discipline more than compensates.',
  'CUST00117:spending': 'Housing takes €761/mo — 52% of total spend. Restaurants (€179) and Groceries (€161) are next, followed by Utilities (€119) and Lifestyle (€72). Total consumption of €1,474/mo is well below the peer average of €3,537 — you spend less than half of what peers your age typically do.',
  'CUST00117:payments': 'Monthly consumption averages €1,474 and your balance is €27,106 — over 18 months of expenses as a buffer. No salary sweeps detected. You have exceptional payment flexibility; the simulator is useful for modelling larger future goals like travel or a first home deposit.',
  'CUST00117:investments': 'No investment transfers recorded in the observed period. Your entire surplus — €1,320/mo on average — is accumulating as cash. With a balance already at €27k and a savings rate above 47%, this may be a good moment to look at whether some of that cash should be put to work.',
};
