"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient, isPlanStripeReady } from "@/lib/api";
import {
  estimateGenerations,
  PLAN_MONTHLY_CREDITS,
  QUALITY_CREDITS,
  QUALITY_TIER_OPTIONS,
} from "@/lib/credits";

const PLANS = [
  {
    id: "standard" as const,
    name: "Standard",
    price: "$20/mo",
    credits: "4,200 credits",
    note: "Similar to Comfy Cloud Standard",
  },
  {
    id: "creator" as const,
    name: "Creator",
    price: "$35/mo",
    credits: "7,400 credits",
    popular: true,
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$100/mo",
    credits: "21,100 credits",
    note: "Teams & heavy use",
  },
];

export default function PricingPage() {
  const [stripeStatus, setStripeStatus] = useState<Awaited<
    ReturnType<typeof apiClient.stripeStatus>
  > | null>(null);

  useEffect(() => {
    void apiClient
      .stripeStatus()
      .then(setStripeStatus)
      .catch(() => setStripeStatus(null));
  }, []);

  const stripeReady = Boolean(stripeStatus?.configured && stripeStatus?.price_configured);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-2 text-center text-3xl font-bold">Pricing</h1>
      <p className="mb-10 text-center text-skill-muted">
        Monthly subscription with credits. When credits run out, upgrade or renew.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const planReady = isPlanStripeReady(plan.id, stripeStatus);
          return (
            <div
              key={plan.id}
              className={`card relative ${plan.popular ? "ring-2 ring-skill-blue-dark" : ""}`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-skill-yellow px-3 py-0.5 text-xs font-semibold">
                  Popular
                </span>
              )}
              <h2 className="text-lg font-bold">{plan.name}</h2>
              <p className="mt-2 text-2xl font-bold">{plan.price}</p>
              <p className="mt-1 text-sm text-skill-muted">{plan.credits}</p>
              <p className="mt-2 text-xs text-skill-muted">
                ~
                {estimateGenerations(PLAN_MONTHLY_CREDITS[plan.id], "standard").toLocaleString()}{" "}
                Medium · ~
                {estimateGenerations(PLAN_MONTHLY_CREDITS[plan.id], "budget").toLocaleString()}{" "}
                Budget generations / mo
              </p>
              {plan.note && <p className="mt-2 text-xs text-skill-muted">{plan.note}</p>}
              {stripeStatus && stripeReady && !planReady && (
                <p className="mt-2 text-xs text-amber-800">Stripe price not configured yet</p>
              )}
              {stripeStatus === null || planReady ? (
                <Link
                  href={`/login?plan=${plan.id}`}
                  className="btn-primary mt-5 w-full"
                >
                  Subscribe
                </Link>
              ) : (
                <span className="btn-secondary mt-5 inline-block w-full cursor-not-allowed text-center opacity-70">
                  Unavailable
                </span>
              )}
            </div>
          );
        })}
      </div>
      <section className="mt-12">
        <h2 className="text-center text-xl font-bold">Generation costs</h2>
        <p className="mb-6 mt-2 text-center text-sm text-skill-muted">
          Credits deducted per image generation by quality tier.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {QUALITY_TIER_OPTIONS.map(({ tier, label }) => (
            <div key={tier} className="card text-center">
              <p className="font-semibold">{label}</p>
              <p className="mt-1 text-2xl font-bold">{QUALITY_CREDITS[tier]}</p>
              <p className="text-xs text-skill-muted">credits / generation</p>
            </div>
          ))}
        </div>
      </section>
      <p className="mt-8 text-center text-sm text-skill-muted">
        Subscribe starts with sign-in, then continues in Billing with Stripe test mode.{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
        {" · "}
        <Link href="/settings/billing" className="underline">
          Open billing
        </Link>
        . Creator/Pro use dedicated price IDs when set, otherwise fall back to Standard.
        Generations are blocked with HTTP 402 when your balance cannot cover the selected quality
        tier.
      </p>
    </div>
  );
}
