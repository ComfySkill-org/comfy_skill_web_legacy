import type { ProjectSummary, QualityTier } from "@/lib/api";

export type ProjectViewFilter = ProjectSummary["view_mode"] | "all";
export type ProjectSort = "updated-desc" | "updated-asc" | "title-asc" | "title-desc";

export const SNAP_KEY = "comfyskill.studio.snap-to-grid";
export const PROJECT_LIST_KEY = "comfyskill.studio.project-list";
export const HAND_TOOL_KEY = "comfyskill.studio.hand-tool";
export const REMEMBER_HAND_TOOL_KEY = "comfyskill.studio.remember-hand-tool";
export const DEFAULT_QUALITY_KEY = "comfyskill.studio.default-quality";

const DEFAULT_QUALITY_FALLBACK: QualityTier = "standard";

export function readSnapToGrid(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SNAP_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeSnapToGrid(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SNAP_KEY, String(enabled));
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
}

export function readProjectListPrefs(): {
  view: ProjectViewFilter | null;
  sort: ProjectSort | null;
} {
  if (typeof window === "undefined") return { view: null, sort: null };
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(PROJECT_LIST_KEY) ?? "null");
    if (typeof stored !== "object" || stored === null) return { view: null, sort: null };
    const preference = stored as Record<string, unknown>;
    const view =
      preference.view === "all" ||
      preference.view === "workflow" ||
      preference.view === "storyboard"
        ? preference.view
        : null;
    let sort: ProjectSort | null = null;
    if (
      preference.sort === "updated-desc" ||
      preference.sort === "updated-asc" ||
      preference.sort === "title-asc" ||
      preference.sort === "title-desc"
    ) {
      sort = preference.sort;
    } else if (preference.sort === "updated") {
      sort = "updated-desc";
    } else if (preference.sort === "title") {
      sort = "title-asc";
    }
    return { view, sort };
  } catch {
    return { view: null, sort: null };
  }
}

export function writeProjectListPrefs(view: ProjectViewFilter, sort: ProjectSort): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PROJECT_LIST_KEY, JSON.stringify({ view, sort }));
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
}

export function readRememberHandTool(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(REMEMBER_HAND_TOOL_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeRememberHandTool(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REMEMBER_HAND_TOOL_KEY, String(enabled));
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
}

export function readHandToolActive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const storage = readRememberHandTool() ? localStorage : sessionStorage;
    return storage.getItem(HAND_TOOL_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeHandToolActive(active: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const storage = readRememberHandTool() ? localStorage : sessionStorage;
    storage.setItem(HAND_TOOL_KEY, active ? "1" : "0");
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
}

export function readDefaultQualityTier(): QualityTier {
  if (typeof window === "undefined") return DEFAULT_QUALITY_FALLBACK;
  try {
    const raw = localStorage.getItem(DEFAULT_QUALITY_KEY);
    if (raw === "premium" || raw === "standard" || raw === "budget") return raw;
    return DEFAULT_QUALITY_FALLBACK;
  } catch {
    return DEFAULT_QUALITY_FALLBACK;
  }
}

export function writeDefaultQualityTier(tier: QualityTier): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DEFAULT_QUALITY_KEY, tier);
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
}
