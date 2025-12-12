export type StudioDeepLink = {
  projectId?: string;
  blockId?: string;
  importJobId?: string;
};

export function parseStudioDeepLink(search: string | URLSearchParams): StudioDeepLink {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  return {
    projectId: params.get("project") ?? undefined,
    blockId: params.get("block") ?? undefined,
    importJobId: params.get("importJob") ?? undefined,
  };
}

export function buildStudioHref(link: StudioDeepLink): string {
  const params = new URLSearchParams();
  if (link.projectId) params.set("project", link.projectId);
  if (link.blockId) params.set("block", link.blockId);
  if (link.importJobId) params.set("importJob", link.importJobId);
  const query = params.toString();
  return query ? `/studio?${query}` : "/studio";
}

export function clearStudioDeepLinkFromUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("project");
  url.searchParams.delete("block");
  url.searchParams.delete("importJob");
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

export function hasStudioDeepLink(link: StudioDeepLink): boolean {
  return Boolean(link.projectId || link.blockId || link.importJobId);
}
