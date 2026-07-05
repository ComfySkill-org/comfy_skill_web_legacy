/** Human-readable labels for credit transaction types from the API. */
export function formatTransactionType(type: string): string {
  switch (type) {
    case "grant":
      return "Credit grant";
    case "usage":
      return "Generation";
    case "refund":
      return "Refund";
    case "subscription":
      return "Subscription";
    default:
      return type.replace(/_/g, " ");
  }
}

export function transactionAmountClassName(amount: number): string {
  if (amount > 0) return "font-bold text-green-700";
  if (amount < 0) return "font-bold text-skill-ink";
  return "font-bold text-skill-muted";
}

export function summarizeTransactions(transactions: { amount: number }[]): {
  creditsIn: number;
  creditsOut: number;
} {
  let creditsIn = 0;
  let creditsOut = 0;

  for (const tx of transactions) {
    if (tx.amount > 0) creditsIn += tx.amount;
    else creditsOut += Math.abs(tx.amount);
  }

  return { creditsIn, creditsOut };
}
