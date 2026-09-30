import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { ChevronDown, ChevronRight, ImageOff } from "lucide-react";
import { MediaPicker } from "../components/MediaPicker";
import {
  Button,
  Card,
  DropdownMenu,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  SortableList,
  DragHandle,
  type DragHandleProps,
  Table,
  TBody,
  TD,
  Textarea,
  TH,
  THead,
  toast,
  TR,
  useConfirm,
} from "../components/ui";
import { apiJson } from "../lib/api";

const ROOT = "ROOT";

/** Depth-annotated, pre-ordered by the backend so the tree renders directly. */
interface CategoryNode {
  /** From the MIRROR, not Duda's list — see the note on the backend type. */
  imageUrl?: string | null;
  id: string;
  title: string;
  parent_id: string;
  products_count: number;
  depth: number;
  subcategoryCount: number;
}

interface CategoryDetail {
  id: string;
  title: string;
  parent_id: string;
  description?: string;
  image?: { alt: string; url: string } | null;
  seo?: { url?: string; title?: string; description?: string };
}

interface FormState {
  title: string;
  parent_id: string;
  description: string;
  /**
   * ⚠️ Empty string means "leave whatever Duda has", NOT "remove it". A
   * category image CANNOT be removed once set — probed 2026-09-30: Duda
   * accepts `image: null` and ignores it, and `{url:""}`, `{}` and
   * `{url:null}` all 400. So the UI offers Replace, never Remove; a button
   * that silently did nothing would be worse than its absence.
   */
  image_url: string;
  seo_url: string;
  seo_title: string;
  seo_description: string;
}

const blankForm: FormState = {
  title: "",
  parent_id: ROOT,
  description: "",
  image_url: "",
  seo_url: "",
  seo_title: "",
  seo_description: "",
};

/**
 * Store categories, mirroring Duda's own screen: a collapsible tree with
 * per-row subcategory and product counts.
 *
 * Duda returns categories FLAT with a parent_id, so the backend derives depth
 * and ordering; this page only owns which branches are collapsed.
 */
