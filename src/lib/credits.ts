import type { QualityTier } from "@/lib/api";

/** Credit cost per quality tier — matches PRD §4.1 and backend estimates. */
export const QUALITY_CREDITS: Record<QualityTier, number> = {
  premium: 50,
  standard: 20,
  budget: 8,
};

export const QUALITY_TIER_OPTIONS: { tier: QualityTier; label: string }[] = [
  { tier: "premium", label: "Good" },
  { tier: "standard", label: "Medium" },
  { tier: "budget", label: "Budget" },
];

export function isLowCreditBalance(balance: number): boolean {
  return balance < QUALITY_CREDITS.budget;
}

export function hasCreditsForGeneration(balance: number, tier: QualityTier): boolean {
  return balance >= QUALITY_CREDITS[tier];
}

export function formatInsufficientCreditsMessage(creditEstimate: number): string {
  return `Need at least ${creditEstimate} credits for this quality tier. Add credits in Billing.`;
}

/** Monthly credits included with each subscription plan (after webhook). */
export const PLAN_MONTHLY_CREDITS = {
  standard: 4200,
  creator: 7400,
  pro: 21100,
} as const;

export function estimateGenerations(
  planCredits: number,
  tier: QualityTier = "standard",
): number {
  return Math.floor(planCredits / QUALITY_CREDITS[tier]);
}
