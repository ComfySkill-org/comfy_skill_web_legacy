"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { apiClient, clearAuth, type ProjectSummary } from "@/lib/api";
import {
  addEdgeBetween,
  apiProjectToCanvas,
  applySkillTemplate,
  blockResultSummary,
  canvasProjectToApiPut,
  clearProjectLocal,
  createImageBlock,
  createStarterProject,
  createTextBlock,
  createVideoBlock,
  duplicateBlock,
  fitProjectInViewport,
  insertAssetBlock,
  loadProjectLocal,
  moveBlock,
  nudgeBlock,
  parseCanvasProjectJson,
  ProjectHistory,
  removeBlock,
  removeEdge,
  resetViewportPan,
  resetWorkflowViewport,
  revealBlockInViewport,
  revealEdgeInViewport,
  saveProjectLocal,
  setViewMode,
  unlinkBlock,
  zoomViewportAt,
  storyboardOrderedBlocks,
  SKILL_TEMPLATES,
  type CanvasBlock,
  type CanvasBlockStatus,
  type CanvasProject,
  type StudioViewMode,
} from "@/lib/canvas";
import {
  getRemoteProjectId,
  isStudioAuthed,
  loadOrCreateRemoteProject,
  pushRemoteProject,
  setRemoteProjectId,
  starterOrLocal,
} from "@/lib/projectSync";

const QUALITY_CREDITS: Record<CanvasBlock["params"]["quality_tier"], number> = {
  premium: 50,
  standard: 20,
  budget: 8,
};
const CANVAS_GRID_SIZE = 24;
const SNAP_PREFERENCE_KEY = "comfyskill.studio.snap-to-grid";
const PROJECT_LIST_PREFERENCE_KEY = "comfyskill.studio.project-list";
type ProjectViewFilter = ProjectSummary["view_mode"] | "all";
type ProjectSort = "updated-desc" | "updated-asc" | "title-asc" | "title-desc";

const BLOCK_STATUS_META: Record<
  CanvasBlockStatus,
  { label: string; className: string }
> = {
  idle: { label: "Draft", className: "bg-slate-700/70 text-slate-300" },
  pending: { label: "Queued", className: "bg-amber-500/15 text-amber-300" },
  running: { label: "Generating", className: "bg-sky-500/15 text-sky-300" },
  completed: { label: "Ready", className: "bg-emerald-500/15 text-emerald-300" },
  failed: { label: "Failed", className: "bg-rose-500/15 text-rose-300" },
};

