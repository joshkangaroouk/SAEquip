import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Mail, Search, Star } from "lucide-react";
import { Button, ButtonLink, DropdownMenu, Field, Input, Modal, SegmentedControl, Skeleton, Textarea, toast, useConfirm } from "./ui";
import { apiJson } from "../lib/api";
import { cn } from "../lib/cn";
import { refreshEnquiryCounts } from "../lib/enquiryCounts";
import { formatDateTime } from "../lib/format";
import type { EnquiryNote, EnquiryRow, EnquiryState } from "../lib/types";

/**
 * The pieces Quote Requests and Resource Requests share as split views: the
 * list toolbar and filter, the loading rows, the envelope and the star, the
 * detail's header actions, notes and definition grid, and the calls behind
 * them.
 *
 * Read state works like a shared mailbox (2026-11, replacing batch 6's "Mark
 * as handled"): opening a request marks it read for the whole team, unread
 * rows are bold with an envelope beside the star, and "Mark as unread" puts
 * one back. The star and the notes are shared the same way.
 */

export type EnquiryFilter = "all" | "unread" | "starred";

/** Unread = nobody on the team has opened it yet. */
export const isUnread = (e: Pick<EnquiryState, "readAt">) => e.readAt === null;
export const isStarred = (e: Pick<EnquiryState, "starredAt">) => e.starredAt !== null;

export type StatePatch = { read: boolean } | { starred: boolean };
type PatchKind = "read" | "starred";

/** The columns each kind of change owns, so an answer only touches its own. */
const OWNS: Record<PatchKind, (keyof EnquiryState)[]> = {
  read: ["readAt", "readBy"],
  starred: ["starredAt", "starredBy"],
};

const kindOf = (patch: StatePatch): PatchKind => ("read" in patch ? "read" : "starred");

function pick(e: EnquiryState, kind: PatchKind): Partial<EnquiryState> {
  return Object.fromEntries(OWNS[kind].map((k) => [k, e[k]]));
}

/**
 * The row as it should look straight away. Who did it arrives with the
 * server's answer; a row already read or starred keeps its first stamp, as the
 * server does.
 */
