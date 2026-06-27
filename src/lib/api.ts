const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

import {
  firebaseLogout,
  getFirebaseIdToken,
  isFirebaseEnabled,
} from "@/lib/firebase";

export type QualityTier = "premium" | "standard" | "budget";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "tester" | "user";
  balance_credits: number;
}

export interface Job {
  id: string;
  capability: string;
  prompt_text: string;
  quality_tier: QualityTier;
  status: string;
  model_preset: string | null;
  credits_estimated: number;
  credits_charged: number | null;
  output_url: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  job_id: string | null;
  created_at: string;
}

async function authHeaders(forceRefresh = false): Promise<HeadersInit> {
  if (isFirebaseEnabled()) {
    const token = await getFirebaseIdToken(forceRefresh);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("comfyskill_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const request = async (forceRefresh = false) =>
    fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders(forceRefresh)),
        ...init?.headers,
      },
    });

  let res = await request();
  if (res.status === 401 && isFirebaseEnabled()) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    res = await request(true);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body.detail;
    throw new Error(typeof detail === "string" ? detail : res.statusText);
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  login: (email: string, password: string) =>
    api<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => api<User>("/me"),

  createJob: (prompt: string, quality_tier: QualityTier) =>
    api<{ job: Job; credits_estimate: number }>("/jobs", {
      method: "POST",
      body: JSON.stringify({ prompt, quality_tier }),
    }),

  getJob: (id: string) => api<Job>(`/jobs/${id}`),

  listJobs: () => api<{ jobs: Job[]; total: number }>("/jobs"),

  balance: () => api<{ balance_credits: number }>("/billing/balance"),

  transactions: () => api<{ transactions: Transaction[] }>("/billing/transactions"),

  stripeStatus: () =>
    api<{ configured: boolean; price_configured: boolean; mode: string }>(
      "/billing/stripe/status",
    ),

  createCheckout: () =>
    api<{ checkout_url: string }>("/billing/checkout", {
      method: "POST",
    }),

  createEmbeddedCheckout: () =>
    api<{ client_secret: string }>("/billing/checkout/embedded", {
      method: "POST",
    }),

  createBillingPortal: () =>
    api<{ portal_url: string }>("/billing/portal", {
      method: "POST",
    }),

  adminJobs: () => api<{ jobs: Job[]; total: number }>("/admin/jobs"),

  adminUsers: () =>
    api<{
      users: Array<{
        id: string;
        email: string;
        name: string;
        role: string;
        balance_credits: number;
        created_at: string;
      }>;
    }>("/admin/users"),

  adminMetrics: () =>
    api<{
      total_jobs: number;
      completed_jobs: number;
      failed_jobs: number;
      credits_consumed_today: number;
      active_users: number;
    }>("/admin/metrics"),
};

export function saveToken(token: string) {
  localStorage.setItem("comfyskill_token", token);
}

export function clearToken() {
  localStorage.removeItem("comfyskill_token");
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  if (isFirebaseEnabled()) return null;
  return localStorage.getItem("comfyskill_token");
}

export async function clearAuth(): Promise<void> {
  clearToken();
  if (isFirebaseEnabled()) await firebaseLogout();
}

export { isFirebaseEnabled };
