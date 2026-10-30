import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "./Button";

/**
 * The selected item, held in the URL (`?id=` by default) so a selection is
 * deep-linkable and survives a reload. Replaces the history entry rather than
 * adding one, as Translations does with its own params; other params are kept.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useSelection(param = "id") {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get(param);
  const select = useCallback(
    (id: string | null) =>
      setParams(
        (p) => {
          const next = new URLSearchParams(p);
          if (id) next.set(param, id);
          else next.delete(param);
          return next;
        },
        { replace: true },
      ),
    [param, setParams],
  );
  /** The link for an item: the current URL with this id selected. */
  const hrefFor = useCallback(
    (id: string) => {
      const next = new URLSearchParams(params);
      next.set(param, id);
      return `?${next}`;
    },
    [param, params],
  );
  return { selectedId, select, hrefFor };
}

interface SplitState {
  headingRef: RefObject<HTMLHeadingElement>;
  headingId: string;
}
const SplitContext = createContext<SplitState | null>(null);

/**
 * List on the left (~380px), the selected item on the right (00 "split view"),
 * each pane scrolling on its own. The height comes from the caller: a fixed
 * height, or `flex-1 min-h-0` inside a full-height page (route handle
 * `layout: "full"`).
 *
 * Below lg it is one column (02a Q23): the list alone until something is
 * selected, then the detail full-width with "Back to list".
 *
 * When the selection changes, focus moves to the detail's heading (rendered
 * by `SplitDetailHeader`), so a keyboard or screen-reader user lands on what
 * they opened. Not on first load: a deep link opens with focus where the page
 * starts. Not a dialog, so no focus trap. In the list, the arrow keys move
 * between rows.
 */
export function SplitView({
  list,
  listLabel,
  selectedId,
  detail,
  emptyDetail,
  onBack,
  className,
}: {
  /** The left pane: toolbar and rows (`SplitListItem`). */
  list: ReactNode;
  /** Names the list pane, e.g. "Quote requests". */
  listLabel: string;
  /** From `useSelection()`. */
  selectedId: string | null;
  /** The right pane for the selection — start it with `SplitDetailHeader`. Null shows `emptyDetail`. */
  detail: ReactNode | null;
  emptyDetail?: ReactNode;
  /** Below lg, "Back to list" — usually `() => select(null)`. */
  onBack: () => void;
  className?: string;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  const navRef = useRef<HTMLElement>(null);
  const previous = useRef(selectedId);
  // The row to return focus to after "Back to list" (below lg).
  const backTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (selectedId && selectedId !== previous.current) headingRef.current?.focus({ preventScroll: true });
    if (!selectedId && backTo.current) {
      backTo.current.focus();
      backTo.current = null;
    }
    previous.current = selectedId;
  }, [selectedId]);

  /**
   * Arrow keys move between the list's rows (Home/End to the ends); Enter
   * opens the focused one, as on any link. Only while a row has focus, so the
   * toolbar's search box keeps its own arrow keys.
   */
  function onListKey(e: React.KeyboardEvent<HTMLElement>) {
    if (!(e.target as HTMLElement).matches("[data-split-item]")) return;
    const rows = Array.from(navRef.current?.querySelectorAll<HTMLElement>("[data-split-item]") ?? []);
    const at = rows.indexOf(e.target as HTMLElement);
    let to: number | undefined;
    if (e.key === "ArrowDown") to = Math.min(at + 1, rows.length - 1);
    else if (e.key === "ArrowUp") to = Math.max(at - 1, 0);
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = rows.length - 1;
    if (to === undefined) return;
    e.preventDefault();
    rows[to]?.focus();
  }

  function back() {
    // The open row is still in the DOM (only hidden), so it can take focus
    // back once the list shows again — otherwise focus falls to the page.
    backTo.current = navRef.current?.querySelector<HTMLElement>('[aria-current="true"]') ?? null;
    onBack();
  }

  const showing = selectedId !== null;
  return (
    <SplitContext.Provider value={{ headingRef, headingId }}>
      <div
        className={cn(
          "border border-border bg-surface lg:grid lg:min-h-0 lg:grid-cols-[theme(spacing.95)_minmax(0,1fr)] lg:grid-rows-1",
          className,
        )}
      >
        <nav
          ref={navRef}
          aria-label={listLabel}
          onKeyDown={onListKey}
          className={cn("min-h-0 lg:block lg:overflow-y-auto lg:border-r lg:border-border", showing && "hidden")}
        >
          {list}
        </nav>
        <section
          aria-labelledby={detail ? headingId : undefined}
          aria-label={detail ? undefined : "Details"}
          className={cn("min-h-0 lg:block lg:overflow-y-auto", !showing && "hidden")}
        >
          <div className="border-b border-border px-5 py-2 lg:hidden">
            <Button variant="ghost" size="sm" onClick={back}>
              <ArrowLeft size={16} />
              Back to list
            </Button>
          </div>
          {detail ?? emptyDetail}
        </section>
      </div>
    </SplitContext.Provider>
  );
}

/**
 * A row in the list: the title (600 while selected), a muted subtitle, a
 * mono meta line on the right (a date) and an optional chip. A link, so it
 * opens in a new tab like any other; the selected one carries
 * aria-current="true" and the selected state (02a "After 4a").
 */
export function SplitListItem({
  to,
  selected,
  title,
  subtitle,
  meta,
  badge,
}: {
  /** `hrefFor(id)` from `useSelection`. */
  to: string;
  selected: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <Link
      to={to}
      replace
      data-split-item
      aria-current={selected ? "true" : undefined}
      className={cn(
        "block border-b border-border px-5 py-3 transition-colors duration-[120ms] focus-visible:outline-offset-[-2px]",
        selected ? "bg-selected shadow-[inset_3px_0_0_0_rgb(var(--selected-bar))]" : "hover:bg-surface-2",
      )}
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className={cn("min-w-0 truncate text-body text-text", selected && "font-semibold")}>{title}</span>
        {meta && <span className="t-code-sm shrink-0 text-muted">{meta}</span>}
      </span>
      {(subtitle || badge) && (
        <span className="mt-0.5 flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-help text-muted">{subtitle}</span>
          {badge && <span className="shrink-0">{badge}</span>}
        </span>
      )}
    </Link>
  );
}

/**
 * The top of the detail pane: the heading (which receives focus on select),
 * an optional subtitle, and actions on the right.
 */
export function SplitDetailHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  const ctx = useContext(SplitContext);
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-5">
      <div className="min-w-0">
        {/* Focused by script on select; not a control, so no outline. */}
        <h2
          ref={ctx?.headingRef}
          id={ctx?.headingId}
          tabIndex={-1}
          className="t-detail-title text-text focus-visible:outline-none"
        >
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-body text-muted">{subtitle}</p>}
      </div>
      {/* Not shrink-0: in a narrow pane (lg, 1024) the group must be able to
          shrink so its own flex-wrap breaks the buttons onto a second line. */}
      {actions && <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