function optimistic(e: EnquiryState, patch: StatePatch, now: string): Partial<EnquiryState> {
  if ("read" in patch) {
    if (!patch.read) return { readAt: null, readBy: null };
    return e.readAt ? {} : { readAt: now, readBy: null };
  }
  if (!patch.starred) return { starredAt: null, starredBy: null };
  return e.starredAt ? {} : { starredAt: now, starredBy: null };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Everything a page does to its requests: change one's state (read, star),
 * mark several read, add or delete a note, delete one. `base` is the list's API path
 * ("/api/quotes"), `setList` updates the page's copy of the list, `noun`
 * names one ("quote request").
 *
 * Changes show at once and are put back if the server refuses. Only the
 * latest change of each kind to a row may land, so two quick clicks on a star
 * cannot finish in the wrong order.
 *
 * `touched`: rows changed since the filter last changed. They stay in a
 * filtered list until it changes again, so a row does not vanish from under
 * the cursor the moment it is opened (Unread) or unstarred (Starred).
 */
export function useEnquiryActions<T extends EnquiryRow>({
  base,
  noun,
  setList,
}: {
  base: string;
  noun: string;
  setList: (update: (list: T[]) => T[]) => void;
}) {
  const seq = useRef(new Map<string, number>());
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());

  const patchRow = useCallback(
    (id: string, values: Partial<EnquiryState>) => setList((list) => list.map((e) => (e.id === id ? { ...e, ...values } : e))),
    [setList],
  );

  const setState = useCallback(
    async (row: T, patch: StatePatch, opts: { success?: string } = {}): Promise<boolean> => {
      const kind = kindOf(patch);
      const key = `${row.id}:${kind}`;
      const mine = (seq.current.get(key) ?? 0) + 1;
      seq.current.set(key, mine);
      const before = pick(row, kind);
      patchRow(row.id, optimistic(row, patch, new Date().toISOString()));
      setTouched((t) => (t.has(row.id) ? t : new Set(t).add(row.id)));
      try {
        const res = await apiJson<EnquiryState>(`${base}/${row.id}`, { method: "PATCH", body: JSON.stringify(patch) });
        if (seq.current.get(key) === mine) patchRow(row.id, pick(res, kind));
        if (kind === "read") refreshEnquiryCounts();
        if (opts.success) toast.success(opts.success);
        return true;
      } catch (e) {
        if (seq.current.get(key) === mine) patchRow(row.id, before);
        toast.error(e instanceof Error ? e.message : `Couldn't update the ${noun}`);
        return false;
      }
    },
    [base, noun, patchRow],
  );

  const markRead = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      try {
        const res = await apiJson<{ requests: EnquiryState[] }>(`${base}/mark-read`, {
          method: "POST",
          body: JSON.stringify({ ids }),
        });
        const byId = new Map(res.requests.map((r) => [r.id, r]));
        setList((list) => list.map((e) => (byId.has(e.id) ? { ...e, ...pick(byId.get(e.id)!, "read") } : e)));
        refreshEnquiryCounts();
        toast.success(`Marked ${plural(ids.length, noun)} as read`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `Couldn't mark the ${noun}s as read`);
      }
    },
    [base, noun, setList],
  );

  /** Permanent. `onRemoved` runs just before the row leaves the list (to clear the selection). */
  const remove = useCallback(
    async (id: string, onRemoved?: () => void): Promise<boolean> => {
      try {
        await apiJson(`${base}/${id}?confirm=true`, { method: "DELETE" });
        onRemoved?.();
        setList((list) => list.filter((e) => e.id !== id));
        refreshEnquiryCounts();
        toast.success(`Deleted the ${noun}`);
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `Couldn't delete the ${noun}`);
        return false;
      }
    },
    [base, noun, setList],
  );

  /** Adds a note to the end of the request's board; resolves true once stored. */
  const addNote = useCallback(
    async (id: string, body: string): Promise<boolean> => {
      try {
        const note = await apiJson<EnquiryNote>(`${base}/${id}/notes`, { method: "POST", body: JSON.stringify({ body }) });
        setList((list) => list.map((e) => (e.id === id ? { ...e, teamNotes: [...e.teamNotes, note] } : e)));
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't add the note");
        return false;
      }
    },
    [base, setList],
  );

  /** Deletes one of your own notes (the server refuses anyone else's). */
  const deleteNote = useCallback(
    async (id: string, noteId: string): Promise<boolean> => {
      try {
        await apiJson(`${base}/${id}/notes/${noteId}`, { method: "DELETE" });
        setList((list) =>
          list.map((e) => (e.id === id ? { ...e, teamNotes: e.teamNotes.filter((n) => n.id !== noteId) } : e)),
        );
        toast.success("Note deleted");
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't delete the note");
        return false;
      }
    },
    [base, setList],
  );

  const resetTouched = useCallback(() => setTouched(new Set()), []);

  return { setState, markRead, remove, addNote, deleteNote, touched, resetTouched };
}

/**
 * Opening a request marks it read, once per opening: after "Mark as unread"
 * it stays unread until it is opened again (another request first, then this
 * one). A deep link counts as opening.
 */
export function useAutoRead<T extends EnquiryState>(
  selected: T | null,
  setState: (row: T, patch: StatePatch) => Promise<boolean>,
) {
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (!selected) {
      opened.current = null;
      return;
    }
    if (opened.current === selected.id) return;
    opened.current = selected.id;
    if (isUnread(selected)) void setState(selected, { read: true });
  }, [selected, setState]);
}

/**
 * The star, in the list and beside the detail's heading. A toggle button
 * (aria-pressed), so its name stays the same either way. Solid yellow when
 * starred, edge included (Josh: no darker outline); a muted outline otherwise.
 *
 * In the list an unstarred star shows on hover or focus only, and always on a
 * touch screen, where there is no hover; a starred one always shows.
 */
