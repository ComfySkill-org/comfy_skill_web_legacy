import type { Job, QualityTier } from "@/lib/api";
import { QUALITY_TIER_OPTIONS } from "@/lib/credits";

export type JobStatusFilter = "all" | "completed" | "failed" | "in_progress";

export const JOB_STATUS_FILTERS: { id: JobStatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "in_progress", label: "In progress" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
];

export function matchesJobStatusFilter(job: Job, filter: JobStatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "in_progress") {
    return job.status === "pending" || job.status === "running";
  }
  return job.status === filter;
}

export function countJobsByStatusFilter(
  jobs: readonly Job[],
): Record<JobStatusFilter, number> {
  const counts: Record<JobStatusFilter, number> = {
    all: jobs.length,
    in_progress: 0,
    completed: 0,
    failed: 0,
  };

  for (const job of jobs) {
    if (job.status === "pending" || job.status === "running") counts.in_progress += 1;
    else if (job.status === "completed") counts.completed += 1;
    else if (job.status === "failed") counts.failed += 1;
  }

  return counts;
}

export function studioJobHref(job: Job): string {
  if (!job.project_id) return "/studio";
  const params = new URLSearchParams({ project: job.project_id });
  if (job.block_id) params.set("block", job.block_id);
  return `/studio?${params.toString()}`;
}

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

export function sumJobCredits(jobs: readonly Job[]): number {
  return jobs.reduce(
    (total, job) => total + (job.credits_charged ?? job.credits_estimated),
    0,
  );
}
