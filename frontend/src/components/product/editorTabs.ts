import type { DirtyMap, EditorSnapshot, ErrorMap, NativeForm, SectionKey } from "./productEditorTypes";

/**
 * The product editor's tabs (docs/redesign 02a "Batch 8"): which tab holds
 * each save key, and each tab's dirty and error state for its label's dot.
 *
 * Pure — no React — so the aggregation can be tested on its own.
 */

export type EditorTab = "overview" | "content" | "compliance" | "options" | "files" | "seo";

export const EDITOR_TABS: { value: EditorTab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "content", label: "Content" },
  { value: "compliance", label: "Compliance" },
  { value: "options", label: "Options" },
  { value: "files", label: "Files & media" },
  { value: "seo", label: "SEO" },
];

/** The `?tab=` value, or Overview for a missing or unknown one. */
export function parseTab(value: string | null): EditorTab {
  return EDITOR_TABS.some((t) => t.value === value) ? (value as EditorTab) : "overview";
}

/**
 * The keys in the side panel (Visibility's accessory toggle, Categories), on
 * no tab of their own. Images were here in batch 11 and went back to Files &
 * media in batch 12 (12 §1).
 */
const PANEL_KEYS = ["accessory", "categories"] as const;
type PanelKey = (typeof PANEL_KEYS)[number];
const isPanelKey = (key: SectionKey): key is PanelKey => (PANEL_KEYS as readonly SectionKey[]).includes(key);

/**
 * The tab each single-tab key lives on. `details` spans several tabs (see
 * DETAIL_FIELDS) and the side panel's keys are on none, so neither is here.
 */
export const KEY_TAB: Record<Exclude<SectionKey, "details" | PanelKey>, EditorTab> = {
  specs: "content",
  benefits: "content",
  applications: "content",
  compatible: "content",
  logos: "compliance",
  options: "options",
  variations: "options",
  images: "files",
  model3d: "files",
  downloads: "files",
};

/**
 * Which part of the editor shows each `details` field. One save key, one
 * PATCH — but its fields sit on Overview, Content, SEO and the side panel's
 * Visibility, so a tab's dot comes from ITS fields, not the whole key.
 */
export const DETAIL_FIELDS: Record<"overview" | "content" | "seo" | "panel", (keyof NativeForm)[]> = {
  overview: [
    "name",
    "sku",
    "type",
    "stock_status",
    "price",
    "compare_at_price",
    "quantity",
    "requires_shipping",
    "managed_inventory",
  ],
  content: ["description"],
  seo: ["seo_title", "seo_description", "seo_product_url"],
  panel: ["status"],
};

export interface TabState {
  dirty: boolean;
  /** The first error on the tab, if any. */
  error: string | null;
}

export interface EditorTabState {
  tabs: Record<EditorTab, TabState>;
  /** The tabs a `details` error belongs to, in tab order (empty when there is none). */
  detailsErrorTabs: EditorTab[];
}

const fieldsDiffer = (draft: NativeForm, baseline: NativeForm, fields: (keyof NativeForm)[]) =>
  fields.some((f) => draft[f] !== baseline[f]);

/**
 * The tab that shows a `details` field. The side panel's status is on
 * Overview when the panel is (it is never invalid anyway).
 */
export function fieldTab(field: keyof NativeForm): EditorTab {
  if (DETAIL_FIELDS.content.includes(field)) return "content";
  if (DETAIL_FIELDS.seo.includes(field)) return "seo";
  return "overview";
}

export function editorTabState({
  draft,
  baseline,
  dirty,
  saveErrors,
  validationErrors,
  detailsInvalidField,
  panelInOverview,
}: {
  draft: EditorSnapshot;
  baseline: EditorSnapshot;
  dirty: DirtyMap;
  saveErrors: ErrorMap;
  validationErrors: ErrorMap;
  /** The field `validationErrors.details` is about, from validate(). */
  detailsInvalidField: keyof NativeForm | null;
  /**
   * Below 1280px the side panel (Visibility, Categories) is part of Overview,
   * so its edits and errors count there. From 1280 it is on screen beside
   * every tab and belongs to none.
   */
  panelInOverview: boolean;
}): EditorTabState {
  const tabs = Object.fromEntries(EDITOR_TABS.map((t) => [t.value, { dirty: false, error: null }])) as Record<
    EditorTab,
    TabState
  >;
  const mark = (tab: EditorTab, error?: string | null) => {
    if (error) tabs[tab].error ??= error;
    else tabs[tab].dirty = true;
  };

  // Single-tab keys: the key's own dirty flag and error.
  for (const [key, tab] of Object.entries(KEY_TAB) as [keyof typeof KEY_TAB, EditorTab][]) {
    if (dirty[key]) mark(tab);
    const err = saveErrors[key] ?? validationErrors[key];
    if (err) mark(tab, err);
  }

  // `details`, field by field.
  const d = draft.details;
  const b = baseline.details;
  const detailTabs: EditorTab[] = [];
  if (fieldsDiffer(d, b, DETAIL_FIELDS.overview)) detailTabs.push("overview");
  if (fieldsDiffer(d, b, DETAIL_FIELDS.content)) detailTabs.push("content");
  if (fieldsDiffer(d, b, DETAIL_FIELDS.seo)) detailTabs.push("seo");
  const statusChanged = fieldsDiffer(d, b, DETAIL_FIELDS.panel);
  if (statusChanged && panelInOverview && !detailTabs.includes("overview")) detailTabs.unshift("overview");
  for (const tab of detailTabs) mark(tab);

  // A server error is about the whole PATCH: it belongs on every tab whose
  // fields went into it, and always on Overview, where its Alert is. A
  // validation error names one field, so one tab.
  let detailsErrorTabs: EditorTab[] = [];
  if (saveErrors.details) {
    detailsErrorTabs = EDITOR_TABS.map((t) => t.value).filter((t) => t === "overview" || detailTabs.includes(t));
    for (const tab of detailsErrorTabs) mark(tab, saveErrors.details);
  } else if (validationErrors.details) {
    detailsErrorTabs = [detailsInvalidField ? fieldTab(detailsInvalidField) : "overview"];
    mark(detailsErrorTabs[0], validationErrors.details);
  }

  // The side panel's own keys.
  if (panelInOverview) {
    for (const key of PANEL_KEYS) {
      if (dirty[key]) mark("overview");
      const err = saveErrors[key] ?? validationErrors[key];
      if (err) mark("overview", err);
    }
  }

  return { tabs, detailsErrorTabs };
}

/**
 * The tab to open for a failed section's pill (the band's save area). Null
 * when the section is in the side panel and the panel is on screen beside
 * every tab.
 */
export function tabForKey(key: SectionKey, state: EditorTabState, panelInOverview: boolean): EditorTab | null {
  if (key === "details") return state.detailsErrorTabs[0] ?? "overview";
  if (isPanelKey(key)) return panelInOverview ? "overview" : null;
  return KEY_TAB[key];
}

/** The tab labels' counts: items on Content, attached options, files on Files & media. */
export function tabCounts(draft: EditorSnapshot): Partial<Record<EditorTab, number>> {
  return {
    content: draft.specs.length + draft.benefits.length + draft.applications.length,
    options: draft.options.length,
    files: draft.images.length + draft.downloads.length + (draft.model3d.mediaAssetId ? 1 : 0),
  };
}
