"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiClient, getToken, isFirebaseEnabled, type Job } from "@/lib/api";
import { isJobInsufficientCreditsError, isLowCreditBalance, qualityTierLabel } from "@/lib/credits";
import { getFirebaseAuth, subscribeToAuthToken } from "@/lib/firebase";
import {
  countJobsByQualityFilter,
  formatJobCreditsLabel,
  JOB_QUALITY_FILTERS,
  matchesJobQualityFilter,
  studioJobHref,
  sumJobCredits,
  type JobQualityFilter,
} from "@/lib/jobs";

function statusTone(status: string): string {
  if (status === "completed") return "text-green-700";
  if (status === "failed") return "text-red-600";
  if (status === "pending" || status === "running") return "text-skill-blue-dark";
  return "text-skill-muted";
}

type JobFilter = "all" | "completed" | "failed" | "in_progress";

const JOB_FILTERS: { id: JobFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "in_progress", label: "In progress" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
];

function matchesJobFilter(job: Job, filter: JobFilter): boolean {
  if (filter === "all") return true;
  if (filter === "in_progress") {
    return job.status === "pending" || job.status === "running";
  }
  return job.status === filter;
}

export default function AppJobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<JobFilter>("all");
  const [qualityFilter, setQualityFilter] = useState<JobQualityFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);
  const [highlightJobId, setHighlightJobId] = useState<string | null>(null);
  const [balanceCredits, setBalanceCredits] = useState<number | null>(null);

  const filteredJobs = useMemo(
    () =>
      jobs.filter(
        (job) => matchesJobFilter(job, filter) && matchesJobQualityFilter(job, qualityFilter),
      ),
    [jobs, filter, qualityFilter],
  );

  const jobFilterCounts = useMemo(() => {
    const counts: Record<JobFilter, number> = {
      all: jobs.length,
      completed: 0,
      failed: 0,
      in_progress: 0,
    };

    for (const job of jobs) {
      if (job.status === "completed") counts.completed += 1;
      else if (job.status === "failed") counts.failed += 1;
      else if (job.status === "pending" || job.status === "running") counts.in_progress += 1;
    }

    return counts;
  }, [jobs]);

  const jobQualityFilterCounts = useMemo(() => countJobsByQualityFilter(jobs), [jobs]);

  const filteredCreditsTotal = useMemo(() => sumJobCredits(filteredJobs), [filteredJobs]);

  useEffect(() => {
    async function loadJobs() {
      setError("");
      setLoading(true);
      try {
        const [{ jobs: list }, user] = await Promise.all([
          apiClient.listJobs(),
          apiClient.me(),
        ]);
        setJobs(list);
        setBalanceCredits(user.balance_credits);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load jobs");
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }

    if (isFirebaseEnabled()) {
      const unsub = subscribeToAuthToken((token) => {
        if (token) void loadJobs();
        else if (!getFirebaseAuth()?.currentUser) router.replace("/login");
      });
      if (getFirebaseAuth()?.currentUser) void loadJobs();
      return unsub;
    }

    if (!getToken()) {
      router.replace("/login");
      return;
    }
    void loadJobs();
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const jobId = new URLSearchParams(window.location.search).get("job");
    if (!jobId) return;
    setHighlightJobId(jobId);
    setFilter("all");
  }, []);

  useEffect(() => {
    if (!highlightJobId || loading) return;
    const row = document.getElementById(`job-${highlightJobId}`);
    if (!row) return;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightJobId, loading, jobs]);

  useEffect(() => {
    function refreshJobs() {
      void Promise.all([apiClient.listJobs(), apiClient.me()])
        .then(([{ jobs: list }, user]) => {
          setJobs(list);
          setBalanceCredits(user.balance_credits);
        })
        .catch(() => undefined);
    }

    function onWindowFocus() {
      refreshJobs();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") refreshJobs();
    }

    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const inFlight = jobs.some(
      (job) => job.status === "pending" || job.status === "running",
    );
    if (!inFlight || loading) return;

    const timer = setInterval(() => {
      void apiClient
        .listJobs()
        .then(({ jobs: list }) => setJobs(list))
        .catch(() => undefined);
    }, 2000);
    return () => clearInterval(timer);
  }, [jobs, loading]);

  async function copyJobPrompt(job: Job) {
    try {
      await navigator.clipboard.writeText(job.prompt_text);
      setCopiedJobId(job.id);
      window.setTimeout(() => {
        setCopiedJobId((current) => (current === job.id ? null : current));
      }, 2000);
    } catch {
      setError("Could not copy prompt to clipboard");
    }
  }

  const lowCreditBalance =
    balanceCredits !== null && isLowCreditBalance(balanceCredits);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Generation history</h1>
          <p className="text-sm text-skill-muted">
            Recent jobs from quick form and studio blocks.
          </p>
          {balanceCredits !== null && (
            <p
              className={`mt-1 text-sm font-medium ${lowCreditBalance ? "text-amber-700" : "text-skill-muted"}`}
            >
              {balanceCredits.toLocaleString()} credits remaining
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <button
            type="button"
            className="underline hover:text-skill-ink disabled:opacity-50"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              void Promise.all([apiClient.listJobs(), apiClient.me()])
                .then(([{ jobs: list }, user]) => {
                  setJobs(list);
                  setBalanceCredits(user.balance_credits);
                })
                .catch((err) =>
                  setError(err instanceof Error ? err.message : "Failed to refresh jobs"),
                )
                .finally(() => setLoading(false));
            }}
          >
            Refresh
          </button>
          <Link href="/settings/billing?plan=standard" className="underline hover:text-skill-ink">
            Billing
          </Link>
          <Link href="/settings" className="underline hover:text-skill-ink">
            Account
          </Link>
          <Link href="/app" className="underline hover:text-skill-ink">
            Quick form
          </Link>
          <Link href="/studio" className="underline hover:text-skill-ink">
            Studio
          </Link>
        </div>
      </div>

      {loading && <p className="text-sm text-skill-muted">Loading jobs…</p>}
      {error && !loading && <p className="text-sm text-red-600">{error}</p>}

      {lowCreditBalance && !loading && (
        <p className="mb-4 rounded-xl border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Credits are running low for new generations.{" "}
          <Link href="/settings/billing?plan=standard" className="font-semibold underline">
            Add credits in Billing
          </Link>
          {" · "}
          <Link href="/settings" className="font-semibold underline">
            Account overview
          </Link>
        </p>
      )}

      {!loading && !error && jobs.length === 0 && (
        <div className="card text-sm text-skill-muted">
          <p>No generations yet.</p>
          <Link href="/app" className="btn-primary mt-4 inline-block">
            Start in quick form
          </Link>
        </div>
      )}

      {!loading && jobs.length > 0 && (
        <>
          <div
            className="mb-4 flex flex-wrap gap-2"
            role="tablist"
            aria-label="Filter jobs by status"
          >
            {JOB_FILTERS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filter === id}
                className={`rounded-full border px-3 py-1 text-sm transition ${
                  filter === id
                    ? "border-skill-blue-dark bg-skill-blue/20 font-semibold"
                    : "border-skill-blue/20 bg-white hover:bg-skill-yellow/30"
                }`}
                onClick={() => setFilter(id)}
              >
                {label} ({jobFilterCounts[id]})
              </button>
            ))}
          </div>

          <div
            className="mb-4 flex flex-wrap gap-2"
            role="tablist"
            aria-label="Filter jobs by quality tier"
          >
            {JOB_QUALITY_FILTERS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={qualityFilter === id}
                className={`rounded-full border px-3 py-1 text-sm transition ${
                  qualityFilter === id
                    ? "border-skill-blue-dark bg-skill-blue/20 font-semibold"
                    : "border-skill-blue/20 bg-white hover:bg-skill-yellow/30"
                }`}
                onClick={() => setQualityFilter(id)}
              >
                {label} ({jobQualityFilterCounts[id]})
              </button>
            ))}
          </div>

          <p className="mb-4 text-sm text-skill-muted">
            Showing {filteredJobs.length} job{filteredJobs.length === 1 ? "" : "s"} ·{" "}
            {filteredCreditsTotal.toLocaleString()} credits (charged or estimated)
          </p>

          {filteredJobs.length === 0 ? (
            <p className="text-sm text-skill-muted">
              No jobs match the current filters.
            </p>
          ) : (
            <div className="space-y-3">
              {filteredJobs.map((job) => (
            <article
              key={job.id}
              id={`job-${job.id}`}
              className={`card flex flex-col gap-4 sm:flex-row sm:items-start ${
                highlightJobId === job.id ? "ring-2 ring-skill-blue-dark" : ""
              }`}
              data-testid="job-row"
            >
              {job.output_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={job.output_url}
                  alt=""
                  className="h-24 w-24 shrink-0 rounded-xl border border-skill-blue/20 object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-dashed border-skill-blue/20 bg-skill-yellow/20 text-xs text-skill-muted">
                  {job.status === "failed" ? "Failed" : "Pending"}
                </div>
              )}

              <div className="min-w-0 flex-1 space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className={`font-semibold capitalize ${statusTone(job.status)}`}>
                    {job.status}
                  </span>
                  <span className="text-skill-muted">
                    {qualityTierLabel(job.quality_tier)}
                  </span>
                  <span className="text-skill-muted">{formatJobCreditsLabel(job)}</span>
                  <span className="text-xs text-skill-muted">
                    {new Date(job.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="line-clamp-2 text-skill-ink">{job.prompt_text}</p>
                {job.error_message && (
                  <p className="text-red-600">
                    {job.error_message}
                    {isJobInsufficientCreditsError(job.error_message) && (
                      <>
                        {" "}
                        <Link
                          href="/settings/billing?plan=standard"
                          className="underline hover:text-red-800"
                        >
                          Add credits in Billing
                        </Link>
                      </>
                    )}
                  </p>
                )}
                {job.project_id && (
                  <p className="text-xs text-skill-muted">
                    Studio project · block {job.block_id ?? "—"}
                  </p>
                )}
                <div className="flex flex-wrap gap-3 text-xs">
                  <button
                    type="button"
                    className="underline hover:text-skill-ink"
                    onClick={() => void copyJobPrompt(job)}
                  >
                    {copiedJobId === job.id ? "Prompt copied" : "Copy prompt"}
                  </button>
                  {job.output_url && (
                    <a
                      href={job.output_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-skill-ink"
                    >
                      Open output
                    </a>
                  )}
                  {job.output_url && !job.project_id && (
                    <Link
                      href={`/studio?importJob=${job.id}`}
                      className="underline hover:text-skill-ink"
                    >
                      Add to studio
                    </Link>
                  )}
                  {job.project_id && (
                    <Link href={studioJobHref(job)} className="underline hover:text-skill-ink">
                      Open studio
                    </Link>
                  )}
                </div>
              </div>
            </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
