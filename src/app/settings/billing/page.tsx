"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiClient, getToken } from "@/lib/api";

export default function BillingPage() {
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiClient.balance().then((b) => setBalance(b.balance_credits));
  }, [router]);

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">Billing & usage</h1>
      <div className="card space-y-4">
        <p>
          Current balance:{" "}
          <span className="text-xl font-bold">{balance ?? "…"} credits</span>
        </p>
        <p className="text-sm text-skill-muted">
          Stripe subscription checkout will be enabled in Phase 2. Credits are deducted per
          generation based on quality tier.
        </p>
        <Link href="/pricing" className="btn-secondary inline-block">
          View plans
        </Link>
      </div>
    </div>
  );
}
