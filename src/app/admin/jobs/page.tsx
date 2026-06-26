"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiClient, getToken, type Job } from "@/lib/api";
import { qualityTierLabel } from "@/lib/credits";
import {
  countJobsByStatusFilter,
  formatJobCreditsLabel,
  JOB_STATUS_FILTERS,
  matchesJobStatusFilter,
  studioJobHref,
  type JobStatusFilter,
} from "@/lib/jobs";

function statusTone(status: string): string {
  if (status === "completed") return "text-green-700";
  if (status === "failed") return "text-red-600";
  if (status === "pending" || status === "running") return "text-skill-blue-dark";
  return "text-skill-muted";
}

export default function AdminJobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<JobStatusFilter>("all");

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiClient
      .me()
      .then((u) => {
        if (u.role !== "admin") router.replace("/app");
        else return apiClient.adminJobs();
      })
      .then((r) => r && setJobs(r.jobs))
      .catch(() => router.replace("/app"));
  }, [router]);

  const filterCounts = useMemo(() => countJobsByStatusFilter(jobs), [jobs]);
  const filteredJobs = useMemo(
    () => jobs.filter((job) => matchesJobStatusFilter(job, filter)),
    [jobs, filter],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">All jobs</h1>
        <Link href="/admin" className="text-sm underline hover:text-skill-ink">
          Back to dashboard
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {JOB_STATUS_FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === id
                ? "bg-skill-blue-dark text-white"
                : "border border-skill-blue/20 text-skill-muted hover:bg-skill-yellow/30"
            }`}
          >
            {label} ({filterCounts[id]})
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-skill-blue/20 text-skill-muted">
              <th className="p-2">Created</th>
              <th className="p-2">Status</th>
              <th className="p-2">Prompt</th>
              <th className="p-2">Quality</th>
              <th className="p-2">Credits</th>
              <th className="p-2">Canvas</th>
            </tr>
          </thead>
          <tbody>
            {filteredJobs.map((job) => (
              <tr
                key={job.id}
                className={`border-b border-skill-blue/10 ${
                  job.status === "failed" ? "bg-red-50/40" : ""
                }`}
              >
                <td className="whitespace-nowrap p-2 text-xs text-skill-muted">
                  {new Date(job.created_at).toLocaleString()}
                </td>
                <td className={`p-2 capitalize ${statusTone(job.status)}`}>{job.status}</td>
                <td className="max-w-xs truncate p-2" title={job.prompt_text}>
                  {job.prompt_text}
                </td>
                <td className="p-2">{qualityTierLabel(job.quality_tier)}</td>
                <td className="p-2 text-xs text-skill-muted">{formatJobCreditsLabel(job)}</td>
                <td className="p-2">
                  {job.project_id ? (
                    <Link href={studioJobHref(job)} className="underline hover:text-skill-ink">
                      Open studio
                    </Link>
                  ) : (
                    <span className="text-skill-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