export function StarButton({
  enquiry,
  name,
  onToggle,
  inList = false,
}: {
  enquiry: Pick<EnquiryState, "starredAt" | "starredBy">;
  /** Who the request is from, for the button's name. */
  name: string;
  onToggle: () => void;
  inList?: boolean;
}) {
  const starred = isStarred(enquiry);
  const tip = starred
    ? `Starred${enquiry.starredBy ? ` by ${enquiry.starredBy}` : ""}${enquiry.starredAt ? `, ${formatDateTime(enquiry.starredAt)}` : ""}. Click to remove the star.`
    : "Star";
  return (
    <button
      type="button"
      aria-pressed={starred}
      aria-label={`Star the request from ${name}`}
      title={tip}
      onClick={onToggle}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center text-muted transition-opacity duration-[120ms] hover:text-text",
        inList && !starred && "opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100 [@media(hover:none)]:opacity-100",
      )}
    >
      <Star size={inList ? 16 : 20} aria-hidden="true" className={starred ? "fill-accent stroke-accent" : undefined} />
    </button>
  );
}

/**
 * The envelope that marks an unread request, beside the star. It goes as soon
 * as the request is opened. Decorative: the row says "Unread:" to screen
 * readers, and the bold text carries it too.
 */
export function UnreadMark({ enquiry, size = 16 }: { enquiry: Pick<EnquiryState, "readAt">; size?: number }) {
  if (!isUnread(enquiry)) return null;
  return (
    <span title="Unread" aria-hidden="true" className="inline-flex shrink-0 items-center text-text">
      <Mail size={size} />
    </span>
  );
}

/**
 * A list row's right-hand side: the envelope (while unread) and the star. The
 * envelope's slot is kept when it is empty, so the dates line up down the list.
 */
export function EnquiryRowAside({
  enquiry,
  name,
  onToggleStar,
}: {
  enquiry: Pick<EnquiryState, "readAt" | "starredAt" | "starredBy">;
  name: string;
  onToggleStar: () => void;
}) {
  return (
    <span className="flex items-center">
      <span className="inline-flex w-5 justify-center">
        <UnreadMark enquiry={enquiry} />
      </span>
      <StarButton inList enquiry={enquiry} name={name} onToggle={onToggleStar} />
    </span>
  );
}

/** The detail's "Opened" value: when and by whom, or Unread. */
export function ReadStatus({ enquiry }: { enquiry: Pick<EnquiryState, "readAt" | "readBy"> }) {
  if (!enquiry.readAt) return <>Unread</>;
  return (
    <>
      {formatDateTime(enquiry.readAt)}
      {enquiry.readBy && <span className="text-muted"> by {enquiry.readBy}</span>}
    </>
  );
}

const replySubject = (kind: "quote" | "resource") => `Your SA Equip ${kind} request`;
const mailto = (email: string, kind: "quote" | "resource") =>
  `mailto:${email}?subject=${encodeURIComponent(replySubject(kind))}`;

/** The email address as a link that starts a reply, with the same subject as Reply by email. */
export function EmailLink({ email, kind }: { email: string; kind: "quote" | "resource" }) {
  return (
    <a href={mailto(email, kind)} className="underline underline-offset-2 hover:text-muted">
      {email}
    </a>
  );
}

/**
 * A phone number as a link that starts a call. The href keeps only digits and
 * a leading +, since the number is typed by the public; with no digits it is
 * plain text.
 */
export function PhoneLink({ phone }: { phone: string }) {
  const digits = phone.trim().replace(/(?!^\+)[^\d]/g, "");
  if (!/\d/.test(digits)) return <>{phone}</>;
  return (
    <a href={`tel:${digits}`} className="underline underline-offset-2 hover:text-muted">
      {phone}
    </a>
  );
}

