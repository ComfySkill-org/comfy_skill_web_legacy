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

export function createEmptyProject(title = "Untitled project"): CanvasProject {
  return {
    id: crypto.randomUUID(),
    title,
    blocks: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
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
    params: partial?.params ?? {
      prompt: "",
      quality_tier: "standard",
    },
  };
}
