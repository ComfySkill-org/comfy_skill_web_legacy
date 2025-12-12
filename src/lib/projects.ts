import type { ProjectSummary } from "@/lib/api";
import type { ProjectSort, ProjectViewFilter } from "@/lib/studioPreferences";
import { buildStudioHref } from "@/lib/studioNavigation";

function projectUpdatedTimestamp(updatedAt: string | null): number {
  if (!updatedAt) return 0;
  const timestamp = Date.parse(updatedAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function sortProjectSummaries(projects: readonly ProjectSummary[]): ProjectSummary[] {
  return [...projects].sort(
    (a, b) =>
      projectUpdatedTimestamp(b.updated_at) - projectUpdatedTimestamp(a.updated_at),
  );
}

export function formatProjectUpdatedAt(updatedAt: string | null): string {
  if (!updatedAt) return "Not saved yet";
  const timestamp = projectUpdatedTimestamp(updatedAt);
  return timestamp ? new Date(timestamp).toLocaleString() : "Update time unavailable";
}

export function uniqueProjectCopyTitle(
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

export function filterAndSortProjectSummaries(
  projects: readonly ProjectSummary[],
  opts: { query: string; viewFilter: ProjectViewFilter; sort: ProjectSort },
): ProjectSummary[] {
  const query = opts.query.trim().toLocaleLowerCase();
  const matching = projects.filter(
    (project) =>
      (opts.viewFilter === "all" || project.view_mode === opts.viewFilter) &&
      (!query || project.title.toLocaleLowerCase().includes(query)),
  );

  if (opts.sort === "title-asc" || opts.sort === "title-desc") {
    const direction = opts.sort === "title-asc" ? 1 : -1;
    return [...matching].sort(
      (a, b) =>
        direction * a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) ||
        projectUpdatedTimestamp(b.updated_at) - projectUpdatedTimestamp(a.updated_at),
    );
  }

  if (opts.sort === "updated-asc") {
    return [...matching].sort(
      (a, b) =>
        projectUpdatedTimestamp(a.updated_at) - projectUpdatedTimestamp(b.updated_at),
    );
  }

  return sortProjectSummaries(matching);
}

export function studioProjectHref(projectId: string): string {
  return buildStudioHref({ projectId });
}
