import { useEffect, useMemo, useState, type FormEvent } from "react";
import { apiJson } from "../lib/api";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DragHandle,
  Input,
  PageHeader,
  Select,
  SortableList,
  toast,
  useConfirm,
} from "../components/ui";
import type { HubTag, HubTagGroup } from "../lib/types";

/** The bucket ungrouped tags fall into. Not a real group — it has no id. */
const UNGROUPED = "__ungrouped__";

/**
 * Manage tag groups and the tags inside them.
 *
 * Tags are Hub-owned — Duda has no equivalent — so this page is the whole
 * source of truth for them. Assignment happens per product in the editor.
 *
 * Groups exist because two unrelated vocabularies share this list: Industries
 * (Aviation, Offshore) and Site Problems (Dust, Fumes). Mixed together they
 * are unusable both here and in the editor's picker.
 */
export default function Tags() {
  const confirm = useConfirm();
  const [tags, setTags] = useState<HubTag[] | null>(null);
  const [groups, setGroups] = useState<HubTagGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [newTagGroup, setNewTagGroup] = useState<string>(UNGROUPED);
  const [groupName, setGroupName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [editingGroup, setEditingGroup] = useState<{ id: string; name: string } | null>(null);

  const load = () =>
    Promise.all([apiJson<HubTag[]>("/api/tags"), apiJson<HubTagGroup[]>("/api/tag-groups")])
      .then(([t, g]) => {
        setTags(t);
        setGroups(g);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load tags"));

  useEffect(() => {
    void load();
  }, []);

  /**
   * Buckets for rendering: every group in its own order, then Ungrouped last.
   *
   * Derived on every render from the two responses rather than held in state,
   * the same discipline SpecTableEditor uses — one source of truth, and no way
   * for this to drift from the server after a write.
   */
  const buckets = useMemo<{ key: string; group: HubTagGroup | null; tags: HubTag[] }[]>(() => {
    if (!tags || !groups) return [];
    const out: { key: string; group: HubTagGroup | null; tags: HubTag[] }[] = groups.map((g) => ({
      key: g.id,
      group: g,
      tags: tags.filter((t) => t.groupId === g.id),
    }));
    const loose = tags.filter((t) => !t.groupId);
    // Only shown when it has something in it — an empty "Ungrouped" heading is
    // noise on a tidy list.
    if (loose.length) out.push({ key: UNGROUPED, group: null, tags: loose });
    return out;
  }, [tags, groups]);

  /* ----------------------------------------------------------- groups -- */

  async function createGroup(e: FormEvent) {
    e.preventDefault();
    const trimmed = groupName.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await apiJson("/api/tag-groups", { method: "POST", body: JSON.stringify({ name: trimmed }) });
      setGroupName("");
      await load();
      toast.success(`Added group “${trimmed}”`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add the group");
    } finally {
      setBusy(false);
    }
  }

  async function renameGroup(id: string, next: string) {
    const trimmed = next.trim();
    if (!trimmed) return;
    try {
      await apiJson(`/api/tag-groups/${id}`, { method: "PATCH", body: JSON.stringify({ name: trimmed }) });
      setEditingGroup(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not rename the group");
    }
  }

  async function removeGroup(g: HubTagGroup) {
    const ok = await confirm({
      title: `Delete the “${g.name}” group?`,
      // Deliberately says the tags SURVIVE. Tag.groupId is SetNull, so nothing
      // is lost — and a warning implying otherwise would stop someone tidying
      // up a mistyped group name.
      description: g.tagCount
        ? `Its ${g.tagCount} tag${g.tagCount === 1 ? "" : "s"} will not be deleted — ${g.tagCount === 1 ? "it moves" : "they move"} to Ungrouped, keeping every product assignment.`
        : "It has no tags in it.",
      confirmLabel: "Delete group",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiJson(`/api/tag-groups/${g.id}`, { method: "DELETE" });
      await load();
      toast.success(`Deleted group “${g.name}”`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the group");
    }
  }

  async function reorderGroups(next: HubTagGroup[]) {
    setGroups(next); // optimistic — small list, trivial write
    try {
      await apiJson("/api/tag-groups/reorder", {
        method: "PUT",
        body: JSON.stringify({ ids: next.map((g) => g.id) }),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the group order");
      await load();
    }
  }

  /* ------------------------------------------------------------- tags -- */

  async function create(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await apiJson<HubTag>("/api/tags", {
        method: "POST",
        body: JSON.stringify({
          name: trimmed,
          groupId: newTagGroup === UNGROUPED ? null : newTagGroup,
        }),
      });
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

  async function moveTag(tag: HubTag, groupId: string) {
    try {
      await apiJson(`/api/tags/${tag.id}`, {
        method: "PATCH",
        // The name goes along because PATCH takes it as required — sending the
        // current one keeps this a pure move.
        body: JSON.stringify({ name: tag.name, groupId: groupId === UNGROUPED ? null : groupId }),
      });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not move the tag");
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

  /**
   * Reorder within ONE group. The server rejects an id set that is not exactly
   * that group's tags, so the payload must carry the group it applies to.
   */
  async function reorder(groupId: string | null, next: HubTag[]) {
    setTags((prev) =>
      prev ? [...prev.filter((t) => (t.groupId ?? null) !== groupId), ...next] : prev,
    );
    try {
      await apiJson("/api/tags/reorder", {
        method: "PUT",
        body: JSON.stringify({ groupId, ids: next.map((t) => t.id) }),
      });
      await load(); // re-sort into the server's canonical order
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the order");
      await load();
    }
  }

  const groupOptions = [
    ...(groups ?? []).map((g) => ({ value: g.id, label: g.name })),
    { value: UNGROUPED, label: "Ungrouped" },
  ];

  return (
    <>
      <PageHeader
        title="Tags"
        description="Labels for grouping products, organised into groups. Assign them per product in the editor."
        actions={
          tags && groups ? (
            <Badge tone="neutral">
              {tags.length} tag{tags.length === 1 ? "" : "s"} · {groups.length} group
              {groups.length === 1 ? "" : "s"}
            </Badge>
          ) : undefined
        }
      />

      {error && (
        <div className="mt-6 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Add a group" description="e.g. Industries, Site Problems" />
          <form onSubmit={createGroup} className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Industries"
                aria-label="New group name"
              />
            </div>
            <Button type="submit" variant="secondary" disabled={!groupName.trim() || busy}>
              {busy ? "Adding…" : "Add group"}
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Add a tag" />
          <form onSubmit={create} className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Aviation"
                aria-label="New tag name"
              />
            </div>
            <div className="w-40 shrink-0">
              <Select
                value={newTagGroup}
                onChange={(e) => setNewTagGroup(e.target.value)}
                aria-label="Group for the new tag"
              >
                {groupOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" disabled={!name.trim() || busy}>
              {busy ? "Adding…" : "Add tag"}
            </Button>
          </form>
        </Card>
      </div>

      {groups && groups.length > 1 && (
        <Card className="mt-6">
          <CardHeader title="Group order" description="Drag to reorder. This is the order groups appear in everywhere." />
          <SortableList
            as="div"
            className="flex flex-wrap gap-2"
            items={groups}
            getId={(g) => g.id}
            onReorder={reorderGroups}
            renderItem={(g, handle) => (
              <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 py-1.5">
                <DragHandle handle={handle} />
                <span className="text-xs font-semibold text-text">{g.name}</span>
                <span className="text-xs text-subtle">{g.tagCount}</span>
              </div>
            )}
          />
        </Card>
      )}

      {!tags || !groups ? (
        <Card className="mt-6">
          <p className="text-small text-subtle">Loading…</p>
        </Card>
      ) : buckets.length === 0 ? (
        <Card className="mt-6">
          <p className="text-small text-subtle">No tags yet. Add one above.</p>
        </Card>
      ) : (
        buckets.map((b) => (
          <Card key={b.key} className="mt-6">
            <CardHeader
              title={b.group?.name ?? "Ungrouped"}
              description={
                b.group
                  ? "Drag to reorder within this group."
                  : "Tags with no group. Pick one from the dropdown on a row to file it."
              }
              actions={
                b.group ? (
                  <div className="flex items-center gap-2">
                    {editingGroup?.id === b.group.id ? (
                      <input
                        autoFocus
                        className="w-40 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text focus:border-accent focus:outline-none"
                        value={editingGroup.name}
                        onChange={(e) => setEditingGroup({ id: b.group!.id, name: e.target.value })}
                        onBlur={() => void renameGroup(b.group!.id, editingGroup.name)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void renameGroup(b.group!.id, editingGroup.name);
                          if (e.key === "Escape") setEditingGroup(null);
                        }}
                      />
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingGroup({ id: b.group!.id, name: b.group!.name })}
                      >
                        Rename
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => void removeGroup(b.group!)}>
                      Delete group
                    </Button>
                  </div>
                ) : undefined
              }
            />

            {b.tags.length === 0 ? (
              <p className="text-small text-subtle">No tags in this group yet.</p>
            ) : (
              <SortableList
                as="div"
                className="space-y-2"
                items={b.tags}
                getId={(t) => t.id}
                onReorder={(next) => void reorder(b.group?.id ?? null, next)}
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
                    <div className="w-36 shrink-0">
                      <Select
                        size="sm"
                        value={tag.groupId ?? UNGROUPED}
                        onChange={(e) => void moveTag(tag, e.target.value)}
                        aria-label={`Group for ${tag.name}`}
                      >
                        {groupOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </div>
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
        ))
      )}
    </>
  );
}
