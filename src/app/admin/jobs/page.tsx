"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiClient, getToken, type Job } from "@/lib/api";

export default function AdminJobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);

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

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">All jobs</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-skill-blue/20 text-skill-muted">
              <th className="p-2">Status</th>
              <th className="p-2">Prompt</th>
              <th className="p-2">Quality</th>
              <th className="p-2">Model preset</th>
              <th className="p-2">Credits</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-b border-skill-blue/10">
                <td className="p-2 capitalize">{j.status}</td>
                <td className="max-w-xs truncate p-2">{j.prompt_text}</td>
                <td className="p-2">{j.quality_tier}</td>
                <td className="p-2">{j.model_preset ?? "—"}</td>
                <td className="p-2">{j.credits_charged ?? j.credits_estimated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
