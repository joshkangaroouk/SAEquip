import { useCallback, useEffect, useRef, useState } from "react";
import { apiJson } from "./api";
import type { MediaAsset } from "./types";

export type MediaKind = "image" | "file" | "model";

export type MediaSort = "recent" | "oldest" | "name" | "name-desc" | "largest" | "smallest";

/** Label/value pairs for a sort <Select>, in the order they should appear. */
export const MEDIA_SORT_OPTIONS: { value: MediaSort; label: string }[] = [
  { value: "recent", label: "Recently added" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "largest", label: "Largest first" },
  { value: "smallest", label: "Smallest first" },
];

interface MediaPage {
  items: MediaAsset[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** Delay a fast-changing value, so typing doesn't fire a request per keystroke. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/**
 * Search / sort / paginate the media library.
 *
 * Shared by the Media Centre page and the MediaPicker modal so the two cannot
 * drift — they were already two independent `GET /api/media` calls, and the
 * picker's had no paging at all, which is how it came to load the whole
 * library (344 assets, each with a resolved URL) into a dialog.
 *
 * `kind` is fixed by the caller rather than being part of the hook's state:
 * the picker is always opened for one kind, and the page owns its own tabs.
 * Changing kind, the query or the sort resets to page 1 — otherwise a filter
 * that shrinks the result set leaves you stranded on a page that no longer
 * exists.
 */
export function useMediaLibrary({
  kind,
  pageSize = 24,
}: {
  kind?: MediaKind;
  pageSize?: number;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<MediaSort>("recent");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<MediaPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const debouncedQ = useDebounced(q.trim(), 250);

  // Reset paging whenever the result set changes shape under us.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setPage(1);
  }, [kind, debouncedQ, sort]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ sort, page: String(page), pageSize: String(pageSize) });
    if (kind) params.set("kind", kind);
    if (debouncedQ) params.set("q", debouncedQ);

    apiJson<MediaPage>(`/api/media?${params}`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load media");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, debouncedQ, sort, page, pageSize, reloadKey]);

  /** Re-fetch the current page — after an upload or a delete. */
  const reload = useCallback(() => setReloadKey((n) => n + 1), []);

  /**
   * Show a newly uploaded asset. Jumps to the newest-first page 1 rather than
   * splicing it into the current page, which would render pageSize+1 items and
   * put it somewhere the active sort says it does not belong.
   */
  const showNewest = useCallback(() => {
    setQ("");
    setSort("recent");
    setPage(1);
    setReloadKey((n) => n + 1);
  }, []);

  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    pageCount: data?.pageCount ?? 1,
    page,
    setPage,
    q,
    setQ,
    sort,
    setSort,
    loading,
    error,
    reload,
    showNewest,
    isEmpty: !loading && !error && (data?.total ?? 0) === 0,
    isFiltered: debouncedQ.length > 0,
  };
}
