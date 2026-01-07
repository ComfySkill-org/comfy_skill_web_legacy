"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiClient, getToken, type User } from "@/lib/api";

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [metrics, setMetrics] = useState<Awaited<ReturnType<typeof apiClient.adminMetrics>> | null>(
    null,
  );
  const [error, setError] = useState("");

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
        return apiClient.adminMetrics();
      })
      .then((m) => m && setMetrics(m))
      .catch((e) => setError(e.message));
  }, [router]);

  if (!user) return <div className="p-8 text-center">Loading…</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">Admin dashboard</h1>
      {error && <p className="mb-4 text-red-600">{error}</p>}
      {metrics && (
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
        Grant credits to individual accounts from the Users page.
      </p>
    </div>
  );
}
