"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient, clearAuth, getToken, isFirebaseEnabled, type User } from "@/lib/api";
import { QUALITY_CREDITS, QUALITY_TIER_OPTIONS } from "@/lib/credits";
import { getFirebaseAuth, subscribeToAuthToken } from "@/lib/firebase";

export default function FeaturesPage() {
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
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-3xl font-bold">Features</h1>
      <p className="mb-6 text-sm text-skill-muted">
        Arrange beats, link shots, and generate results into canvas blocks — not a node graph.
      </p>
      <div className="space-y-4">
        <div className="card">
          <h2 className="font-semibold">Studio canvas</h2>
          <p className="mt-2 text-sm text-skill-muted">
            Infinite canvas for shots and beats. See flow relationships and generation results
            (image / text) on the board; change prompts and quality in the right panel only.
          </p>
        </div>
        <div className="card">
          <h2 className="font-semibold">Skill openings</h2>
          <p className="mt-2 text-sm text-skill-muted">
            Start from productized templates — Pixar-style short, viral remake, scene beat —
            then refine on the canvas without learning ComfyUI nodes.
          </p>
        </div>
        <div className="card">
          <h2 className="font-semibold">Credits & billing</h2>
          <p className="mt-2 text-sm text-skill-muted">
            Subscribe for monthly credits. Pick a quality tier when you generate —{" "}
            {QUALITY_TIER_OPTIONS.map(({ tier, label }, index) => (
              <span key={tier}>
                {index > 0 ? " · " : ""}
                {label} ({QUALITY_CREDITS[tier]} credits)
              </span>
            ))}
            .
          </p>
          <p className="mt-2 text-sm text-skill-muted">
            When your balance is too low, generation requests return HTTP 402 and the app
            prompts you to add credits in Billing before trying again.
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <Link href="/pricing" className="underline hover:text-skill-ink">
              View pricing
            </Link>
            <Link href="/settings/billing" className="underline hover:text-skill-ink">
              Manage billing
            </Link>
          </div>
        </div>
        <div className="card opacity-70">
          <h2 className="font-semibold">Coming soon — Video blocks</h2>
          <p className="mt-2 text-sm text-skill-muted">
            Short motion and frame sequences as first-class canvas results.
          </p>
        </div>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        {loading ? (
          <span className="btn-primary cursor-wait opacity-70">Loading…</span>
        ) : user ? (
          <>
            <Link href="/studio" className="btn-primary">
              Continue in studio
            </Link>
            <Link href="/settings/billing?plan=standard" className="btn-secondary">
              Billing &amp; usage
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
          </>
        )}
      </div>
    </div>
  );
}
