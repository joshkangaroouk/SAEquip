import { createElement, type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "../../lib/cn";

/** Props to spread onto whatever element should act as the drag handle. */
export type DragHandleProps = Record<string, unknown>;

interface SortableListProps<T> {
  items: T[];
  getId: (item: T) => string;
  /** Called with the full re-ordered array after a drag completes. */
  onReorder: (next: T[]) => void;
  /** Render one row. `handle` must be spread onto the grab element (see DragHandle). */
  renderItem: (item: T, handle: DragHandleProps, index: number) => ReactNode;
  /** Container element — "div" for lists, "tbody" for table rows. Default "div". */
  as?: "div" | "tbody";
  className?: string;
}

/** A ready-made grip handle. Spread the `handle` from renderItem onto it. */
export function DragHandle({
  handle,
  className,
}: {
  handle: DragHandleProps;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label="Drag to reorder"
      className={cn(
        "cursor-grab touch-none text-subtle hover:text-text active:cursor-grabbing",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        className,
      )}
      {...handle}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <circle cx="5" cy="3" r="1.4" /><circle cx="11" cy="3" r="1.4" />
        <circle cx="5" cy="8" r="1.4" /><circle cx="11" cy="8" r="1.4" />
        <circle cx="5" cy="13" r="1.4" /><circle cx="11" cy="13" r="1.4" />
      </svg>
    </button>
  );
}

function SortableNode<T>({
  id,
  item,
  index,
  as,
  renderItem,
}: {
  id: string;
  item: T;
  index: number;
  as: "div" | "tbody";
  renderItem: SortableListProps<T>["renderItem"];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    position: "relative",
    zIndex: isDragging ? 1 : undefined,
  };
  // For table rows we render a <tr>; otherwise a <div>. The drag handle props
  // (attributes + listeners) are handed to renderItem to attach to the grip.
  const tag = as === "tbody" ? "tr" : "div";
  const handle: DragHandleProps = { ...attributes, ...listeners };
  return createElement(tag, { ref: setNodeRef, style }, renderItem(item, handle, index));
}

/**
 * Generic drag-to-reorder list built on dnd-kit. Works for plain list rows
 * (as="div") and table rows (as="tbody", renderItem returns <td>…</td>).
 */
export function SortableList<T>({
  items,
  getId,
  onReorder,
  renderItem,
  as = "div",
  className,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map(getId);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onReorder(arrayMove(items, from, to));
  }

  const children = items.map((item, index) => (
    <SortableNode
      key={getId(item)}
      id={getId(item)}
      item={item}
      index={index}
      as={as}
      renderItem={renderItem}
    />
  ));

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {as === "tbody" ? (
          <tbody className={cn("divide-y divide-border", className)}>{children}</tbody>
        ) : (
          <div className={cn("space-y-2", className)}>{children}</div>
        )}
      </SortableContext>
    </DndContext>
  );
}
