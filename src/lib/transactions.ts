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
