"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import {
  apiClient,
  getToken,
  isFirebaseEnabled,
  isPlanStripeReady,
  type Transaction,
} from "@/lib/api";
import {
  estimateGenerations,
  isLowCreditBalance,
  PLAN_MONTHLY_CREDITS,
  QUALITY_CREDITS,
  QUALITY_TIER_OPTIONS,
} from "@/lib/credits";
import { getFirebaseAuth, subscribeToAuthToken } from "@/lib/firebase";
import {
  countTransactionsByFilter,
  formatTransactionType,
  matchesTransactionFilter,
  summarizeTransactions,
  TRANSACTION_FILTERS,
  transactionAmountClassName,
  transactionHighlightJobId,
  type TransactionFilter,
} from "@/lib/transactions";
import { pollBalanceAfterCheckout } from "@/lib/billingPoll";

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

const BILLING_PLANS: {
  id: "standard" | "creator" | "pro";
  label: string;
  price: string;
}[] = [
  { id: "standard", label: "Standard", price: "$20/mo" },
  { id: "creator", label: "Creator", price: "$35/mo" },
  { id: "pro", label: "Pro", price: "$100/mo" },
];

export default function BillingPage() {
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stripeStatus, setStripeStatus] = useState<Awaited<
    ReturnType<typeof apiClient.stripeStatus>
  > | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [embeddedClientSecret, setEmbeddedClientSecret] = useState("");
  const [planId, setPlanId] = useState<"standard" | "creator" | "pro">("standard");
  const [transactionFilter, setTransactionFilter] = useState<TransactionFilter>("all");

  function selectPlan(id: "standard" | "creator" | "pro") {
    setPlanId(id);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("plan", id);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = new URLSearchParams(window.location.search).get("plan");
    if (raw === "creator" || raw === "pro" || raw === "standard") {
      setPlanId(raw);
    }
  }, []);

  useEffect(() => {
    async function loadBilling() {
      setError("");
      try {
        await refreshBillingSnapshot();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load billing");
        router.replace("/login");
      }
    }

    if (isFirebaseEnabled()) {
      const unsub = subscribeToAuthToken((token) => {
        if (token) void loadBilling();
        else if (!getFirebaseAuth()?.currentUser) router.replace("/login");
      });
      if (getFirebaseAuth()?.currentUser) void loadBilling();
      return unsub;
    }

    if (getToken()) {
      void loadBilling();
      return;
    }

    router.replace("/login");
  }, [router]);

  useEffect(() => {
    function refreshOnReturn() {
      void refreshBillingSnapshot().catch(() => undefined);
    }

    function onWindowFocus() {
      refreshOnReturn();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") refreshOnReturn();
    }

    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  async function refreshBillingSnapshot() {
    const [balanceResult, transactionsResult, statusResult] = await Promise.all([
      apiClient.balance(),
      apiClient.transactions(),
      apiClient.stripeStatus(),
    ]);
    setBalance(balanceResult.balance_credits);
    setTransactions(transactionsResult.transactions);
    setStripeStatus(statusResult);
    return balanceResult.balance_credits;
  }

  async function startCheckout() {
    setCheckoutLoading(true);
    setError("");
    setMessage("");
    if (!stripePromise) {
      setError("Stripe publishable key is missing — set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.");
      setCheckoutLoading(false);
      return;
    }
    try {
      const { client_secret } = await apiClient.createEmbeddedCheckout(planId);
      setEmbeddedClientSecret(client_secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start checkout");
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function openBillingPortal() {
    setPortalLoading(true);
    setError("");
    setMessage("");
    try {
      const { portal_url } = await apiClient.createBillingPortal();
      window.location.href = portal_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open billing portal");
    } finally {
      setPortalLoading(false);
    }
  }

  async function waitForCheckoutCredits(baseline: number) {
    try {
      const updated = await pollBalanceAfterCheckout(baseline);
      setBalance(updated);
      await refreshBillingSnapshot();
      setMessage("Credits applied — balance updated.");
    } catch {
      setMessage(
        "Checkout completed. Credits will update after the Stripe webhook is received. Refresh if needed.",
      );
      void refreshBillingSnapshot().catch(() => undefined);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "1" || params.get("session_id")) {
      setMessage("Checkout completed — waiting for credits…");
      void refreshBillingSnapshot()
        .then((baseline) => waitForCheckoutCredits(baseline))
        .catch(() => {
          setMessage(
            "Checkout completed. Credits will update after the Stripe webhook is received.",
          );
        });
    }
    if (params.get("canceled") === "1") {
      setMessage("Checkout was canceled.");
    }
  }, []);

  function handleEmbeddedCheckoutComplete() {
    setEmbeddedClientSecret("");
    const baseline = balance ?? 0;
    setMessage("Checkout completed — waiting for credits…");
    void waitForCheckoutCredits(baseline);
  }

  const stripeReady = Boolean(stripeStatus?.configured && stripeStatus.price_configured);
  const selectedPlanReady = isPlanStripeReady(planId, stripeStatus);
  const stripePriceMisconfigured = Boolean(
    stripeStatus?.price_configured && stripeStatus.price_looks_valid === false,
  );
  const ledgerSummary = useMemo(
    () => summarizeTransactions(transactions),
    [transactions],
  );
  const filteredTransactions = useMemo(
    () => transactions.filter((tx) => matchesTransactionFilter(tx, transactionFilter)),
    [transactions, transactionFilter],
  );
  const filteredLedgerSummary = useMemo(
    () => summarizeTransactions(filteredTransactions),
    [filteredTransactions],
  );
  const transactionFilterCounts = useMemo(
    () => countTransactionsByFilter(transactions),
    [transactions],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">Billing & usage</h1>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="card space-y-4">
          <div>
            <p className="text-sm text-skill-muted">Current balance</p>
            <p className="text-3xl font-bold">{balance ?? "..."} credits</p>
            {balance !== null && (
              <p className="mt-1 text-xs text-skill-muted">
                ~
                {estimateGenerations(balance, "standard").toLocaleString()} Medium · ~
                {estimateGenerations(balance, "budget").toLocaleString()} Budget generations
                remaining
              </p>
            )}
          </div>
          {balance !== null && isLowCreditBalance(balance) && (
            <p className="rounded-xl border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Low balance — you need at least {QUALITY_CREDITS.budget} credits for Budget or{" "}
              {QUALITY_CREDITS.standard} for Medium generations.{" "}
              <button
                type="button"
                className="font-semibold underline"
                disabled={!stripeReady || checkoutLoading || Boolean(embeddedClientSecret)}
                onClick={() => void startCheckout()}
              >
                Subscribe to add credits
              </button>
            </p>
          )}
          <div className="rounded-xl border border-skill-blue/10 p-3 text-sm">
            <p className="font-semibold">Generation costs</p>
            <ul className="mt-2 space-y-1 text-skill-muted">
              {QUALITY_TIER_OPTIONS.map(({ tier, label }) => (
                <li key={tier} className="flex justify-between gap-4">
                  <span>{label}</span>
                  <span className="font-semibold text-skill-ink">
                    {QUALITY_CREDITS[tier]} credits
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-skill-yellow/40 p-3 text-sm">
            Stripe mode:{" "}
            <span className="font-semibold capitalize">{stripeStatus?.mode ?? "loading"}</span>
            <br />
            Checkout:{" "}
            <span className="font-semibold">{stripeReady ? "configured" : "not ready"}</span>
          </div>
          {stripePriceMisconfigured && (
            <p className="rounded-xl border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Stripe price ID looks invalid — set <code>STRIPE_PRICE_STANDARD</code> to a{" "}
              <code>price_…</code> id, not <code>prod_…</code>.
            </p>
          )}
          <div>
            <p className="mb-2 text-sm font-semibold">Subscription plan</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {BILLING_PLANS.map((plan) => {
                const monthlyCredits = PLAN_MONTHLY_CREDITS[plan.id];
                const selected = planId === plan.id;
                const planReady = isPlanStripeReady(plan.id, stripeStatus);
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => selectPlan(plan.id)}
                    className={`rounded-xl border p-3 text-left text-sm transition ${
                      selected
                        ? "border-skill-blue-dark bg-skill-blue/20"
                        : "border-skill-blue/20 bg-white hover:bg-skill-yellow/30"
                    } ${!planReady ? "opacity-70" : ""}`}
                  >
                    <span className="block font-semibold">{plan.label}</span>
                    <span className="text-xs text-skill-muted">{plan.price}</span>
                    {!planReady && stripeReady && (
                      <span className="mt-1 block text-xs text-amber-800">
                        Price ID not configured
                      </span>
                    )}
                    <span className="mt-1 block text-xs text-skill-muted">
                      {monthlyCredits.toLocaleString()} credits · ~
                      {estimateGenerations(monthlyCredits, "standard").toLocaleString()} Medium / mo
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {stripeReady && !selectedPlanReady && (
            <p className="text-xs text-amber-800">
              The selected plan needs its own Stripe price ID, or falls back to Standard when configured.
            </p>
          )}
          {message && <p className="text-sm text-skill-blue-dark">{message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-primary"
              disabled={!selectedPlanReady || checkoutLoading || Boolean(embeddedClientSecret)}
              onClick={() => void startCheckout()}
            >
              {checkoutLoading ? "Starting..." : `Subscribe (${planId})`}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={!stripeStatus?.configured || portalLoading}
              onClick={() => void openBillingPortal()}
            >
              {portalLoading ? "Opening..." : "Manage billing"}
            </button>
          </div>
          <p className="text-xs text-skill-muted">
            Credits post to your balance after the Stripe webhook. Card details are collected by
            Stripe Embedded Checkout.
          </p>
        </div>

        <div className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Recent transactions</h2>
            <Link href="/app/jobs" className="text-sm underline hover:text-skill-ink">
              Generation history
            </Link>
          </div>
          {transactions.length > 0 && (
            <p className="text-sm text-skill-muted">
              Ledger total: +{ledgerSummary.creditsIn.toLocaleString()} in · −
              {ledgerSummary.creditsOut.toLocaleString()} used
            </p>
          )}
          {transactions.length > 0 && (
            <div
              className="flex flex-wrap gap-2"
              role="tablist"
              aria-label="Filter transactions by type"
            >
              {TRANSACTION_FILTERS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={transactionFilter === id}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    transactionFilter === id
                      ? "border-skill-blue-dark bg-skill-blue/20 font-semibold"
                      : "border-skill-blue/20 bg-white hover:bg-skill-yellow/30"
                  }`}
                  onClick={() => setTransactionFilter(id)}
                >
                  {label} ({transactionFilterCounts[id]})
                </button>
              ))}
            </div>
          )}
          {filteredTransactions.length > 0 && transactionFilter !== "all" && (
            <p className="text-xs text-skill-muted">
              Filtered: +{filteredLedgerSummary.creditsIn.toLocaleString()} in · −
              {filteredLedgerSummary.creditsOut.toLocaleString()} used
            </p>
          )}
          {transactions.length ? (
            <div className="space-y-3">
              {filteredTransactions.length === 0 ? (
                <p className="text-sm text-skill-muted">No transactions match this filter.</p>
              ) : (
                filteredTransactions.slice(0, 8).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-start justify-between gap-4 rounded-xl border border-skill-blue/10 p-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-semibold">{formatTransactionType(tx.type)}</p>
                    <p className="truncate text-xs text-skill-muted">
                      {tx.description ?? "No description"}
                    </p>
                    <p className="text-xs text-skill-muted">
                      {new Date(tx.created_at).toLocaleString()}
                    </p>
                    {transactionHighlightJobId(tx) && (
                      <Link
                        href={`/app/jobs?job=${transactionHighlightJobId(tx)}`}
                        className="mt-1 inline-block text-xs underline hover:text-skill-ink"
                      >
                        View generation
                      </Link>
                    )}
                  </div>
                  <span className={transactionAmountClassName(tx.amount)}>
                    {tx.amount >= 0 ? "+" : ""}
                    {tx.amount.toLocaleString()}
                  </span>
                </div>
                ))
              )}
            </div>
          ) : (
            <p className="text-sm text-skill-muted">No billing transactions yet.</p>
          )}
        </div>
      </div>

      {embeddedClientSecret && stripePromise && (
        <div className="card mt-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">Secure payment</h2>
              <p className="text-sm text-skill-muted">
                Use Stripe test card 4242 4242 4242 4242. Stripe securely collects payment method,
                name, and billing address.
              </p>
            </div>
            <button
              type="button"
              className="text-sm text-skill-muted underline hover:text-skill-ink"
              onClick={() => setEmbeddedClientSecret("")}
            >
              Close
            </button>
          </div>
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{
              clientSecret: embeddedClientSecret,
              onComplete: handleEmbeddedCheckoutComplete,
            }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-skill-muted">
        <Link href="/settings" className="underline">
          Account settings
        </Link>
        {" · "}
        <Link href="/pricing" className="underline">
          View plans
        </Link>
      </p>
    </div>
  );
}
