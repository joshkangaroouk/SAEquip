import { useEffect, useState, type FormEvent } from "react";
import { apiJson } from "../lib/api";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DragHandle,
  Input,
  PageHeader,
  SortableList,
  toast,
  useConfirm,
} from "../components/ui";
import type { HubTag } from "../lib/types";

/**
 * Manage the tag list.
 *
 * Tags are Hub-owned — Duda has no equivalent — so this page is the whole
 * source of truth for them. Assignment happens per product in the editor.
 */
export default function Tags() {
  const confirm = useConfirm();
  const [tags, setTags] = useState<HubTag[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const load = () =>
    apiJson<HubTag[]>("/api/tags")
      .then(setTags)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load tags"));

  useEffect(() => {
    void load();
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await apiJson<HubTag>("/api/tags", { method: "POST", body: JSON.stringify({ name: trimmed }) });
      setName("");
      await load();
      toast.success(`Added “${trimmed}”`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add the tag");
    } finally {
      setBusy(false);
    }
  }

  async function rename(id: string, next: string) {
    const trimmed = next.trim();
    if (!trimmed) return;
    try {
      await apiJson(`/api/tags/${id}`, { method: "PATCH", body: JSON.stringify({ name: trimmed }) });
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not rename the tag");
    }
  }

  async function remove(tag: HubTag) {
    const ok = await confirm({
      title: `Delete “${tag.name}”?`,
      // The count is the whole point of the warning: deleting a tag silently
      // detaches it from every product, and nothing else would say so.
      description: tag.productCount
        ? `It is on ${tag.productCount} product${tag.productCount === 1 ? "" : "s"} and will be removed from ${tag.productCount === 1 ? "it" : "them all"}. This cannot be undone.`
        : "It is not used on any product yet.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiJson(`/api/tags/${tag.id}`, { method: "DELETE" });
      await load();
      toast.success(`Deleted “${tag.name}”`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the tag");
    }
  }

  async function reorder(next: HubTag[]) {
    setTags(next); // optimistic — the list is small and the write is trivial
    try {
      await apiJson("/api/tags/reorder", {
        method: "PUT",
        body: JSON.stringify({ ids: next.map((t) => t.id) }),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the order");
      await load();
    }
  }

  return (
    <>
      <PageHeader
        title="Tags"
        description="Free-form labels for grouping products. Assign them per product in the editor."
        actions={tags ? <Badge tone="neutral">{tags.length} tags</Badge> : undefined}
      />

      {error && (
        <div className="mt-6 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <Card className="mt-6">
        <CardHeader title="Add a tag" />
        <form onSubmit={create} className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hazardous Area"
              aria-label="New tag name"
            />
          </div>
          <Button type="submit" disabled={!name.trim() || busy}>
            {busy ? "Adding…" : "Add tag"}
          </Button>
        </form>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="All tags"
          description="Drag to reorder — this is the order they appear in when assigning."
        />

        {!tags ? (
          <p className="text-small text-subtle">Loading…</p>
        ) : tags.length === 0 ? (
          <p className="text-small text-subtle">No tags yet. Add one above.</p>
        ) : (
          <SortableList
            as="div"
            className="space-y-2"
            items={tags}
            getId={(t) => t.id}
            onReorder={reorder}
            renderItem={(tag, handle) => (
              <div className="flex items-center gap-3 rounded-md border border-border bg-surface-2 p-2.5">
                <DragHandle handle={handle} />
                {editing?.id === tag.id ? (
                  <input
                    autoFocus
                    className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text focus:border-accent focus:outline-none"
                    value={editing.name}
                    onChange={(e) => setEditing({ id: tag.id, name: e.target.value })}
                    onBlur={() => void rename(tag.id, editing.name)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void rename(tag.id, editing.name);
                      if (e.key === "Escape") setEditing(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditing({ id: tag.id, name: tag.name })}
                    className="min-w-0 flex-1 truncate text-left text-xs font-medium text-text hover:text-accent-strong"
                    title="Rename"
                  >
                    {tag.name}
                  </button>
                )}
                <code className="shrink-0 rounded bg-surface px-1.5 py-0.5 text-xs text-subtle">
                  {tag.slug}
                </code>
                <span className="shrink-0 text-xs text-subtle">
                  {tag.productCount} product{tag.productCount === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  onClick={() => void remove(tag)}
                  className="shrink-0 rounded px-1.5 text-body font-semibold text-muted hover:text-danger"
                >
                  Delete
                </button>
              </div>
            )}
          />
        )}
      </Card>
    </>
  );
}