function projectUpdatedTimestamp(updatedAt: string | null): number {
  if (!updatedAt) return 0;
  const timestamp = Date.parse(updatedAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortProjectSummaries(projects: readonly ProjectSummary[]): ProjectSummary[] {
  return [...projects].sort(
    (a, b) =>
      projectUpdatedTimestamp(b.updated_at) - projectUpdatedTimestamp(a.updated_at),
  );
}

function formatProjectUpdatedAt(updatedAt: string | null): string {
  if (!updatedAt) return "Not saved yet";
  const timestamp = projectUpdatedTimestamp(updatedAt);
  return timestamp ? new Date(timestamp).toLocaleString() : "Update time unavailable";
}

function uniqueProjectCopyTitle(
  sourceTitle: string,
  projects: readonly ProjectSummary[],
): string {
  const source = sourceTitle.trim() || "Untitled project";
  const existing = new Set(projects.map((project) => project.title.trim().toLocaleLowerCase()));
  let copyNumber = 1;
  while (true) {
    const suffix = copyNumber === 1 ? " copy" : ` copy ${copyNumber}`;
    const candidate = `${source.slice(0, 120 - suffix.length).trimEnd()}${suffix}`;
    if (!existing.has(candidate.toLocaleLowerCase())) return candidate;
    copyNumber += 1;
  }
}

/**
 * Studio shell — Phase 1 canvas MVP (PRD-legacy).
 * Center: flow + results. Right: params when a block is selected.
 */
export default function StudioPage() {
  const [project, setProject] = useState<CanvasProject>(() => createStarterProject());
  const [hydrated, setHydrated] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [inspectMediaIndex, setInspectMediaIndex] = useState(0);
  const [promptCopied, setPromptCopied] = useState(false);
  const [mediaLinkCopied, setMediaLinkCopied] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projectSummaries, setProjectSummaries] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");
  const [projectsNotice, setProjectsNotice] = useState("");
  const [projectQuery, setProjectQuery] = useState("");
  const [projectViewFilter, setProjectViewFilter] = useState<ProjectViewFilter>("all");
  const [projectSort, setProjectSort] = useState<ProjectSort>("updated-desc");
  const [projectPendingRename, setProjectPendingRename] = useState<ProjectSummary | null>(null);
  const [projectRenameValue, setProjectRenameValue] = useState("");
  const [projectPendingDelete, setProjectPendingDelete] = useState<ProjectSummary | null>(null);
  const [projectDeleteLoading, setProjectDeleteLoading] = useState(false);
  const [projectActionId, setProjectActionId] = useState<string | null>(null);
  const [projectFileError, setProjectFileError] = useState("");
  const [dialoguePrompt, setDialoguePrompt] = useState("");
  const [dialogueBlockType, setDialogueBlockType] = useState<CanvasBlock["type"]>("image");
  const [syncLabel, setSyncLabel] = useState("local");
  const [balanceCredits, setBalanceCredits] = useState<number | null>(null);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [assets, setAssets] = useState<
    Array<{ id: string; url: string; prompt: string }>
  >([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetQuery, setAssetQuery] = useState("");
  const [historyTick, setHistoryTick] = useState(0);
  const [jobEvents, setJobEvents] = useState<
    Array<{ id: string; event_type: string; created_at: string }>
  >([]);
  const historyRef = useRef(new ProjectHistory());
  const projectRef = useRef(project);
  projectRef.current = project;
  const canvasMainRef = useRef<HTMLElement | null>(null);
  const viewModeRef = useRef<StudioViewMode>("workflow");
  const selectedIdRef = useRef<string | null>(null);
  const selectedEdgeIdRef = useRef<string | null>(null);
  const linkSourceIdRef = useRef<string | null>(null);
  linkSourceIdRef.current = linkSourceId;
  const generateErrorRef = useRef("");
  generateErrorRef.current = generateError;
  const inspectIdRef = useRef<string | null>(null);
  const inspectMediaCountRef = useRef(0);
  const projectsOpenRef = useRef(projectsOpen);
  projectsOpenRef.current = projectsOpen;
  const projectSearchInputRef = useRef<HTMLInputElement | null>(null);
  const canvasToolbarRef = useRef<HTMLDivElement | null>(null);
  const toolbarReturnFocusRef = useRef<HTMLElement | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const syncRequestRef = useRef(0);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const wheelHistoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeHistoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressCanvasClickUntilRef = useRef(0);
  const dragRef = useRef<{
    id: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    moved: boolean;
    before: CanvasProject;
  } | null>(null);
  const panRef = useRef<{
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    moved: boolean;
    before: CanvasProject;
  } | null>(null);
  const spaceHeldRef = useRef(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const [panToolActive, setPanToolActive] = useState(false);
  const panToolActiveRef = useRef(false);
  panToolActiveRef.current = panToolActive;
  const [snapToGrid, setSnapToGrid] = useState(false);
  const snapToGridRef = useRef(false);
  snapToGridRef.current = snapToGrid;
  const zoomRef = useRef(project.viewport.zoom);
  zoomRef.current = project.viewport.zoom;

  useEffect(() => {
    try {
      const enabled = localStorage.getItem(SNAP_PREFERENCE_KEY) === "true";
      snapToGridRef.current = enabled;
      setSnapToGrid(enabled);
    } catch {
      // Storage can be unavailable in private browsing modes.
    }
  }, []);
  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem(PROJECT_LIST_PREFERENCE_KEY) ?? "null",
      );
      if (typeof stored !== "object" || stored === null) return;
      const preference = stored as Record<string, unknown>;
      if (
        preference.view === "all" ||
        preference.view === "workflow" ||
        preference.view === "storyboard"
      ) {
        setProjectViewFilter(preference.view);
      }
      if (
        preference.sort === "updated-desc" ||
        preference.sort === "updated-asc" ||
        preference.sort === "title-asc" ||
        preference.sort === "title-desc"
      ) {
        setProjectSort(preference.sort);
      } else if (preference.sort === "updated") {
        setProjectSort("updated-desc");
      } else if (preference.sort === "title") {
        setProjectSort("title-asc");
      }
    } catch {
      // Ignore malformed or unavailable local preferences.
    }
  }, []);

  const queueRemoteSave = useCallback((snapshot: CanvasProject) => {
    const save = remoteSaveQueueRef.current.then(
      () => pushRemoteProject(snapshot),
      () => pushRemoteProject(snapshot),
    );
    remoteSaveQueueRef.current = save.then(
      () => undefined,
      () => undefined,
    );
    return save;
  }, []);

  function commitChange(mutate: (prev: CanvasProject) => CanvasProject) {
    historyRef.current.record(projectRef.current);
    setProject(mutate);
    setHistoryTick((n) => n + 1);
  }

  function beginNudgeHistory() {
    if (!nudgeHistoryTimerRef.current) {
      historyRef.current.record(projectRef.current);
      setHistoryTick((n) => n + 1);
    } else {
      clearTimeout(nudgeHistoryTimerRef.current);
    }
    nudgeHistoryTimerRef.current = setTimeout(() => {
      nudgeHistoryTimerRef.current = null;
    }, 300);
  }

  function endCanvasGesture(recordHistory: boolean, suppressClick = false) {
    const drag = dragRef.current;
    const pan = panRef.current;
    const gesture = drag ?? pan;
    if (gesture?.moved && recordHistory) {
      historyRef.current.record(gesture.before);
      setHistoryTick((n) => n + 1);
    } else if (drag?.moved) {
      setProject((prev) => moveBlock(prev, drag.id, drag.origX, drag.origY));
    } else if (pan?.moved) {
      setProject((prev) => ({
        ...prev,
        viewport: { ...prev.viewport, x: pan.origX, y: pan.origY },
      }));
    }
    if (pan?.moved && suppressClick) {
      suppressCanvasClickUntilRef.current = performance.now() + 100;
    }
    dragRef.current = null;
    panRef.current = null;
    if (pan) setPanning(false);
  }

  function cancelCanvasGesture() {
    endCanvasGesture(false);
  }

  function consumeSuppressedCanvasClick() {
    if (performance.now() > suppressCanvasClickUntilRef.current) return false;
    suppressCanvasClickUntilRef.current = 0;
    return true;
  }

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      const local = starterOrLocal(loadProjectLocal);
      if (isStudioAuthed()) {
        try {
          const remote = await loadOrCreateRemoteProject(local);
          if (!cancelled) {
            setProject(remote);
            setSyncLabel("cloud");
          }
        } catch {
          if (!cancelled) {
            setProject(local);
            setSyncLabel("local");
          }
        }
      } else if (!cancelled) {
        setProject(local);
        setSyncLabel("local");
      }
      if (!cancelled) setHydrated(true);
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveProjectLocal(project);
    if (!isStudioAuthed()) {
      syncRequestRef.current += 1;
      setSyncLabel("local");
      return;
    }
    const syncRequest = ++syncRequestRef.current;
    setSyncLabel("saving");
    const timer = setTimeout(() => {
      void queueRemoteSave(project)
        .then(() => {
          if (syncRequestRef.current === syncRequest) setSyncLabel("cloud");
        })
        .catch(() => {
          if (syncRequestRef.current === syncRequest) setSyncLabel("local*");
        });
    }, 800);
    autosaveTimerRef.current = timer;
    return () => {
      clearTimeout(timer);
      if (autosaveTimerRef.current === timer) autosaveTimerRef.current = null;
    };
  }, [project, hydrated, queueRemoteSave]);

  useEffect(() => {
    if (!hydrated || !isStudioAuthed()) {
      setBalanceCredits(null);
      return;
    }
    let cancelled = false;
    void apiClient
      .me()
      .then((user) => {
        if (!cancelled) setBalanceCredits(user.balance_credits);
      })
      .catch(() => {
        if (!cancelled) setBalanceCredits(null);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const pan = panRef.current;
      if (pan) {
        const dx = e.clientX - pan.startClientX;
        const dy = e.clientY - pan.startClientY;
        if (dx === 0 && dy === 0 && !pan.moved) return;
        pan.moved = dx !== 0 || dy !== 0;
        setProject((prev) => ({
          ...prev,
          viewport: {
            ...prev.viewport,
            x: pan.origX + dx,
            y: pan.origY + dy,
          },
        }));
        return;
      }
      const drag = dragRef.current;
      if (!drag) return;
      const z = zoomRef.current || 1;
      const nextX = drag.origX + (e.clientX - drag.startClientX) / z;
      const nextY = drag.origY + (e.clientY - drag.startClientY) / z;
      const x = snapToGridRef.current && !e.altKey
        ? Math.round(nextX / CANVAS_GRID_SIZE) * CANVAS_GRID_SIZE
        : nextX;
      const y = snapToGridRef.current && !e.altKey
        ? Math.round(nextY / CANVAS_GRID_SIZE) * CANVAS_GRID_SIZE
        : nextY;
      if (x === drag.origX && y === drag.origY && !drag.moved) return;
      drag.moved = x !== drag.origX || y !== drag.origY;
      setProject((prev) => moveBlock(prev, drag.id, x, y));
    }
    function finishPointerGesture(e?: PointerEvent) {
      endCanvasGesture(true, e?.type === "pointerup" && e.button === 0);
    }
    function onWindowBlur() {
      finishPointerGesture();
      spaceHeldRef.current = false;
      setSpaceHeld(false);
    }
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", finishPointerGesture);
    window.addEventListener("pointercancel", cancelCanvasGesture);
    window.addEventListener("blur", onWindowBlur);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", finishPointerGesture);
      window.removeEventListener("pointercancel", cancelCanvasGesture);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, []);

  useEffect(() => {
    const el = canvasMainRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (viewModeRef.current !== "workflow") return;
      if (
        e.target instanceof Element &&
        e.target.closest("[data-canvas-toolbar]")
      ) {
        return;
      }
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const ax = e.clientX - rect.left;
      const ay = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      const current = projectRef.current;
      if (
        zoomViewportAt(current, current.viewport.zoom * factor, ax, ay) === current
      ) {
        return;
      }
      if (!wheelHistoryTimerRef.current) {
        historyRef.current.record(current);
        setHistoryTick((n) => n + 1);
      } else {
        clearTimeout(wheelHistoryTimerRef.current);
      }
      wheelHistoryTimerRef.current = setTimeout(() => {
        wheelHistoryTimerRef.current = null;
      }, 300);
      setProject((prev) =>
        zoomViewportAt(prev, prev.viewport.zoom * factor, ax, ay),
      );
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (wheelHistoryTimerRef.current) {
        clearTimeout(wheelHistoryTimerRef.current);
        wheelHistoryTimerRef.current = null;
      }
      if (nudgeHistoryTimerRef.current) {
        clearTimeout(nudgeHistoryTimerRef.current);
        nudgeHistoryTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    function isTypingTarget(t: EventTarget | null): boolean {
      if (!(t instanceof HTMLElement)) return false;
      return (
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.tagName === "SELECT" ||
        t.isContentEditable
      );
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space" && !e.repeat) {
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        spaceHeldRef.current = true;
        setSpaceHeld(true);
        return;
      }
      if (e.key === "Escape") {
        if (dragRef.current || panRef.current) {
          e.preventDefault();
          cancelCanvasGesture();
          return;
        }
        if (generateErrorRef.current) {
          e.preventDefault();
          generateErrorRef.current = "";
          setGenerateError("");
          return;
        }
        if (panToolActiveRef.current) {
          e.preventDefault();
          updatePanTool(false);
          return;
        }
        setSelectedId(null);
        setSelectedEdgeId(null);
        setLinkSourceId(null);
        setInspectId(null);
        setHelpOpen(false);
        setResetConfirmOpen(false);
        setProjectsOpen(false);
        setProjectPendingRename(null);
        setProjectPendingDelete(null);
        return;
      }
      if (
        e.key === "/" &&
        projectsOpenRef.current &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isTypingTarget(e.target)
      ) {
        e.preventDefault();
        projectSearchInputRef.current?.focus();
        return;
      }
      if (
        inspectIdRef.current &&
        !isTypingTarget(e.target) &&
        (e.key === "ArrowLeft" || e.key === "ArrowRight")
      ) {
        e.preventDefault();
        const count = inspectMediaCountRef.current;
        if (count > 1) {
          setInspectMediaIndex((index) =>
            e.key === "ArrowLeft"
              ? index === 0
                ? count - 1
                : index - 1
              : index === count - 1
                ? 0
                : index + 1,
          );
        }
        return;
      }
      if (e.key === "?" && !isTypingTarget(e.target)) {
        e.preventDefault();
        setHelpOpen((open) => !open);
        return;
      }
      if (
        (e.key === "g" || e.key === "G") &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isTypingTarget(e.target)
      ) {
        e.preventDefault();
        if (e.shiftKey) {
          if (viewModeRef.current === "workflow") alignSelectedToGrid();
        } else {
          toggleSnapToGrid();
        }
        return;
      }
      if (
        e.key === "0" &&
        viewModeRef.current === "workflow" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isTypingTarget(e.target)
      ) {
        e.preventDefault();
        if (e.shiftKey) {
          resetStudioViewport();
        } else {
          resetZoomTo100();
        }
        return;
      }
      if (
        (e.key === "-" || e.key === "+" || e.key === "=") &&
        viewModeRef.current === "workflow" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isTypingTarget(e.target)
      ) {
        e.preventDefault();
        zoomBy(e.key === "-" ? -0.1 : 0.1);
        return;
      }
      if (
        e.key.toLowerCase() === "f" &&
        viewModeRef.current === "workflow" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isTypingTarget(e.target)
      ) {
        e.preventDefault();
        fitWorkflowInView();
        return;
      }
      if (
        e.key.toLowerCase() === "c" &&
        viewModeRef.current === "workflow" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isTypingTarget(e.target)
      ) {
        e.preventDefault();
        centerSelectedBlock();
        return;
      }
      if (
        e.key.toLowerCase() === "h" &&
        viewModeRef.current === "workflow" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.repeat &&
        !isTypingTarget(e.target)
      ) {
        e.preventDefault();
        updatePanTool(!panToolActiveRef.current);
        return;
      }
      if (
        e.key.toLowerCase() === "t" &&
        viewModeRef.current === "workflow" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.repeat &&
        !isTypingTarget(e.target)
      ) {
        const firstTool =
          canvasToolbarRef.current?.querySelector<HTMLButtonElement>(
            "button:not(:disabled)",
          );
        if (!firstTool) return;
        e.preventDefault();
        if (
          document.activeElement instanceof HTMLElement &&
          !canvasToolbarRef.current?.contains(document.activeElement)
        ) {
          toolbarReturnFocusRef.current = document.activeElement;
        }
        firstTool.focus();
        firstTool.scrollIntoView({ block: "nearest", inline: "nearest" });
        return;
      }
      if (
        e.key.toLowerCase() === "l" &&
        viewModeRef.current === "workflow" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.repeat &&
        !isTypingTarget(e.target)
      ) {
        e.preventDefault();
        startLinkMode();
        return;
      }
      if (
        e.key.toLowerCase() === "o" &&
        viewModeRef.current === "storyboard" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.repeat &&
        !isTypingTarget(e.target)
      ) {
        e.preventDefault();
        openSelectionInWorkflow();
        return;
      }
      if (
        e.key === "Home" &&
        viewModeRef.current === "workflow" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.shiftKey &&
        !isTypingTarget(e.target)
      ) {
        e.preventDefault();
        resetWorkflowPan();
        return;
      }
      if (!isTypingTarget(e.target)) {
        if (
          (e.key === "Delete" || e.key === "Backspace") &&
          (selectedIdRef.current || selectedEdgeIdRef.current)
        ) {
          e.preventDefault();
          historyRef.current.record(projectRef.current);
          const blockId = selectedIdRef.current;
          const edgeId = selectedEdgeIdRef.current;
          setProject((prev) => {
            if (blockId) return removeBlock(prev, blockId);
            if (edgeId) return removeEdge(prev, edgeId);
            return prev;
          });
          setHistoryTick((n) => n + 1);
          setSelectedId(null);
          setSelectedEdgeId(null);
          setLinkSourceId(null);
          return;
        }
        const arrow =
          e.key === "ArrowLeft" ||
          e.key === "ArrowRight" ||
          e.key === "ArrowUp" ||
          e.key === "ArrowDown";
        if (
          viewModeRef.current === "storyboard" &&
          (e.key === "ArrowLeft" || e.key === "ArrowRight")
        ) {
          e.preventDefault();
          const blocks = storyboardOrderedBlocks(projectRef.current);
          if (blocks.length === 0) return;
          const currentIndex = blocks.findIndex((block) => block.id === selectedIdRef.current);
          const direction = e.key === "ArrowLeft" ? -1 : 1;
          const nextIndex =
            currentIndex < 0
              ? direction < 0
                ? blocks.length - 1
                : 0
              : (currentIndex + direction + blocks.length) % blocks.length;
          const nextId = blocks[nextIndex].id;
          setSelectedId(nextId);
          setSelectedEdgeId(null);
          requestAnimationFrame(() => {
            const nextCard = document.getElementById(`storyboard-card-${nextId}`);
            nextCard?.focus({ preventScroll: true });
            nextCard?.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
              inline: "nearest",
            });
          });
          return;
        }
        if (arrow && selectedIdRef.current && viewModeRef.current === "workflow") {
          e.preventDefault();
          const step = e.shiftKey ? 20 : 4;
          const dx =
            e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy =
            e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          beginNudgeHistory();
          const id = selectedIdRef.current;
          setProject((prev) => nudgeBlock(prev, id, dx, dy));
          return;
        }
      }
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key === "d" || e.key === "D") {
        if (isTypingTarget(e.target) || !selectedIdRef.current) return;
        e.preventDefault();
        const id = selectedIdRef.current;
        historyRef.current.record(projectRef.current);
        const { project: next, blockId } = duplicateBlock(projectRef.current, id);
        if (!blockId) return;
        setProject(next);
        setHistoryTick((n) => n + 1);
        setSelectedId(blockId);
        return;
      }
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        const prev = historyRef.current.undo(projectRef.current);
        if (!prev) return;
        setProject(prev);
        setHistoryTick((n) => n + 1);
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        const next = historyRef.current.redo(projectRef.current);
        if (!next) return;
        setProject(next);
        setHistoryTick((n) => n + 1);
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") {
        spaceHeldRef.current = false;
        setSpaceHeld(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const selected = useMemo(
    () => project.blocks.find((b) => b.id === selectedId) ?? null,
    [project.blocks, selectedId],
  );
  const linkSourceBlock = useMemo(
    () => project.blocks.find((block) => block.id === linkSourceId) ?? null,
    [project.blocks, linkSourceId],
  );
  selectedIdRef.current = selectedId;
  selectedEdgeIdRef.current = selectedEdgeId;

  useEffect(() => {
    const jobId = selected?.jobId;
    if (!jobId) {
      setJobEvents([]);
      return;
    }
    let cancelled = false;
    void apiClient
      .getJobEvents(jobId)
      .then((res) => {
        if (!cancelled) setJobEvents(res.events);
      })
      .catch(() => {
        if (!cancelled) setJobEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.jobId, selected?.status]);

  const inspectBlock = useMemo(
    () => project.blocks.find((b) => b.id === inspectId) ?? null,
    [project.blocks, inspectId],
  );
  inspectIdRef.current = inspectId;
  inspectMediaCountRef.current = inspectBlock?.mediaUrls.length ?? 0;

  const inspectSummary = useMemo(
    () => (inspectBlock ? blockResultSummary(inspectBlock) : null),
    [inspectBlock],
  );

  useEffect(() => {
    setInspectMediaIndex(0);
    setPromptCopied(false);
  }, [inspectId]);
  useEffect(() => {
    setMediaLinkCopied(false);
  }, [inspectId, inspectMediaIndex]);

  const inspectMedia = inspectBlock?.mediaUrls[inspectMediaIndex] ?? null;
  const filteredAssets = useMemo(() => {
    const query = assetQuery.trim().toLocaleLowerCase();
    if (!query) return assets;
    return assets.filter((asset) => asset.prompt.toLocaleLowerCase().includes(query));
  }, [assetQuery, assets]);
  const filteredProjects = useMemo(() => {
    const query = projectQuery.trim().toLocaleLowerCase();
    const matching = projectSummaries.filter(
      (project) =>
        (projectViewFilter === "all" || project.view_mode === projectViewFilter) &&
        (!query || project.title.toLocaleLowerCase().includes(query)),
    );
    if (projectSort === "title-asc" || projectSort === "title-desc") {
      const direction = projectSort === "title-asc" ? 1 : -1;
      return [...matching].sort(
        (a, b) =>
          direction * a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) ||
          projectUpdatedTimestamp(b.updated_at) - projectUpdatedTimestamp(a.updated_at),
      );
    }
    if (projectSort === "updated-asc") {
      return [...matching].sort(
        (a, b) =>
          projectUpdatedTimestamp(a.updated_at) - projectUpdatedTimestamp(b.updated_at),
      );
    }
    return sortProjectSummaries(matching);
  }, [projectQuery, projectSort, projectSummaries, projectViewFilter]);
  const projectViewCounts = useMemo(
    () => ({
      workflow: projectSummaries.filter((project) => project.view_mode === "workflow").length,
      storyboard: projectSummaries.filter((project) => project.view_mode === "storyboard").length,
    }),
    [projectSummaries],
  );
  const activeRemoteProjectId = hydrated ? getRemoteProjectId() : null;
  const activeProjectHidden = Boolean(
    activeRemoteProjectId &&
      projectSummaries.some((summary) => summary.id === activeRemoteProjectId) &&
      !filteredProjects.some((summary) => summary.id === activeRemoteProjectId),
  );
  const normalizedRenameTitle = projectRenameValue.trim().toLocaleLowerCase();
  const projectRenameConflict = Boolean(
    projectPendingRename &&
      normalizedRenameTitle &&
      normalizedRenameTitle !== projectPendingRename.title.trim().toLocaleLowerCase() &&
      projectSummaries.some(
        (summary) =>
          summary.id !== projectPendingRename.id &&
          summary.title.trim().toLocaleLowerCase() === normalizedRenameTitle,
      ),
  );

  const viewMode: StudioViewMode = project.viewMode ?? "workflow";
  viewModeRef.current = viewMode;
  const storyboardBlocks = useMemo(
    () => storyboardOrderedBlocks(project),
    [project],
  );
  const storyboardPredecessors = useMemo(() => {
    const positions = new Map(storyboardBlocks.map((block, index) => [block.id, index + 1]));
    const incoming = new Map<string, number[]>();
    for (const edge of project.edges) {
      const sourcePosition = positions.get(edge.sourceBlockId);
      if (!sourcePosition || !positions.has(edge.targetBlockId)) continue;
      const predecessors = incoming.get(edge.targetBlockId) ?? [];
      if (!predecessors.includes(sourcePosition)) predecessors.push(sourcePosition);
      incoming.set(edge.targetBlockId, predecessors);
    }
    for (const predecessors of incoming.values()) predecessors.sort((a, b) => a - b);
    return incoming;
  }, [project.edges, storyboardBlocks]);
  const canUndo = historyRef.current.canUndo;
  const canRedo = historyRef.current.canRedo;
  void historyTick;

  function undo() {
    const prev = historyRef.current.undo(projectRef.current);
    if (!prev) return;
    setProject(prev);
    setHistoryTick((n) => n + 1);
  }

  function redo() {
    const next = historyRef.current.redo(projectRef.current);
    if (!next) return;
    setProject(next);
    setHistoryTick((n) => n + 1);
  }

  function toggleSnapToGrid() {
    const enabled = !snapToGridRef.current;
    snapToGridRef.current = enabled;
    setSnapToGrid(enabled);
    try {
      localStorage.setItem(SNAP_PREFERENCE_KEY, String(enabled));
    } catch {
      // Keep the in-memory preference when storage is unavailable.
    }
  }

  function persistProjectListPreference(view: ProjectViewFilter, sort: ProjectSort) {
    try {
      localStorage.setItem(PROJECT_LIST_PREFERENCE_KEY, JSON.stringify({ view, sort }));
    } catch {
      // Keep the in-memory preference when storage is unavailable.
    }
  }

  function updateProjectViewFilter(view: ProjectViewFilter) {
    setProjectViewFilter(view);
    persistProjectListPreference(view, projectSort);
  }

  function updateProjectSort(sort: ProjectSort) {
    setProjectSort(sort);
    persistProjectListPreference(projectViewFilter, sort);
  }

  function alignSelectedToGrid() {
    const blockId = selectedIdRef.current;
    if (!blockId) return;
    const block = projectRef.current.blocks.find((item) => item.id === blockId);
    if (!block) return;
    const x = Math.round(block.x / CANVAS_GRID_SIZE) * CANVAS_GRID_SIZE;
    const y = Math.round(block.y / CANVAS_GRID_SIZE) * CANVAS_GRID_SIZE;
    if (x === block.x && y === block.y) return;
    commitChange((prev) => moveBlock(prev, blockId, x, y));
  }

  function switchView(mode: StudioViewMode) {
    if ((project.viewMode ?? "workflow") === mode) return;
    if (mode === "storyboard") {
      if (panToolActiveRef.current) updatePanTool(false);
      linkSourceIdRef.current = null;
      setLinkSourceId(null);
    }
    commitChange((prev) => setViewMode(prev, mode));
  }

  function focusWorkflowBlock(blockId: string) {
    requestAnimationFrame(() => {
      canvasMainRef.current
        ?.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(blockId)}"]`)
        ?.focus({ preventScroll: true });
    });
  }

  function openSelectionInWorkflow(blockId?: string) {
    const id = blockId ?? selectedIdRef.current;
    if (!id) return;
    const canvas = canvasMainRef.current;
    const reveal = (prev: CanvasProject) => {
      if (!canvas) return prev;
      return revealBlockInViewport(prev, id, canvas.clientWidth, canvas.clientHeight);
    };

    setSelectedId(id);
    setSelectedEdgeId(null);
    setGenerateError("");

    if (viewModeRef.current === "workflow") {
      const next = reveal(projectRef.current);
      if (next !== projectRef.current) setProject(next);
    } else {
      commitChange((prev) => reveal(setViewMode(prev, "workflow")));
    }
    focusWorkflowBlock(id);
  }

  function patchBlock(
    blockId: string,
    patch: Partial<CanvasBlock> & { params?: CanvasBlock["params"] },
    recordHistory = false,
  ) {
    const apply = (prev: CanvasProject) => ({
      ...prev,
      blocks: prev.blocks.map((b) =>
        b.id === blockId
          ? {
              ...b,
              ...patch,
              params: patch.params ? { ...b.params, ...patch.params } : b.params,
            }
          : b,
      ),
    });
    if (recordHistory) commitChange(apply);
    else setProject(apply);
  }

  function updateSelected(patch: Partial<CanvasBlock> & { params?: CanvasBlock["params"] }) {
    if (!selectedId) return;
    patchBlock(selectedId, patch, true);
  }

  function addBlock(type: "image" | "text" | "video" = "image") {
    const offset = project.blocks.length;
    const pos = { x: 80 + offset * 40, y: 80 + offset * 30 };
    let block;
    if (type === "text") {
      block = createTextBlock({ ...pos, title: `Text ${offset + 1}` });
    } else if (type === "video") {
      block = createVideoBlock({ ...pos, title: `Clip ${offset + 1}` });
    } else {
      block = createImageBlock({
        ...pos,
        title: `Shot ${String.fromCharCode(65 + offset)}`,
      });
    }
    const nextBlock = block;
    commitChange((prev) => ({ ...prev, blocks: [...prev.blocks, nextBlock] }));
    setSelectedId(nextBlock.id);
  }

  async function resetProject() {
    setResetConfirmOpen(false);
    syncRequestRef.current += 1;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    if (isStudioAuthed()) {
      await queueRemoteSave(projectRef.current).catch(() => undefined);
    }
    clearProjectLocal();
    setRemoteProjectId(null);
    historyRef.current = new ProjectHistory();
    const next = createStarterProject();
    setProject(next);
    setSelectedId(null);
    setSelectedEdgeId(null);
    setLinkSourceId(null);
    setGenerateError("");
    setHistoryTick((n) => n + 1);
    setSyncLabel(isStudioAuthed() ? "saving" : "local");
  }

  async function loadProjects() {
    setProjectsLoading(true);
    setProjectsError("");
    setProjectsNotice("");
    try {
      const projects = await apiClient.listProjects();
      setProjectSummaries(sortProjectSummaries(projects));
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Could not load projects.");
    } finally {
      setProjectsLoading(false);
    }
  }

  async function openProjects() {
    setProjectsOpen(true);
    setProjectQuery("");
    await loadProjects();
  }

  async function switchProject(projectId: string) {
    setProjectsLoading(true);
    setProjectsError("");
    syncRequestRef.current += 1;
    try {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      await queueRemoteSave(projectRef.current);
      const remote = await apiClient.getProject(projectId);
      const next = apiProjectToCanvas(remote);
      setRemoteProjectId(remote.id);
      historyRef.current = new ProjectHistory();
      setProject(next);
      setSelectedId(null);
      setSelectedEdgeId(null);
      setLinkSourceId(null);
      setInspectId(null);
      setSyncLabel("cloud");
      setHistoryTick((tick) => tick + 1);
      setProjectsOpen(false);
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Could not switch projects.");
    } finally {
      setProjectsLoading(false);
    }
  }

  async function deleteCloudProject() {
    if (!projectPendingDelete || projectPendingDelete.id === activeRemoteProjectId) return;
    const deletedTitle = projectPendingDelete.title;
    setProjectDeleteLoading(true);
    setProjectsError("");
    setProjectsNotice("");
    try {
      await apiClient.deleteProject(projectPendingDelete.id);
      setProjectSummaries((projects) =>
        projects.filter((project) => project.id !== projectPendingDelete.id),
      );
      setProjectPendingDelete(null);
      setProjectsNotice(`Deleted “${deletedTitle}”.`);
    } catch (error) {
      setProjectPendingDelete(null);
      setProjectsError(error instanceof Error ? error.message : "Could not delete project.");
    } finally {
      setProjectDeleteLoading(false);
    }
  }

  async function duplicateCloudProject(summary: ProjectSummary) {
    setProjectActionId(summary.id);
    setProjectsError("");
    setProjectsNotice("");
    try {
      const source = await apiClient.getProject(summary.id);
      const title = uniqueProjectCopyTitle(source.title, projectSummaries);
      const created = await apiClient.createProject(title);
      const duplicate: CanvasProject = {
        ...apiProjectToCanvas(source),
        id: created.id,
        title,
      };
      const saved = await apiClient.putProject(
        created.id,
        canvasProjectToApiPut(duplicate),
      );
      setProjectSummaries((projects) =>
        sortProjectSummaries([
          {
            id: saved.id,
            title: saved.title,
            view_mode: saved.view_mode,
            updated_at: saved.updated_at,
            block_count: saved.blocks.length,
          },
          ...projects,
        ]),
      );
      setProjectsNotice(`Created “${saved.title}”.`);
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Could not duplicate project.");
    } finally {
      setProjectActionId(null);
    }
  }

  async function renameCloudProject() {
    if (!projectPendingRename || projectPendingRename.id === activeRemoteProjectId) return;
    const title = projectRenameValue.trim();
    if (!title) return;
    if (projectRenameConflict) return;
    if (title === projectPendingRename.title.trim()) {
      setProjectPendingRename(null);
      return;
    }
    const projectId = projectPendingRename.id;
    setProjectActionId(projectId);
    setProjectsError("");
    setProjectsNotice("");
    try {
      const source = await apiClient.getProject(projectId);
      const saved = await apiClient.putProject(
        projectId,
        canvasProjectToApiPut({
          ...apiProjectToCanvas(source),
          title,
        }),
      );
      setProjectSummaries((projects) =>
        sortProjectSummaries(
          projects.map((project) =>
            project.id === projectId
              ? { ...project, title: saved.title, updated_at: saved.updated_at }
              : project,
          ),
        ),
      );
      setProjectPendingRename(null);
      setProjectsNotice(`Renamed project to “${saved.title}”.`);
    } catch (error) {
      setProjectPendingRename(null);
      setProjectsError(error instanceof Error ? error.message : "Could not rename project.");
    } finally {
      setProjectActionId(null);
    }
  }

  function exportCurrentProject() {
    const snapshot = projectRef.current;
    const safeTitle =
      snapshot.title
        .trim()
        .toLocaleLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "") || "studio-project";
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeTitle}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function importProjectFile(file: File) {
    setProjectFileError("");
    try {
      const imported = parseCanvasProjectJson(await file.text());
      if (!imported) {
        setProjectFileError("Import failed: the file is not a valid ComfySkill canvas.");
        return;
      }
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      syncRequestRef.current += 1;
      if (isStudioAuthed()) {
        setSyncLabel("saving");
        await queueRemoteSave(projectRef.current).catch(() => undefined);
      }
      setRemoteProjectId(null);
      historyRef.current = new ProjectHistory();
      const next: CanvasProject = {
        ...imported,
        id: crypto.randomUUID(),
        title: `${imported.title} (imported)`,
      };
      setProject(next);
      setSelectedId(null);
      setSelectedEdgeId(null);
      setLinkSourceId(null);
      setInspectId(null);
      setSyncLabel(isStudioAuthed() ? "saving" : "local");
      setHistoryTick((tick) => tick + 1);
    } catch {
      setProjectFileError("Import failed: the project file could not be read.");
    }
  }

  function selectBlock(blockId: string) {
    setSelectedId(blockId);
    setSelectedEdgeId(null);
    setGenerateError("");
    const sourceId = linkSourceIdRef.current;
    if (sourceId === blockId) {
      linkSourceIdRef.current = null;
      setLinkSourceId(null);
      return;
    }
    if (sourceId) {
      const next = addEdgeBetween(projectRef.current, sourceId, blockId);
      if (next === projectRef.current) {
        setGenerateError("That link already exists or would create a workflow cycle.");
        return;
      }
      commitChange(() => next);
      linkSourceIdRef.current = null;
      setLinkSourceId(null);
    }
  }

  function syncBlockFocusSelection(blockId: string) {
    if (panToolActiveRef.current || linkSourceIdRef.current) return;
    if (selectedIdRef.current !== blockId || selectedEdgeIdRef.current) {
      setSelectedId(blockId);
      setSelectedEdgeId(null);
      setGenerateError("");
    }
    const canvas = canvasMainRef.current;
    if (!canvas || viewModeRef.current !== "workflow") return;
    const next = revealBlockInViewport(
      projectRef.current,
      blockId,
      canvas.clientWidth,
      canvas.clientHeight,
    );
    if (next !== projectRef.current) setProject(next);
  }

  function syncEdgeFocusSelection(edgeId: string) {
    if (panToolActiveRef.current) return;
    if (selectedEdgeIdRef.current !== edgeId || selectedIdRef.current) {
      setSelectedId(null);
      setSelectedEdgeId(edgeId);
    }
    const canvas = canvasMainRef.current;
    if (!canvas || viewModeRef.current !== "workflow") return;
    const next = revealEdgeInViewport(
      projectRef.current,
      edgeId,
      canvas.clientWidth,
      canvas.clientHeight,
    );
    if (next !== projectRef.current) setProject(next);
  }

  function startLinkMode() {
    if (linkSourceIdRef.current) {
      linkSourceIdRef.current = null;
      setLinkSourceId(null);
      setGenerateError("");
      return;
    }
    const sourceId = selectedIdRef.current;
    if (!sourceId) {
      setGenerateError("Select a source block, then click Link and pick the target.");
      return;
    }
    updatePanTool(false);
    linkSourceIdRef.current = sourceId;
    setLinkSourceId(sourceId);
    setGenerateError("");
  }

  function updatePanTool(active: boolean) {
    panToolActiveRef.current = active;
    setPanToolActive(active);
    if (active) {
      linkSourceIdRef.current = null;
      setLinkSourceId(null);
    }
  }

  function returnFocusFromToolbar() {
    const returnTarget = toolbarReturnFocusRef.current;
    if (returnTarget?.isConnected) {
      returnTarget.focus();
    } else {
      canvasMainRef.current?.focus();
    }
  }

  function navigateCanvasToolbar(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      returnFocusFromToolbar();
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      const current = (e.target as HTMLElement).closest("button");
      if (
        !current ||
        current.disabled ||
        current.dataset.opensOverlay === "true"
      ) {
        return;
      }
      requestAnimationFrame(() => requestAnimationFrame(() => returnFocusFromToolbar()));
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const buttons = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
    );
    const current = (e.target as HTMLElement).closest("button");
    const index = current ? buttons.indexOf(current as HTMLButtonElement) : -1;
    if (index < 0 || buttons.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    const nextIndex =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? buttons.length - 1
          : (index + (e.key === "ArrowRight" ? 1 : -1) + buttons.length) %
            buttons.length;
    buttons[nextIndex]?.focus();
    buttons[nextIndex]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function applyTemplate(templateId: string) {
    const template = SKILL_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    let createdId = "";
    commitChange((prev) => {
      const { project: next, blockId } = applySkillTemplate(prev, template);
      createdId = blockId;
      return next;
    });
    setSelectedId(createdId);
    setLinkSourceId(null);
    setGenerateError("");
  }

  function createFromDialogue() {
    const prompt = dialoguePrompt.trim();
    if (!prompt) return;
    let createdId = "";
    commitChange((prev) => {
      const offset = prev.blocks.length;
      const common = {
        x: 80 + offset * 40,
        y: 80 + offset * 30,
        title: prompt.length > 36 ? `${prompt.slice(0, 36)}…` : prompt,
        params: { prompt, quality_tier: "standard" as const },
      };
      const block =
        dialogueBlockType === "text"
          ? createTextBlock({ ...common, bodyText: prompt })
          : dialogueBlockType === "video"
            ? createVideoBlock({ ...common, bodyText: prompt })
            : createImageBlock(common);
      createdId = block.id;
      return { ...prev, blocks: [...prev.blocks, block] };
    });
    setDialoguePrompt("");
    setSelectedId(createdId);
    setLinkSourceId(null);
    setGenerateError("");
  }

  function deleteSelected() {
    if (!selectedId) return;
    const id = selectedId;
    commitChange((prev) => removeBlock(prev, id));
    setSelectedId(null);
    setLinkSourceId(null);
  }

  function duplicateSelected() {
    if (!selectedId) return;
    duplicateBlockById(selectedId);
  }

  function duplicateBlockById(blockId: string) {
    const result = duplicateBlock(projectRef.current, blockId);
    const createdId = result.blockId;
    if (!createdId) return;
    commitChange(() => result.project);
    setSelectedId(createdId);
    requestAnimationFrame(() => {
      canvasMainRef.current
        ?.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(createdId)}"]`)
        ?.focus();
    });
  }

  function unlinkSelected() {
    if (!selectedId) return;
    commitChange((prev) => unlinkBlock(prev, selectedId));
    setLinkSourceId(null);
  }

  function deleteSelectedEdge() {
    if (!selectedEdgeId) return;
    commitChange((prev) => removeEdge(prev, selectedEdgeId));
    setSelectedEdgeId(null);
  }

  async function retryProjectSync() {
    if (!isStudioAuthed()) return;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const syncRequest = ++syncRequestRef.current;
    setSyncLabel("saving");
    try {
      await queueRemoteSave(projectRef.current);
      if (syncRequestRef.current === syncRequest) setSyncLabel("cloud");
    } catch {
      if (syncRequestRef.current === syncRequest) setSyncLabel("local*");
    }
  }

  function zoomBy(delta: number) {
    const canvas = canvasMainRef.current;
    if (!canvas) return;
    const currentZoom = projectRef.current.viewport.zoom;
    const nextZoom = Math.min(
      2,
      Math.max(0.35, Math.round((currentZoom + delta) * 100) / 100),
    );
    if (nextZoom === currentZoom) return;
    commitChange((prev) =>
      zoomViewportAt(
        prev,
        nextZoom,
        canvas.clientWidth / 2,
        canvas.clientHeight / 2,
      ),
    );
  }

  function resetZoomTo100() {
    const canvas = canvasMainRef.current;
    if (!canvas || Math.abs(projectRef.current.viewport.zoom - 1) < 0.001) return;
    commitChange((prev) =>
      zoomViewportAt(prev, 1, canvas.clientWidth / 2, canvas.clientHeight / 2),
    );
  }

  function fitWorkflowInView() {
    const canvas = canvasMainRef.current;
    const current = projectRef.current;
    if (!canvas || current.blocks.length === 0) return;
    const next = fitProjectInViewport(current, canvas.clientWidth, canvas.clientHeight);
    if (
      next.viewport.x === current.viewport.x &&
      next.viewport.y === current.viewport.y &&
      next.viewport.zoom === current.viewport.zoom
    ) {
      return;
    }
    commitChange(() => next);
  }

  function centerSelectedBlock() {
    const blockId = selectedIdRef.current;
    if (blockId) centerBlockById(blockId);
  }

  function centerBlockById(blockId: string) {
    const canvas = canvasMainRef.current;
    const current = projectRef.current;
    const block = current.blocks.find((item) => item.id === blockId);
    if (!canvas || !block) return;
    const x =
      canvas.clientWidth / 2 -
      (block.x + block.width / 2) * current.viewport.zoom;
    const y =
      canvas.clientHeight / 2 -
      (block.y + block.height / 2) * current.viewport.zoom;
    if (x === current.viewport.x && y === current.viewport.y) return;
    commitChange((prev) => ({
      ...prev,
      viewport: { ...prev.viewport, x, y },
    }));
  }

  function nudgeBlockById(blockId: string, dx: number, dy: number) {
    if (dx === 0 && dy === 0) return;
    beginNudgeHistory();
    setSelectedId(blockId);
    setSelectedEdgeId(null);
    setProject((prev) => nudgeBlock(prev, blockId, dx, dy));
  }

  function resetWorkflowPan() {
    const viewport = projectRef.current.viewport;
    if (viewport.x === 0 && viewport.y === 0) return;
    commitChange((prev) => resetViewportPan(prev));
  }

  function resetStudioViewport() {
    commitChange((prev) => resetWorkflowViewport(prev));
  }

  function startCanvasPan(e: ReactPointerEvent, vp: { x: number; y: number }) {
    e.preventDefault();
    panRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: vp.x,
      origY: vp.y,
      moved: false,
      before: projectRef.current,
    };
    setPanning(true);
  }

  async function openAssets() {
    setAssetsOpen(true);
    setAssetQuery("");
    setAssetsLoading(true);
    try {
      const { jobs } = await apiClient.listJobs();
      setAssets(
        jobs
          .filter((j) => j.status === "completed" && j.output_url)
          .slice(0, 24)
          .map((j) => ({
            id: j.id,
            url: j.output_url as string,
            prompt: j.prompt_text,
          })),
      );
    } catch {
      setAssets([]);
    } finally {
      setAssetsLoading(false);
    }
  }

  function insertAsset(asset: { id: string; url: string; prompt: string }) {
    let createdId = "";
    commitChange((prev) => {
      const { project: next, blockId } = insertAssetBlock(prev, {
        url: asset.url,
        prompt: asset.prompt,
        jobId: asset.id,
      });
      createdId = blockId;
      return next;
    });
    setSelectedId(createdId);
    setAssetsOpen(false);
  }

  async function generateSelected() {
    if (!selected) return;
    if (selected.type !== "image") {
      setGenerateError(
        selected.type === "text"
          ? "Text blocks are edited directly in the right panel."
          : "Video generation is not available yet; this block remains a storyboard placeholder.",
      );
      return;
    }
    const prompt = selected.params.prompt.trim();
    if (!prompt) {
      setGenerateError("Enter a prompt in the right panel first.");
      return;
    }

    setGenerateError("");
    setGenerating(true);
    patchBlock(selected.id, { status: "pending" });

    try {
      const { job } = await apiClient.createJob(prompt, selected.params.quality_tier, {
        project_id: project.id,
        block_id: selected.id,
      });
      patchBlock(selected.id, { jobId: job.id, status: job.status as CanvasBlockStatus });
      void apiClient
        .me()
        .then((user) => setBalanceCredits(user.balance_credits))
        .catch(() => undefined);

      let current = job;
      while (current.status !== "completed" && current.status !== "failed") {
        await new Promise((r) => setTimeout(r, 1500));
        current = await apiClient.getJob(current.id);
        patchBlock(selected.id, { status: current.status as CanvasBlockStatus });
        try {
          const timeline = await apiClient.getJobEvents(current.id);
          setJobEvents(timeline.events);
        } catch {
          /* keep last timeline snapshot */
        }
      }

      if (current.status === "completed" && current.output_url) {
        patchBlock(selected.id, {
          status: "completed",
          mediaUrls: [current.output_url, ...selected.mediaUrls].slice(0, 8),
          bodyText: prompt,
        });
      } else {
        patchBlock(selected.id, { status: "failed" });
        setGenerateError(current.error_message || "Generation failed");
      }
      try {
        const timeline = await apiClient.getJobEvents(current.id);
        setJobEvents(timeline.events);
      } catch {
        /* ignore */
      }
    } catch (err) {
      patchBlock(selected.id, { status: "failed" });
      setGenerateError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 px-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-slate-400 hover:text-white">
            ComfySkill
          </Link>
          <span className="text-slate-600">/</span>
          <input
            className="w-40 truncate rounded border border-transparent bg-transparent px-1 text-sm font-medium hover:border-slate-700 focus:border-slate-600 focus:outline-none"
            value={project.title}
            onChange={(e) =>
              commitChange((prev) => ({ ...prev, title: e.target.value }))
            }
            aria-label="Project title"
          />
          <div className="flex rounded-lg border border-slate-700 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => switchView("workflow")}
              className={`rounded-md px-2 py-1 ${
                viewMode === "workflow"
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Workflow
            </button>
            <button
              type="button"
              onClick={() => switchView("storyboard")}
              className={`rounded-md px-2 py-1 ${
                viewMode === "storyboard"
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Storyboard
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hydrated && isStudioAuthed() && (
            <button
              type="button"
              onClick={() => void openProjects()}
              className="text-xs text-slate-400 hover:text-white"
            >
              Projects
            </button>
          )}
          {balanceCredits !== null && (
            <Link
              href="/settings/billing"
              className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:border-sky-500/60 hover:text-white"
            >
              {balanceCredits.toLocaleString()} credits
            </Link>
          )}
          <Link href="/app" className="text-xs text-slate-400 hover:text-white">
            Quick form
          </Link>
          {hydrated &&
            (isStudioAuthed() ? (
              <button
                type="button"
                className="text-xs text-slate-400 hover:text-white"
                onClick={() => {
                  void clearAuth().then(() => {
                    setBalanceCredits(null);
                    window.location.href = "/";
                  });
                }}
              >
                Log out
              </button>
            ) : (
              <Link href="/login" className="text-xs text-slate-400 hover:text-white">
                Log in
              </Link>
            ))}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Canvas — flow + results */}
        <main
          ref={canvasMainRef}
          tabIndex={-1}
          className={`relative min-w-0 flex-1 overflow-hidden ${
            panning
              ? "cursor-grabbing"
              : spaceHeld || panToolActive
                ? "cursor-grab"
                : "cursor-default"
          }`}
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(148,163,184,0.18) 1px, transparent 1px)",
            backgroundSize: `${CANVAS_GRID_SIZE * project.viewport.zoom}px ${CANVAS_GRID_SIZE * project.viewport.zoom}px`,
            backgroundPosition: `${project.viewport.x}px ${project.viewport.y}px`,
          }}
          onClick={() => {
            if (panToolActiveRef.current) return;
            if (consumeSuppressedCanvasClick()) return;
            setSelectedId(null);
            setSelectedEdgeId(null);
          }}
          onPointerDown={(e) => {
            if (viewMode !== "workflow") return;
            if (
              e.button === 1 ||
              (e.button === 0 && (spaceHeldRef.current || panToolActiveRef.current))
            ) {
              startCanvasPan(e, project.viewport);
            }
          }}
          onAuxClick={(e) => {
            // Prevent middle-click default (autoscroll) when panning
            if (e.button === 1) e.preventDefault();
          }}
        >
          {generateError && (
            <div
              role="alert"
              className="absolute left-1/2 top-4 z-30 flex max-w-md -translate-x-1/2 items-start gap-3 rounded-lg border border-rose-500/40 bg-rose-950/90 px-4 py-2 text-xs text-rose-200 shadow-xl"
            >
              <span>{generateError}</span>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  generateErrorRef.current = "";
                  setGenerateError("");
                }}
                className="shrink-0 text-rose-300 hover:text-white"
                aria-label="Dismiss canvas error"
              >
                ×
              </button>
            </div>
          )}
          {viewMode === "storyboard" ? (
            <div
              className="flex h-full gap-4 overflow-x-auto px-6 py-8"
              onClick={(e) => e.stopPropagation()}
            >
              {storyboardBlocks.length === 0 ? (
                <p className="text-sm text-slate-500">Add blocks to build the storyboard.</p>
              ) : (
                storyboardBlocks.map((block, index) => {
                  const active = block.id === selectedId;
                  const predecessors = storyboardPredecessors.get(block.id) ?? [];
                  return (
                    <button
                      key={block.id}
                      id={`storyboard-card-${block.id}`}
                      type="button"
                      aria-label={`Storyboard card ${index + 1}, ${block.title}`}
                      aria-pressed={active}
                      aria-keyshortcuts="Enter Shift+Enter O ArrowLeft ArrowRight Delete Backspace"
                      onClick={() => selectBlock(block.id)}
                      onDoubleClick={() => setInspectId(block.id)}
                      onKeyDown={(e) => {
                        if (
                          e.key.toLowerCase() === "o" &&
                          !e.metaKey &&
                          !e.ctrlKey &&
                          !e.altKey
                        ) {
                          e.preventDefault();
                          e.stopPropagation();
                          openSelectionInWorkflow(block.id);
                          return;
                        }
                        if (e.key === "Enter" && e.shiftKey) {
                          e.preventDefault();
                          e.stopPropagation();
                          selectBlock(block.id);
                          setInspectId(block.id);
                          return;
                        }
                        if (e.key === "Delete" || e.key === "Backspace") {
                          e.preventDefault();
                          e.stopPropagation();
                          const blocks = storyboardOrderedBlocks(projectRef.current);
                          const currentIndex = blocks.findIndex(
                            (item) => item.id === block.id,
                          );
                          commitChange((prev) => removeBlock(prev, block.id));
                          if (selectedIdRef.current === block.id) setSelectedId(null);
                          if (inspectIdRef.current === block.id) setInspectId(null);
                          const remaining = blocks.filter((item) => item.id !== block.id);
                          const next =
                            remaining[
                              Math.min(
                                Math.max(currentIndex, 0),
                                Math.max(remaining.length - 1, 0),
                              )
                            ];
                          if (next) {
                            setSelectedId(next.id);
                            requestAnimationFrame(() => {
                              document
                                .getElementById(`storyboard-card-${next.id}`)
                                ?.focus({ preventScroll: true });
                            });
                          }
                        }
                      }}
                      className={`flex w-56 shrink-0 flex-col overflow-hidden rounded-xl border text-left shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 ${
                        active
                          ? "border-sky-400 ring-2 ring-sky-400/40"
                          : "border-slate-700 hover:border-slate-500"
                      } bg-slate-900/95`}
                    >
                      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
                        <span className="text-xs font-medium">
                          {index + 1}. {block.title}
                        </span>
                        <span className="text-[10px] uppercase text-slate-500">{block.type}</span>
                      </div>
                      <div className="flex h-36 items-center justify-center bg-slate-950 p-2">
                        {block.mediaUrls[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={block.mediaUrls[0]}
                            alt=""
                            className="max-h-full max-w-full rounded object-contain"
                          />
                        ) : (
                          <p className="line-clamp-4 px-2 text-center text-[11px] text-slate-500">
                            {block.bodyText || block.params.prompt || "Empty"}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-slate-800 px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${BLOCK_STATUS_META[block.status].className}`}
                        >
                          {BLOCK_STATUS_META[block.status].label}
                        </span>
                        <span
                          className="truncate text-[10px] text-slate-500"
                          title={
                            predecessors.length > 0
                              ? `Depends on cards ${predecessors.join(", ")}`
                              : "Workflow start"
                          }
                        >
                          {predecessors.length > 0
                            ? `After ${predecessors.join(", ")}`
                            : "Start"}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <>
          <svg
            className="pointer-events-none absolute inset-0 z-30 h-full w-full origin-top-left"
            style={{
              transform: `translate(${project.viewport.x}px, ${project.viewport.y}px) scale(${project.viewport.zoom})`,
            }}
          >
            <defs>
              <marker
                id="studio-edge-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(148,163,184,0.75)" />
              </marker>
              <marker
                id="studio-edge-arrow-selected"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(56,189,248,0.95)" />
              </marker>
            </defs>
            {project.edges.map((edge) => {
              const src = project.blocks.find((b) => b.id === edge.sourceBlockId);
              const tgt = project.blocks.find((b) => b.id === edge.targetBlockId);
              if (!src || !tgt) return null;
              const x1 = src.x + src.width;
              const y1 = src.y + src.height / 2;
              const x2 = tgt.x;
              const y2 = tgt.y + tgt.height / 2;
              const path = `M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x2 - 60} ${y2}, ${x2} ${y2}`;
              const selected = edge.id === selectedEdgeId;
              return (
                <g key={edge.id}>
                  <path
                    d={path}
                    stroke="transparent"
                    strokeWidth={12}
                    fill="none"
                    tabIndex={panToolActive ? -1 : 0}
                    role="button"
                    aria-label={`Link from ${src.title} to ${tgt.title}`}
                    aria-pressed={selected}
                    aria-keyshortcuts="Enter Space Delete Backspace"
                    className="pointer-events-auto cursor-pointer focus-visible:stroke-sky-300/30 focus-visible:outline-none"
                    onFocus={() => syncEdgeFocusSelection(edge.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (panToolActiveRef.current) return;
                      if (consumeSuppressedCanvasClick()) return;
                      setSelectedId(null);
                      setSelectedEdgeId(edge.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Delete" || e.key === "Backspace") {
                        e.preventDefault();
                        e.stopPropagation();
                        commitChange((prev) => removeEdge(prev, edge.id));
                        setSelectedEdgeId(null);
                        requestAnimationFrame(() => canvasMainRef.current?.focus());
                        return;
                      }
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedId(null);
                      setSelectedEdgeId(edge.id);
                    }}
                  />
                  <path
                    d={path}
                    stroke={selected ? "rgba(56,189,248,0.95)" : "rgba(148,163,184,0.55)"}
                    strokeWidth={selected ? 3 : 1.5}
                    fill="none"
                    markerEnd={
                      selected
                        ? "url(#studio-edge-arrow-selected)"
                        : "url(#studio-edge-arrow)"
                    }
                  />
                </g>
              );
            })}
          </svg>

          <div
            className="absolute inset-0 origin-top-left"
            style={{
              transform: `translate(${project.viewport.x}px, ${project.viewport.y}px) scale(${project.viewport.zoom})`,
            }}
            onPointerDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.button !== 0 && e.button !== 1) return;
              startCanvasPan(e, projectRef.current.viewport);
            }}
          >
          {project.blocks.map((block) => {
            const active = block.id === selectedId;
            const isLinkSource = block.id === linkSourceId;
            return (
              <div
                key={block.id}
                data-block-id={block.id}
                role="button"
                tabIndex={panToolActive ? -1 : 0}
                aria-pressed={active}
                aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Shift+ArrowUp Shift+ArrowDown Shift+ArrowLeft Shift+ArrowRight C Enter Shift+Enter Space Delete Backspace Meta+D Control+D"
                aria-label={
                  linkSourceBlock
                    ? isLinkSource
                      ? `${block.title}, link source. Activate to cancel linking.`
                      : `Link ${linkSourceBlock.title} to ${block.title}`
                    : block.title
                }
                className={`absolute rounded-lg border text-left shadow-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50 ${
                  linkSourceId ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"
                } ${
                  isLinkSource
                    ? "border-amber-400 ring-2 ring-amber-400/40"
                    : active
                      ? "border-sky-400 ring-2 ring-sky-400/40"
                    : "border-slate-700 hover:border-slate-500"
                } bg-slate-900/95`}
                style={{
                  left: block.x,
                  top: block.y,
                  width: block.width,
                  height: block.height,
                }}
                onFocus={() => syncBlockFocusSelection(block.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (panToolActiveRef.current) return;
                  if (consumeSuppressedCanvasClick()) return;
                  selectBlock(block.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (panToolActiveRef.current) return;
                  setInspectId(block.id);
                }}
                onPointerDown={(e) => {
                  if (e.button === 1) {
                    e.stopPropagation();
                    startCanvasPan(e, projectRef.current.viewport);
                    return;
                  }
                  if (e.button !== 0) return;
                  if (spaceHeldRef.current || panToolActiveRef.current) {
                    startCanvasPan(e, projectRef.current.viewport);
                    return;
                  }
                  e.stopPropagation();
                  const wasLinking = Boolean(linkSourceId);
                  selectBlock(block.id);
                  if (wasLinking) return;
                  dragRef.current = {
                    id: block.id,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    origX: block.x,
                    origY: block.y,
                    moved: false,
                    before: projectRef.current,
                  };
                }}
                onKeyDown={(e) => {
                  const arrow =
                    e.key === "ArrowLeft" ||
                    e.key === "ArrowRight" ||
                    e.key === "ArrowUp" ||
                    e.key === "ArrowDown";
                  if (arrow && viewModeRef.current === "workflow") {
                    e.preventDefault();
                    e.stopPropagation();
                    const step = e.shiftKey ? 20 : 4;
                    const dx =
                      e.key === "ArrowLeft"
                        ? -step
                        : e.key === "ArrowRight"
                          ? step
                          : 0;
                    const dy =
                      e.key === "ArrowUp"
                        ? -step
                        : e.key === "ArrowDown"
                          ? step
                          : 0;
                    nudgeBlockById(block.id, dx, dy);
                    return;
                  }
                  if (
                    e.key.toLowerCase() === "c" &&
                    !e.metaKey &&
                    !e.ctrlKey &&
                    !e.altKey
                  ) {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedId(block.id);
                    centerBlockById(block.id);
                    return;
                  }
                  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
                    e.preventDefault();
                    e.stopPropagation();
                    duplicateBlockById(block.id);
                    return;
                  }
                  if (e.key === "Delete" || e.key === "Backspace") {
                    e.preventDefault();
                    e.stopPropagation();
                    const selectedEdge = projectRef.current.edges.find(
                      (edge) => edge.id === selectedEdgeIdRef.current,
                    );
                    commitChange((prev) => removeBlock(prev, block.id));
                    if (selectedIdRef.current === block.id) setSelectedId(null);
                    if (
                      selectedEdge?.sourceBlockId === block.id ||
                      selectedEdge?.targetBlockId === block.id
                    ) {
                      setSelectedEdgeId(null);
                    }
                    if (linkSourceIdRef.current === block.id) {
                      linkSourceIdRef.current = null;
                      setLinkSourceId(null);
                    }
                    if (inspectIdRef.current === block.id) setInspectId(null);
                    requestAnimationFrame(() => canvasMainRef.current?.focus());
                    return;
                  }
                  if (
                    e.key === "Enter" &&
                    e.shiftKey &&
                    !linkSourceIdRef.current
                  ) {
                    e.preventDefault();
                    e.stopPropagation();
                    selectBlock(block.id);
                    setInspectId(block.id);
                    return;
                  }
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectBlock(block.id);
                  }
                }}
              >
                <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
                  <span className="text-xs font-medium">{block.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-slate-500">
                      {block.type}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${BLOCK_STATUS_META[block.status].className}`}
                    >
                      {BLOCK_STATUS_META[block.status].label}
                    </span>
                  </div>
                </div>
                <div className="flex h-[calc(100%-36px)] items-center justify-center px-3">
                  {block.type === "text" ? (
                    <p className="line-clamp-6 w-full text-left text-xs text-slate-300">
                      {block.bodyText || block.params.prompt || "Empty text block"}
                    </p>
                  ) : block.type === "video" ? (
                    <div className="flex w-full flex-col gap-2">
                      <div className="grid grid-cols-4 gap-1">
                        {[0, 1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="flex aspect-video items-center justify-center rounded bg-slate-800 text-[9px] text-slate-500"
                          >
                            {block.mediaUrls[i] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={block.mediaUrls[i]}
                                alt=""
                                className="h-full w-full rounded object-cover"
                              />
                            ) : (
                              `F${i + 1}`
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="line-clamp-2 text-[10px] text-slate-500">
                        {block.bodyText || block.params.prompt || "Video placeholder"}
                      </p>
                    </div>
                  ) : block.mediaUrls.length > 1 ? (
                    <div className="grid w-full grid-cols-2 gap-1">
                      {block.mediaUrls.slice(0, 4).map((url) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={url}
                          src={url}
                          alt=""
                          className="aspect-square rounded object-cover"
                        />
                      ))}
                    </div>
                  ) : block.mediaUrls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={block.mediaUrls[0]}
                      alt=""
                      className="max-h-full max-w-full rounded object-contain"
                    />
                  ) : (
                    <p className="line-clamp-4 text-center text-xs text-slate-500">
                      {block.params.prompt || "No result yet — edit params on the right"}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          </div>

          <div
            ref={canvasToolbarRef}
            role="toolbar"
            aria-label="Canvas tools"
            aria-orientation="horizontal"
            aria-keyshortcuts="T"
            data-canvas-toolbar
            className="absolute bottom-4 left-1/2 flex max-w-[calc(100%_-_2rem)] -translate-x-1/2 gap-2 overflow-x-auto rounded-full border border-slate-700 bg-slate-900/90 px-3 py-2 shadow-xl [&>button]:shrink-0 [&>button:focus-visible]:outline [&>button:focus-visible]:outline-2 [&>button:focus-visible]:outline-sky-400"
            onFocusCapture={(e) => {
              const related = e.relatedTarget;
              if (
                related instanceof HTMLElement &&
                !e.currentTarget.contains(related)
              ) {
                toolbarReturnFocusRef.current = related;
              }
            }}
            onKeyDown={navigateCanvasToolbar}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => {
              e.stopPropagation();
              if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
              e.preventDefault();
              e.currentTarget.scrollLeft += e.deltaY;
            }}
            onAuxClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                addBlock("image");
              }}
              className="rounded-full bg-sky-600 px-3 py-1 text-xs font-medium hover:bg-sky-500"
            >
              + Image
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                addBlock("text");
              }}
              className="rounded-full bg-slate-700 px-3 py-1 text-xs font-medium hover:bg-slate-600"
            >
              + Text
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                addBlock("video");
              }}
              className="rounded-full bg-slate-700 px-3 py-1 text-xs font-medium hover:bg-slate-600"
            >
              + Video
            </button>
            <button
              type="button"
              data-opens-overlay="true"
              onClick={(e) => {
                e.stopPropagation();
                void openAssets();
              }}
              className="rounded-full bg-slate-700 px-3 py-1 text-xs font-medium hover:bg-slate-600"
            >
              Assets
            </button>
            <button
              type="button"
              aria-pressed={snapToGrid}
              onClick={(e) => {
                e.stopPropagation();
                toggleSnapToGrid();
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                snapToGrid
                  ? "bg-sky-500 text-slate-950"
                  : "bg-slate-700 hover:bg-slate-600"
              }`}
              title="Align dragged blocks to the canvas grid (G)"
            >
              Snap
            </button>
            <button
              type="button"
              disabled={!selectedId}
              onClick={(e) => {
                e.stopPropagation();
                alignSelectedToGrid();
              }}
              className="rounded-full bg-slate-700 px-3 py-1 text-xs font-medium hover:bg-slate-600 disabled:opacity-40"
              title="Align the selected block to the nearest grid point (Shift+G)"
            >
              Align
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                startLinkMode();
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                linkSourceId
                  ? "bg-amber-500 text-slate-950"
                  : "bg-slate-700 hover:bg-slate-600"
              }`}
              aria-pressed={Boolean(linkSourceId)}
              aria-keyshortcuts="L"
              aria-label={
                linkSourceBlock
                  ? `Cancel linking from ${linkSourceBlock.title}`
                  : "Start linking from the selected block"
              }
              title={linkSourceId ? "Cancel link mode (L)" : "Start link mode (L)"}
            >
              {linkSourceId ? "Pick target…" : "Link"}
            </button>
            {linkSourceBlock && (
              <span role="status" aria-live="polite" className="sr-only">
                Linking from {linkSourceBlock.title}. Choose a target block, or activate the
                source again to cancel.
              </span>
            )}
            <button
              type="button"
              disabled={!selectedId}
              onClick={(e) => {
                e.stopPropagation();
                deleteSelected();
              }}
              className="rounded-full bg-slate-700 px-3 py-1 text-xs font-medium hover:bg-rose-600 disabled:opacity-40"
              title="Delete (⌫)"
            >
              Delete
            </button>
            <button
              type="button"
              disabled={!selectedId}
              onClick={(e) => {
                e.stopPropagation();
                duplicateSelected();
              }}
              className="rounded-full bg-slate-700 px-3 py-1 text-xs font-medium hover:bg-slate-600 disabled:opacity-40"
              title="Duplicate (⌘D)"
            >
              Duplicate
            </button>
            <button
              type="button"
              disabled={
                !selectedId ||
                !project.edges.some(
                  (edge) =>
                    edge.sourceBlockId === selectedId ||
                    edge.targetBlockId === selectedId,
                )
              }
              onClick={(e) => {
                e.stopPropagation();
                unlinkSelected();
              }}
              className="rounded-full bg-slate-700 px-3 py-1 text-xs font-medium hover:bg-slate-600 disabled:opacity-40"
              title="Remove edges on this block"
            >
              Unlink
            </button>
            <button
              type="button"
              disabled={!selectedEdgeId}
              onClick={(e) => {
                e.stopPropagation();
                deleteSelectedEdge();
              }}
              className="rounded-full bg-slate-700 px-3 py-1 text-xs font-medium hover:bg-rose-600 disabled:opacity-40"
              title="Delete selected link (⌫)"
            >
              Delete link
            </button>
            <button
              type="button"
              disabled={!canUndo}
              onClick={(e) => {
                e.stopPropagation();
                undo();
              }}
              className="rounded-full bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700 disabled:opacity-40"
              title="Undo (⌘Z)"
            >
              Undo
            </button>
            <button
              type="button"
              disabled={!canRedo}
              onClick={(e) => {
                e.stopPropagation();
                redo();
              }}
              className="rounded-full bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700 disabled:opacity-40"
              title="Redo (⌘⇧Z)"
            >
              Redo
            </button>
            <button
              type="button"
              disabled={project.viewport.zoom <= 0.35}
              onClick={(e) => {
                e.stopPropagation();
                zoomBy(-0.1);
              }}
              className="rounded-full bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              title="Zoom out from canvas center (−)"
              aria-label="Zoom out"
              aria-keyshortcuts="-"
            >
              −
            </button>
            <button
              type="button"
              disabled={project.viewport.zoom >= 2}
              onClick={(e) => {
                e.stopPropagation();
                zoomBy(0.1);
              }}
              className="rounded-full bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              title="Zoom in toward canvas center (+)"
              aria-label="Zoom in"
              aria-keyshortcuts="+"
            >
              +
            </button>
            <button
              type="button"
              disabled={Math.abs(project.viewport.zoom - 1) < 0.001}
              onClick={(e) => {
                e.stopPropagation();
                resetZoomTo100();
              }}
              className="min-w-12 rounded-full bg-slate-800 px-2 py-1 text-xs tabular-nums hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              title="Reset zoom to 100% (0)"
              aria-label={`Current zoom ${Math.round(project.viewport.zoom * 100)}%. Reset to 100%`}
              aria-keyshortcuts="0"
            >
              {Math.round(project.viewport.zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updatePanTool(!panToolActiveRef.current);
              }}
              className={`rounded-full px-2 py-1 text-xs ${
                panToolActive
                  ? "bg-sky-500 text-slate-950"
                  : "bg-slate-800 hover:bg-slate-700"
              }`}
              title="Toggle hand tool (H)"
              aria-keyshortcuts="H"
              aria-pressed={panToolActive}
            >
              Hand
            </button>
            <button
              type="button"
              disabled={
                project.viewport.x === 0 &&
                project.viewport.y === 0 &&
                Math.abs(project.viewport.zoom - 1) < 0.001
              }
              onClick={(e) => {
                e.stopPropagation();
                resetStudioViewport();
              }}
              className="rounded-full bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              title="Reset pan and zoom (Shift+0)"
              aria-keyshortcuts="Shift+0"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                resetWorkflowPan();
              }}
              className="rounded-full bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700"
              title="Reset pan (Home)"
              aria-keyshortcuts="Home"
            >
              Origin
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fitWorkflowInView();
              }}
              className="rounded-full bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700"
              title="Fit all blocks in view (F)"
              aria-keyshortcuts="F"
            >
              Fit
            </button>
            <button
              type="button"
              disabled={!selectedId}
              onClick={(e) => {
                e.stopPropagation();
                centerSelectedBlock();
              }}
              className="rounded-full bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              title="Center selected block (C)"
              aria-keyshortcuts="C"
            >
              Center
            </button>
            <button
              type="button"
              data-opens-overlay="true"
              onClick={(e) => {
                e.stopPropagation();
                setHelpOpen(true);
              }}
              className="rounded-full bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700"
              title="Studio help (?)"
            >
              Help
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                exportCurrentProject();
              }}
              className="rounded-full bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700"
              title="Export current canvas as JSON"
            >
              Export
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const input = e.currentTarget;
                const file = input.files?.[0];
                if (!file) return;
                void importProjectFile(file).finally(() => {
                  input.value = "";
                });
              }}
            />
            <button
              type="button"
              data-opens-overlay="true"
              onClick={(e) => {
                e.stopPropagation();
                setProjectFileError("");
                importInputRef.current?.click();
              }}
              className="rounded-full bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700"
              title="Import a canvas JSON backup"
            >
              Import
            </button>
            <button
              type="button"
              data-opens-overlay="true"
              onClick={(e) => {
                e.stopPropagation();
                setResetConfirmOpen(true);
              }}
              className="rounded-full px-3 py-1 text-xs text-slate-400 hover:text-white"
            >
              New project
            </button>
            <span className="px-2 text-xs leading-6 text-slate-500">
              {Math.round(project.viewport.zoom * 100)}% · Arrows nudge (one undo burst) · Wheel zoom ·{" "}
              {syncLabel === "local*" ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void retryProjectSync();
                  }}
                  className="text-amber-400 hover:text-amber-300"
                >
                  sync failed · Retry
                </button>
              ) : syncLabel === "cloud" ? (
                "saved"
              ) : syncLabel === "saving" ? (
                "saving…"
              ) : (
                "local"
              )}
            </span>
            {projectFileError && (
              <span className="max-w-52 truncate text-xs text-rose-400" title={projectFileError}>
                {projectFileError}
              </span>
            )}
          </div>
            </>
          )}
        </main>

        {/* Right — params when selected */}
        <aside className="flex w-80 shrink-0 flex-col border-l border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="text-sm font-semibold">
              {selected ? "Block params" : "New dialogue"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {selected
                ? "Edit this block on the right; canvas stays result-focused."
                : "Select a block to edit params, or add a block from the toolbar."}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {selected ? (
              <div className="space-y-4">
                <label className="block text-xs text-slate-400">
                  Title
                  <input
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    value={selected.title}
                    onChange={(e) => updateSelected({ title: e.target.value })}
                  />
                </label>
                {selected.type === "text" && (
                  <label className="block text-xs text-slate-400">
                    Body
                    <textarea
                      className="mt-1 h-28 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                      value={selected.bodyText ?? ""}
                      onChange={(e) => updateSelected({ bodyText: e.target.value })}
                    />
                  </label>
                )}
                <label className="block text-xs text-slate-400">
                  Prompt
                  <textarea
                    className="mt-1 h-28 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    value={selected.params.prompt}
                    onChange={(e) =>
                      updateSelected({
                        params: { ...selected.params, prompt: e.target.value },
                      })
                    }
                  />
                </label>
                {selected.type === "image" && (
                  <label className="block text-xs text-slate-400">
                    <span className="flex items-center justify-between">
                      <span>Quality</span>
                      <span className="text-slate-500">
                        Est. {QUALITY_CREDITS[selected.params.quality_tier]} credits
                      </span>
                    </span>
                    <select
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                      value={selected.params.quality_tier}
                      onChange={(e) =>
                        updateSelected({
                          params: {
                            ...selected.params,
                            quality_tier: e.target.value as CanvasBlock["params"]["quality_tier"],
                          },
                        })
                      }
                    >
                      <option value="premium">Good · 50 credits</option>
                      <option value="standard">Medium · 20 credits</option>
                      <option value="budget">Budget · 8 credits</option>
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  disabled={generating || selected.type !== "image"}
                  onClick={() => void generateSelected()}
                  className="w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium hover:bg-sky-500 disabled:opacity-50"
                >
                  {selected.type !== "image"
                    ? `${selected.type === "text" ? "Text" : "Video"} generation unavailable`
                    : generating
                      ? "Generating…"
                      : "Generate image"}
                </button>
                <button
                  type="button"
                  onClick={() => setInspectId(selected.id)}
                  className="w-full rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:border-sky-500/60"
                >
                  Inspect result
                </button>
                {selected.type !== "image" ? (
                  <p className="text-[11px] text-amber-400">
                    {selected.type === "text"
                      ? "Edit text content directly above; no generation job is required."
                      : "Video blocks are placeholders until a video capability is connected."}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Runs POST /jobs and writes the result back onto this canvas block. Double-click
                    a block to inspect.
                  </p>
                )}
                {selected.jobId && jobEvents.length > 0 && (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Job timeline
                    </div>
                    <ol className="mt-2 space-y-1.5">
                      {jobEvents.map((ev) => (
                        <li
                          key={ev.id}
                          className="flex items-baseline justify-between gap-2 text-[11px]"
                        >
                          <span className="font-medium text-slate-300">{ev.event_type}</span>
                          <span className="shrink-0 text-slate-600">
                            {new Date(ev.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    createFromDialogue();
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-950/80 p-3"
                >
                  <label className="mb-3 block text-xs text-slate-400">
                    Block type
                    <select
                      value={dialogueBlockType}
                      onChange={(e) =>
                        setDialogueBlockType(e.target.value as CanvasBlock["type"])
                      }
                      className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-sky-500"
                    >
                      <option value="image">Image</option>
                      <option value="text">Text</option>
                      <option value="video">Video</option>
                    </select>
                  </label>
                  <label className="block text-xs text-slate-400">
                    What do you want to create?
                    <textarea
                      value={dialoguePrompt}
                      onChange={(e) => setDialoguePrompt(e.target.value)}
                      placeholder="Describe a shot, scene, or visual idea…"
                      className="mt-2 h-24 w-full resize-none rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-sky-500"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={!dialoguePrompt.trim()}
                    className="mt-2 w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Add draft to canvas
                  </button>
                </form>
                <p className="text-xs text-slate-400">
                  Or start from a Skill template:
                </p>
                {SKILL_TEMPLATES.map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => applyTemplate(skill.id)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/80 p-3 text-left hover:border-sky-500/60"
                  >
                    <div className="text-sm font-medium text-slate-100">{skill.title}</div>
                    <div className="mt-1 text-[11px] text-slate-500">{skill.blurb}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {projectsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setProjectsOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold">Cloud projects</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Your current canvas is saved before switching.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={projectsLoading}
                  onClick={() => void loadProjects()}
                  className="text-xs text-slate-400 hover:text-white disabled:opacity-50"
                >
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => setProjectsOpen(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-3">
              {!projectsLoading && !projectsError && projectSummaries.length > 0 && (
                <div className="mb-3 flex flex-col gap-2 sm:flex-row">
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">Search cloud projects</span>
                    <input
                      ref={projectSearchInputRef}
                      autoFocus
                      type="search"
                      value={projectQuery}
                      onChange={(e) => setProjectQuery(e.target.value)}
                      placeholder="Search projects…"
                      aria-keyshortcuts="/"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-sky-500"
                    />
                  </label>
                  <label>
                    <span className="sr-only">Filter projects by view</span>
                    <select
                      value={projectViewFilter}
                      onChange={(e) =>
                        updateProjectViewFilter(e.target.value as ProjectViewFilter)
                      }
                      className="h-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-300 outline-none focus:border-sky-500"
                    >
                      <option value="all">All views ({projectSummaries.length})</option>
                      <option value="workflow">Workflow ({projectViewCounts.workflow})</option>
                      <option value="storyboard">Storyboard ({projectViewCounts.storyboard})</option>
                    </select>
                  </label>
                  <label>
                    <span className="sr-only">Sort cloud projects</span>
                    <select
                      value={projectSort}
                      onChange={(e) => updateProjectSort(e.target.value as ProjectSort)}
                      className="h-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-300 outline-none focus:border-sky-500"
                    >
                      <option value="updated-desc">Recently updated</option>
                      <option value="updated-asc">Oldest updated</option>
                      <option value="title-asc">Name A–Z</option>
                      <option value="title-desc">Name Z–A</option>
                    </select>
                  </label>
                </div>
              )}
              {!projectsLoading && !projectsError && projectSummaries.length > 0 && (
                <div className="mb-3 flex items-center justify-between gap-3 px-1 text-xs text-slate-500">
                  <span>
                    Showing {filteredProjects.length} of {projectSummaries.length}
                  </span>
                  {activeProjectHidden && (
                    <button
                      type="button"
                      onClick={() => {
                        setProjectQuery("");
                        updateProjectViewFilter("all");
                      }}
                      className="text-amber-300 hover:text-amber-200"
                    >
                      Current project hidden · Show
                    </button>
                  )}
                </div>
              )}
              {projectsNotice && !projectsError && (
                <p
                  role="status"
                  aria-live="polite"
                  className="mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300"
                >
                  {projectsNotice}
                </p>
              )}
              {projectsLoading ? (
                <p className="px-2 py-6 text-center text-sm text-slate-500">
                  Loading projects…
                </p>
              ) : projectsError ? (
                <div className="px-2 py-6 text-center">
                  <p className="text-sm text-rose-400">{projectsError}</p>
                  <button
                    type="button"
                    onClick={() => void loadProjects()}
                    className="mt-3 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-slate-500 hover:text-white"
                  >
                    Retry
                  </button>
                </div>
              ) : projectSummaries.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-slate-500">
                  No cloud projects yet.
                </p>
              ) : filteredProjects.length === 0 ? (
                <div className="px-2 py-6 text-center">
                  <p className="text-sm text-slate-500">No projects match the current filters.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setProjectQuery("");
                      updateProjectViewFilter("all");
                    }}
                    className="mt-3 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-slate-500 hover:text-white"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredProjects.map((summary) => (
                    <div
                      key={summary.id}
                      className={`flex items-stretch overflow-hidden rounded-lg border ${
                        summary.id === activeRemoteProjectId
                          ? "cursor-default border-sky-500/50 bg-sky-500/5"
                          : "border-slate-800 bg-slate-950/60 hover:border-sky-500/60"
                      }`}
                    >
                      <button
                        type="button"
                        disabled={summary.id === activeRemoteProjectId}
                        onClick={() => void switchProject(summary.id)}
                        className="flex min-w-0 flex-1 items-center justify-between px-3 py-3 text-left"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-200">
                            {summary.title}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {formatProjectUpdatedAt(summary.updated_at)}
                          </p>
                        </div>
                        <div className="ml-4 flex shrink-0 items-center gap-2">
                          {summary.id === activeRemoteProjectId && (
                            <span className="rounded-full bg-sky-500/15 px-2 py-1 text-[10px] text-sky-300">
                              Current
                            </span>
                          )}
                          <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] capitalize text-slate-400">
                            {summary.view_mode}
                          </span>
                          <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] text-slate-400">
                            {summary.block_count} blocks
                          </span>
                        </div>
                      </button>
                      {summary.id !== activeRemoteProjectId && (
                        <button
                          type="button"
                          disabled={projectActionId !== null}
                          onClick={() => {
                            setProjectPendingRename(summary);
                            setProjectRenameValue(summary.title);
                          }}
                          className="border-l border-slate-800 px-3 text-xs text-slate-500 hover:bg-sky-500/10 hover:text-sky-300 disabled:opacity-50"
                          aria-label={`Rename ${summary.title}`}
                        >
                          Rename
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={projectActionId !== null}
                        onClick={() => void duplicateCloudProject(summary)}
                        className="border-l border-slate-800 px-3 text-xs text-slate-500 hover:bg-sky-500/10 hover:text-sky-300 disabled:opacity-50"
                        aria-label={`Duplicate ${summary.title}`}
                      >
                        {projectActionId === summary.id ? "Working…" : "Duplicate"}
                      </button>
                      {summary.id !== activeRemoteProjectId && (
                        <button
                          type="button"
                          disabled={projectActionId !== null}
                          onClick={() => setProjectPendingDelete(summary)}
                          className="border-l border-slate-800 px-3 text-xs text-slate-500 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
                          aria-label={`Delete ${summary.title}`}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {projectPendingRename && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-6"
          onClick={() => {
            if (projectActionId !== projectPendingRename.id) setProjectPendingRename(null);
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-project-title"
            className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
            onSubmit={(e) => {
              e.preventDefault();
              void renameCloudProject();
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="rename-project-title" className="text-sm font-semibold">
              Rename cloud project
            </h3>
            <label className="mt-4 block text-xs text-slate-400">
              Project title
              <input
                autoFocus
                maxLength={120}
                value={projectRenameValue}
                onChange={(e) => setProjectRenameValue(e.target.value)}
                aria-invalid={projectRenameConflict}
                aria-describedby={projectRenameConflict ? "rename-project-error" : undefined}
                className={`mt-2 w-full rounded-lg border bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none ${
                  projectRenameConflict
                    ? "border-rose-500 focus:border-rose-400"
                    : "border-slate-700 focus:border-sky-500"
                }`}
              />
            </label>
            {projectRenameConflict && (
              <p id="rename-project-error" className="mt-2 text-xs text-rose-400">
                Another cloud project already uses this title.
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={projectActionId === projectPendingRename.id}
                onClick={() => setProjectPendingRename(null)}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  !projectRenameValue.trim() ||
                  projectRenameValue.trim() === projectPendingRename.title.trim() ||
                  projectRenameConflict ||
                  projectActionId === projectPendingRename.id
                }
                className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {projectActionId === projectPendingRename.id ? "Renaming…" : "Rename"}
              </button>
            </div>
          </form>
        </div>
      )}

      {projectPendingDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-6"
          onClick={() => setProjectPendingDelete(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-project-title"
            className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-project-title" className="text-sm font-semibold">
              Delete “{projectPendingDelete.title}”?
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              This permanently removes the cloud project and its saved canvas layout. Generated
              jobs and assets are not deleted.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={projectDeleteLoading}
                onClick={() => setProjectPendingDelete(null)}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={projectDeleteLoading}
                onClick={() => void deleteCloudProject()}
                className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {projectDeleteLoading ? "Deleting…" : "Delete project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {resetConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setResetConfirmOpen(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-project-title"
            className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="reset-project-title" className="text-sm font-semibold">
              Start a new project?
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              This replaces the current local canvas with a fresh starter project. Existing cloud
              projects remain available through the API.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetConfirmOpen(false)}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void resetProject()}
                className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500"
              >
                Start new project
              </button>
            </div>
          </div>
        </div>
      )}

      {helpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Studio controls</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Keep the canvas focused on flow and results.
                </p>
              </div>
              <button
                type="button"
                className="text-xs text-slate-400 hover:text-white"
                onClick={() => setHelpOpen(false)}
              >
                Close
              </button>
            </div>
            <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-xs">
              <dt className="font-medium text-slate-300">Drag block</dt>
              <dd className="text-slate-500">
                Reposition as one undo step; hold Alt to bypass active grid snapping
              </dd>
              <dt className="font-medium text-slate-300">G / Shift+G</dt>
              <dd className="text-slate-500">Toggle snapping / align the selected workflow block</dd>
              <dt className="font-medium text-slate-300">L</dt>
              <dd className="text-slate-500">
                Start or cancel linking; invalid targets keep Link mode active
              </dd>
              <dt className="font-medium text-slate-300">H / Space / middle drag</dt>
              <dd className="text-slate-500">
                Toggle selection-safe Hand mode or temporarily pan
              </dd>
              <dt className="font-medium text-slate-300">Mouse wheel</dt>
              <dd className="text-slate-500">
                Zoom toward the pointer; each continuous gesture is one undo step
              </dd>
              <dt className="font-medium text-slate-300">+ / −</dt>
              <dd className="text-slate-500">Zoom around the workflow canvas center</dd>
              <dt className="font-medium text-slate-300">0</dt>
              <dd className="text-slate-500">Reset workflow zoom to 100%</dd>
              <dt className="font-medium text-slate-300">Shift + 0</dt>
              <dd className="text-slate-500">Reset workflow pan and zoom to defaults</dd>
              <dt className="font-medium text-slate-300">F</dt>
              <dd className="text-slate-500">Fit all workflow blocks in view</dd>
              <dt className="font-medium text-slate-300">C</dt>
              <dd className="text-slate-500">Center the selected or focused workflow block</dd>
              <dt className="font-medium text-slate-300">Home</dt>
              <dd className="text-slate-500">Reset workflow canvas pan</dd>
              <dt className="font-medium text-slate-300">Arrow keys</dt>
              <dd className="text-slate-500">
                Nudge the selected or focused workflow block as one undo step per burst;
                navigate storyboard; browse retained outputs in result detail
              </dd>
              <dt className="font-medium text-slate-300">Toolbar arrows</dt>
              <dd className="text-slate-500">Move focus between available canvas tools</dd>
              <dt className="font-medium text-slate-300">Enter / Space</dt>
              <dd className="text-slate-500">
                Activate the focused canvas tool and return to the workflow
              </dd>
              <dt className="font-medium text-slate-300">T</dt>
              <dd className="text-slate-500">Focus the canvas toolbar</dd>
              <dt className="font-medium text-slate-300">⌘/Ctrl + D</dt>
              <dd className="text-slate-500">Duplicate the selected or focused block</dd>
              <dt className="font-medium text-slate-300">Shift + Enter</dt>
              <dd className="text-slate-500">
                Inspect the focused workflow block or storyboard card
              </dd>
              <dt className="font-medium text-slate-300">O</dt>
              <dd className="text-slate-500">
                Open the selected or focused storyboard card on the workflow canvas
              </dd>
              <dt className="font-medium text-slate-300">⌘/Ctrl + Z</dt>
              <dd className="text-slate-500">Undo; add Shift to redo</dd>
              <dt className="font-medium text-slate-300">Delete</dt>
              <dd className="text-slate-500">
                Remove the selected or focused block; in storyboard, focus moves to the next
                card
              </dd>
              <dt className="font-medium text-slate-300">Tab</dt>
              <dd className="text-slate-500">
                Move focus between workflow blocks and links; selection follows focus and
                off-screen items pan into view
              </dd>
              <dt className="font-medium text-slate-300">Tab + Enter / Delete</dt>
              <dd className="text-slate-500">Select or remove a focused workflow link</dd>
              <dt className="font-medium text-slate-300">Esc</dt>
              <dd className="text-slate-500">
                Leave the toolbar, cancel a gesture, dismiss errors, or close overlays
              </dd>
            </dl>
          </div>
        </div>
      )}

      {inspectSummary && inspectBlock && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setInspectId(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex min-h-[240px] flex-1 items-center justify-center bg-slate-950 p-4">
              {inspectMedia ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={inspectMedia}
                  alt=""
                  className="max-h-[70vh] max-w-full rounded object-contain"
                />
              ) : (
                <p className="whitespace-pre-wrap text-sm text-slate-300">
                  {inspectBlock.bodyText || inspectSummary.prompt || "No media yet"}
                </p>
              )}
            </div>
            <div className="flex w-72 shrink-0 flex-col border-l border-slate-800 p-4">
              <h3 className="text-sm font-semibold">{inspectSummary.title}</h3>
              <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-500">
                {inspectBlock.type} · {inspectSummary.status} · {inspectSummary.quality}
              </p>
              <p className="mt-4 text-xs leading-relaxed text-slate-300">
                {inspectSummary.prompt || "No prompt"}
              </p>
              {inspectSummary.prompt && (
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(inspectSummary.prompt)
                      .then(() => setPromptCopied(true))
                      .catch(() => setPromptCopied(false));
                  }}
                  className="mt-3 self-start rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-400 hover:border-slate-500 hover:text-white"
                >
                  {promptCopied ? "Prompt copied" : "Copy prompt"}
                </button>
              )}
              {inspectSummary.mediaCount > 1 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-slate-500">
                      Result {inspectMediaIndex + 1} of {inspectSummary.mediaCount}
                    </p>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setInspectMediaIndex((index) =>
                            index === 0 ? inspectSummary.mediaCount - 1 : index - 1,
                          )
                        }
                        className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:border-slate-500 hover:text-white"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setInspectMediaIndex((index) =>
                            index === inspectSummary.mediaCount - 1 ? 0 : index + 1,
                          )
                        }
                        className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:border-slate-500 hover:text-white"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {inspectBlock.mediaUrls.map((url, index) => (
                      <button
                        key={`${url}-${index}`}
                        type="button"
                        onClick={() => setInspectMediaIndex(index)}
                        className={`overflow-hidden rounded border ${
                          index === inspectMediaIndex
                            ? "border-sky-400"
                            : "border-slate-700 hover:border-slate-500"
                        }`}
                        aria-label={`View result ${index + 1}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="aspect-square w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-auto space-y-2">
                {inspectMedia && (
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={inspectMedia}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-slate-700 px-3 py-2 text-center text-sm text-slate-300 hover:border-slate-500 hover:text-white"
                    >
                      Open original
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(inspectMedia)
                          .then(() => setMediaLinkCopied(true))
                          .catch(() => setMediaLinkCopied(false));
                      }}
                      className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500 hover:text-white"
                    >
                      {mediaLinkCopied ? "Link copied" : "Copy link"}
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  className="w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium hover:bg-sky-500"
                  onClick={() => {
                    setSelectedId(inspectBlock.id);
                    setInspectId(null);
                  }}
                >
                  Edit in side panel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {assetsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setAssetsOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <h3 className="text-sm font-semibold">Asset library</h3>
              <button
                type="button"
                className="text-xs text-slate-400 hover:text-white"
                onClick={() => setAssetsOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              {!assetsLoading && assets.length > 0 && (
                <label className="mb-4 block">
                  <span className="sr-only">Search generated assets</span>
                  <input
                    type="search"
                    value={assetQuery}
                    onChange={(e) => setAssetQuery(e.target.value)}
                    placeholder="Search by prompt…"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-sky-500"
                  />
                </label>
              )}
              {assetsLoading ? (
                <p className="text-sm text-slate-500">Loading completed jobs…</p>
              ) : assets.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No completed results yet. Generate from a block first.
                </p>
              ) : filteredAssets.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No generated assets match “{assetQuery.trim()}”.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {filteredAssets.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => insertAsset(asset)}
                      className="overflow-hidden rounded-lg border border-slate-700 text-left hover:border-sky-500/60"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={asset.url} alt="" className="aspect-square w-full object-cover" />
                      <p className="line-clamp-2 px-2 py-1 text-[10px] text-slate-400">
                        {asset.prompt || "Untitled"}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
