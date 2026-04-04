/**
 * Canvas domain types for the studio (PRD-legacy Phase 1).
 * Blocks show results on the infinite canvas; params edit in the right panel.
 */

export type CanvasBlockType = "image" | "text" | "video";

export type CanvasBlockStatus =
  | "idle"
  | "pending"
  | "running"
  | "completed"
  | "failed";

export interface CanvasBlockParams {
  prompt: string;
  quality_tier: "premium" | "standard" | "budget";
}

export interface CanvasBlock {
  id: string;
  type: CanvasBlockType;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  bodyText?: string;
  mediaUrls: string[];
  status: CanvasBlockStatus;
  jobId?: string | null;
  params: CanvasBlockParams;
}

export interface CanvasEdge {
  id: string;
  sourceBlockId: string;
  targetBlockId: string;
}

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface CanvasProject {
  id: string;
  title: string;
  blocks: CanvasBlock[];
  edges: CanvasEdge[];
  viewport: CanvasViewport;
}

const STORAGE_KEY = "comfyskill.studio.project.v1";

export function createEmptyProject(title = "Untitled project"): CanvasProject {
  return {
    id: crypto.randomUUID(),
    title,
    blocks: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function defaultParams(): CanvasBlockParams {
  return { prompt: "", quality_tier: "standard" };
}

export function createImageBlock(
  partial?: Partial<Pick<CanvasBlock, "x" | "y" | "title" | "params">>,
): CanvasBlock {
  return {
    id: crypto.randomUUID(),
    type: "image",
    title: partial?.title ?? "Image block",
    x: partial?.x ?? 120,
    y: partial?.y ?? 120,
    width: 280,
    height: 220,
    mediaUrls: [],
    status: "idle",
    jobId: null,
    params: partial?.params ?? defaultParams(),
  };
}

export function createTextBlock(
  partial?: Partial<Pick<CanvasBlock, "x" | "y" | "title" | "bodyText" | "params">>,
): CanvasBlock {
  return {
    id: crypto.randomUUID(),
    type: "text",
    title: partial?.title ?? "Text block",
    x: partial?.x ?? 120,
    y: partial?.y ?? 120,
    width: 280,
    height: 180,
    bodyText: partial?.bodyText ?? "",
    mediaUrls: [],
    status: "idle",
    jobId: null,
    params: partial?.params ?? defaultParams(),
  };
}

/** Client-side persistence until Postgres projects API lands (PRD-legacy C7). */
export function saveProjectLocal(project: CanvasProject): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function loadProjectLocal(): CanvasProject | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CanvasProject;
    if (!parsed?.id || !Array.isArray(parsed.blocks) || !Array.isArray(parsed.edges)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearProjectLocal(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function createStarterProject(): CanvasProject {
  const p = createEmptyProject("Studio draft");
  const a = createImageBlock({ x: 80, y: 100, title: "Shot A" });
  const b = createImageBlock({ x: 420, y: 160, title: "Shot B" });
  p.blocks = [a, b];
  p.edges = [
    {
      id: crypto.randomUUID(),
      sourceBlockId: a.id,
      targetBlockId: b.id,
    },
  ];
  return p;
}

export function moveBlock(
  project: CanvasProject,
  blockId: string,
  x: number,
  y: number,
): CanvasProject {
  return {
    ...project,
    blocks: project.blocks.map((b) => (b.id === blockId ? { ...b, x, y } : b)),
  };
}

/** Add a flow edge if both blocks exist and the pair is not already linked. */
export function addEdgeBetween(
  project: CanvasProject,
  sourceBlockId: string,
  targetBlockId: string,
): CanvasProject {
  if (sourceBlockId === targetBlockId) return project;
  const ids = new Set(project.blocks.map((b) => b.id));
  if (!ids.has(sourceBlockId) || !ids.has(targetBlockId)) return project;
  const exists = project.edges.some(
    (e) => e.sourceBlockId === sourceBlockId && e.targetBlockId === targetBlockId,
  );
  if (exists) return project;
  return {
    ...project,
    edges: [
      ...project.edges,
      {
        id: crypto.randomUUID(),
        sourceBlockId,
        targetBlockId,
      },
    ],
  };
}

