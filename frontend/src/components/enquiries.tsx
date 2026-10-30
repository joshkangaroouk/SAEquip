import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Input, SegmentedControl, Skeleton } from "./ui";

/**
 * The pieces Quote requests and Resource requests share as split views
 * (redesign batch 6): the list toolbar, the New / Handled filter, the
 * loading rows and the detail's definition grid.
 */

export type EnquiryFilter = "all" | "new" | "handled";

/** New = not yet marked handled. */
export const isNew = (e: { handledAt: string | null }) => e.handledAt === null;

/** Filter by state, then by a case-insensitive search over the given fields. */
export function filterEnquiries<T extends { handledAt: string | null }>(
  list: T[],
  filter: EnquiryFilter,
  query: string,
  fields: (e: T) => (string | null | undefined)[],
): T[] {
  const q = query.trim().toLowerCase();
  return list.filter((e) => {
    if (filter === "new" && !isNew(e)) return false;
    if (filter === "handled" && isNew(e)) return false;
    if (!q) return true;
    return fields(e).some((v) => (v ?? "").toLowerCase().includes(q));
  });
}

/**
 * The top of the list pane: search and the All / New / Handled filter with
 * counts. Sticky, so it stays in view as the list scrolls — under the 64px top
 * bar below lg, where the page scrolls; at the top of the pane from lg, where
 * the pane does.
 */
export function EnquiryToolbar<T extends { handledAt: string | null }>({
  all,
  query,
  onQuery,
  filter,
  onFilter,
  searchLabel,
}: {
  all: T[];
  query: string;
  onQuery: (q: string) => void;
  filter: EnquiryFilter;
  onFilter: (f: EnquiryFilter) => void;
  /** e.g. "Search quote requests". */
  searchLabel: string;
}) {
  const fresh = all.filter(isNew).length;
  return (
    <div className="sticky top-16 z-10 space-y-3 border-b border-border bg-surface p-4 lg:top-0">
      <div className="relative">
        <Search
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <Input
          size="sm"
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Name, company or email…"
          aria-label={searchLabel}
          className="pl-9"
        />
      </div>
      <SegmentedControl<EnquiryFilter>
        ariaLabel="Show"
        value={filter}
        onChange={onFilter}
        options={[
          { value: "all", label: "All", count: all.length },
          { value: "new", label: "New", count: fresh },
          { value: "handled", label: "Handled", count: all.length - fresh },
        ]}
      />
    </div>
  );
}

/** Placeholder rows the shape of SplitListItem, while the list loads. */
export function EnquiryListSkeleton() {
  return (
    <ul aria-busy="true" aria-label="Loading">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="border-b border-border px-5 py-3">
          <div className="flex justify-between gap-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="mt-2 h-3 w-24" />
        </li>
      ))}
    </ul>
  );
}

/** The detail's two-column definition grid (00). */
export function DefinitionGrid({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">{children}</dl>;
}

/** One labelled value. "—" when empty, so a field is never silently missing. */
export function Detail({ label, children, wide = false }: { label: string; children?: ReactNode; wide?: boolean }) {
  const empty = children == null || children === "";
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="t-label">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-body text-text">
        {empty ? (
          <>
            <span aria-hidden="true" className="text-muted">
              —
            </span>
            <span className="sr-only">Not given</span>
          </>
        ) : (
          children
        )}
      </dd>
    </div>
  );
}
