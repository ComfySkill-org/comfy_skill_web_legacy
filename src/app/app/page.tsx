"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  apiClient,
  getToken,
  type Job,
  type QualityTier,
  type User,
} from "@/lib/api";

const QUALITY_OPTIONS: { tier: QualityTier; label: string; hint: string }[] = [
  { tier: "premium", label: "Good", hint: "Best quality · higher cost" },
  { tier: "standard", label: "Medium", hint: "Balanced" },
  { tier: "budget", label: "Budget", hint: "Fast · lower cost" },
];

export default function AppPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [prompt, setPrompt] = useState("");
  const [quality, setQuality] = useState<QualityTier>("standard");
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiClient.me().then(setUser).catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") return;
    const timer = setInterval(async () => {
      try {
        const updated = await apiClient.getJob(job.id);
        setJob(updated);
        if (updated.status === "completed" || updated.status === "failed") {
          const me = await apiClient.me();
          setUser(me);
        }
      } catch {
        /* ignore poll errors */
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [job]);

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setJob(null);
    try {
      const { job: created } = await apiClient.createJob(prompt, quality);
      setJob(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return <div className="p-8 text-center text-skill-muted">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Text → Image</h1>
        <span className="rounded-full bg-skill-yellow px-3 py-1 text-sm font-medium">
          {user.balance_credits} credits
        </span>
      </div>

      <form onSubmit={onGenerate} className="card space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium">Describe your image</label>
          <textarea
            className="input min-h-[100px] resize-y"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A cozy café on a rainy evening, warm lighting…"
            data-testid="prompt"
            required
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Quality</p>
          <div className="grid grid-cols-3 gap-2">
            {QUALITY_OPTIONS.map((opt) => (
              <button
                key={opt.tier}
                type="button"
                data-testid={`quality-${opt.tier}`}
                onClick={() => setQuality(opt.tier)}
                className={`rounded-xl border p-3 text-left text-sm transition ${
                  quality === opt.tier
                    ? "border-skill-blue-dark bg-skill-blue/20"
                    : "border-skill-blue/20 bg-white hover:bg-skill-yellow/30"
                }`}
              >
                <span className="block font-semibold">{opt.label}</span>
                <span className="text-xs text-skill-muted">{opt.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={loading}
          data-testid="generate"
        >
          {loading ? "Starting…" : "Generate"}
        </button>
      </form>

      {job && (
        <div className="card mt-6 space-y-3" data-testid="job-panel">
          <p className="text-sm">
            Status:{" "}
            <span data-testid="job-status" className="font-semibold capitalize">
              {job.status}
            </span>
          </p>
          {job.model_preset && (
            <p className="text-xs text-skill-muted">Preset: {job.model_preset}</p>
          )}
          {job.error_message && (
            <p className="text-sm text-red-600">{job.error_message}</p>
          )}
          {job.output_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={job.output_url}
              alt="Generated"
              className="max-w-full rounded-xl border border-skill-blue/20"
              data-testid="output-image"
            />
          )}
        </div>
      )}

      <p className="mt-6 text-center text-sm text-skill-muted">
        <Link href="/settings/billing" className="underline">
          Billing & usage
        </Link>
      </p>
    </div>
  );
}
