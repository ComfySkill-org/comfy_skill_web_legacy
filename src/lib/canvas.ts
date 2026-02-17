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

export function setViewportZoom(project: CanvasProject, zoom: number): CanvasProject {
  const clamped = Math.min(2, Math.max(0.35, Math.round(zoom * 100) / 100));
  return {
    ...project,
    viewport: { ...project.viewport, zoom: clamped },
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






