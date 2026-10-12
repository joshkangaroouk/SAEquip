import { TITLE_CLASSIFICATION } from "../../services/downloadKinds.js";
import type { CertScheme, DownloadKind } from "@prisma/client";

/**
 * Rules that stop a re-run of an import overwriting work done in the Hub
 * since. Pure, so they are tested without touching Duda or the database
 * (scripts/script-guards-test.ts).
 */

/**
 * `--descriptions`: keep a product whose Hub description differs from what
 * the CSV composes — someone has edited it in the dashboard — unless --force.
 * An empty Hub copy is filled; an identical one is a no-op either way.
 */
export function keepEditedDescription(existing: string | null | undefined, composed: string, force: boolean): boolean {
  const now = (existing ?? "").trim();
  return !force && now !== "" && now !== composed.trim();
}


export interface DownloadPlan {
  /** Rows whose file is no longer in the scrape. */
  deleteIds: string[];
  /** Rows kept for their file: only the scraped title and the order change. */
  updates: { id: string; title: string; sortOrder: number }[];
  /** New files, written GATED and typed from their title. */
  creates: { mediaAssetId: string; title: string; sortOrder: number; kind: DownloadKind; certScheme: CertScheme | null }[];
}

/**
 * `downloads:import`: turn a product's scraped set into writes.
 *
 * ⚠️ A keyed diff on the FILE, like PUT /api/products/:id/downloads — never
 * delete-all-then-recreate. Recreating wrote every row `gated: false` with no
 * `kind`, so a --force re-run dropped the product's files off the resources
 * pages and, once retyped, left them ungated; it also detached every captured
 * request from its download. A surviving row keeps its id, its type and its
 * gating. New rows are gated (every file is, since 2026-10-05) and typed by
 * TITLE_CLASSIFICATION; an unknown title is an error before any write.
 */
export function planDownloadSet(
  existing: { id: string; mediaAssetId: string }[],
  wanted: { mediaAssetId: string; title: string }[],
): DownloadPlan | { error: string } {
  const byAsset = new Map(existing.map((r) => [r.mediaAssetId, r]));
  const wantAssets = new Set(wanted.map((w) => w.mediaAssetId));
  const plan: DownloadPlan = {
    deleteIds: existing.filter((r) => !wantAssets.has(r.mediaAssetId)).map((r) => r.id),
    updates: [],
    creates: [],
  };
  for (const [sortOrder, w] of wanted.entries()) {
    const prev = byAsset.get(w.mediaAssetId);
    if (prev) {
      plan.updates.push({ id: prev.id, title: w.title, sortOrder });
      continue;
    }
    const type = Object.prototype.hasOwnProperty.call(TITLE_CLASSIFICATION, w.title) ? TITLE_CLASSIFICATION[w.title] : null;
    if (!type) return { error: `unknown download title "${w.title}" — add it to TITLE_CLASSIFICATION first` };
    plan.creates.push({ mediaAssetId: w.mediaAssetId, title: w.title, sortOrder, kind: type.kind, certScheme: type.certScheme });
  }
  return plan;
}

type Link = { hubProductId: string; dudaCategoryId: string };

/**
 * `duda:assign-product-types`: what to remove and add in the categories the
 * script owns (Products and the three product types).
 *
 * ⚠️ Scoped to the products it ASSIGNS. It used to delete every link in its
 * four categories and recreate only the CSV's, so a product created in the
 * Hub after the import (and typed by hand) lost its type and its Products
 * link on every run, with nothing in the dry run to say so.
 */
export function planTypeLinks(current: Link[], writes: Link[]): { removals: Link[]; adds: Link[]; leftAlone: Link[] } {
  const key = (l: Link) => `${l.hubProductId}|${l.dudaCategoryId}`;
  const touched = new Set(writes.map((w) => w.hubProductId));
  const want = new Set(writes.map(key));
  const have = new Set(current.map(key));
  return {
    removals: current.filter((c) => touched.has(c.hubProductId) && !want.has(key(c))),
    adds: writes.filter((w, i) => !have.has(key(w)) && writes.findIndex((x) => key(x) === key(w)) === i),
    leftAlone: current.filter((c) => !touched.has(c.hubProductId)),
  };
}
