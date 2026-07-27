import { Badge, Button, Card, CardHeader, DragHandle, RemoveButton, SortableList } from "./ui";
import type { TextItemDraft } from "./product/productEditorTypes";

/**
 * Ordered text list, used for both Key Benefits and Applications. Controlled —
 * the parent owns the items and the unified save bar commits them.
 */
export function TextItemListEditor({
  id,
  title,
  description,
  items,
  onChange,
  dirty,
  error,
  placeholder = "Enter text…",
}: {
  id: string;
  title: string;
  description?: string;
  items: TextItemDraft[];
  onChange: (next: TextItemDraft[]) => void;
  dirty: boolean;
  error?: string;
  placeholder?: string;
}) {
  const update = (itemId: string, val: string) =>
    onChange(items.map((it) => (it.id === itemId ? { ...it, text: val } : it)));
  const del = (itemId: string) => onChange(items.filter((it) => it.id !== itemId));
  const add = () => onChange([...items, { id: crypto.randomUUID(), text: "" }]);

  return (
    <Card id={id}>
      <CardHeader
        title={title}
        description={description}
        actions={dirty ? <Badge tone="accent">Unsaved</Badge> : undefined}
      />

      {error && (
        <div className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-small text-danger">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-small text-subtle">No items. Add one below.</p>
      ) : (
        <SortableList
          items={items}
          getId={(it) => it.id}
          onReorder={onChange}
          renderItem={(it, handle, index) => (
            <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-3">
              <DragHandle handle={handle} />
              <span className="w-6 text-right text-xs text-subtle">{index + 1}.</span>
              <input
                className={`flex-1 rounded-md border bg-surface px-3 py-2 text-xs font-medium text-text placeholder:text-subtle focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent ${
                  it.text.trim() ? "border-border" : "border-danger"
                }`}
                value={it.text}
                onChange={(e) => update(it.id, e.target.value)}
                placeholder={placeholder}
              />
              <RemoveButton onClick={() => del(it.id)} title="Delete item" />
            </div>
          )}
        />
      )}

      <div className="mt-4">
        <Button variant="secondary" size="sm" onClick={add}>
          + Add item
        </Button>
      </div>
    </Card>
  );
}
