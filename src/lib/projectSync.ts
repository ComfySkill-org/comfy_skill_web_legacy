/**
 * Sync studio canvas with /projects API when authenticated (PRD-legacy C7/C8).
 * Falls back to localStorage when unauthenticated.
 */

import { apiClient, getToken, isFirebaseEnabled } from "@/lib/api";
import { getFirebaseAuth } from "@/lib/firebase";
import {
  apiProjectToCanvas,
  canvasProjectToApiPut,
  createStarterProject,
  type CanvasProject,
} from "@/lib/canvas";

const REMOTE_ID_KEY = "comfyskill.studio.remoteProjectId";

export function getRemoteProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REMOTE_ID_KEY);
}

export function setRemoteProjectId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(REMOTE_ID_KEY, id);
  else localStorage.removeItem(REMOTE_ID_KEY);
}

export function isStudioAuthed(): boolean {
  if (isFirebaseEnabled()) return Boolean(getFirebaseAuth()?.currentUser);
  return Boolean(getToken());
}

export async function loadRemoteProjectById(projectId: string): Promise<CanvasProject> {
  const remote = await apiClient.getProject(projectId);
  setRemoteProjectId(remote.id);
  return apiProjectToCanvas(remote);
}

export async function createFreshRemoteProject(starter: CanvasProject): Promise<CanvasProject> {
  const created = await apiClient.createProject(starter.title || "Studio draft");
  const seeded = { ...starter, id: created.id };
  const saved = await apiClient.putProject(created.id, canvasProjectToApiPut(seeded));
  setRemoteProjectId(saved.id);
  return apiProjectToCanvas(saved);
}

export async function loadOrCreateRemoteProject(
  localFallback: CanvasProject,
): Promise<CanvasProject> {
  const existingId = getRemoteProjectId();
  if (existingId) {
    try {
      const remote = await apiClient.getProject(existingId);
      return apiProjectToCanvas(remote);
    } catch {
      setRemoteProjectId(null);
    }
  }

  const summaries = await apiClient.listProjects();
  if (summaries.length > 0) {
    const remote = await apiClient.getProject(summaries[0].id);
    setRemoteProjectId(remote.id);
    return apiProjectToCanvas(remote);
  }

  const created = await apiClient.createProject(localFallback.title || "Studio draft");
  const seeded = { ...localFallback, id: created.id };
  const saved = await apiClient.putProject(created.id, canvasProjectToApiPut(seeded));
  setRemoteProjectId(saved.id);
  return apiProjectToCanvas(saved);
}

export async function pushRemoteProject(project: CanvasProject): Promise<CanvasProject> {
  let id = getRemoteProjectId() || project.id;
  try {
    const saved = await apiClient.putProject(id, canvasProjectToApiPut(project));
    setRemoteProjectId(saved.id);
    return apiProjectToCanvas(saved);
  } catch {
    const created = await apiClient.createProject(project.title);
    const withId = { ...project, id: created.id };
    const saved = await apiClient.putProject(created.id, canvasProjectToApiPut(withId));
    setRemoteProjectId(saved.id);
    return apiProjectToCanvas(saved);
  }
}

export function starterOrLocal(
  loadLocal: () => CanvasProject | null,
): CanvasProject {
  return loadLocal() ?? createStarterProject();
}
