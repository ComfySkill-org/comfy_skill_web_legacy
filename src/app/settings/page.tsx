"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiClient, getToken, isFirebaseEnabled, type User } from "@/lib/api";
import { isLowCreditBalance } from "@/lib/credits";
import { getFirebaseAuth, subscribeToAuthToken } from "@/lib/firebase";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadUser() {
      setError("");
      try {
        setUser(await apiClient.me());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load account");
        router.replace("/login");
      }
    }

    if (isFirebaseEnabled()) {
      const unsub = subscribeToAuthToken((token) => {
        if (token) void loadUser();
        else if (!getFirebaseAuth()?.currentUser) router.replace("/login");
      });
      if (getFirebaseAuth()?.currentUser) void loadUser();
      return unsub;
    }

    if (!getToken()) {
      router.replace("/login");
      return;
    }
    void loadUser();
  }, [router]);

  if (!user) {
    return <p className="p-8 text-center text-skill-muted">Loading account…</p>;
  }

  const lowBalance = isLowCreditBalance(user.balance_credits);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">Account</h1>
      <p className="mb-6 text-sm text-skill-muted">
        Profile, credits, and shortcuts to studio tools.
      </p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="card space-y-4">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-skill-blue-dark text-lg font-bold text-white">
            {(user.name || user.email).trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{user.name}</p>
            <p className="truncate text-sm text-skill-muted">{user.email}</p>
          </div>
        </div>

        <dl className="grid gap-3 border-t border-skill-blue/10 pt-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-skill-muted">Role</dt>
            <dd className="font-semibold capitalize">{user.role}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-skill-muted">Credits</dt>
            <dd className={lowBalance ? "font-semibold text-amber-700" : "font-semibold"}>
              {user.balance_credits.toLocaleString()}
            </dd>
          </div>
        </dl>

        {lowBalance && (
          <p className="rounded-xl border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Balance is low for new generations.{" "}
            <Link href="/settings/billing?plan=standard" className="font-semibold underline">
              Add credits in Billing
            </Link>
          </p>
        )}
      </div>

      <nav className="mt-6 grid gap-3 sm:grid-cols-2">
        {[
          { href: "/studio", label: "Studio", desc: "Canvas workflow and storyboard" },
          { href: "/app/jobs", label: "Generation history", desc: "Recent jobs and outputs" },
          {
            href: "/settings/billing?plan=standard",
            label: "Billing & usage",
            desc: "Subscribe and view transactions",
          },
          { href: "/app", label: "Quick form", desc: "Legacy single-prompt generator" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="card block transition hover:bg-skill-yellow/20"
          >
            <p className="font-semibold">{item.label}</p>
            <p className="mt-1 text-sm text-skill-muted">{item.desc}</p>
          </Link>
        ))}
      </nav>
    </div>
  );
}
