import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiJson } from "../../lib/api";
import { toast } from "../ui";
import type {
  HubCustomPayload,
  HubSpecRow,
  HubTextItem,
  ProductDetail,
  ProductLogoEntry,
} from "../../lib/types";
import {
  activeLogoIds,
  buildDetailsPayload,
  imagesFrom,
  isSectionDirty,
  itemsFrom,
  logoDiff,
  nativeFromProduct,
  optionsFrom,
  specsFrom,
  validate,
  variationsFrom,
} from "./normalize";
import {
  SECTION_LABELS,
  type CatalogOption,
  type DirtyMap,
  type EditorContext,
  type EditorSnapshot,
  type ErrorMap,
  type LogoKind,
  type OptionCatalog,
  type OptionRefDraft,
  type SectionKey,
  type VariationDraft,
} from "./productEditorTypes";

const SECTION_KEYS: SectionKey[] = [
  "details",
  "images",
  "options",
  "variations",
  "specs",
  "benefits",
  "applications",
  "logos",
];

const emptyDirty: DirtyMap = {
  details: false,
  images: false,
  options: false,
  variations: false,
  specs: false,
  benefits: false,
  applications: false,
  logos: false,
};

/** One unit of work in a save, plus the sections it banks on success. */
interface SaveTask {
  keys: SectionKey[];
  label: string;
  run: () => Promise<Partial<EditorSnapshot>>;
}