/**
 * The detail header's actions (00): the more menu (export this one, copy the
 * address, mark as unread, delete) and Reply by email as the primary, last.
 * The reply subject is 02a Q17's.
 */
export function EnquiryActions({
  kind,
  enquiry,
  onMarkUnread,
  onDelete,
  onExport,
}: {
  kind: "quote" | "resource";
  enquiry: Pick<EnquiryState, "readAt"> & { name: string; email: string };
  onMarkUnread: () => void;
  /** Opens the delete dialog. */
  onDelete: () => void;
  onExport: () => void;
}) {
  return (
    <>
      <DropdownMenu
        label={`More actions for the ${kind} request from ${enquiry.name}`}
        actions={[
          { label: "Mark as unread", onSelect: onMarkUnread, disabled: isUnread(enquiry) },
          { label: "Export this request as CSV", onSelect: onExport },
          {
            label: "Copy email address",
            onSelect: () =>
              void navigator.clipboard
                .writeText(enquiry.email)
                .then(() => toast.success("Email address copied"))
                .catch(() => toast.error("Couldn't copy the email address")),
          },
          { label: "Delete request…", onSelect: onDelete, danger: true },
        ]}
      />
      <ButtonLink variant="primary" size="sm" href={mailto(enquiry.email, kind)}>
        Reply by email
      </ButtonLink>
    </>
  );
}

/**
 * Delete one request, for someone who asks for their data to be removed.
 * Permanent (the database has no backups), so it asks for "delete" to be
 * typed, like deleting a product asks for its name. `removes` lists what goes,
 * in the dialog's words.
 */
export function DeleteEnquiryDialog({
  open,
  onClose,
  name,
  removes,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  removes: string;
  /** Resolves true once deleted. */
  onConfirm: () => Promise<boolean>;
}) {
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (open) setTyped("");
  }, [open]);
  const ready = typed.trim().toLowerCase() === "delete";

  async function confirm() {
    if (!ready || deleting) return;
    setDeleting(true);
    const ok = await onConfirm();
    setDeleting(false);
    if (ok) onClose();
  }

  return (
    <Modal
      open={open}
      onClose={() => !deleting && onClose()}
      dismissable={!deleting}
      size="md"
      title={`Delete the request from ${name}?`}
      description={`This permanently removes ${removes}. There's no backup, so it can't be undone. Use it when someone asks for their data to be removed.`}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger-solid" onClick={() => void confirm()} disabled={!ready} loading={deleting}>
            Delete permanently
          </Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void confirm();
        }}
      >
        <Field label="Type delete to confirm">
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
        </Field>
      </form>
    </Modal>
  );
}

/**
 * The team's notes on a request: a small message board, oldest first, each
 * with who wrote it and when, and a box to add one at the bottom (the button,
 * or Cmd/Ctrl + Enter). Only the author of a note may delete it, so the board
 * stays a record of who said what; the server enforces that too.
 *
 * While there is text in the box that hasn't been added, leaving the page
 * asks first. Mount it with `key={id}`, so the box starts empty per request.
 */
