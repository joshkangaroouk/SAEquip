import { useEffect, useState, useSyncExternalStore } from "react";
import { apiFetch } from "./api";
import type { ProductSummary } from "./types";

/**
 * The product list for the shell — the sidebar's live count and the top-bar
 * search (docs/redesign 02a "After 4b") — held for the session.
 *
 * It is the same GET /api/products the Products page makes, and the two share
 * it: `fetchProductIndex()` reuses a request already in flight, so landing on
 * the Products page sends one request, not two (the endpoint pages through
 * Duda server-side, so a duplicate is not free). Each call still starts a
 * fresh request when none is in flight, and every reply refreshes the copy
 * here, so visiting Products also refreshes the search.
 */
let cache: ProductSummary[] | null = null;
let inflight: Promise<ProductSummary[]> | null = null;
const listeners = new Set<() => void>();

function publish(next: ProductSummary[] | null) {
  cache = next;
  listeners.forEach((l) => l());
}

export function fetchProductIndex(): Promise<ProductSummary[]> {
  if (inflight) return inflight;
  inflight = apiFetch("/api/products")
    .then(async (res) => {
      if (!res.ok) throw new Error(`/api/products returned ${res.status}`);
      const data: ProductSummary[] = await res.json();
      publish(data);
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Forget the copy — on sign-out, so the next account starts clean. */
export function clearProductIndex() {
  publish(null);
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** The session's product list, loading it the first time anything asks. */
export function useProductIndex(): { products: ProductSummary[] | null; error: string | null } {
  const products = useSyncExternalStore(subscribe, () => cache);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (cache || inflight) return;
    fetchProductIndex().catch((e) => setError(e instanceof Error ? e.message : "Couldn't load products"));
  }, []);
  return { products, error };
}
