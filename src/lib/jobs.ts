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
