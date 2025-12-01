/**
 * Canvas domain types for the studio (PRD-legacy Phase 1).
 * Blocks show results on the infinite canvas; params edit in the right panel.
 */

import type { ApiProject } from "@/lib/api";

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

/** Product-level view (PRD-legacy C11) — not a ComfyUI node editor. */
export type StudioViewMode = "workflow" | "storyboard";

export interface CanvasProject {
  id: string;
  title: string;
  blocks: CanvasBlock[];
  edges: CanvasEdge[];
  viewport: CanvasViewport;
  viewMode?: StudioViewMode;
}

const STORAGE_KEY = "comfyskill.studio.project.v1";

export function createEmptyProject(title = "Untitled project"): CanvasProject {
  return {
    id: crypto.randomUUID(),
    title,
    blocks: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    viewMode: "workflow",
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

/** Video block — preview frames / clip URL later; MVP shows a storyboard placeholder. */
export function createVideoBlock(
  partial?: Partial<Pick<CanvasBlock, "x" | "y" | "title" | "bodyText" | "params" | "mediaUrls">>,
): CanvasBlock {
  return {
    id: crypto.randomUUID(),
    type: "video",
    title: partial?.title ?? "Video block",
    x: partial?.x ?? 120,
    y: partial?.y ?? 120,
    width: 320,
    height: 200,
    bodyText: partial?.bodyText ?? "",
    mediaUrls: partial?.mediaUrls ?? [],
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Validate exported/local canvas JSON before it reaches rendering or cloud persistence. */
export function parseCanvasProjectJson(raw: string): CanvasProject | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string") {
      return null;
    }
    if (!isRecord(value.viewport) || !Array.isArray(value.blocks) || !Array.isArray(value.edges)) {
      return null;
    }
    const finite = (item: unknown): item is number =>
      typeof item === "number" && Number.isFinite(item);
    if (
      !finite(value.viewport.x) ||
      !finite(value.viewport.y) ||
      !finite(value.viewport.zoom)
    ) {
      return null;
    }

    const blockTypes = new Set<CanvasBlockType>(["image", "text", "video"]);
    const statuses = new Set<CanvasBlockStatus>([
      "idle",
      "pending",
      "running",
      "completed",
      "failed",
    ]);
    const qualities = new Set<CanvasBlockParams["quality_tier"]>([
      "premium",
      "standard",
      "budget",
    ]);
    const isBlock = (item: unknown): item is CanvasBlock => {
      if (!isRecord(item) || !isRecord(item.params)) return false;
      return (
        typeof item.id === "string" &&
        blockTypes.has(item.type as CanvasBlockType) &&
        typeof item.title === "string" &&
        finite(item.x) &&
        finite(item.y) &&
        finite(item.width) &&
        finite(item.height) &&
        (item.bodyText === undefined || typeof item.bodyText === "string") &&
        Array.isArray(item.mediaUrls) &&
        item.mediaUrls.every((url) => typeof url === "string") &&
        statuses.has(item.status as CanvasBlockStatus) &&
        (item.jobId === undefined || item.jobId === null || typeof item.jobId === "string") &&
        typeof item.params.prompt === "string" &&
        qualities.has(item.params.quality_tier as CanvasBlockParams["quality_tier"])
      );
    };
    const isEdge = (item: unknown): item is CanvasEdge =>
      isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.sourceBlockId === "string" &&
      typeof item.targetBlockId === "string";
    if (!value.blocks.every(isBlock) || !value.edges.every(isEdge)) return null;

    const blockIds = new Set(value.blocks.map((block) => block.id));
    if (
      value.edges.some(
        (edge) => !blockIds.has(edge.sourceBlockId) || !blockIds.has(edge.targetBlockId),
      )
    ) {
      return null;
    }
    const viewMode =
      value.viewMode === "storyboard" || value.viewMode === "workflow"
        ? value.viewMode
        : "workflow";
    return {
      id: value.id,
      title: value.title,
      blocks: value.blocks,
      edges: value.edges,
      viewport: {
        x: value.viewport.x,
        y: value.viewport.y,
        zoom: value.viewport.zoom,
      },
      viewMode,
    };
  } catch {
    return null;
  }
}

export function loadProjectLocal(): CanvasProject | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseCanvasProjectJson(raw);
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

/** Nudge a block by delta in canvas units (PRD-legacy Phase 1 keyboard layout). */
export function nudgeBlock(
  project: CanvasProject,
  blockId: string,
  dx: number,
  dy: number,
): CanvasProject {
  const block = project.blocks.find((b) => b.id === blockId);
  if (!block) return project;
  return moveBlock(project, blockId, block.x + dx, block.y + dy);
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

/** Productized openings for the right panel (PRD-legacy C9). */
export interface SkillTemplate {
  id: string;
  title: string;
  blurb: string;
  blockType: CanvasBlockType;
  prompt: string;
  bodyText?: string;
}

export const SKILL_TEMPLATES: SkillTemplate[] = [
  {
    id: "pixar-short",
    title: "Pixar-style short",
    blurb: "Warm character moment · soft lighting",
    blockType: "image",
    prompt:
      "Pixar-style 3D character still, emotional close-up, soft cinematic lighting, shallow depth of field",
  },
  {
    id: "viral-remake",
    title: "Viral remake",
    blurb: "Hook frame for a short-form cut",
    blockType: "image",
    prompt:
      "High-contrast vertical thumbnail frame, bold subject, social-first composition, 9:16 safe margins",
  },
  {
    id: "scene-beat",
    title: "Scene beat",
    blurb: "Text beat to place before a shot",
    blockType: "text",
    prompt: "Write a one-sentence scene beat for the next shot",
    bodyText: "INT. LOCATION — DAY\nA single beat that sets emotion before the cut.",
  },
  {
    id: "motion-hook",
    title: "Motion hook",
    blurb: "Video block placeholder for a short cut",
    blockType: "video",
    prompt: "3-second camera push-in on the hero product, soft rim light, 24fps feel",
    bodyText: "Clip TBD — frames will appear here after generation.",
  },
];

export function applySkillTemplate(
  project: CanvasProject,
  template: SkillTemplate,
): { project: CanvasProject; blockId: string } {
  const offset = project.blocks.length;
  const base = {
    x: 100 + offset * 36,
    y: 100 + offset * 28,
    title: template.title,
    params: {
      prompt: template.prompt,
      quality_tier: "standard" as const,
    },
  };
  let block: CanvasBlock;
  if (template.blockType === "text") {
    block = createTextBlock({ ...base, bodyText: template.bodyText ?? "" });
  } else if (template.blockType === "video") {
    block = createVideoBlock({ ...base, bodyText: template.bodyText ?? "" });
  } else {
    block = createImageBlock(base);
  }
  return {
    project: { ...project, blocks: [...project.blocks, block] },
    blockId: block.id,
  };
}

export function removeBlock(project: CanvasProject, blockId: string): CanvasProject {
  return {
    ...project,
    blocks: project.blocks.filter((b) => b.id !== blockId),
    edges: project.edges.filter(
      (e) => e.sourceBlockId !== blockId && e.targetBlockId !== blockId,
    ),
  };
}

/** Drop all edges connected to a block (PRD-legacy Phase 1 — 轻量连线). */
export function unlinkBlock(project: CanvasProject, blockId: string): CanvasProject {
  return {
    ...project,
    edges: project.edges.filter(
      (e) => e.sourceBlockId !== blockId && e.targetBlockId !== blockId,
    ),
  };
}

/** Remove one selected flow relationship without disturbing neighboring edges. */
export function removeEdge(project: CanvasProject, edgeId: string): CanvasProject {
  if (!project.edges.some((edge) => edge.id === edgeId)) return project;
  return {
    ...project,
    edges: project.edges.filter((edge) => edge.id !== edgeId),
  };
}

/** Clone a block offset on the canvas; does not copy edges or job binding. */
export function duplicateBlock(
  project: CanvasProject,
  blockId: string,
): { project: CanvasProject; blockId: string | null } {
  const src = project.blocks.find((b) => b.id === blockId);
  if (!src) return { project, blockId: null };
  const copy: CanvasBlock = {
    ...src,
    id: crypto.randomUUID(),
    x: src.x + 36,
    y: src.y + 36,
    title: `${src.title} copy`,
    jobId: null,
    status: src.mediaUrls.length ? "completed" : "idle",
    mediaUrls: [...src.mediaUrls],
    bodyText: src.bodyText,
    params: { ...src.params },
  };
  return {
    project: { ...project, blocks: [...project.blocks, copy] },
    blockId: copy.id,
  };
}

export function setViewportZoom(project: CanvasProject, zoom: number): CanvasProject {
  const clamped = Math.min(2, Math.max(0.35, Math.round(zoom * 100) / 100));
  return {
    ...project,
    viewport: { ...project.viewport, zoom: clamped },
  };
}

/**
 * Zoom toward a point in canvas container coordinates so the world point
 * under the cursor stays fixed (PRD-legacy Phase 1 — 缩放).
 */
export function zoomViewportAt(
  project: CanvasProject,
  nextZoom: number,
  anchorScreenX: number,
  anchorScreenY: number,
): CanvasProject {
  const z0 = project.viewport.zoom || 1;
  const z1 = Math.min(2, Math.max(0.35, Math.round(nextZoom * 100) / 100));
  if (z1 === z0) return project;
  const worldX = (anchorScreenX - project.viewport.x) / z0;
  const worldY = (anchorScreenY - project.viewport.y) / z0;
  return {
    ...project,
    viewport: {
      x: anchorScreenX - worldX * z1,
      y: anchorScreenY - worldY * z1,
      zoom: z1,
    },
  };
}

/** Pan the infinite canvas in screen pixels (PRD-legacy Phase 1 — 拖拽 / 平移). */
export function panViewport(
  project: CanvasProject,
  deltaX: number,
  deltaY: number,
): CanvasProject {
  return {
    ...project,
    viewport: {
      ...project.viewport,
      x: project.viewport.x + deltaX,
      y: project.viewport.y + deltaY,
    },
  };
}

export function resetViewportPan(project: CanvasProject): CanvasProject {
  return {
    ...project,
    viewport: { ...project.viewport, x: 0, y: 0 },
  };
}

/** Center every result block inside the visible workflow area (PRD-legacy C1/C10). */
export function fitProjectInViewport(
  project: CanvasProject,
  viewportWidth: number,
  viewportHeight: number,
  padding = 64,
): CanvasProject {
  if (project.blocks.length === 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return project;
  }

  const minX = Math.min(...project.blocks.map((block) => block.x));
  const minY = Math.min(...project.blocks.map((block) => block.y));
  const maxX = Math.max(...project.blocks.map((block) => block.x + block.width));
  const maxY = Math.max(...project.blocks.map((block) => block.y + block.height));
  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const availableWidth = Math.max(1, viewportWidth - padding * 2);
  const availableHeight = Math.max(1, viewportHeight - padding * 2);
  const zoom = Math.min(
    2,
    Math.max(
      0.35,
      Math.floor(
        Math.min(availableWidth / contentWidth, availableHeight / contentHeight) * 100,
      ) / 100,
    ),
  );

  return {
    ...project,
    viewport: {
      x: (viewportWidth - contentWidth * zoom) / 2 - minX * zoom,
      y: (viewportHeight - contentHeight * zoom) / 2 - minY * zoom,
      zoom,
    },
  };
}

/** Read-only summary for the result inspect overlay (PRD-legacy C12). */
export function blockResultSummary(block: CanvasBlock): {
  title: string;
  prompt: string;
  quality: string;
  status: CanvasBlockStatus;
  mediaCount: number;
  primaryMedia: string | null;
} {
  return {
    title: block.title,
    prompt: block.params.prompt || block.bodyText || "",
    quality: block.params.quality_tier,
    status: block.status,
    mediaCount: block.mediaUrls.length,
    primaryMedia: block.mediaUrls[0] ?? null,
  };
}

export function setViewMode(
  project: CanvasProject,
  viewMode: StudioViewMode,
): CanvasProject {
  return { ...project, viewMode };
}

/** Storyboard order: left-to-right, then top-to-bottom. */
export function storyboardOrderedBlocks(project: CanvasProject): CanvasBlock[] {
  return [...project.blocks].sort((a, b) => a.x - b.x || a.y - b.y);
}

export function cloneProject(project: CanvasProject): CanvasProject {
  return JSON.parse(JSON.stringify(project)) as CanvasProject;
}

/** Keep a bounded undo stack of project snapshots (PRD-legacy Phase 2). */
export class ProjectHistory {
  private past: CanvasProject[] = [];
  private future: CanvasProject[] = [];
  private readonly limit: number;

  constructor(limit = 40) {
    this.limit = limit;
  }

  record(before: CanvasProject): void {
    this.past.push(cloneProject(before));
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }

  undo(current: CanvasProject): CanvasProject | null {
    const prev = this.past.pop();
    if (!prev) return null;
    this.future.push(cloneProject(current));
    return prev;
  }

  redo(current: CanvasProject): CanvasProject | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(cloneProject(current));
    return next;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }
}

export function canvasProjectToApiPut(project: CanvasProject) {
  return {
    title: project.title,
    viewport: project.viewport,
    view_mode: (project.viewMode ?? "workflow") as "workflow" | "storyboard",
    blocks: project.blocks.map((b) => ({
      id: b.id,
      type: b.type,
      title: b.title,
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      body_text: b.bodyText ?? null,
      media_urls: b.mediaUrls,
      status: b.status,
      job_id: b.jobId ?? null,
      params: b.params,
    })),
    edges: project.edges.map((e) => ({
      id: e.id,
      source_block_id: e.sourceBlockId,
      target_block_id: e.targetBlockId,
    })),
  };
}

export function apiProjectToCanvas(api: ApiProject): CanvasProject {
  return {
    id: api.id,
    title: api.title,
    viewport: {
      x: api.viewport?.x ?? 0,
      y: api.viewport?.y ?? 0,
      zoom: api.viewport?.zoom ?? 1,
    },
    viewMode: api.view_mode,
    blocks: api.blocks.map((b) => ({
      id: b.id,
      type: b.type,
      title: b.title,
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      bodyText: b.body_text ?? undefined,
      mediaUrls: b.media_urls ?? [],
      status: b.status as CanvasBlockStatus,
      jobId: b.job_id,
      params: {
        prompt: String((b.params?.prompt as string) ?? ""),
        quality_tier: (b.params?.quality_tier as CanvasBlockParams["quality_tier"]) ?? "standard",
      },
    })),
    edges: api.edges.map((e) => ({
      id: e.id,
      sourceBlockId: e.source_block_id,
      targetBlockId: e.target_block_id,
    })),
  };
}

/** Drop a completed job result onto the canvas as a new image block (PRD C14). */
export function insertAssetBlock(
  project: CanvasProject,
  asset: { url: string; prompt?: string; jobId?: string; title?: string },
): { project: CanvasProject; blockId: string } {
  const offset = project.blocks.length;
  const block = createImageBlock({
    x: 100 + offset * 36,
    y: 100 + offset * 28,
    title: asset.title ?? `Asset ${offset + 1}`,
    params: {
      prompt: asset.prompt ?? "",
      quality_tier: "standard",
    },
  });
  block.mediaUrls = [asset.url];
  block.status = "completed";
  block.jobId = asset.jobId ?? null;
  block.bodyText = asset.prompt;
  return {
    project: { ...project, blocks: [...project.blocks, block] },
    blockId: block.id,
  };
}



