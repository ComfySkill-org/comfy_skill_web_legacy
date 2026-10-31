"use client";

import Link from "next/link";
import { isPlanStripeReady } from "@/lib/api";
import { PLAN_MONTHLY_CREDITS } from "@/lib/credits";

type StripeStatus = {
  configured?: boolean;
  price_configured?: boolean;
  price_looks_valid?: boolean;
  mode?: string;
  plans?: Record<string, boolean>;
};

const PLAN_LABELS = [
  { id: "standard" as const, label: "Standard" },
  { id: "creator" as const, label: "Creator" },
  { id: "pro" as const, label: "Pro" },
];

export function StripeStatusCard({ status }: { status: StripeStatus | null }) {
  if (!status) {
    return (
      <div className="card text-sm text-skill-muted">
        <p className="font-semibold text-skill-ink">Stripe checkout</p>
        <p className="mt-2">Loading Stripe configuration…</p>
      </div>
    );
  }

  const stripeReady = Boolean(status.configured && status.price_configured);
  const priceMisconfigured = Boolean(
    status.price_configured && status.price_looks_valid === false,
  );

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Stripe checkout</p>
          <p className="mt-1 text-xs text-skill-muted">
            Mode: <span className="capitalize">{status.mode ?? "unknown"}</span>
            {" · "}
            {stripeReady ? "Configured" : "Not ready"}
          </p>
        </div>
        <Link href="/settings/billing" className="text-xs underline hover:text-skill-ink">
          Open billing
        </Link>
      </div>
      {priceMisconfigured && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Standard price ID looks invalid — set <code>STRIPE_PRICE_STANDARD</code> to a{" "}
          <code>price_…</code> id.
        </p>
      )}
      <ul className="grid gap-2 sm:grid-cols-3">
        {PLAN_LABELS.map((plan) => {
          const ready = isPlanStripeReady(plan.id, status);
          return (
            <li
              key={plan.id}
              className={`rounded-xl border px-3 py-2 text-xs ${
                ready ? "border-green-500/30 bg-green-50" : "border-skill-blue/20 bg-white"
              }`}
            >
              <p className="font-semibold">{plan.label}</p>
              <p className="mt-1 text-skill-muted">
                {PLAN_MONTHLY_CREDITS[plan.id].toLocaleString()} credits/mo
              </p>
              <p className="mt-1">{ready ? "Price ready" : "Price missing"}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
