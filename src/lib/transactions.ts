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

export function transactionHighlightJobId(tx: {
  type: string;
  job_id: string | null;
}): string | null {
  if (!tx.job_id) return null;
  if (tx.type === "usage" || tx.type === "refund") return tx.job_id;
  return null;
}

export type TransactionFilter = "all" | "usage" | "subscription" | "grant" | "refund";

export const TRANSACTION_FILTERS: { id: TransactionFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "usage", label: "Generations" },
  { id: "subscription", label: "Subscriptions" },
  { id: "grant", label: "Grants" },
  { id: "refund", label: "Refunds" },
];

export function matchesTransactionFilter(
  tx: { type: string },
  filter: TransactionFilter,
): boolean {
  if (filter === "all") return true;
  return tx.type === filter;
}

export function countTransactionsByFilter(
  transactions: readonly { type: string }[],
): Record<TransactionFilter, number> {
  const counts: Record<TransactionFilter, number> = {
    all: transactions.length,
    usage: 0,
    subscription: 0,
    grant: 0,
    refund: 0,
  };

  for (const tx of transactions) {
    if (tx.type in counts && tx.type !== "all") {
      counts[tx.type as Exclude<TransactionFilter, "all">] += 1;
    }
  }

  return counts;
}

export function summarizeUsageForMonth(
  transactions: readonly { type: string; amount: number; created_at: string }[],
  referenceDate: Date = new Date(),
): { creditsUsed: number; generationCount: number } {
  const month = referenceDate.getMonth();
  const year = referenceDate.getFullYear();
  let creditsUsed = 0;
  let generationCount = 0;

  for (const tx of transactions) {
    if (tx.type !== "usage") continue;
    const created = new Date(tx.created_at);
    if (created.getMonth() !== month || created.getFullYear() !== year) continue;
    creditsUsed += Math.abs(tx.amount);
    generationCount += 1;
  }

  return { creditsUsed, generationCount };
}

export function estimateCreditsRunway(
  balance: number,
  monthUsage: { creditsUsed: number; generationCount: number },
  referenceDate: Date = new Date(),
): number | null {
  if (balance <= 0 || monthUsage.generationCount === 0 || monthUsage.creditsUsed <= 0) {
    return null;
  }

  const dayOfMonth = referenceDate.getDate();
  const dailyBurn = monthUsage.creditsUsed / dayOfMonth;
  if (dailyBurn <= 0) return null;

  return Math.floor(balance / dailyBurn);
}

export function summarizeRefundsForMonth(
  transactions: readonly { type: string; amount: number; created_at: string }[],
  referenceDate: Date = new Date(),
): { refundCount: number; creditsRefunded: number } {
  const month = referenceDate.getMonth();
  const year = referenceDate.getFullYear();
  let refundCount = 0;
  let creditsRefunded = 0;

  for (const tx of transactions) {
    if (tx.type !== "refund") continue;
    const created = new Date(tx.created_at);
    if (created.getMonth() !== month || created.getFullYear() !== year) continue;
    refundCount += 1;
    creditsRefunded += Math.abs(tx.amount);
  }

  return { refundCount, creditsRefunded };
}

export type BillingSearchState = {
  plan?: "standard" | "creator" | "pro";
  ledger: TransactionFilter;
  highlightJobId?: string | null;
};

const BILLING_PLAN_VALUES = ["standard", "creator", "pro"] as const;
const BILLING_LEDGER_VALUES: TransactionFilter[] = [
  "all",
  "usage",
  "subscription",
  "grant",
  "refund",
];

export function parseBillingSearchParams(
  search: string | URLSearchParams,
): BillingSearchState {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const plan = params.get("plan");
  const ledger = params.get("ledger");

  return {
    plan: BILLING_PLAN_VALUES.includes(plan as (typeof BILLING_PLAN_VALUES)[number])
      ? (plan as (typeof BILLING_PLAN_VALUES)[number])
      : undefined,
    ledger: BILLING_LEDGER_VALUES.includes(ledger as TransactionFilter)
      ? (ledger as TransactionFilter)
      : "all",
    highlightJobId: params.get("job"),
  };
}

export function buildBillingSearchParams(state: BillingSearchState): string {
  const params = new URLSearchParams();
  if (state.plan) params.set("plan", state.plan);
  if (state.ledger !== "all") params.set("ledger", state.ledger);
  if (state.highlightJobId) params.set("job", state.highlightJobId);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function averageCreditsPerGeneration(monthUsage: {
  creditsUsed: number;
  generationCount: number;
}): number | null {
  if (monthUsage.generationCount <= 0) return null;
  return Math.round(monthUsage.creditsUsed / monthUsage.generationCount);
}
