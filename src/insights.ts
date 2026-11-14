// ponytail: flat lookup, add generative fallback if insight variety matters
export type InsightKey = `${string}:${string}`;

export const INSIGHTS: Record<InsightKey, string> = {
  // Alex (CUST00115)
  'CUST00115:accounts': 'Your balance has grown steadily over the past 3 months — a positive trend. Check the cash flow details below to see what drove it.',
  'CUST00115:spending': 'Restaurants and groceries together account for the largest share of your discretionary spend. Small reductions there free up the most cash.',
  'CUST00115:payments': 'Your average monthly outgoing payments are well within your balance. You have room to experiment here without stress.',
  'CUST00115:investments': "You've been making regular transfers this period. Consistency here matters more than the size of each transfer.",
  // Robin (CUST00047)
  'CUST00047:accounts': 'Strong income this period — above your recent average. Your balance is at a multi-month high. Good moment to look at where the surplus goes.',
  'CUST00047:spending': 'Transport looks elevated this month compared to your usual pattern. Worth checking if that is a one-off or a new recurring cost.',
  'CUST00047:payments': 'No unusual large outgoing payments this month. Your fixed costs are running on their normal pattern.',
  'CUST00047:investments': 'Investment transfer activity is quiet this month so far. Your 6-month trend shows moderate, consistent contributions.',
  // Noa (CUST00050)
  'CUST00050:accounts': 'Balance dipped slightly this month, but income is steady. Spending ran a bit higher than average — the Spending tab can show you where.',
  'CUST00050:spending': 'Subscriptions and recurring services have been growing as a share of your spend. A quick audit of those could free up steady monthly cash.',
  'CUST00050:payments': 'Your balance comfortably covers typical monthly payments with a healthy buffer. The simulator here shows the real impact of any amount.',
  'CUST00050:investments': "You've contributed to investments every month in the observed period — a solid habit. Small, consistent amounts compound over time.",
};