export default function Categories() {
  const confirm = useConfirm();
  const [nodes, setNodes] = useState<CategoryNode[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const didInitialCollapse = useRef(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  /** What Duda already had, so an unchanged image is never re-sent. */
  const originalImage = useRef("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<{ count: number; categories: CategoryNode[] }>("/api/categories");
      setNodes(res.categories);
      /*
       * Start with the top level collapsed, ONCE. The tree went from 3 rows to
       * 23 when Industries and Site Challenges arrived, and every descendant
       * rendering on first paint buries the structure it is meant to show.
       *
       * Guarded by a ref rather than keyed off `collapsed` being empty: `load()`
       * runs again after every create, rename and delete, and re-collapsing
       * there would throw away whatever the user had just opened to work in.
       */
      if (!didInitialCollapse.current) {
        didInitialCollapse.current = true;
        setCollapsed(new Set(res.categories.filter((c) => c.depth === 0).map((c) => c.id)));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(id: string) {
    setCollapsed((c) => {
      const next = new Set(c);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function openCreate(parentId: string = ROOT) {
    originalImage.current = "";
    setEditingId(null);
    setForm({ ...blankForm, parent_id: parentId });
    setFormOpen(true);
  }

  async function openEdit(node: CategoryNode) {
    originalImage.current = "";
    setEditingId(node.id);
    setForm({ ...blankForm, title: node.title, parent_id: node.parent_id });
    setFormOpen(true);
    try {
      // Only the single-category GET carries description/image/seo.
      const full = await apiJson<CategoryDetail>(`/api/categories/${node.id}`);
      // Recorded before the form is set, so the "did the image change?" test
      // on save compares against Duda rather than against the blank form.
      originalImage.current = full.image?.url ?? "";
      setForm({
        title: full.title,
        parent_id: full.parent_id,
        description: full.description ?? "",
        image_url: full.image?.url ?? "",
        seo_url: full.seo?.url ?? "",
        seo_title: full.seo?.title ?? "",
        seo_description: full.seo?.description ?? "",
      });
    } catch {
      toast.error("Couldn't load the full category — you can still rename it.");
    }
  }

  async function submit() {
    if (!form.title.trim() || busy) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        parent_id: form.parent_id,
        description: form.description,
      };
      /*
       * Only sent when it CHANGED. Re-sending the current value makes Duda
       * re-fetch and re-host the same file on every save, orphaning the
       * previous copy on its CDN — the same reason the product importer does
       * not re-send unchanged gallery URLs.
       */
      if (form.image_url && form.image_url !== originalImage.current) {
        body.image = { url: form.image_url };
      }
      // Only send seo when something is set; the backend merges it over the
      // current value so the page URL is never blanked.
      if (form.seo_url || form.seo_title || form.seo_description) {
        body.seo = {
          ...(form.seo_url ? { url: form.seo_url.trim() } : {}),
          title: form.seo_title,
          description: form.seo_description,
        };
      }

      if (editingId) {
        await apiJson(`/api/categories/${editingId}`, { method: "PATCH", body: JSON.stringify(body) });
        toast.success("Category updated");
      } else {
        await apiJson("/api/categories", { method: "POST", body: JSON.stringify(body) });
        toast.success(`Created “${form.title.trim()}”`);
      }
      setFormOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the category");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Persist one parent's child order.
   *
   * ⚠️ Optimistic: the rows are already where the drag left them, so waiting
   * for the round trip would snap them back and then forward again. On failure
   * the server's own tree replaces the local one, which is the honest outcome
   * — the order did not save, so it must not look like it did.
   */
  async function reorder(parentId: string, ids: string[]) {
    try {
      const res = await apiJson<{ categories: CategoryNode[] }>("/api/categories/reorder", {
        method: "PUT",
        body: JSON.stringify({ parentId, ids }),
      });
      setNodes(res.categories);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the new order");
      await load();
    }
  }

  async function remove(node: CategoryNode) {
    const ok = await confirm({
      title: `Delete “${node.title}”?`,
      description:
        node.subcategoryCount > 0 ? (
          <>
            This also deletes its{" "}
            <span className="font-semibold">
              {node.subcategoryCount} subcategor{node.subcategoryCount === 1 ? "y" : "ies"}
            </span>
            . Products aren't deleted — they just stop being categorised.
          </>
        ) : (
          "Products aren't deleted — they just stop being categorised."
        ),
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiJson(
        `/api/categories/${node.id}${node.subcategoryCount > 0 ? "?confirm=true" : ""}`,
        { method: "DELETE" },
      );
      toast.success(`Deleted “${node.title}”`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the category");
    }
  }

  /** Valid re-parent targets: anything but self and its own descendants. */
  const parentChoices = useMemo(() => {
    if (!nodes) return [];
    if (!editingId) return nodes;
    const banned = new Set<string>([editingId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const n of nodes) {
        if (!banned.has(n.id) && banned.has(n.parent_id)) {
          banned.add(n.id);
          grew = true;
        }
      }
    }
    return nodes.filter((n) => !banned.has(n.id));
  }, [nodes, editingId]);

  return (
    <>
      <PageHeader
        title="Categories"
        description="Create product categories to help store visitors find what they want to buy."
        actions={
          <Button variant="primary" size="sm" onClick={() => openCreate()}>
            + Create New Category
          </Button>
        }
      />

      {/* The real Card and Table, so only the cell contents change on load. */}
      {loading && (
        <Card className="mt-4 p-0" aria-busy="true" aria-live="polite" aria-label="Loading categories">
          <Table className="border-0">
            <THead>
              <TR>
                <TH className="w-10" />
                <TH>Category title</TH>
                <TH className="w-32">Subcategories</TH>
                <TH className="w-24">Products</TH>
                <TH className="w-12" />
              </TR>
            </THead>
            <TBody>
              {Array.from({ length: 8 }, (_, i) => (
                <TR key={i}>
                  <TD />
                  <TD>
                    {/* Alternating indent, so the placeholder reads as the
                        tree it is about to become rather than a flat list. */}
                    <div style={{ paddingLeft: i % 3 === 0 ? 0 : "1.5rem" }}>
                      <Skeleton className="h-4 w-56" />
                    </div>
                  </TD>
                  <TD>
                    <Skeleton className="h-4 w-8" />
                  </TD>
                  <TD>
                    <Skeleton className="h-4 w-8" />
                  </TD>
                  <TD />
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
      {error && (
        <div className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-body text-danger">
          {error}
        </div>
      )}

      {!loading && !error && nodes && (
        <Card className="mt-4 p-0">
          {nodes.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No categories yet"
                description="Group products so visitors can browse them."
                action={
                  <Button variant="primary" size="sm" onClick={() => openCreate()}>
                    + Create New Category
                  </Button>
                }
              />
            </div>
          ) : (
            <CategoryTree
              nodes={nodes}
              collapsed={collapsed}
              onToggle={toggle}
              onEdit={(n) => void openEdit(n)}
              onAddChild={(id) => openCreate(id)}
              onRemove={(n) => void remove(n)}
              onReorder={reorder}
            />
          )}
        </Card>
      )}

      {pickerOpen && (
        <MediaPicker
          kind="image"
          onPick={(asset) => {
            setForm((f) => ({ ...f, image_url: asset.url }));
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <Modal
        open={formOpen}
        onClose={() => !busy && setFormOpen(false)}
        size="lg"
        title={editingId ? "Edit category" : "Create category"}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void submit()}
              loading={busy}
              disabled={!form.title.trim()}
            >
              {editingId ? "Save changes" : "Create category"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Title" htmlFor="cat-title">
              <Input
                id="cat-title"
                size="sm"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                autoFocus
              />
            </Field>
            <Field label="Parent category" htmlFor="cat-parent" hint="Top level sits at the root of the store.">
              <Select
                id="cat-parent"
                size="sm"
                value={form.parent_id}
                onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value }))}
              >
                <option value={ROOT}>Top level</option>
                {parentChoices.map((c) => (
                  <option key={c.id} value={c.id}>
                    {"— ".repeat(c.depth)}
                    {c.title}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="Image"
            hint="Duda fetches the file and re-hosts its own copy, so the Media Centre original can be changed or deleted later without breaking the page."
          >
            <div className="flex items-center gap-3">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-surface-2 text-subtle">
                {form.image_url ? (
                  <img src={form.image_url} alt="" className="h-full w-full object-contain" />
                ) : (
                  <ImageOff size={18} />
                )}
              </span>
              <div>
                <Button type="button" variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
                  {form.image_url ? "Replace image" : "Choose image"}
                </Button>
                {/*
                  * ⚠️ No Remove button, deliberately. A category image cannot
                  * be cleared once set — probed 2026-09-30: Duda accepts
                  * `image: null` and ignores it, and `{url:""}`, `{}` and
                  * `{url:null}` all 400. A button that silently did nothing
                  * would be worse than its absence.
                  */}
                {form.image_url && (
                  <p className="mt-1 text-small text-subtle">
                    An image can be replaced but not removed.
                  </p>
                )}
              </div>
            </div>
          </Field>

          <Field label="Description" htmlFor="cat-desc" hint="HTML, shown on the category page.">
            <Textarea
              id="cat-desc"
              size="sm"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="h-20 font-mono"
              spellCheck={false}
            />
          </Field>

          <fieldset className="rounded-lg border border-border p-3">
            <legend className="px-1.5 text-small font-medium text-muted">SEO</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field
                label="Page URL"
                htmlFor="cat-url"
                hint={editingId ? "Duda won't allow this to be blank." : "Auto-generated from the title."}
              >
                <Input
                  id="cat-url"
                  size="sm"
                  value={form.seo_url}
                  onChange={(e) => setForm((f) => ({ ...f, seo_url: e.target.value }))}
                  placeholder={editingId ? undefined : "auto"}
                />
              </Field>
              <Field label="Title" htmlFor="cat-seo-title">
                <Input
                  id="cat-seo-title"
                  size="sm"
                  value={form.seo_title}
                  onChange={(e) => setForm((f) => ({ ...f, seo_title: e.target.value }))}
                />
              </Field>
              <Field label="Meta description" htmlFor="cat-seo-desc">
                <Input
                  id="cat-seo-desc"
                  size="sm"
                  value={form.seo_description}
                  onChange={(e) => setForm((f) => ({ ...f, seo_description: e.target.value }))}
                />
              </Field>
            </div>
          </fieldset>
        </div>
      </Modal>
    </>
  );
}

/** Grid template shared by the header and every row, so they cannot drift. */
const COLS = "grid grid-cols-[2rem_1fr_7rem_5rem_3rem] items-center gap-2 px-3";

/**
 * The category tree, drag-reorderable.
 *
 * ⚠️ TWO NESTED SortableLists, and the nesting is what enforces the rule.
 * `SortableList` renders its own `DndContext`, so a drag started among a
 * parent's children can never land in the top-level list — "you cannot move a
 * subcategory to another top-level category" is structural here, not a check
 * that could be forgotten or bypassed. Validating it server-side as well is
 * belt and braces for a stale tab, not the mechanism.
 *
 * ⚠️ Not a `<table>` any more. A table gives one `<tbody>` per sortable
 * context, and a tree needs a parent row and its children in the SAME visual
 * sequence but DIFFERENT contexts — which multiple tbodies cannot express.
 * The grid reproduces the columns exactly.
 */
function CategoryTree({
  nodes,
  collapsed,
  onToggle,
  onEdit,
  onAddChild,
  onRemove,
  onReorder,
}: {
  nodes: CategoryNode[];
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (n: CategoryNode) => void;
  onAddChild: (id: string) => void;
  onRemove: (n: CategoryNode) => void;
  onReorder: (parentId: string, ids: string[]) => void;
}) {
  const topLevel = nodes.filter((n) => n.depth === 0);
  const childrenOf = (id: string) => nodes.filter((n) => n.parent_id === id);

  const row = (n: CategoryNode, handle: DragHandleProps, child: boolean) => {
    const isCollapsed = collapsed.has(n.id);
    const kids = childrenOf(n.id);
    return (
      <div className={`${COLS} border-b border-border py-2.5 last:border-b-0 hover:bg-surface-2`}>
        <DragHandle handle={handle} />
        <div className="flex min-w-0 items-center gap-2" style={{ paddingLeft: child ? "1.5rem" : 0 }}>
          {kids.length > 0 ? (
            <button
              type="button"
              onClick={() => onToggle(n.id)}
              aria-label={isCollapsed ? "Expand" : "Collapse"}
              aria-expanded={!isCollapsed}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted transition-colors hover:bg-surface hover:text-text"
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
          ) : (
            <span className="h-5 w-5 shrink-0" />
          )}
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-surface-2 text-subtle">
            {n.imageUrl ? (
              <img src={n.imageUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              <ImageOff size={14} />
            )}
          </span>
          {/* The title is the edit affordance — it is what you click when you
              mean "open this", and the ⋯ menu keeps the other actions. */}
          <button
            type="button"
            onClick={() => onEdit(n)}
            className="truncate text-left font-medium text-text underline-offset-2 hover:underline"
          >
            {n.title}
          </button>
        </div>
        <span className="text-muted">{n.subcategoryCount}</span>
        <span className="text-muted">{n.products_count}</span>
        <DropdownMenu
          actions={[
            { label: "Edit", onSelect: () => onEdit(n) },
            { label: "Add subcategory", onSelect: () => onAddChild(n.id) },
            { label: "Delete", onSelect: () => onRemove(n), danger: true },
          ]}
        />
      </div>
    );
  };

  return (
    <div>
      <div className={`${COLS} border-b border-border py-2 text-small font-semibold text-muted`}>
        <span />
        <span>Category title</span>
        <span>Subcategories</span>
        <span>Products</span>
        <span />
      </div>

      <SortableList
        items={topLevel}
        getId={(n) => n.id}
        className=" "
        onReorder={(next) => onReorder(ROOT, next.map((n) => n.id))}
        renderItem={(n, handle) => (
          <>
            {row(n, handle, false)}
            {!collapsed.has(n.id) && childrenOf(n.id).length > 0 && (
              <SortableList
                items={childrenOf(n.id)}
                getId={(c) => c.id}
                className=" "
                onReorder={(next) => onReorder(n.id, next.map((c) => c.id))}
                renderItem={(c, h) => row(c, h, true)}
              />
            )}
          </>
        )}
      />
    </div>
  );
}
