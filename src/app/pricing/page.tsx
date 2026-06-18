import Link from "next/link";
import { QUALITY_CREDITS, QUALITY_TIER_OPTIONS } from "@/lib/credits";

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
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-2 text-center text-3xl font-bold">Pricing</h1>
      <p className="mb-10 text-center text-skill-muted">
        Monthly subscription with credits. When credits run out, upgrade or renew.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
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
            {plan.note && <p className="mt-2 text-xs text-skill-muted">{plan.note}</p>}
            <Link
              href={`/settings/billing?plan=${plan.id}`}
              className="btn-primary mt-5 w-full"
            >
              Subscribe
            </Link>
          </div>
        ))}
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
        Ready to test subscription checkout?{" "}
        <Link href="/settings/billing" className="underline">
          Open billing
        </Link>{" "}
        to subscribe with Stripe test mode. Creator/Pro use dedicated price IDs when set,
        otherwise fall back to Standard.
      </p>
    </div>
  );
}
