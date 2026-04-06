"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "@/lib/api";
import {
  addEdgeBetween,
  applySkillTemplate,
  clearProjectLocal,
  createImageBlock,
  createStarterProject,
  createTextBlock,
  loadProjectLocal,
  moveBlock,
  removeBlock,
  saveProjectLocal,
  setViewportZoom,
  SKILL_TEMPLATES,
  type CanvasBlock,
  type CanvasBlockStatus,
  type CanvasProject,
} from "@/lib/canvas";

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
  const dragRef = useRef<{
    id: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const zoomRef = useRef(project.viewport.zoom);
  zoomRef.current = project.viewport.zoom;

  useEffect(() => {
    const saved = loadProjectLocal();
    if (saved) setProject(saved);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveProjectLocal(project);
  }, [project, hydrated]);

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const z = zoomRef.current || 1;
      const x = drag.origX + (e.clientX - drag.startClientX) / z;
      const y = drag.origY + (e.clientY - drag.startClientY) / z;
      setProject((prev) => moveBlock(prev, drag.id, x, y));
    }
    function onPointerUp() {
      dragRef.current = null;
    }
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  const selected = useMemo(
    () => project.blocks.find((b) => b.id === selectedId) ?? null,
    [project.blocks, selectedId],
  );

  function patchBlock(
    blockId: string,
    patch: Partial<CanvasBlock> & { params?: CanvasBlock["params"] },
  ) {
    setProject((prev) => ({
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
    }));
  }

  function updateSelected(patch: Partial<CanvasBlock> & { params?: CanvasBlock["params"] }) {
    if (!selectedId) return;
    patchBlock(selectedId, patch);
  }

  function addBlock(type: "image" | "text" = "image") {
    const offset = project.blocks.length;
    const block =
      type === "text"
        ? createTextBlock({
            x: 80 + offset * 40,
            y: 80 + offset * 30,
            title: `Text ${offset + 1}`,
          })
        : createImageBlock({
            x: 80 + offset * 40,
            y: 80 + offset * 30,
            title: `Shot ${String.fromCharCode(65 + offset)}`,
          });
    setProject((prev) => ({ ...prev, blocks: [...prev.blocks, block] }));
    setSelectedId(block.id);
  }

  function resetProject() {
    clearProjectLocal();
    const next = createStarterProject();
    setProject(next);
    setSelectedId(null);
    setLinkSourceId(null);
    setGenerateError("");
  }

  function selectBlock(blockId: string) {
    setSelectedId(blockId);
    setLinkSourceId((prev) => {
      if (prev && prev !== blockId) {
        setProject((p) => addEdgeBetween(p, prev, blockId));
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
    const { project: next, blockId } = applySkillTemplate(project, template);
    setProject(next);
    setSelectedId(blockId);
    setLinkSourceId(null);
    setGenerateError("");
  }

  function deleteSelected() {
    if (!selectedId) return;
    setProject((prev) => removeBlock(prev, selectedId));
    setSelectedId(null);
    setLinkSourceId(null);
  }

  function zoomBy(delta: number) {
    setProject((prev) => setViewportZoom(prev, prev.viewport.zoom + delta));
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
      const { job } = await apiClient.createJob(prompt, selected.params.quality_tier);
      patchBlock(selected.id, { jobId: job.id, status: job.status as CanvasBlockStatus });

      let current = job;
      while (current.status !== "completed" && current.status !== "failed") {
        await new Promise((r) => setTimeout(r, 1500));
        current = await apiClient.getJob(current.id);
        patchBlock(selected.id, { status: current.status as CanvasBlockStatus });
      }

      if (current.status === "completed" && current.output_url) {
        patchBlock(selected.id, {
          status: "completed",
          mediaUrls: [current.output_url],
          bodyText: prompt,
        });
      } else {
        patchBlock(selected.id, { status: "failed" });
        setGenerateError(current.error_message || "Generation failed");
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
          <span className="text-sm font-medium">{project.title}</span>
          <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
            Workflow
          </span>
        </div>
        <Link href="/app" className="text-xs text-slate-400 hover:text-white">
          Legacy form
        </Link>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Canvas — flow + results */}
        <main
          className="relative min-w-0 flex-1 overflow-hidden"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(148,163,184,0.18) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
          onClick={() => setSelectedId(null)}
        >
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full origin-top-left"
            style={{ transform: `scale(${project.viewport.zoom})` }}
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
            style={{ transform: `scale(${project.viewport.zoom})` }}
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
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  selectBlock(block.id);
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
            >
              Delete
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
                resetProject();
              }}
              className="rounded-full px-3 py-1 text-xs text-slate-400 hover:text-white"
            >
              Reset
            </button>
            <span className="px-2 text-xs leading-6 text-slate-500">
              {Math.round(project.viewport.zoom * 100)}% · saved locally
            </span>
          </div>
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
                {generateError ? (
                  <p className="text-[11px] text-rose-400">{generateError}</p>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Runs POST /jobs and writes the result back onto this canvas block.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  Every skill is an opening — pick one to drop a seeded block on the canvas.
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
    </div>
  );
}
