"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiClient, getToken, isFirebaseEnabled, type Job } from "@/lib/api";
import { QUALITY_TIER_OPTIONS } from "@/lib/credits";
import { getFirebaseAuth, subscribeToAuthToken } from "@/lib/firebase";

const QUALITY_LABELS = Object.fromEntries(
  QUALITY_TIER_OPTIONS.map(({ tier, label }) => [tier, label]),
) as Record<string, string>;

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);
  const [highlightJobId, setHighlightJobId] = useState<string | null>(null);

  const filteredJobs = useMemo(
    () => jobs.filter((job) => matchesJobFilter(job, filter)),
    [jobs, filter],
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

  const filteredCreditsTotal = useMemo(
    () =>
      filteredJobs.reduce(
        (total, job) => total + (job.credits_charged ?? job.credits_estimated),
        0,
      ),
    [filteredJobs],
  );

  useEffect(() => {
    async function loadJobs() {
      setError("");
      setLoading(true);
      try {
        const { jobs: list } = await apiClient.listJobs();
        setJobs(list);
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
      void apiClient
        .listJobs()
        .then(({ jobs: list }) => setJobs(list))
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Generation history</h1>
          <p className="text-sm text-skill-muted">
            Recent jobs from quick form and studio blocks.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <button
            type="button"
            className="underline hover:text-skill-ink disabled:opacity-50"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              void apiClient
                .listJobs()
                .then(({ jobs: list }) => setJobs(list))
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

          <p className="mb-4 text-sm text-skill-muted">
            Showing {filteredJobs.length} job{filteredJobs.length === 1 ? "" : "s"} ·{" "}
            {filteredCreditsTotal.toLocaleString()} credits
          </p>

          {filteredJobs.length === 0 ? (
            <p className="text-sm text-skill-muted">No jobs match this filter.</p>
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
                    {QUALITY_LABELS[job.quality_tier] ?? job.quality_tier}
                  </span>
                  <span className="text-skill-muted">
                    {(job.credits_charged ?? job.credits_estimated).toLocaleString()} credits
                  </span>
                  <span className="text-xs text-skill-muted">
                    {new Date(job.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="line-clamp-2 text-skill-ink">{job.prompt_text}</p>
                {job.error_message && (
                  <p className="text-red-600">{job.error_message}</p>
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
                  {job.project_id && (
                    <Link href="/studio" className="underline hover:text-skill-ink">
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