export function useProductEditor(
  productId: string | undefined,
  { hideCommerce = false }: { hideCommerce?: boolean } = {},
) {
  const [context, setContext] = useState<EditorContext | null>(null);
  const [baseline, setBaseline] = useState<EditorSnapshot | null>(null);
  const [draft, setDraft] = useState<EditorSnapshot | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  const [saving, setSaving] = useState(false);
  const [savingLabel, setSavingLabel] = useState<string | null>(null);
  const [saveErrors, setSaveErrors] = useState<ErrorMap>({});

  /**
   * Lets a caller suppress the navigate-away guard for a deliberate exit (e.g.
   * after deleting the product). A ref, not state, so the blocker predicate
   * sees the change without waiting for a re-render.
   */
  const guardDisarmed = useRef(false);
  const disarmGuard = useCallback(() => {
    guardDisarmed.current = true;
  }, []);

  const load = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setLoadError(null);
    try {
      // One round of parallel fetches replaces the three independent loads the
      // page used to do (product, /custom, and one per logo kind).
      const [product, custom, sa, cert, optionCatalog, store] = await Promise.all([
        apiJson<ProductDetail>(`/api/products/${productId}`),
        apiJson<HubCustomPayload>(`/api/products/${productId}/custom`),
        apiJson<ProductLogoEntry[]>(`/api/products/${productId}/logos?kind=SA_LOGO`),
        apiJson<ProductLogoEntry[]>(`/api/products/${productId}/logos?kind=CERT_LOGO`),
        apiJson<OptionCatalog>(`/api/options`),
        apiJson<{ max_variations_per_product: number | null }>(`/api/store`),
      ]);

      const snapshot: EditorSnapshot = {
        details: nativeFromProduct(product),
        images: imagesFrom(product.images),
        options: optionsFrom(product.options),
        variations: variationsFrom(product.variations),
        specs: specsFrom(custom.specs),
        benefits: itemsFrom(custom.benefits),
        applications: itemsFrom(custom.applications),
        logos: { SA_LOGO: activeLogoIds(sa), CERT_LOGO: activeLogoIds(cert) },
      };

      setContext({
        product,
        logoCatalog: { SA_LOGO: sa, CERT_LOGO: cert },
        optionCatalog,
        maxVariations: store.max_variations_per_product,
      });
      // Two independent copies — mutating the draft must never touch baseline.
      setBaseline(structuredClone(snapshot));
      setDraft(structuredClone(snapshot));
      setSaveErrors({});
      setLoadedAt(new Date());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load product");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Patch one slice of the draft. */
  const setSection = useCallback(
    <K extends keyof EditorSnapshot>(key: K, value: EditorSnapshot[K]) => {
      setDraft((d) => (d ? { ...d, [key]: value } : d));
    },
    [],
  );

  const toggleLogo = useCallback((kind: LogoKind, logoId: string) => {
    setDraft((d) => {
      if (!d) return d;
      const current = d.logos[kind];
      const next = current.includes(logoId)
        ? current.filter((id) => id !== logoId)
        : [...current, logoId];
      return { ...d, logos: { ...d.logos, [kind]: next } };
    });
  }, []);

  const dirty: DirtyMap = useMemo(() => {
    if (!draft || !baseline) return emptyDirty;
    const map = { ...emptyDirty };
    for (const key of SECTION_KEYS) map[key] = isSectionDirty(draft, baseline, key);
    return map;
  }, [draft, baseline]);

  const isDirty = SECTION_KEYS.some((k) => dirty[k]);
  const validationErrors = useMemo(
    () => (draft ? validate(draft, context?.maxVariations, { hideCommerce }) : {}),
    [draft, context?.maxVariations, hideCommerce],
  );
  const isValid = Object.keys(validationErrors).length === 0;

  const dirtyLabels = useMemo(
    () => SECTION_KEYS.filter((k) => dirty[k]).map((k) => SECTION_LABELS[k]),
    [dirty],
  );

  const reset = useCallback(() => {
    if (baseline) setDraft(structuredClone(baseline));
    setSaveErrors({});
  }, [baseline]);

  /** Attach a catalog option, exposing all of its choices by default. */
  const attachOption = useCallback((option: CatalogOption) => {
    setDraft((d) => {
      if (!d || d.options.some((o) => o.id === option.id)) return d;
      const ref: OptionRefDraft = {
        id: option.id,
        name: option.name,
        type: option.type,
        choiceIds: option.choices.map((c) => c.id),
      };
      return { ...d, options: [...d.options, ref] };
    });
  }, []);

  const detachOption = useCallback((optionId: string) => {
    setDraft((d) => (d ? { ...d, options: d.options.filter((o) => o.id !== optionId) } : d));
  }, []);

  /** Include/exclude one of an attached option's choices for THIS product. */
  const toggleOptionChoice = useCallback((optionId: string, choiceId: string) => {
    setDraft((d) => {
      if (!d) return d;
      return {
        ...d,
        options: d.options.map((o) =>
          o.id !== optionId
            ? o
            : {
                ...o,
                choiceIds: o.choiceIds.includes(choiceId)
                  ? o.choiceIds.filter((c) => c !== choiceId)
                  : [...o.choiceIds, choiceId],
              },
        ),
      };
    });
  }, []);

  const setVariation = useCallback((id: string, patch: Partial<VariationDraft>) => {
    setDraft((d) =>
      d
        ? { ...d, variations: d.variations.map((v) => (v.id === id ? { ...v, ...patch } : v)) }
        : d,
    );
  }, []);

  /** Bulk-fill one field across every variation — essential past ~8 rows. */
  const setAllVariations = useCallback((patch: Partial<VariationDraft>) => {
    setDraft((d) => (d ? { ...d, variations: d.variations.map((v) => ({ ...v, ...patch })) } : d));
  }, []);

  /** Re-read just the shared option catalog after a catalog-level mutation. */
  const reloadOptionCatalog = useCallback(async () => {
    try {
      const optionCatalog = await apiJson<OptionCatalog>(`/api/options`);
      setContext((c) => (c ? { ...c, optionCatalog } : c));
    } catch {
      // Non-fatal: the attach modal just shows a slightly stale catalog.
    }
  }, []);

  /**
   * Saves every dirty section, sequentially.
   *
   * Only dirty sections are sent: the hub PUTs are delete-all-then-recreate, so
   * a no-op PUT is a real destructive round-trip against live data.
   *
   * Each task banks its result into BOTH baseline and draft on success, so a
   * later failure doesn't lose earlier work. Failures are recorded per-section
   * and the loop continues — the failed section stays dirty, which keeps the
   * navigate-away guard armed.
   *
   * Returns true only if everything committed.
   */
  const save = useCallback(async (): Promise<boolean> => {
    if (!productId || !draft || !baseline || saving) return false;
    if (!isValid) {
      toast.error("Fix the highlighted fields before saving.");
      return false;
    }
    if (!SECTION_KEYS.some((k) => dirty[k])) return true;

    const tasks: SaveTask[] = [];

    if (dirty.details) {
      tasks.push({
        keys: ["details"],
        label: "details",
        run: async () => {
          const payload = buildDetailsPayload(draft.details, baseline.details);
          const updated = await apiJson<ProductDetail>(`/api/products/${productId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
          setContext((c) => (c ? { ...c, product: updated } : c));
          return { details: nativeFromProduct(updated) };
        },
      });
    }

    if (dirty.images) {
      tasks.push({
        keys: ["images"],
        label: "images",
        run: async () => {
          // Full ordered replacement. Duda ingests any not-yet-hosted URL and
          // returns its own CDN URL, so we re-baseline from the response.
          const updated = await apiJson<ProductDetail>(`/api/products/${productId}/images`, {
            method: "PUT",
            body: JSON.stringify({
              images: draft.images.map((img) => ({ url: img.url, alt: img.alt })),
            }),
          });
          setContext((c) => (c ? { ...c, product: updated } : c));
          return { images: imagesFrom(updated.images) };
        },
      });
    }

    // Options BEFORE variations: Duda regenerates variations (with new ids) on
    // an option change, so any variation edit in the same save would target
    // dead ids. The UI locks the variations table while options are dirty, and
    // the backend 409s on stale ids as a backstop.
    if (dirty.options) {
      tasks.push({
        keys: ["options", "variations"],
        label: "options",
        run: async () => {
          const res = await apiJson<{
            product: ProductDetail;
            variationData: { restored: number; dropped: string[] };
          }>(`/api/products/${productId}/options`, {
            method: "PUT",
            body: JSON.stringify({
              options: draft.options.map((o) => ({ id: o.id, choiceIds: o.choiceIds })),
            }),
          });

          setContext((c) => (c ? { ...c, product: res.product } : c));

          // Duda blanks every SKU/price on regeneration; the backend re-applies
          // what it can. Tell the user plainly what didn't survive.
          const { restored, dropped } = res.variationData;
          if (restored > 0) {
            toast.success(`Carried variation details across ${restored} combination(s)`);
          }
          if (dropped.length > 0) {
            toast.error(
              `${dropped.length} combination(s) no longer exist, so their SKU and price difference were lost`,
            );
          }

          return {
            options: optionsFrom(res.product.options),
            variations: variationsFrom(res.product.variations),
          };
        },
      });
    } else if (dirty.variations) {
      tasks.push({
        keys: ["variations"],
        label: "variations",
        run: async () => {
          const res = await apiJson<{ product: ProductDetail }>(
            `/api/products/${productId}/variations`,
            {
              method: "PUT",
              body: JSON.stringify({
                variations: draft.variations.map((v) => ({
                  id: v.id,
                  sku: v.sku,
                  price_difference: v.price_difference,
                  status: v.status === "HIDDEN" ? "HIDDEN" : "ACTIVE",
                })),
              }),
            },
          );
          setContext((c) => (c ? { ...c, product: res.product } : c));
          return { variations: variationsFrom(res.product.variations) };
        },
      });
    }

    if (dirty.specs) {
      tasks.push({
        keys: ["specs"],
        label: "specs",
        run: async () => {
          const rows = await apiJson<HubSpecRow[]>(`/api/products/${productId}/specs`, {
            method: "PUT",
            body: JSON.stringify({
              rows: draft.specs.map((r) => ({ label: r.label.trim(), value: r.value.trim() })),
            }),
          });
          return { specs: specsFrom(rows) };
        },
      });
    }

    for (const key of ["benefits", "applications"] as const) {
      if (!dirty[key]) continue;
      tasks.push({
        keys: [key],
        label: key,
        run: async () => {
          const items = await apiJson<HubTextItem[]>(`/api/products/${productId}/${key}`, {
            method: "PUT",
            body: JSON.stringify({ items: draft[key].map((i) => ({ text: i.text.trim() })) }),
          });
          return { [key]: itemsFrom(items) } as Partial<EditorSnapshot>;
        },
      });
    }

    if (dirty.logos) {
      tasks.push({
        keys: ["logos"],
        label: "logos",
        run: async () => {
          const { activate, deactivate } = logoDiff(draft.logos, baseline.logos);
          // Both endpoints are idempotent, so a retry of the same save converges.
          for (const id of activate) {
            await apiJson(`/api/products/${productId}/logos/${id}`, { method: "PUT" });
          }
          for (const id of deactivate) {
            await apiJson(`/api/products/${productId}/logos/${id}`, { method: "DELETE" });
          }
          const [sa, cert] = await Promise.all([
            apiJson<ProductLogoEntry[]>(`/api/products/${productId}/logos?kind=SA_LOGO`),
            apiJson<ProductLogoEntry[]>(`/api/products/${productId}/logos?kind=CERT_LOGO`),
          ]);
          setContext((c) => (c ? { ...c, logoCatalog: { SA_LOGO: sa, CERT_LOGO: cert } } : c));
          return { logos: { SA_LOGO: activeLogoIds(sa), CERT_LOGO: activeLogoIds(cert) } };
        },
      });
    }

    setSaving(true);
    setSaveErrors({});
    const failures: ErrorMap = {};
    let succeeded = 0;

    for (const task of tasks) {
      setSavingLabel(task.label);
      try {
        const confirmed = await task.run();
        // Bank immediately: this section is now saved even if a later task fails.
        setBaseline((b) => (b ? { ...b, ...confirmed } : b));
        setDraft((d) => (d ? { ...d, ...confirmed } : d));
        succeeded++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Save failed";
        for (const k of task.keys) failures[k] = msg;
      }
    }

    setSavingLabel(null);
    setSaving(false);
    setSaveErrors(failures);

    const failedCount = Object.keys(failures).length;
    if (failedCount === 0) {
      toast.success(tasks.length === 1 ? "Saved" : `Saved ${tasks.length} sections`);
      return true;
    }
    if (succeeded === 0) {
      toast.error(Object.values(failures)[0] ?? "Save failed");
    } else {
      const failedLabels = SECTION_KEYS.filter((k) => failures[k]).map((k) => SECTION_LABELS[k]);
      toast.error(
        `Saved ${succeeded} of ${tasks.length} sections — ${failedLabels.join(", ")} failed`,
      );
    }
    return false;
  }, [productId, draft, baseline, saving, isValid, dirty]);

  return {
    context,
    draft,
    baseline,
    loading,
    loadError,
    loadedAt,
    saving,
    savingLabel,
    saveErrors,
    validationErrors,
    dirty,
    isDirty,
    isValid,
    dirtyLabels,
    setSection,
    toggleLogo,
    attachOption,
    detachOption,
    toggleOptionChoice,
    setVariation,
    setAllVariations,
    reloadOptionCatalog,
    reset,
    save,
    reload: load,
    /** True while the guard should be suppressed (deliberate exit or mid-save). */
    guardSuppressed: () => guardDisarmed.current || saving,
    disarmGuard,
  };
}
