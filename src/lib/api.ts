const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

function authHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("comfyskill_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  login: (email: string, password: string) =>
    api<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, name: string) =>
    api<User>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
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
  return localStorage.getItem("comfyskill_token");
}
