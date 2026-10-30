import { useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Badge, Button, ButtonLink, DropdownMenu, Input, SegmentedControl, Skeleton, toast } from "./ui";
import { apiJson } from "../lib/api";
import { refreshEnquiryCounts } from "../lib/enquiryCounts";
import { formatDateTime } from "../lib/format";
import type { HandledResponse } from "../lib/types";

/**
 * The pieces Quote requests and Resource requests share as split views
 * (redesign batch 6): the list toolbar, the New / Handled filter, the
 * loading rows, the detail's header actions and definition grid, and the
 * Mark as handled call.
 */

export type EnquiryFilter = "all" | "new" | "handled";

interface Handled {
  handledAt: string | null;
  handledBy: string | null;
}

/** New = not yet marked handled. */
export const isNew = (e: { handledAt: string | null }) => e.handledAt === null;

/**
 * Mark as handled / Mark as new: PATCH `endpoint(id)` with `{ handled }`, then
 * hand the server's answer to `onDone` to fold into the page's list, and
 * refresh the sidebar badges. `busy` is the id in flight.
 */
export function useMarkHandled(endpoint: (id: string) => string, onDone: (res: HandledResponse) => void, noun: string) {
  const [busy, setBusy] = useState<string | null>(null);
  async function setHandled(id: string, handled: boolean) {
    setBusy(id);
    try {
      const res = await apiJson<HandledResponse>(endpoint(id), {
        method: "PATCH",
        body: JSON.stringify({ handled }),
      });
      onDone(res);
      refreshEnquiryCounts();
      toast.success(handled ? "Marked as handled" : "Marked as new");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Couldn't update the ${noun}`);
    } finally {
      setBusy(null);
    }
  }
  return { busy, setHandled };
}

/** The list with one row's handled state replaced by the server's answer. */
export function withHandled<T extends Handled & { id: string }>(list: T[], res: HandledResponse): T[] {
  return list.map((e) => (e.id === res.id ? { ...e, handledAt: res.handledAt, handledBy: res.handledBy } : e));
}

/** The detail's Status value: when and by whom it was handled, or the New chip. */
export function HandledStatus({ enquiry }: { enquiry: Handled }) {
  if (!enquiry.handledAt) return <Badge tone="new">New</Badge>;
  return (
    <>
      Handled {formatDateTime(enquiry.handledAt)}
      {enquiry.handledBy && <span className="text-muted"> by {enquiry.handledBy}</span>}
    </>
  );
}

/**
 * The detail header's actions (00): the more menu (export this one, copy the
 * address), Mark as handled / Mark as new, and Reply by email as the primary,
 * last. The reply subject is 02a Q17's.
 */
export function EnquiryActions({
  kind,
  enquiry,
  busy,
  onHandled,
  onExport,
}: {
  kind: "quote" | "resource";
  enquiry: Handled & { name: string; email: string };
  busy: boolean;
  /** Called with the state to set: true = handled. */
  onHandled: (handled: boolean) => void;
  onExport: () => void;
}) {
  const fresh = isNew(enquiry);
  const subject = `Your SA Equip ${kind} request`;
  return (
    <>
      <DropdownMenu
        label={`More actions for the ${kind} request from ${enquiry.name}`}
        actions={[
          { label: "Export this request as CSV", onSelect: onExport },
          {
            label: "Copy email address",
            onSelect: () =>
              void navigator.clipboard
                .writeText(enquiry.email)
                .then(() => toast.success("Email address copied"))
                .catch(() => toast.error("Couldn't copy the email address")),
          },
        ]}
      />
      <Button variant="secondary" size="sm" loading={busy} onClick={() => onHandled(fresh)}>
        {fresh ? "Mark as handled" : "Mark as new"}
      </Button>
      <ButtonLink variant="primary" size="sm" href={`mailto:${enquiry.email}?subject=${encodeURIComponent(subject)}`}>
        Reply by email
      </ButtonLink>
    </>
  );
}

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
