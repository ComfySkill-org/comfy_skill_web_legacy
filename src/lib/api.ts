const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function getApiBaseUrl(): string {
  return API_URL;
}

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
  project_id?: string | null;
  block_id?: string | null;
}

export interface ProjectSummary {
  id: string;
  title: string;
  view_mode: "workflow" | "storyboard";
  updated_at: string | null;
  block_count: number;
}

export interface ApiProjectBlock {
  id: string;
  type: "image" | "text" | "video";
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  body_text: string | null;
  media_urls: string[];
  status: string;
  job_id: string | null;
  params: Record<string, unknown>;
}

export interface ApiProjectEdge {
  id: string;
  source_block_id: string;
  target_block_id: string;
}

export interface ApiProject {
  id: string;
  title: string;
  viewport: { x: number; y: number; zoom: number };
  view_mode: "workflow" | "storyboard";
  blocks: ApiProjectBlock[];
  edges: ApiProjectEdge[];
  created_at: string | null;
  updated_at: string | null;
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

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
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
    throw new ApiError(typeof detail === "string" ? detail : res.statusText, res.status);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export const apiClient = {
  login: (email: string, password: string) =>
    api<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => api<User>("/me"),

  createJob: (
    prompt: string,
    quality_tier: QualityTier,
    opts?: { project_id?: string; block_id?: string },
  ) =>
    api<{ job: Job; credits_estimate: number }>("/jobs", {
      method: "POST",
      body: JSON.stringify({
        prompt,
        quality_tier,
        project_id: opts?.project_id ?? null,
        block_id: opts?.block_id ?? null,
      }),
    }),

  getJob: (id: string) => api<Job>(`/jobs/${id}`),

  getJobEvents: (id: string) =>
    api<{
      job_id: string;
      events: Array<{
        id: string;
        event_type: string;
        payload: Record<string, unknown> | null;
        created_at: string;
      }>;
      total: number;
    }>(`/jobs/${id}/events`),

  listJobs: () => api<{ jobs: Job[]; total: number }>("/jobs"),

  listProjects: () => api<ProjectSummary[]>("/projects"),

  createProject: (title: string) =>
    api<ApiProject>("/projects", {
      method: "POST",
      body: JSON.stringify({ title }),
    }),

  getProject: (id: string) => api<ApiProject>(`/projects/${id}`),

  putProject: (
    id: string,
    body: {
      title: string;
      viewport: { x: number; y: number; zoom: number };
      view_mode: "workflow" | "storyboard";
      blocks: Array<Record<string, unknown>>;
      edges: Array<Record<string, unknown>>;
    },
  ) =>
    api<ApiProject>(`/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  deleteProject: (id: string) =>
    api<void>(`/projects/${id}`, {
      method: "DELETE",
    }),

  balance: () => api<{ balance_credits: number }>("/billing/balance"),

  transactions: () => api<{ transactions: Transaction[] }>("/billing/transactions"),

  stripeStatus: () =>
    api<{
      configured: boolean;
      price_configured: boolean;
      price_looks_valid?: boolean;
      mode: string;
      plans?: Record<string, boolean>;
    }>("/billing/stripe/status"),

  createCheckout: (planId: "standard" | "creator" | "pro" = "standard") =>
    api<{ checkout_url: string }>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan_id: planId }),
    }),

  createEmbeddedCheckout: (planId: "standard" | "creator" | "pro" = "standard") =>
    api<{ client_secret: string }>("/billing/checkout/embedded", {
      method: "POST",
      body: JSON.stringify({ plan_id: planId }),
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
