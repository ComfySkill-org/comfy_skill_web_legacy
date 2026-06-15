import type { Job, QualityTier } from "@/lib/api";
import { QUALITY_TIER_OPTIONS } from "@/lib/credits";

export type JobQualityFilter = "all" | QualityTier;

export const JOB_QUALITY_FILTERS: { id: JobQualityFilter; label: string }[] = [
  { id: "all", label: "All qualities" },
  ...QUALITY_TIER_OPTIONS.map(({ tier, label }) => ({ id: tier, label })),
];

export function matchesJobQualityFilter(job: Job, filter: JobQualityFilter): boolean {
  if (filter === "all") return true;
  return job.quality_tier === filter;
}

export function countJobsByQualityFilter(
  jobs: readonly Job[],
): Record<JobQualityFilter, number> {
  const counts: Record<JobQualityFilter, number> = {
    all: jobs.length,
    premium: 0,
    standard: 0,
    budget: 0,
  };

  for (const job of jobs) {
    counts[job.quality_tier] += 1;
  }

  return counts;
}

export function formatJobCreditsLabel(job: Job): string {
  const amount = (job.credits_charged ?? job.credits_estimated).toLocaleString();
  if (job.status === "completed" && job.credits_charged !== null) {
    return `Charged ${job.credits_charged.toLocaleString()} credits`;
  }
  if (job.status === "pending" || job.status === "running") {
    return `Est. ${job.credits_estimated.toLocaleString()} credits`;
  }
  if (job.status === "failed") {
    return `Est. ${job.credits_estimated.toLocaleString()} credits (not charged)`;
  }
  return `${amount} credits`;
}