export function NoteBoard({
  notes,
  me,
  onAdd,
  onDelete,
}: {
  notes: EnquiryNote[];
  /** The signed-in user's email, to offer Delete on their own notes. */
  me: string | null;
  /** Resolves true once stored. */
  onAdd: (body: string) => Promise<boolean>;
  onDelete: (note: EnquiryNote) => Promise<boolean>;
}) {
  const id = useId();
  const confirm = useConfirm();
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const ready = draft.trim() !== "" && !posting;

  async function add() {
    if (!ready) return;
    setPosting(true);
    const ok = await onAdd(draft.trim());
    setPosting(false);
    if (ok) setDraft("");
  }

  async function remove(note: EnquiryNote) {
    const ok = await confirm({
      title: "Delete this note?",
      description: "It's removed for everyone on the team.",
      confirmLabel: "Delete note",
      danger: true,
    });
    if (ok) await onDelete(note);
  }

  const unsent = draft.trim() !== "";
  useEffect(() => {
    if (!unsent) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsent]);

  return (
    <section aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`} className="t-overline mb-2">
        Notes{notes.length > 0 && <span className="tabular-nums"> ({notes.length})</span>}
      </h3>
      {notes.length === 0 ? (
        <p className="t-help mb-3 text-muted">No notes yet.</p>
      ) : (
        <ol className="mb-3 space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="border border-border bg-surface-2 px-3 py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="t-help min-w-0 break-words">
                  <span className="font-semibold text-text">{n.createdBy ?? "Unknown"}</span>
                  <span className="text-muted tabular-nums">
                    {" · "}
                    <time dateTime={n.createdAt}>{formatDateTime(n.createdAt)}</time>
                  </span>
                </p>
                {me && n.createdBy === me && (
                  <button
                    type="button"
                    onClick={() => void remove(n)}
                    aria-label={`Delete your note from ${formatDateTime(n.createdAt)}`}
                    className="t-help text-muted underline-offset-2 hover:text-danger hover:underline"
                  >
                    Delete
                  </button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-line break-words text-body text-text">{n.body}</p>
            </li>
          ))}
        </ol>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <label htmlFor={`${id}-new`} className="sr-only">
          Add a note
        </label>
        <Textarea
          id={`${id}-new`}
          rows={3}
          maxLength={5000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void add();
            }
          }}
          placeholder="Add a note for the team, e.g. quoted £1,200 on 10 Nov, chasing the PO."
          aria-describedby={`${id}-hint`}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p id={`${id}-hint`} className="t-help text-muted">
            Only the team sees notes. Cmd or Ctrl + Enter adds one.
          </p>
          {/* Yellow (primary) once there is something to add; quiet until then. */}
          <Button type="submit" variant={draft.trim() ? "primary" : "secondary"} size="sm" disabled={!ready} loading={posting}>
            Add note
          </Button>
        </div>
      </form>
    </section>
  );
}

/** A request's notes for one CSV cell: "[date, who] text", one note per line, oldest first. */
export function notesCsv(notes: EnquiryNote[]): string {
  return notes.map((n) => `[${formatDateTime(n.createdAt)}, ${n.createdBy ?? "unknown"}] ${n.body}`).join("\n");
}

/**
 * Filter by state, then by a case-insensitive search over the given fields.
 * `keep` (from useEnquiryActions' `touched`) stays in a filtered list even when
 * it no longer matches the state, but the search still applies to it.
 */
export function filterEnquiries<T extends EnquiryState>(
  list: T[],
  filter: EnquiryFilter,
  query: string,
  fields: (e: T) => (string | null | undefined)[],
  keep: ReadonlySet<string> = new Set(),
): T[] {
  const q = query.trim().toLowerCase();
  return list.filter((e) => {
    if (filter === "unread" && !isUnread(e) && !keep.has(e.id)) return false;
    if (filter === "starred" && !isStarred(e) && !keep.has(e.id)) return false;
    if (!q) return true;
    return fields(e).some((v) => (v ?? "").toLowerCase().includes(q));
  });
}

/**
 * The top of the list pane: search and the All / Unread / Starred filter with
 * counts. Sticky, so it stays in view as the list scrolls — under the 64px top
 * bar below lg, where the page scrolls; at the top of the pane from lg, where
 * the pane does.
 */
export function EnquiryToolbar<T extends EnquiryState>({
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
          { value: "unread", label: "Unread", count: all.filter(isUnread).length },
          { value: "starred", label: "Starred", count: all.filter(isStarred).length },
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

/**
 * One labelled value. "—" when empty, so a field is never silently missing.
 * Long unbroken values (an email address) wrap rather than push the detail
 * pane sideways — at 1024 the pane is under 300px wide.
 */
export function Detail({ label, children, wide = false }: { label: string; children?: ReactNode; wide?: boolean }) {
  const empty = children == null || children === "" || children === false;
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="t-label">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line break-words text-body text-text">
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
