import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronRight, ImageOff } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  DragHandle,
  Field,
  Input,
  Loader,
  Select,
  SortableList,
  Textarea,
  toast,
  type DragHandleProps,
} from "../components/ui";
import { MediaPicker } from "../components/MediaPicker";
import { UnsavedChangesModal } from "../components/UnsavedChangesModal";
import { useUnsavedChangesWarning } from "../hooks/useUnsavedChangesWarning";
import { AssignPickList } from "../components/product/AssignPickList";
import { apiJson } from "../lib/api";
import type { ProductSummary } from "../lib/types";

const ROOT = "ROOT";

interface CategoryNode {
  id: string;
  title: string;
  parent_id: string;
  depth: number;
  subcategoryCount: number;
  products_count: number;
  hubProductCount: number;
  imageUrl?: string | null;
}

interface CategoryDetail {
  id: string;
  title: string;
  parent_id: string;
  description?: string;
  image?: { alt: string; url: string } | null;
  seo?: { url?: string; title?: string; description?: string };
}

interface Draft {
  title: string;
  parent_id: string;
  description: string;
  image_url: string;
  seo_url: string;
  seo_title: string;
  seo_description: string;
  productIds: string[];
}

/** Compared to decide "dirty" — product ids as a SORTED set, so tick order isn't a change. */
const project = (d: Draft) => JSON.stringify({ ...d, productIds: [...d.productIds].sort() });

/**
 * Edit one category: info, image, SEO, its products and its subcategories.
 *
 * ⚠️ A PAGE, not a modal, and the image is why. Choosing one opens
 * `MediaPicker`, and a picker inside a modal is two independent overlays:
 * `Modal` closes on Escape and `MediaPicker` has no Escape handler at all, so
 * Escape dismissed the form UNDERNEATH the open picker. Both are `z-50` and
 * only `Modal` portals, so the picker also rendered behind it. Layering was
 * fixable in a line; the focus trap, the scroll lock and the Escape ambiguity
 * were not. The create modal survives because it asks for a name and a parent
 * and opens nothing.
 */
