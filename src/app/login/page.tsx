"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiClient, getToken, isFirebaseEnabled, saveToken } from "@/lib/api";
import { firebaseLogin } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("tester@comfyskill.local");
  const [password, setPassword] = useState("replace-me-tester");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const useFirebase = isFirebaseEnabled();

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
      router.push("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  if (typeof window !== "undefined" && !useFirebase && getToken()) {
    router.replace("/app");
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-12">
      <form onSubmit={onSubmit} className="card w-full space-y-4">
        <h1 className="text-2xl font-bold">Log in to ComfySkill</h1>
        <p className="text-sm text-skill-muted">
          {useFirebase
            ? "Sign in with Firebase (Comfy Cloud–aligned auth)."
            : "Legacy JWT mode — set Firebase env vars for production auth."}
        </p>
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
    </div>
  );
}
