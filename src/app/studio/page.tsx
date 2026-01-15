"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { apiClient } from "@/lib/api";
import {
  addEdgeBetween,
  applySkillTemplate,
  blockResultSummary,
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
  ProjectHistory,
  removeBlock,
  resetViewportPan,
  saveProjectLocal,
  setViewMode,
  setViewportZoom,
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
  isStudioAuthed,
  loadOrCreateRemoteProject,
  pushRemoteProject,
  setRemoteProjectId,
  starterOrLocal,
} from "@/lib/projectSync";

/**
 * Studio shell — Phase 1 canvas MVP (PRD-legacy).
 * Center: flow + results. Right: params when a block is selected.
 */
export default function StudioPage() {
  const [project, setProject] = useState<CanvasProject>(() => createStarterProject());
  const [hydrated, setHydrated] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [inspectMediaIndex, setInspectMediaIndex] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [dialoguePrompt, setDialoguePrompt] = useState("");
  const [dialogueBlockType, setDialogueBlockType] = useState<CanvasBlock["type"]>("image");
  const [syncLabel, setSyncLabel] = useState("local");
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
  const dragRef = useRef<{
    id: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const panRef = useRef<{
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const spaceHeldRef = useRef(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const zoomRef = useRef(project.viewport.zoom);
  zoomRef.current = project.viewport.zoom;

  function commitChange(mutate: (prev: CanvasProject) => CanvasProject) {
    historyRef.current.record(projectRef.current);
    setProject(mutate);
    setHistoryTick((n) => n + 1);
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
      setSyncLabel("local");
      return;
    }
    const timer = setTimeout(() => {
      void pushRemoteProject(project)
        .then(() => setSyncLabel("cloud"))
        .catch(() => setSyncLabel("local*"));
    }, 800);
    return () => clearTimeout(timer);
  }, [project, hydrated]);

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const pan = panRef.current;
      if (pan) {
        const dx = e.clientX - pan.startClientX;
        const dy = e.clientY - pan.startClientY;
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
      const x = drag.origX + (e.clientX - drag.startClientX) / z;
      const y = drag.origY + (e.clientY - drag.startClientY) / z;
      setProject((prev) => moveBlock(prev, drag.id, x, y));
    }
    function onPointerUp() {
      dragRef.current = null;
      if (panRef.current) {
        panRef.current = null;
        setPanning(false);
      }
    }
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  useEffect(() => {
    const el = canvasMainRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (viewModeRef.current !== "workflow") return;
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const ax = e.clientX - rect.left;
      const ay = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      setProject((prev) =>
        zoomViewportAt(prev, prev.viewport.zoom * factor, ax, ay),
      );
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
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
        setSelectedId(null);
        setLinkSourceId(null);
        setInspectId(null);
        setHelpOpen(false);
        return;
      }
      if (e.key === "?" && !isTypingTarget(e.target)) {
        e.preventDefault();
        setHelpOpen((open) => !open);
        return;
      }
      if (!isTypingTarget(e.target)) {
        if ((e.key === "Delete" || e.key === "Backspace") && selectedIdRef.current) {
          e.preventDefault();
          const id = selectedIdRef.current;
          historyRef.current.record(projectRef.current);
          setProject((prev) => removeBlock(prev, id));
          setHistoryTick((n) => n + 1);
          setSelectedId(null);
          setLinkSourceId(null);
          return;
        }
        const arrow =
          e.key === "ArrowLeft" ||
          e.key === "ArrowRight" ||
          e.key === "ArrowUp" ||
          e.key === "ArrowDown";
        if (arrow && selectedIdRef.current) {
          e.preventDefault();
          const step = e.shiftKey ? 20 : 4;
          const dx =
            e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy =
            e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          if (!e.repeat) {
            historyRef.current.record(projectRef.current);
            setHistoryTick((n) => n + 1);
          }
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
  selectedIdRef.current = selectedId;

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

  const inspectSummary = useMemo(
    () => (inspectBlock ? blockResultSummary(inspectBlock) : null),
    [inspectBlock],
  );

  useEffect(() => {
    setInspectMediaIndex(0);
  }, [inspectId]);

  const inspectMedia = inspectBlock?.mediaUrls[inspectMediaIndex] ?? null;
  const filteredAssets = useMemo(() => {
    const query = assetQuery.trim().toLocaleLowerCase();
    if (!query) return assets;
    return assets.filter((asset) => asset.prompt.toLocaleLowerCase().includes(query));
  }, [assetQuery, assets]);

  const viewMode: StudioViewMode = project.viewMode ?? "workflow";
  viewModeRef.current = viewMode;
  const storyboardBlocks = useMemo(
    () => storyboardOrderedBlocks(project),
    [project],
  );
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

  function switchView(mode: StudioViewMode) {
    if ((project.viewMode ?? "workflow") === mode) return;
    commitChange((prev) => setViewMode(prev, mode));
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

  function resetProject() {
    clearProjectLocal();
    setRemoteProjectId(null);
    historyRef.current = new ProjectHistory();
    const next = createStarterProject();
    setProject(next);
    setSelectedId(null);
    setLinkSourceId(null);
    setGenerateError("");
    setHistoryTick((n) => n + 1);
    if (isStudioAuthed()) {
      void pushRemoteProject(next)
        .then((saved) => {
          setProject(saved);
          setSyncLabel("cloud");
        })
        .catch(() => setSyncLabel("local"));
    } else {
      setSyncLabel("local");
    }
  }

  function selectBlock(blockId: string) {
    setSelectedId(blockId);
    setLinkSourceId((prev) => {
      if (prev && prev !== blockId) {
        commitChange((p) => addEdgeBetween(p, prev, blockId));
        return null;
      }
      return prev;
    });
  }

  function startLinkMode() {
    if (!selectedId) {
      setGenerateError("Select a source block, then click Link and pick the target.");
      return;
    }
    setLinkSourceId(selectedId);
    setGenerateError("");
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
    let createdId = "";
    commitChange((prev) => {
      const { project: next, blockId } = duplicateBlock(prev, selectedId);
      createdId = blockId ?? "";
      return next;
    });
    if (createdId) setSelectedId(createdId);
  }

  function unlinkSelected() {
    if (!selectedId) return;
    commitChange((prev) => unlinkBlock(prev, selectedId));
    setLinkSourceId(null);
  }

  function zoomBy(delta: number) {
    commitChange((prev) => setViewportZoom(prev, prev.viewport.zoom + delta));
  }

  function startCanvasPan(e: ReactPointerEvent, vp: { x: number; y: number }) {
    e.preventDefault();
    panRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: vp.x,
      origY: vp.y,
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
        <Link href="/app" className="text-xs text-slate-400 hover:text-white">
          Quick form
        </Link>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Canvas — flow + results */}
        <main
          ref={canvasMainRef}
          className={`relative min-w-0 flex-1 overflow-hidden ${
            panning ? "cursor-grabbing" : spaceHeld ? "cursor-grab" : "cursor-default"
          }`}
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(148,163,184,0.18) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            backgroundPosition: `${project.viewport.x}px ${project.viewport.y}px`,
          }}
          onClick={() => setSelectedId(null)}
          onPointerDown={(e) => {
            if (viewMode !== "workflow") return;
            if (e.button === 1 || (e.button === 0 && spaceHeldRef.current)) {
              startCanvasPan(e, project.viewport);
            }
          }}
          onAuxClick={(e) => {
            // Prevent middle-click default (autoscroll) when panning
            if (e.button === 1) e.preventDefault();
          }}
        >
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
                  return (
                    <button
                      key={block.id}
                      type="button"
                      onClick={() => selectBlock(block.id)}
                      onDoubleClick={() => setInspectId(block.id)}
                      className={`flex w-56 shrink-0 flex-col overflow-hidden rounded-xl border text-left shadow-lg ${
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
                      <div className="border-t border-slate-800 px-3 py-2 text-[10px] text-slate-500">
                        {block.status}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <>
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full origin-top-left"
            style={{
              transform: `translate(${project.viewport.x}px, ${project.viewport.y}px) scale(${project.viewport.zoom})`,
            }}
          >
            {project.edges.map((edge) => {
              const src = project.blocks.find((b) => b.id === edge.sourceBlockId);
              const tgt = project.blocks.find((b) => b.id === edge.targetBlockId);
              if (!src || !tgt) return null;
              const x1 = src.x + src.width;
              const y1 = src.y + src.height / 2;
              const x2 = tgt.x;
              const y2 = tgt.y + tgt.height / 2;
              return (
                <path
                  key={edge.id}
                  d={`M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x2 - 60} ${y2}, ${x2} ${y2}`}
                  stroke="rgba(148,163,184,0.55)"
                  strokeWidth={1.5}
                  fill="none"
                />
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
              if (e.button === 0 && spaceHeldRef.current) {
                startCanvasPan(e, projectRef.current.viewport);
                return;
              }
              if (e.button === 0) {
                startCanvasPan(e, projectRef.current.viewport);
              }
            }}
          >
          {project.blocks.map((block) => {
            const active = block.id === selectedId;
            const isLinkSource = block.id === linkSourceId;
            return (
              <div
                key={block.id}
                role="button"
                tabIndex={0}
                className={`absolute cursor-grab rounded-lg border text-left shadow-lg transition active:cursor-grabbing ${
                  active || isLinkSource
                    ? "border-sky-400 ring-2 ring-sky-400/40"
                    : "border-slate-700 hover:border-slate-500"
                } bg-slate-900/95`}
                style={{
                  left: block.x,
                  top: block.y,
                  width: block.width,
                  height: block.height,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  selectBlock(block.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setInspectId(block.id);
                }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  if (spaceHeldRef.current) {
                    startCanvasPan(e, projectRef.current.viewport);
                    return;
                  }
                  e.stopPropagation();
                  selectBlock(block.id);
                  historyRef.current.record(projectRef.current);
                  setHistoryTick((n) => n + 1);
                  dragRef.current = {
                    id: block.id,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    origX: block.x,
                    origY: block.y,
                  };
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectBlock(block.id);
                  }
                }}
              >
                <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
                  <span className="text-xs font-medium">{block.title}</span>
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">
                    {block.type} · {block.status}
                  </span>
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

          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2 rounded-full border border-slate-700 bg-slate-900/90 px-3 py-2 shadow-xl">
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
              onClick={(e) => {
                e.stopPropagation();
                startLinkMode();
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                linkSourceId
                  ? "bg-amber-500 text-slate-950"
                  : "bg-slate-700 hover:bg-slate-600"
              }`}
            >
              {linkSourceId ? "Pick target…" : "Link"}
            </button>
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
              onClick={(e) => {
                e.stopPropagation();
                zoomBy(-0.1);
              }}
              className="rounded-full bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700"
            >
              −
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                zoomBy(0.1);
              }}
              className="rounded-full bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700"
            >
              +
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                commitChange((prev) => resetViewportPan(prev));
              }}
              className="rounded-full bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700"
              title="Reset pan"
            >
              Pan
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const canvas = canvasMainRef.current;
                if (!canvas) return;
                commitChange((prev) =>
                  fitProjectInViewport(prev, canvas.clientWidth, canvas.clientHeight),
                );
              }}
              className="rounded-full bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700"
              title="Fit all blocks in view"
            >
              Fit
            </button>
            <button
              type="button"
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
                resetProject();
              }}
              className="rounded-full px-3 py-1 text-xs text-slate-400 hover:text-white"
            >
              Reset
            </button>
            <span className="px-2 text-xs leading-6 text-slate-500">
              {Math.round(project.viewport.zoom * 100)}% · Arrows nudge · Wheel zoom ·{" "}
              {syncLabel}
            </span>
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
                <label className="block text-xs text-slate-400">
                  Quality
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
                    <option value="premium">Good</option>
                    <option value="standard">Medium</option>
                    <option value="budget">Budget</option>
                  </select>
                </label>
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => void generateSelected()}
                  className="w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium hover:bg-sky-500 disabled:opacity-50"
                >
                  {generating ? "Generating…" : "Generate"}
                </button>
                <button
                  type="button"
                  onClick={() => setInspectId(selected.id)}
                  className="w-full rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:border-sky-500/60"
                >
                  Inspect result
                </button>
                {generateError ? (
                  <p className="text-[11px] text-rose-400">{generateError}</p>
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
              <dd className="text-slate-500">Reposition a shot or asset</dd>
              <dt className="font-medium text-slate-300">Space + drag</dt>
              <dd className="text-slate-500">Pan the workflow canvas</dd>
              <dt className="font-medium text-slate-300">Mouse wheel</dt>
              <dd className="text-slate-500">Zoom toward the pointer</dd>
              <dt className="font-medium text-slate-300">Arrow keys</dt>
              <dd className="text-slate-500">Nudge the selected block; Shift moves farther</dd>
              <dt className="font-medium text-slate-300">⌘/Ctrl + D</dt>
              <dd className="text-slate-500">Duplicate the selected block</dd>
              <dt className="font-medium text-slate-300">⌘/Ctrl + Z</dt>
              <dd className="text-slate-500">Undo; add Shift to redo</dd>
              <dt className="font-medium text-slate-300">Delete</dt>
              <dd className="text-slate-500">Remove the selected block</dd>
              <dt className="font-medium text-slate-300">Esc</dt>
              <dd className="text-slate-500">Close overlays and clear selection</dd>
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
              {inspectSummary.mediaCount > 1 && (
                <div className="mt-4">
                  <p className="text-[11px] text-slate-500">
                    Result {inspectMediaIndex + 1} of {inspectSummary.mediaCount}
                  </p>
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
              <button
                type="button"
                className="mt-auto rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium hover:bg-sky-500"
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
