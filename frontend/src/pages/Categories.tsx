import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ImageOff } from "lucide-react";
import {
  Button,
  Card,
  DropdownMenu,
  EmptyState,
  Field,
  Input,
  Loader,
  Modal,
  PageHeader,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Textarea,
  toast,
  useConfirm,
} from "../components/ui";
import { apiJson } from "../lib/api";

const ROOT = "ROOT";

/** Depth-annotated, pre-ordered by the backend so the tree renders directly. */
interface CategoryNode {
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
  seo_url: string;
  seo_title: string;
  seo_description: string;
}

const blankForm: FormState = {
  title: "",
  parent_id: ROOT,
  description: "",
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

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<{ count: number; categories: CategoryNode[] }>("/api/categories");
      setNodes(res.categories);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Hide any row whose ancestor chain contains a collapsed node. */
  const visible = useMemo(() => {
    if (!nodes) return [];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    return nodes.filter((n) => {
      let parent = n.parent_id;
      while (parent && parent !== ROOT) {
        if (collapsed.has(parent)) return false;
        parent = byId.get(parent)?.parent_id ?? ROOT;
      }
      return true;
    });
  }, [nodes, collapsed]);

  const topLevel = useMemo(() => (nodes ?? []).filter((n) => n.parent_id === ROOT), [nodes]);

  function toggle(id: string) {
    setCollapsed((c) => {
      const next = new Set(c);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function openCreate(parentId: string = ROOT) {
    setEditingId(null);
    setForm({ ...blankForm, parent_id: parentId });
    setFormOpen(true);
  }

  async function openEdit(node: CategoryNode) {
    setEditingId(node.id);
    setForm({ ...blankForm, title: node.title, parent_id: node.parent_id });
    setFormOpen(true);
    try {
      // Only the single-category GET carries description/image/seo.
      const full = await apiJson<CategoryDetail>(`/api/categories/${node.id}`);
      setForm({
        title: full.title,
        parent_id: full.parent_id,
        description: full.description ?? "",
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

      {loading && <Loader label="Loading categories…" />}
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
                {visible.map((n) => {
                  const isCollapsed = collapsed.has(n.id);
                  const topIndex = n.depth === 0 ? topLevel.indexOf(n) + 1 : null;
                  return (
                    <TR key={n.id}>
                      <TD className="text-subtle">{topIndex ?? ""}</TD>
                      <TD>
                        <div
                          className="flex items-center gap-2"
                          // Indent by depth so nesting is readable without a
                          // separate tree column.
                          style={{ paddingLeft: `${n.depth * 1.5}rem` }}
                        >
                          {n.subcategoryCount > 0 ? (
                            <button
                              type="button"
                              onClick={() => toggle(n.id)}
                              aria-label={isCollapsed ? "Expand" : "Collapse"}
                              aria-expanded={!isCollapsed}
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted transition-colors hover:bg-surface-2 hover:text-text"
                            >
                              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            </button>
                          ) : (
                            <span className="h-5 w-5 shrink-0" />
                          )}
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-border bg-surface-2 text-subtle">
                            <ImageOff size={14} />
                          </span>
                          <span className="font-medium text-text">{n.title}</span>
                        </div>
                      </TD>
                      <TD className="text-muted">{n.subcategoryCount}</TD>
                      <TD className="text-muted">{n.products_count}</TD>
                      <TD>
                        <DropdownMenu
                          actions={[
                            { label: "Edit", onSelect: () => void openEdit(n) },
                            { label: "Add subcategory", onSelect: () => openCreate(n.id) },
                            { label: "Delete", onSelect: () => void remove(n), danger: true },
                          ]}
                        />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </Card>
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