export default function CategoryDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();

  const [cats, setCats] = useState<CategoryNode[]>([]);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [baseline, setBaseline] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  /** What Duda already had, so an unchanged image is never re-sent. */
  const originalImage = useRef("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, tree, assigned, prods] = await Promise.all([
        apiJson<CategoryDetail>(`/api/categories/${id}`),
        apiJson<{ categories: CategoryNode[] }>("/api/categories"),
        apiJson<{ ids: string[] }>(`/api/categories/${id}/products`),
        apiJson<ProductSummary[]>("/api/products"),
      ]);
      originalImage.current = detail.image?.url ?? "";
      const next: Draft = {
        title: detail.title,
        parent_id: detail.parent_id || ROOT,
        description: detail.description ?? "",
        image_url: detail.image?.url ?? "",
        seo_url: detail.seo?.url ?? "",
        seo_title: detail.seo?.title ?? "",
        seo_description: detail.seo?.description ?? "",
        productIds: assigned.ids,
      };
      setCats(tree.categories);
      setProducts(prods);
      setBaseline(next);
      setDraft(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the category");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const node = cats.find((c) => c.id === id);
  const children = useMemo(() => cats.filter((c) => c.parent_id === id), [cats, id]);
  const dirty = !!draft && !!baseline && project(draft) !== project(baseline);

  // ⚠️ Mirrors the server rule. The slug is the page URL AND how the public
  // listing finds this category, so an uppercase or spaced one would break
  // that page's product grid without any error.
  const slug = draft?.seo_url.trim() ?? "";
  const slugError =
    slug && !/^[a-z0-9-]+$/.test(slug) ? "Lowercase letters, numbers and hyphens only." : undefined;

  /*
   * ⚠️ This page had no guard: tick twenty products, click a sidebar link, and
   * the edits were gone without a word. Same guard as the product editor —
   * in-app navigation gets the three-way modal, a tab close the browser's own.
   */
  const blocker = useUnsavedChangesWarning({ when: dirty && !saving });

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  /**
   * ⚠️ Re-parenting is offered here but NOT in the tree's drag-reorder, and
   * that is deliberate rather than inconsistent: a deliberate choice from a
   * labelled dropdown is a different act from a drag that could land anywhere.
   * The server refuses a move under the category's own descendant either way.
   */
  const parentOptions = cats.filter((c) => c.id !== id && !isDescendant(cats, c.id, id));

  /** True only when everything committed — the unsaved-changes modal relies on it. */
  async function save(): Promise<boolean> {
    if (!draft || !baseline || saving || slugError) return false;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: draft.title.trim(),
        parent_id: draft.parent_id,
        description: draft.description,
      };
      // Only when it CHANGED: re-sending makes Duda re-fetch and re-host the
      // same file, orphaning the previous copy on its CDN.
      if (draft.image_url && draft.image_url !== originalImage.current) {
        body.image = { url: draft.image_url };
      }
      if (draft.seo_url || draft.seo_title || draft.seo_description) {
        body.seo = {
          ...(draft.seo_url ? { url: draft.seo_url.trim() } : {}),
          title: draft.seo_title,
          description: draft.seo_description,
        };
      }
      await apiJson(`/api/categories/${id}`, { method: "PATCH", body: JSON.stringify(body) });

      // Separate call, and only when it changed — the product set is Hub-side
      // while everything above is Duda's.
      if ([...draft.productIds].sort().join() !== [...baseline.productIds].sort().join()) {
        await apiJson(`/api/categories/${id}/products`, {
          method: "PUT",
          body: JSON.stringify({ ids: draft.productIds }),
        });
      }
      toast.success("Category saved");
      await load();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the category");
      return false;
    } finally {
      setSaving(false);
    }
  }

  /** Drag order saves immediately: a drag has no Save button of its own. */
  async function reorderChildren(ids: string[]) {
    try {
      const res = await apiJson<{ categories: CategoryNode[] }>("/api/categories/reorder", {
        method: "PUT",
        body: JSON.stringify({ parentId: id, ids }),
      });
      setCats(res.categories);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the new order");
      await load();
    }
  }

  if (loading) return <Loader label="Loading category…" />;
  if (error) {
    return (
      <div className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-body text-danger">
        {error}
      </div>
    );
  }
  if (!draft) return null;

  return (
    <>
      <UnsavedChangesModal blocker={blocker} onSave={save} />
      <nav className="flex items-center gap-1.5 text-small text-muted">
        <Link to="/categories" className="hover:text-text">
          Categories
        </Link>
        <ChevronRight size={13} />
        <span className="text-text">{node?.title ?? draft.title}</span>
      </nav>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1 font-semibold text-text">{node?.title ?? draft.title}</h1>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-small text-muted">Unsaved changes</span>}
          <Button variant="secondary" size="sm" onClick={() => navigate("/categories")} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={() => void save()} disabled={!dirty || saving || !draft.title.trim() || !!slugError}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-10">
        <div className="space-y-4 lg:col-span-7">
          <Card>
            <CardHeader title="Category info" />
            <div className="space-y-4">
              <Field label="Category name" htmlFor="cat-title">
                <Input
                  id="cat-title"
                  size="sm"
                  value={draft.title}
                  onChange={(e) => set("title", e.target.value)}
                />
              </Field>
              <Field label="Parent category" htmlFor="cat-parent" hint="Top level sits at the root of the store.">
                <Select
                  id="cat-parent"
                  size="sm"
                  value={draft.parent_id}
                  onChange={(e) => set("parent_id", e.target.value)}
                >
                  <option value={ROOT}>Top level</option>
                  {parentOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {"— ".repeat(c.depth) + c.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Description" htmlFor="cat-desc" hint="HTML, shown on the category page.">
                <Textarea
                  id="cat-desc"
                  size="sm"
                  value={draft.description}
                  onChange={(e) => set("description", e.target.value)}
                  className="h-24 font-mono"
                  spellCheck={false}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Category products"
              description="Stored in the Hub. Run duda:sync-categories to push it to Duda's storefront."
            />
            <AssignPickList
              items={products.map((p) => ({ id: p.id, label: p.name, imageUrl: p.thumbnail }))}
              selected={draft.productIds}
              onChange={(next) => set("productIds", next)}
              searchPlaceholder="Search products…"
              emptyText="No products in this store yet."
            />
          </Card>

          <Card>
            <CardHeader
              title="Subcategories"
              actions={
                <Button variant="secondary" size="sm" onClick={() => navigate(`/categories?create=${id}`)}>
                  + Create a subcategory
                </Button>
              }
            />
            {children.length === 0 ? (
              <p className="text-small text-subtle">No subcategories yet.</p>
            ) : (
              <SortableList
                items={children}
                getId={(c) => c.id}
                className="divide-y divide-border"
                onReorder={(next) => void reorderChildren(next.map((c) => c.id))}
                renderItem={(c, handle: DragHandleProps) => (
                  <div className="flex items-center gap-2 py-2">
                    <DragHandle handle={handle} />
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-surface-2 text-subtle">
                      {c.imageUrl ? (
                        <img src={c.imageUrl} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <ImageOff size={14} />
                      )}
                    </span>
                    <Link
                      to={`/categories/${c.id}`}
                      className="min-w-0 flex-1 truncate font-medium text-text underline-offset-2 hover:underline"
                    >
                      {c.title}
                    </Link>
                    <span className="shrink-0 text-small text-muted">{c.hubProductCount} products</span>
                  </div>
                )}
              />
            )}
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-3">
          <Card>
            <CardHeader title="Category image" />
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-surface-2 text-subtle transition-colors hover:border-ring hover:text-text"
            >
              {draft.image_url ? (
                <img src={draft.image_url} alt="" className="h-full w-full object-contain" />
              ) : (
                <span className="flex flex-col items-center gap-2 text-small">
                  <ImageOff size={24} />
                  Click to choose an image
                </span>
              )}
            </button>
            <p className="mt-2 text-small text-subtle">
              Duda fetches the file and re-hosts its own copy, so the Media Centre original can
              change later without breaking the page.
              {/*
                * ⚠️ No Remove: a category image cannot be cleared once set.
                * Probed 2026-09-30 — Duda accepts `image: null` and ignores it,
                * and {url:""}, {} and {url:null} all 400. A button that did
                * nothing would be worse than its absence.
                */}
              {draft.image_url && " An image can be replaced but not removed."}
            </p>
          </Card>

          <Card>
            <CardHeader title="SEO" />
            <div className="space-y-4">
              <Field
                label="Page URL"
                htmlFor="cat-seo-url"
                hint="The live category page address. Changing it breaks existing links."
                error={slugError}
              >
                <Input
                  id="cat-seo-url"
                  size="sm"
                  value={draft.seo_url}
                  onChange={(e) => set("seo_url", e.target.value)}
                />
              </Field>
              <Field label="Title" htmlFor="cat-seo-title">
                <Input
                  id="cat-seo-title"
                  size="sm"
                  value={draft.seo_title}
                  onChange={(e) => set("seo_title", e.target.value)}
                />
              </Field>
              <Field label="Meta description" htmlFor="cat-seo-desc">
                <Textarea
                  id="cat-seo-desc"
                  size="sm"
                  value={draft.seo_description}
                  onChange={(e) => set("seo_description", e.target.value)}
                  className="h-20"
                />
              </Field>
            </div>
          </Card>
        </div>
      </div>

      {pickerOpen && (
        <MediaPicker
          kind="image"
          onPick={(asset) => {
            setPickerOpen(false);
            // Duda fetches a category image by its URL, so an unresolved one
            // is refused rather than sent.
            if (!asset.url) {
              toast.error(`“${asset.filename}” has no usable URL, so it cannot be used.`);
              return;
            }
            set("image_url", asset.url);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}

/** True when `candidate` sits anywhere beneath `ancestor`. */
function isDescendant(cats: CategoryNode[], candidate: string, ancestor: string): boolean {
  let p = cats.find((c) => c.id === candidate)?.parent_id;
  const seen = new Set<string>();
  while (p && p !== ROOT && !seen.has(p)) {
    if (p === ancestor) return true;
    seen.add(p);
    p = cats.find((c) => c.id === p)?.parent_id;
  }
  return false;
}
