"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  apiClient,
  getToken,
  isFirebaseEnabled,
  type Job,
  type QualityTier,
  type User,
} from "@/lib/api";
import { QUALITY_CREDITS } from "@/lib/credits";
import { getFirebaseAuth, subscribeToAuthToken } from "@/lib/firebase";

const QUALITY_OPTIONS: { tier: QualityTier; label: string; hint: string }[] = [
  { tier: "premium", label: "Good", hint: `Best quality · ${QUALITY_CREDITS.premium} credits` },
  { tier: "standard", label: "Medium", hint: `Balanced · ${QUALITY_CREDITS.standard} credits` },
  { tier: "budget", label: "Budget", hint: `Fast · ${QUALITY_CREDITS.budget} credits` },
];

/** Legacy single-prompt form — kept for e2e; primary UX is /studio (PRD-legacy). */
export default function AppPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [prompt, setPrompt] = useState("");
  const [quality, setQuality] = useState<QualityTier>("standard");
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadUser = () => apiClient.me().then(setUser).catch(() => router.replace("/login"));

    if (isFirebaseEnabled()) {
      const unsub = subscribeToAuthToken((token) => {
        if (token) void loadUser();
        else if (!getFirebaseAuth()?.currentUser) router.replace("/login");
      });
      if (getFirebaseAuth()?.currentUser) void loadUser();
      return unsub;
    }

    const authed = isFirebaseEnabled()
      ? Boolean(getFirebaseAuth()?.currentUser)
      : Boolean(getToken());
    if (!authed) {
      router.replace("/login");
      return;
    }
    void loadUser();
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
    const creditEstimate = QUALITY_CREDITS[quality];
    if (user && user.balance_credits < creditEstimate) {
      setError(
        `Need at least ${creditEstimate} credits for this quality tier. Add credits in Billing.`,
      );
      return;
    }
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
    return <p className="p-8 text-center text-skill-muted">Loading…</p>;
  }

  const creditEstimate = QUALITY_CREDITS[quality];
  const hasInsufficientCredits = user.balance_credits < creditEstimate;
  const lowCreditBalance = user.balance_credits < QUALITY_CREDITS.budget;

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <div className="mb-6 rounded-2xl border border-skill-blue/30 bg-skill-yellow/40 p-4 text-sm">
        <p className="font-semibold text-skill-ink">Studio is the main creator</p>
        <p className="mt-1 text-skill-muted">
          Arrange shots on the canvas, link flow, and edit params on the right.
        </p>
        <Link href="/studio" className="btn-primary mt-3 inline-block">
          Open studio
        </Link>
      </div>

      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Quick generate</h1>
          <p className="text-sm text-skill-muted">Legacy single-prompt form</p>
        </div>
        <p
          className={`text-sm font-medium ${lowCreditBalance ? "text-amber-700" : ""}`}
          data-testid="credits"
        >
          {user.balance_credits.toLocaleString()} credits
        </p>
      </div>

      <form onSubmit={onGenerate} className="card space-y-4">
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

        {hasInsufficientCredits && (
          <p className="text-sm text-amber-700">
            Need {creditEstimate} credits for {quality}; you have{" "}
            {user.balance_credits.toLocaleString()}.{" "}
            <Link href="/settings/billing?plan=standard" className="underline hover:text-amber-900">
              Add credits in Billing
            </Link>
          </p>
        )}

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={loading || hasInsufficientCredits}
          data-testid="generate"
        >
          {loading
            ? "Starting…"
            : hasInsufficientCredits
              ? "Insufficient credits"
              : `Generate · ${creditEstimate} credits`}
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
        <Link href="/settings/billing?plan=standard" className="underline">
          Billing & usage
        </Link>
      </p>
    </div>
  );
}
