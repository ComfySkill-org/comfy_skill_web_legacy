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
