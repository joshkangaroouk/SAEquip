import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import {
  Thumb,
  Alert,
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
  toast,
  useConfirm,
} from "../components/ui";
import { apiJson } from "../lib/api";
import { cn } from "../lib/cn";

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
  /** The HUB's count — see the note on the backend type. */
  hubProductCount: number;
  /** The category page's slug, from the mirror. Null if never mirrored. */
  slug?: string | null;
}

interface FormState {
  title: string;
  parent_id: string;
}

const blankForm: FormState = {
  title: "",
  parent_id: ROOT,
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
  const [form, setForm] = useState<FormState>(blankForm);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

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
    setForm({ ...blankForm, parent_id: parentId });
    setFormOpen(true);
  }

  /*
   * `/categories?create=<parentId>` opens the create form under that parent —
   * what a category page's "+ Create a subcategory" links to. ⚠️ Nothing read
   * it until 2026-10-12, so that button just landed on this list. Applied once
   * the tree has loaded (an unknown parent is ignored), then removed from the
   * URL so a refresh or Back does not reopen the form.
   */
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const parent = params.get("create");
    if (!parent || !nodes) return;
    if (parent === ROOT || nodes.some((n) => n.id === parent)) openCreate(parent);
    setParams((p) => {
      p.delete("create");
      return p;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, nodes]);


  /** Create only — everything else is edited on /categories/:id. */
  async function submit() {
    if (!form.title.trim() || busy) return;
    setBusy(true);
    try {
      const created = await apiJson<{ id: string }>("/api/categories", {
        method: "POST",
        body: JSON.stringify({ title: form.title.trim(), parent_id: form.parent_id }),
      });
      setFormOpen(false);
      toast.success(`Created “${form.title.trim()}”`);
      // Straight to the page, which is where the rest of it is filled in.
      navigate(`/categories/${created.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the category");
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
        // ⚠️ Duda does NOT delete subcategories with their parent — measured:
        // the direct children move to the TOP LEVEL. This used to say they
        // were deleted, which is the opposite of what happens to the tree.
        node.subcategoryCount > 0 ? (
          <>
            Its{" "}
            <span className="font-semibold">
              {node.subcategoryCount} subcategor{node.subcategoryCount === 1 ? "y is" : "ies are"} not deleted
            </span>{" "}
            — Duda moves {node.subcategoryCount === 1 ? "it" : "them"} to the top level. Products aren't deleted
            either; they just stop being in “{node.title}”.
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


  return (
    <>
      <PageHeader
        title="Categories"
        description="Create product categories to help store visitors find what they want to buy."
        actions={
          <Button variant="primary" size="sm" onClick={() => openCreate()}>
            <Plus size={16} aria-hidden="true" />
            New category
          </Button>
        }
      />

      {/* The same Card, header and grid rows as the tree, so only the
          contents change on load. Three rows: the top level starts collapsed. */}
      {loading && (
        <Card padded={false} aria-busy="true" aria-live="polite" aria-label="Loading categories">
          <TreeHeader />
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className={cn(COLS, "border-t border-border py-2.5")}>
              <Skeleton className="h-8.5 w-8.5" />
              <div className="flex min-w-0 items-center gap-2">
                <Skeleton className="h-7 w-7 shrink-0" />
                <Skeleton className="hidden h-10 w-10 shrink-0 sm:block" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40 max-w-full" />
                  <Skeleton className="h-3 w-28 max-w-full" />
                </div>
              </div>
              <Skeleton className="hidden h-4 w-6 sm:block" />
              <Skeleton className="h-4 w-6" />
              <Skeleton className="h-8.5 w-8.5" />
            </div>
          ))}
        </Card>
      )}
      {error && <Alert tone="danger">{error}</Alert>}

      {!loading && !error && nodes && nodes.length === 0 && (
        <EmptyState
          title="No categories yet"
          description="Group products so visitors can browse them."
          action={
            <Button variant="primary" size="sm" onClick={() => openCreate()}>
              <Plus size={16} aria-hidden="true" />
              New category
            </Button>
          }
        />
      )}
      {!loading && !error && nodes && nodes.length > 0 && (
        <Card padded={false}>
          <CategoryTree
            nodes={nodes}
            collapsed={collapsed}
            onToggle={toggle}
            onEdit={(n) => navigate(`/categories/${n.id}`)}
            onAddChild={(id) => openCreate(id)}
            onRemove={(n) => void remove(n)}
            onReorder={reorder}
          />
        </Card>
      )}

      {/*
        * ⚠️ CREATE ONLY. Editing moved to /categories/:id because choosing an
        * image opens MediaPicker, and a picker inside a modal is two
        * independent overlays: Modal closes on Escape, MediaPicker has no
        * Escape handler, so Escape dismissed the form UNDERNEATH the picker.
        * This one asks for a name and a parent and opens nothing.
        */}
      <Modal
        open={formOpen}
        onClose={() => !busy && setFormOpen(false)}
        title="Create category"
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
              Create category
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Title" htmlFor="cat-title">
            <Input
              id="cat-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              autoFocus
            />
          </Field>
          <Field label="Parent category" htmlFor="cat-parent" hint="Top level sits at the root of the store.">
            <Select
              id="cat-parent"
              value={form.parent_id}
              onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value }))}
            >
              <option value={ROOT}>Top level</option>
              {(nodes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {"— ".repeat(c.depth) + c.title}
                </option>
              ))}
            </Select>
          </Field>
          <p className="text-help text-muted">
            Description, image, SEO and products are edited on the category page after it
            exists.
          </p>
        </div>
      </Modal>
    </>
  );
}

/**
 * Grid template shared by the header, the skeleton and every row, so they
 * cannot drift: drag handle, category, subcategories, products, actions.
 * Below `sm` the subcategories column drops out (its cells are `hidden`), so
 * the category keeps a usable width on a phone.
 */
const COLS =
  "grid grid-cols-[2.125rem_minmax(0,1fr)_3.5rem_2.125rem] items-center gap-x-3 px-3 " +
  "sm:grid-cols-[2.125rem_minmax(0,1fr)_6.5rem_5rem_2.125rem]";

/**
 * The tree's indent (12.14): 24px per level, on the chevron, thumbnail and
 * name group only (the drag handle keeps its column). Every row keeps a
 * chevron slot, so a level's thumbnails line up whether or not they have
 * children. The product editor's Categories dialog (AssignPickList) uses
 * the same 24px.
 */
const TREE_INDENT = 24;

/**
 * A nested group's guide line: 1px of --border down its left, under the
 * parent's chevron (the row's 12px padding, the 34px handle column, the
 * 12px gap, then the middle of the 28px chevron, plus the parent's own
 * indent). Drawn above the rows, so a row's hover background cannot hide it.
 */
const guideLeft = (parentDepth: number) => 12 + 34 + 12 + 14 + parentDepth * TREE_INDENT;

function TreeHeader() {
  return (
    <div className={cn(COLS, "t-th h-10 bg-surface-2")} aria-hidden="true">
      <span />
      <span>Category</span>
      <span className="hidden sm:block">Subcategories</span>
      <span>Products</span>
      <span />
    </div>
  );
}

/**
 * The category tree, drag-reorderable: the three top-level groups (Products,
 * Site Challenges, Industries), each opening onto its subcategories.
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
 *
 * ⚠️ Every row draws its own TOP border. Each sits inside its own drag
 * wrapper, so it is always that wrapper's last child: `last:border-b-0`
 * removed the separator under almost every row.
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
      <div className={cn(COLS, "border-t border-border py-2.5 transition-colors duration-[120ms] hover:bg-surface-2")}>
        <DragHandle handle={handle} label={`Drag ${n.title} to reorder`} />
        <div className="flex min-w-0 items-center gap-2" style={{ paddingLeft: n.depth * TREE_INDENT }}>
          {kids.length > 0 ? (
            <button
              type="button"
              onClick={() => onToggle(n.id)}
              aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${n.title}`}
              aria-expanded={!isCollapsed}
              className="flex h-7 w-7 shrink-0 items-center justify-center text-muted transition-colors duration-[120ms] hover:bg-surface hover:text-text"
            >
              {isCollapsed ? <ChevronRight size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
            </button>
          ) : (
            <span className="h-7 w-7 shrink-0" />
          )}
          {/* From `sm`: on a phone the title needs the width more. */}
          <Thumb src={n.imageUrl} size={40} className="hidden sm:flex" />
          <div className="min-w-0">
            {/* The title is the edit affordance — what you click when you
                mean "open this" — and a real link, so it opens in a new tab. */}
            <Link
              to={`/categories/${n.id}`}
              // Wraps on a phone, where truncating left about ten characters.
              className={cn("block text-text sm:truncate", child ? "font-medium" : "font-semibold")}
            >
              {n.title}
            </Link>
            {n.slug && <span className="t-code-sm block truncate text-muted">{n.slug}</span>}
          </div>
        </div>
        <span className="hidden font-mono text-help text-muted sm:block">{n.subcategoryCount}</span>
        {/*
          * ⚠️ The HUB's count, not Duda's. The two differ by design between
          * syncs, and showing Duda's made this column report a product the
          * edit page could not find — it reads the Hub, as does the public
          * widget. The sync is Kangaroo's job, so the staff screen no longer
          * flags the difference (02 §6).
          */}
        <span className="font-mono text-help text-text">{n.hubProductCount}</span>
        <DropdownMenu
          label={`Actions for ${n.title}`}
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
      <TreeHeader />

      <SortableList
        items={topLevel}
        getId={(n) => n.id}
        className=" "
        onReorder={(next) => onReorder(ROOT, next.map((n) => n.id))}
        renderItem={(n, handle) => (
          <>
            {row(n, handle, false)}
            {!collapsed.has(n.id) && childrenOf(n.id).length > 0 && (
              // The children's own sortable list, with its guide line.
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 z-[2] w-px bg-border"
                  style={{ left: guideLeft(n.depth) }}
                />
                <SortableList
                  items={childrenOf(n.id)}
                  getId={(c) => c.id}
                  className=" "
                  onReorder={(next) => onReorder(n.id, next.map((c) => c.id))}
                  renderItem={(c, h) => row(c, h, true)}
                />
              </div>
            )}
          </>
        )}
      />
    </div>
  );
}
