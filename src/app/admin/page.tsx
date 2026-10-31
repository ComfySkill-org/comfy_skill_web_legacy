"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiClient, getToken, type User } from "@/lib/api";
import { ApiHealthBadge } from "@/components/ApiHealthBadge";
import { StripeStatusCard } from "@/components/StripeStatusCard";
import { deriveJobHealthRates, deriveInProgressJobMetrics, formatHealthRate } from "@/lib/adminMetrics";

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [metrics, setMetrics] = useState<Awaited<ReturnType<typeof apiClient.adminMetrics>> | null>(
    null,
  );
  const [stripeStatus, setStripeStatus] = useState<Awaited<
    ReturnType<typeof apiClient.stripeStatus>
  > | null>(null);
  const [error, setError] = useState("");
  const [metricsUpdatedAt, setMetricsUpdatedAt] = useState<Date | null>(null);
  const [metricsRefreshing, setMetricsRefreshing] = useState(false);

  async function refreshDashboardMetrics() {
    setMetricsRefreshing(true);
    setError("");
    try {
      const [m, stripe] = await Promise.all([
        apiClient.adminMetrics(),
        apiClient.stripeStatus(),
      ]);
      setMetrics(m);
      setStripeStatus(stripe);
      setMetricsUpdatedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh metrics");
    } finally {
      setMetricsRefreshing(false);
    }
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiClient
      .me()
      .then((u) => {
        if (u.role !== "admin") {
          router.replace("/app");
          return;
        }
        setUser(u);
        return refreshDashboardMetrics();
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load admin dashboard"));
  }, [router]);

  const healthRates = useMemo(
    () => (metrics ? deriveJobHealthRates(metrics) : null),
    [metrics],
  );
  const inProgressMetrics = useMemo(
    () => (metrics ? deriveInProgressJobMetrics(metrics) : null),
    [metrics],
  );
  const inProgressAlert =
    inProgressMetrics !== null &&
    ((inProgressMetrics.inProgressRate ?? 0) > 0.1 || inProgressMetrics.inProgress >= 5);

  if (!user) return <div className="p-8 text-center">Loading…</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">Admin dashboard</h1>
      {error && <p className="mb-4 text-red-600">{error}</p>}
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <ApiHealthBadge variant="card" />
        <StripeStatusCard status={stripeStatus} />
      </div>
      {metrics && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-green-50 px-3 py-1 text-green-800">
                Completion {formatHealthRate(healthRates?.completionRate ?? null)}
              </span>
              <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">
                Failure {formatHealthRate(healthRates?.failureRate ?? null)}
              </span>
              {inProgressMetrics && inProgressMetrics.inProgress > 0 && (
                <span
                  className={`rounded-full px-3 py-1 ${
                    inProgressAlert
                      ? "bg-amber-50 text-amber-900"
                      : "bg-skill-blue/10 text-skill-blue-dark"
                  }`}
                >
                  In progress {formatHealthRate(inProgressMetrics.inProgressRate)} (
                  {inProgressMetrics.inProgress.toLocaleString()} jobs)
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-skill-muted">
              {metricsUpdatedAt && (
                <span>Updated {metricsUpdatedAt.toLocaleTimeString()}</span>
              )}
              <button
                type="button"
                className="underline hover:text-skill-ink disabled:opacity-50"
                disabled={metricsRefreshing}
                onClick={() => void refreshDashboardMetrics()}
              >
                {metricsRefreshing ? "Refreshing…" : "Refresh metrics"}
              </button>
            </div>
          </div>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Total jobs", value: metrics.total_jobs },
            { label: "Completed", value: metrics.completed_jobs },
            { label: "Failed", value: metrics.failed_jobs },
            { label: "Credits used today", value: metrics.credits_consumed_today },
            { label: "Active users", value: metrics.active_users },
          ].map((m) => (
            <div key={m.label} className="card text-center">
              <p className="text-2xl font-bold">{m.value}</p>
              <p className="text-sm text-skill-muted">{m.label}</p>
            </div>
          ))}
          </div>
        </>
      )}
      <div className="flex flex-wrap gap-3">
        <a href="/admin/jobs" className="btn-primary">
          All jobs
        </a>
        <a href="/admin/users" className="btn-secondary">
          Users
        </a>
      </div>
      <p className="mt-4 text-sm text-skill-muted">
        Grant credits to individual accounts from the Users page. Failed jobs with canvas links
        open the bound studio block from All jobs.
      </p>
    </div>
  );
}
