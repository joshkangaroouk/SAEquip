import {
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "../../lib/cn";

type KeepMounted = boolean | "visited";

interface TabsState {
  value: string;
  select: (value: string) => void;
  idFor: (kind: "tab" | "panel", value: string) => string;
  keepMounted: KeepMounted;
  visited: Set<string>;
}

const TabsContext = createContext<TabsState | null>(null);

function useTabs(part: string): TabsState {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error(`<${part}> must be inside <Tabs>`);
  return ctx;
}

/**
 * Underline tabs (00 "Tabs"): a full-width row with a bottom rule; the active
 * tab is --text at 600 with a 3px yellow bar, the rest muted (--text on
 * hover, 02a Q4). Counts in mono; an 8px square dot for unsaved changes or an
 * error (02a Q8), which is also in the tab's name so it is not colour alone.
 *
 *   <Tabs defaultValue="overview">
 *     <TabList aria-label="Product">
 *       <Tab value="overview">Overview</Tab>
 *       <Tab value="files" count={4} indicator="dirty">Files & media</Tab>
 *     </TabList>
 *     <TabPanel value="overview">…</TabPanel>
 *     <TabPanel value="files">…</TabPanel>
 *   </Tabs>
 *
 * Controlled (`value` + `onValueChange`, e.g. synced to ?tab=) or uncontrolled
 * (`defaultValue`). The keyboard follows the tabs pattern with automatic
 * activation: one tab stop, arrows move and select, Home/End.
 *
 * `keepMounted` decides what happens to a panel that is not showing:
 *   "visited" (default) mounts a panel the first time it is shown, then keeps
 *     it mounted but `hidden` — so a section that fetches, or a 3D viewer, is
 *     not rebuilt on every switch, and nothing mounts up front;
 *   true mounts every panel at once; false keeps only the active one.
 */
export function Tabs({
  value: controlled,
  defaultValue,
  onValueChange,
  keepMounted = "visited",
  className,
  children,
}: {
  /** Controlled: the active tab. Pass this or `defaultValue` — with neither, no tab is active or focusable. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  keepMounted?: KeepMounted;
  className?: string;
  children: ReactNode;
}) {
  const [own, setOwn] = useState(defaultValue ?? "");
  const value = controlled ?? own;
  const base = useId();
  // Panels already shown, for keepMounted="visited". A ref: adding to it never
  // needs its own render — the value change that adds it already causes one.
  const visited = useRef(new Set<string>());
  visited.current.add(value);

  const select = useCallback(
    (v: string) => {
      if (controlled === undefined) setOwn(v);
      onValueChange?.(v);
    },
    [controlled, onValueChange],
  );
  const idFor = useCallback(
    (kind: "tab" | "panel", v: string) => `${base}-${kind}-${v.replace(/[^A-Za-z0-9_-]/g, "_")}`,
    [base],
  );

  return (
    <TabsContext.Provider value={{ value, select, idFor, keepMounted, visited: visited.current }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabList({
  "aria-label": ariaLabel,
  className,
  children,
}: {
  /** Names the set, e.g. "Product sections". */
  "aria-label": string;
  className?: string;
  children: ReactNode;
}) {
  const { select } = useTabs("TabList");
  const list = useRef<HTMLDivElement>(null);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const tabs = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []);
    const at = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    let to: number | undefined;
    if (e.key === "ArrowRight") to = (at + 1) % tabs.length;
    else if (e.key === "ArrowLeft") to = (at - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = tabs.length - 1;
    if (to === undefined) return;
    e.preventDefault();
    tabs[to].focus();
    const v = tabs[to].dataset.value;
    if (v !== undefined) select(v);
  }

  return (
    <div
      ref={list}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      // The rule is an inset shadow rather than a border, so it sits inside
      // the row and the active tab's bar paints over it instead of being
      // clipped by the sideways scroll.
      className={cn("flex overflow-x-auto shadow-[inset_0_-1px_0_rgb(var(--border))]", className)}
    >
      {children}
    </div>
  );
}

export function Tab({
  value,
  count,
  indicator = null,
  children,
}: {
  value: string;
  count?: number;
  /** An 8px dot: "dirty" (unsaved changes) or "error" (02a Q8). */
  indicator?: "dirty" | "error" | null;
  children: ReactNode;
}) {
  const { value: active, select, idFor } = useTabs("Tab");
  const on = value === active;
  return (
    <button
      type="button"
      role="tab"
      id={idFor("tab", value)}
      aria-selected={on}
      aria-controls={idFor("panel", value)}
      tabIndex={on ? 0 : -1}
      data-value={value}
      onClick={() => !on && select(value)}
      className={cn(
        "relative inline-flex h-11 shrink-0 items-center gap-2 px-4 text-body whitespace-nowrap transition-colors duration-[120ms]",
        "focus-visible:outline-offset-[-2px]",
        on
          ? "font-semibold text-text after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-accent"
          : "font-medium text-muted hover:text-text",
      )}
    >
      {/* The label at its 600 width as well, so switching tabs doesn't shift the row. */}
      <span className="grid justify-items-center">
        <span aria-hidden="true" className="invisible col-start-1 row-start-1 font-semibold">
          {children}
        </span>
        <span className="col-start-1 row-start-1">{children}</span>
      </span>
      {count !== undefined && <span className="t-code-sm text-muted">{count}</span>}
      {indicator && (
        <>
          <span
            aria-hidden="true"
            className={cn(
              "h-2 w-2 shrink-0",
              indicator === "error" ? "bg-danger" : "bg-text outline outline-[1.5px] outline-surface",
            )}
          />
          <span className="sr-only">{indicator === "error" ? "(error)" : "(unsaved changes)"}</span>
        </>
      )}
    </button>
  );
}

export function TabPanel({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: ReactNode;
}) {
  const { value: active, idFor, keepMounted, visited } = useTabs("TabPanel");
  const on = value === active;
  const mounted = on || keepMounted === true || (keepMounted === "visited" && visited.has(value));
  if (!mounted) return null;
  return (
    <div
      role="tabpanel"
      id={idFor("panel", value)}
      aria-labelledby={idFor("tab", value)}
      tabIndex={0}
      hidden={!on}
      // The `hidden` class as well as the attribute: a display utility in
      // `className` (flex, grid) would otherwise beat the attribute and show it.
      className={cn("focus-visible:outline-offset-[-2px]", className, !on && "hidden")}
    >
      {children}
    </div>
  );
}
