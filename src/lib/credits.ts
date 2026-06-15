import type { QualityTier } from "@/lib/api";

/** Credit cost per quality tier — matches PRD §4.1 and backend estimates. */
export const QUALITY_CREDITS: Record<QualityTier, number> = {
  premium: 50,
  standard: 20,
  budget: 8,
};
