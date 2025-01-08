"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  apiClient,
  getApiBaseUrl,
  getToken,
  isFirebaseEnabled,
  saveToken,
} from "@/lib/api";
import { firebaseLogin, getFirebaseAuth } from "@/lib/firebase";

function readLoginPlan(): "standard" | "creator" | "pro" | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("plan");
  if (raw === "creator" || raw === "pro" || raw === "standard") return raw;
  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("tester@comfyskill.local");
  const [password, setPassword] = useState("replace-me-tester");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginPlan, setLoginPlan] = useState<"standard" | "creator" | "pro" | null>(null);
  const useFirebase = isFirebaseEnabled();

  useEffect(() => {
    setLoginPlan(readLoginPlan());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const plan = readLoginPlan();
    const destination = plan ? `/settings/billing?plan=${plan}` : "/app";

    if (useFirebase) {
      if (getFirebaseAuth()?.currentUser) router.replace(destination);
      return;
    }

    if (getToken()) router.replace(destination);
  }, [router, useFirebase]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (useFirebase) {
        await firebaseLogin(email, password);
      } else {
        const { access_token } = await apiClient.login(email, password);
        saveToken(access_token);
      }
      const plan = readLoginPlan();
      router.push(
        plan ? `/settings/billing?plan=${plan}` : "/app",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-12">
      <div className="w-full">
      <form onSubmit={onSubmit} className="card w-full space-y-4">
        <h1 className="text-2xl font-bold">Log in to ComfySkill</h1>
        <p className="text-sm text-skill-muted">
          {useFirebase
            ? "Sign in with Firebase (Comfy Cloud–aligned auth)."
            : "Legacy JWT mode — set Firebase env vars for production auth."}
        </p>
        {!useFirebase && (
          <p className="text-xs text-skill-muted">
            API endpoint:{" "}
            <code className="rounded bg-skill-yellow/40 px-1 font-mono text-skill-ink">
              {getApiBaseUrl()}
            </code>
          </p>
        )}
        {loginPlan && (
          <p className="rounded-xl border border-skill-blue/20 bg-skill-yellow/30 px-3 py-2 text-sm text-skill-ink">
            After sign-in you&apos;ll continue to Billing for the{" "}
            <span className="font-semibold capitalize">{loginPlan}</span> plan.
          </p>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <input
            className="input"
            type="email"
            name="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tester@comfyskill.local"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Password</label>
          <input
            className="input"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-skill-muted">
        <Link href="/app" className="underline hover:text-skill-ink">
          Quick form
        </Link>
        {" · "}
        <Link href="/pricing" className="underline hover:text-skill-ink">
          View pricing
        </Link>
        {" · "}
        <Link href="/studio" className="underline hover:text-skill-ink">
          Open studio
        </Link>
      </p>
      </div>
    </div>
  );
}
