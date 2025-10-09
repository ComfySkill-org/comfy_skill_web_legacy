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

export type JobSourceFilter = "all" | "studio" | "quick_form";

export const JOB_SOURCE_FILTERS: { id: JobSourceFilter; label: string }[] = [
  { id: "all", label: "All sources" },
  { id: "studio", label: "Studio" },
  { id: "quick_form", label: "Quick form" },
];

export function matchesJobSourceFilter(job: Job, filter: JobSourceFilter): boolean {
  if (filter === "all") return true;
  if (filter === "studio") return Boolean(job.project_id);
  return !job.project_id;
}

export function matchesJobPromptSearch(job: Job, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return job.prompt_text.toLocaleLowerCase().includes(needle);
}

export function countJobsBySourceFilter(
  jobs: readonly Job[],
): Record<JobSourceFilter, number> {
  const counts: Record<JobSourceFilter, number> = {
    all: jobs.length,
    studio: 0,
    quick_form: 0,
  };

  for (const job of jobs) {
    if (job.project_id) counts.studio += 1;
    else counts.quick_form += 1;
  }

  return counts;
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

export type JobListQueryState = {
  status: JobStatusFilter;
  quality: JobQualityFilter;
  source: JobSourceFilter;
  prompt: string;
  sort: JobSortOption;
};

export type JobSortOption = "newest" | "oldest" | "credits_desc";

export const JOB_SORT_OPTIONS: { id: JobSortOption; label: string }[] = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "credits_desc", label: "Most credits" },
];

const JOB_LIST_SORT_VALUES: JobSortOption[] = ["newest", "oldest", "credits_desc"];

const JOB_LIST_STATUS_VALUES: JobStatusFilter[] = [
  "all",
  "in_progress",
  "completed",
  "failed",
];

const JOB_LIST_SOURCE_VALUES: JobSourceFilter[] = ["all", "studio", "quick_form"];

const JOB_LIST_QUALITY_VALUES: JobQualityFilter[] = [
  "all",
  "premium",
  "standard",
  "budget",
];

export function parseJobListSearchParams(
  search: string | URLSearchParams,
): JobListQueryState {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const status = params.get("status");
  const source = params.get("source");
  const quality = params.get("quality");

  return {
    status: JOB_LIST_STATUS_VALUES.includes(status as JobStatusFilter)
      ? (status as JobStatusFilter)
      : "all",
    source: JOB_LIST_SOURCE_VALUES.includes(source as JobSourceFilter)
      ? (source as JobSourceFilter)
      : "all",
    quality: JOB_LIST_QUALITY_VALUES.includes(quality as JobQualityFilter)
      ? (quality as JobQualityFilter)
      : "all",
    prompt: params.get("q") ?? "",
    sort: JOB_LIST_SORT_VALUES.includes(params.get("sort") as JobSortOption)
      ? (params.get("sort") as JobSortOption)
      : "newest",
  };
}

export function buildJobListSearchParams(
  state: JobListQueryState,
  highlightJobId?: string | null,
): string {
  const params = new URLSearchParams();
  if (state.status !== "all") params.set("status", state.status);
  if (state.quality !== "all") params.set("quality", state.quality);
  if (state.source !== "all") params.set("source", state.source);
  if (state.prompt.trim()) params.set("q", state.prompt.trim());
  if (state.sort !== "newest") params.set("sort", state.sort);
  if (highlightJobId) params.set("job", highlightJobId);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function billingRefundHref(jobId: string): string {
  const params = new URLSearchParams({ ledger: "refund", job: jobId });
  return `/settings/billing?${params.toString()}`;
}

export function hasActiveJobListFilters(state: JobListQueryState): boolean {
  return (
    state.status !== "all" ||
    state.quality !== "all" ||
    state.source !== "all" ||
    state.prompt.trim() !== ""
  );
}

export function sortJobs<T extends Job>(jobs: readonly T[], sort: JobSortOption): T[] {
  const copy = [...jobs];
  copy.sort((a, b) => {
    if (sort === "credits_desc") {
      const aCredits = a.credits_charged ?? a.credits_estimated;
      const bCredits = b.credits_charged ?? b.credits_estimated;
      return bCredits - aCredits;
    }
    const aTime = new Date(a.created_at).getTime();
    const bTime = new Date(b.created_at).getTime();
    return sort === "newest" ? bTime - aTime : aTime - bTime;
  });
  return copy;
}

export function formatJobDuration(job: Job): string | null {
  if (job.status === "pending" || job.status === "running") return "Running…";
  if (!job.completed_at) return null;

  const seconds = Math.max(
    0,
    Math.round(
      (new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000,
    ),
  );
  if (seconds < 60) return `Completed in ${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder > 0 ? `Completed in ${minutes}m ${remainder}s` : `Completed in ${minutes}m`;
}
