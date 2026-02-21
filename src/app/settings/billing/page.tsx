"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import {
  apiClient,
  getToken,
  isFirebaseEnabled,
  type Transaction,
} from "@/lib/api";
import { getFirebaseAuth, subscribeToAuthToken } from "@/lib/firebase";

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

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
        const [balanceResult, transactionsResult, statusResult] = await Promise.all([
          apiClient.balance(),
          apiClient.transactions(),
          apiClient.stripeStatus(),
        ]);
        setBalance(balanceResult.balance_credits);
        setTransactions(transactionsResult.transactions);
        setStripeStatus(statusResult);
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "1") {
      setMessage("Checkout completed. Credits will update after the Stripe webhook is received.");
    }
    if (params.get("session_id")) {
      setMessage("Payment submitted. Credits will update after the Stripe webhook is received.");
    }
    if (params.get("canceled") === "1") {
      setMessage("Checkout was canceled.");
    }
  }, []);

  const stripeReady = Boolean(stripeStatus?.configured && stripeStatus.price_configured);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">Billing & usage</h1>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="card space-y-4">
          <div>
            <p className="text-sm text-skill-muted">Current balance</p>
            <p className="text-3xl font-bold">{balance ?? "..."} credits</p>
          </div>
          <div className="rounded-xl bg-skill-yellow/40 p-3 text-sm">
            Stripe mode:{" "}
            <span className="font-semibold capitalize">{stripeStatus?.mode ?? "loading"}</span>
            <br />
            Checkout:{" "}
            <span className="font-semibold">{stripeReady ? "configured" : "not ready"}</span>
          </div>
          {message && <p className="text-sm text-skill-blue-dark">{message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-primary"
              disabled={!stripeReady || checkoutLoading || Boolean(embeddedClientSecret)}
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
            Plan from pricing: <span className="font-semibold capitalize">{planId}</span>
            {" "}(Standard 4,200 / Creator 7,400 / Pro 21,100 credits after webhook).
            Card details are collected by Stripe Embedded Checkout.
          </p>
        </div>

        <div className="card space-y-4">
          <h2 className="text-lg font-bold">Recent transactions</h2>
          {transactions.length ? (
            <div className="space-y-3">
              {transactions.slice(0, 8).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-start justify-between gap-4 rounded-xl border border-skill-blue/10 p-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-semibold capitalize">{tx.type}</p>
                    <p className="truncate text-xs text-skill-muted">
                      {tx.description ?? "No description"}
                    </p>
                    <p className="text-xs text-skill-muted">
                      {new Date(tx.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className={tx.amount >= 0 ? "font-bold text-green-700" : "font-bold"}>
                    {tx.amount >= 0 ? "+" : ""}
                    {tx.amount}
                  </span>
                </div>
              ))}
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
            options={{ clientSecret: embeddedClientSecret }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-skill-muted">
        <Link href="/pricing" className="underline">
          View plans
        </Link>
      </p>
    </div>
  );
}
