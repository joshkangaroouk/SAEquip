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
  type SortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "../../lib/cn";
import { TR } from "./Table";

/** Props to spread onto whatever element should act as the drag handle. */
export type DragHandleProps = Record<string, unknown>;

/** What a drag did: which item moved, from where to where, in `items`. */
export interface ReorderMove {
  id: string;
  from: number;
  to: number;
}

/** Props for one row (as="tbody": a table `TR`, so `hover` and `onClick` work as on any row). */
export type SortableRowProps = React.HTMLAttributes<HTMLTableRowElement> & { hover?: boolean; selected?: boolean };

interface SortableListProps<T> {
  items: T[];
  getId: (item: T) => string;
  /** Called with the full re-ordered array after a drag completes, and what moved. */
  onReorder: (next: T[], move: ReorderMove) => void;
  /** Render one row. `handle` must be spread onto the grab element (see DragHandle). */
  renderItem: (item: T, handle: DragHandleProps, index: number) => ReactNode;
  /** Container element — "div" for lists, "tbody" for table rows. Default "div". */
  as?: "div" | "tbody";
  className?: string;
  /** dnd-kit sorting strategy — use rectSortingStrategy for multi-column grids. */
  strategy?: SortingStrategy;
  /** as="tbody" only: props for each row's `TR` (hover, onClick, className…). */
  rowProps?: (item: T) => SortableRowProps;
}

/** A ready-made grip handle. Spread the `handle` from renderItem onto it. */
export function DragHandle({
  handle,
  label = "Drag to reorder",
  className,
}: {
  handle: DragHandleProps;
  /** The accessible name — prefer the item, e.g. "Drag EX Heater to reorder". */
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        // A 34px square icon button (00); focus is the global outline.
        "flex h-8.5 w-8.5 shrink-0 cursor-grab touch-none items-center justify-center",
        "text-muted transition-colors duration-[120ms] hover:bg-surface-2 hover:text-text active:cursor-grabbing",
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
  rowProps,
}: {
  id: string;
  item: T;
  index: number;
  as: "div" | "tbody";
  renderItem: SortableListProps<T>["renderItem"];
  rowProps?: SortableListProps<T>["rowProps"];
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
  // The drag handle props (attributes + listeners) are handed to renderItem to
  // attach to the grip.
  const handle: DragHandleProps = { ...attributes, ...listeners };
  if (as === "tbody") {
    // The table's own row, so hover, the row click and its guard behave as on any row.
    const props = rowProps?.(item) ?? {};
    return (
      <TR {...props} ref={setNodeRef} style={{ ...props.style, ...style }}>
        {renderItem(item, handle, index)}
      </TR>
    );
  }
  return createElement("div", { ref: setNodeRef, style }, renderItem(item, handle, index));
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
  strategy = verticalListSortingStrategy,
  rowProps,
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
    onReorder(arrayMove(items, from, to), { id: String(active.id), from, to });
  }

  const children = items.map((item, index) => (
    <SortableNode
      key={getId(item)}
      id={getId(item)}
      item={item}
      index={index}
      as={as}
      renderItem={renderItem}
      rowProps={rowProps}
    />
  ));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      // ⚠️ dnd-kit renders its screen-reader text as <div>s beside the list
      // unless given a container, and a <div> inside a <table> is invalid. So
      // table rows put it in <body>.
      accessibility={as === "tbody" ? { container: document.body } : undefined}
    >
      <SortableContext items={ids} strategy={strategy}>
        {as === "tbody" ? (
          <tbody className={cn("divide-y divide-border", className)}>{children}</tbody>
        ) : (
          // The space-y-2 default only applies when the caller hasn't supplied
          // their own container classes — a custom className (e.g. a grid with
          // its own gap) fully replaces it, since space-y's `> * + *` margin
          // would otherwise stack on top of a grid gap and misalign the first
          // row (every item but the first gets an extra margin-top).
          <div className={className ? className : "space-y-2"}>{children}</div>
        )}
      </SortableContext>
    </DndContext>
  );
}
