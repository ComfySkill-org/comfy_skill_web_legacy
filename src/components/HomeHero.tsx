"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient, clearAuth, getToken, isFirebaseEnabled, type User } from "@/lib/api";
import { getFirebaseAuth, subscribeToAuthToken } from "@/lib/firebase";

export function HomeHero() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = () =>
      apiClient
        .me()
        .then((profile) => {
          setUser(profile);
          setLoading(false);
        })
        .catch(() => {
          void clearAuth();
          setUser(null);
          setLoading(false);
        });

    if (isFirebaseEnabled()) {
      const unsub = subscribeToAuthToken((token) => {
        if (token) void loadUser();
        else {
          setUser(null);
          setLoading(false);
        }
      });
      if (getFirebaseAuth()?.currentUser) void loadUser();
      else setLoading(false);
      return unsub;
    }

    if (!getToken()) {
      setLoading(false);
      return;
    }
    void loadUser();
  }, []);

  return (
    <section className="card text-center">
      <p className="mb-3 text-sm font-medium uppercase tracking-wide text-skill-blue-dark">
        Story-first creation canvas
      </p>
      <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
        Arrange shots on a canvas. See results, not node graphs.
      </h1>
      <p className="mx-auto mb-8 max-w-2xl text-skill-muted">
        ComfySkill is built around your work — scenes, beats, and previews on an infinite
        canvas. Edit parameters in the side panel; the engine stays behind the curtain.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        {loading ? (
          <span className="btn-primary cursor-wait opacity-70">Loading…</span>
        ) : user ? (
          <>
            <Link href="/studio" className="btn-primary">
              Continue in studio
            </Link>
            <Link href="/app/jobs" className="btn-secondary">
              Generation history
            </Link>
            <Link
              href="/settings/billing?plan=standard"
              className="rounded-full border border-skill-blue/30 px-4 py-2 text-sm font-medium text-skill-ink hover:bg-skill-yellow/40"
            >
              {user.balance_credits.toLocaleString()} credits
            </Link>
          </>
        ) : (
          <>
            <Link href="/studio" className="btn-primary">
              Open studio
            </Link>
            <Link href="/login?next=/studio" className="btn-secondary">
              Log in to save &amp; generate
            </Link>
            <Link href="/pricing" className="btn-secondary">
              View pricing
            </Link>
          </>
        )}
      </div>
    </section>
  );
}

export function HomeFooterLinks() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (isFirebaseEnabled()) {
      const unsub = subscribeToAuthToken((token) => {
        setSignedIn(Boolean(token));
      });
      setSignedIn(Boolean(getFirebaseAuth()?.currentUser));
      return unsub;
    }
    setSignedIn(Boolean(getToken()));
  }, []);

  if (signedIn) {
    return (
      <p className="mt-10 text-center text-sm text-skill-muted">
        Track credit usage in{" "}
        <Link href="/app/jobs" className="underline hover:text-skill-ink">
          generation history
        </Link>
        {" · "}
        <Link href="/settings/billing" className="underline hover:text-skill-ink">
          billing &amp; usage
        </Link>
      </p>
    );
  }

  return (
    <p className="mt-10 text-center text-sm text-skill-muted">
      <Link href="/login?next=/app/jobs" className="underline hover:text-skill-ink">
        Sign in to track generation history
      </Link>
      {" · "}
      <Link href="/pricing" className="underline hover:text-skill-ink">
        View pricing
      </Link>
    </p>
  );
}
