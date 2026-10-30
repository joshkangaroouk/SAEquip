import { createContext, useContext, useEffect, type ReactNode, type Ref } from "react";
import { Link, useMatches } from "react-router-dom";
import { Menu } from "lucide-react";
import { Button, SegmentedControl } from "./ui";
import { ProductSearch } from "./ProductSearch";
import type { Theme } from "../lib/theme";

/**
 * A route's place in the breadcrumb, from its `handle` in App.tsx:
 * "Group / Page", or "Group / Parent / Page" for a detail page.
 */
export interface Crumbs {
  group?: string;
  parent?: { title: string; to: string };
  title: string;
}

/**
 * The last crumb's text, when the page knows a better one than its route —
 * the product editor names the product. Set with `usePageCrumb`.
 */
const CrumbContext = createContext<(label: string | null) => void>(() => {});

export function CrumbProvider({ value, children }: { value: (label: string | null) => void; children: ReactNode }) {
  return <CrumbContext.Provider value={value}>{children}</CrumbContext.Provider>;
}

/** Name the current page in the breadcrumb (e.g. the product's name); cleared on unmount. */
// eslint-disable-next-line react-refresh/only-export-components
export function usePageCrumb(label: string | null | undefined) {
  const set = useContext(CrumbContext);
  useEffect(() => {
    set(label || null);
    return () => set(null);
  }, [label, set]);
}

function Breadcrumb({ pageLabel }: { pageLabel: string | null }) {
  const crumbs = [...useMatches()]
    .reverse()
    .map((m) => (m.handle as { crumbs?: Crumbs } | undefined)?.crumbs)
    .find(Boolean);
  if (!crumbs) return null;
  const page = pageLabel ?? crumbs.title;
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-2 text-body">
        {/* Below lg, the page alone (02a Q23). The group joins from xl: between
            lg and xl the bar is too narrow for three crumbs and a 280px search,
            and the page name is the part worth keeping. */}
        {crumbs.group && (
          <li className="hidden shrink-0 items-center gap-2 text-muted xl:flex">
            {crumbs.group}
            <span aria-hidden="true">/</span>
          </li>
        )}
        {crumbs.parent && (
          <li className="hidden shrink-0 items-center gap-2 lg:flex">
            <Link to={crumbs.parent.to} className="text-muted hover:text-text hover:underline">
              {crumbs.parent.title}
            </Link>
            <span aria-hidden="true" className="text-muted">
              /
            </span>
          </li>
        )}
        <li aria-current="page" className="min-w-0 truncate font-semibold text-text" title={page}>
          {page}
        </li>
      </ol>
    </nav>
  );
}

/**
 * The top bar (00 "Top bar", 02a Q20/Q23): 64px on --surface with a bottom
 * rule. The breadcrumb on the left; the product search and the Light/Dark
 * toggle on the right. Below lg: the menu button for the sidebar drawer, the
 * page name, a search button and the toggle.
 *
 * Sticky, so a sticky table head sits under it (`top-16`).
 */
export function TopBar({
  theme,
  onThemeChange,
  onOpenMenu,
  menuButtonRef,
  menuOpen,
  pageLabel,
}: {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onOpenMenu: () => void;
  menuButtonRef: Ref<HTMLButtonElement>;
  menuOpen: boolean;
  pageLabel: string | null;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface px-5 lg:gap-4 lg:px-10">
      <Button
        ref={menuButtonRef}
        variant="ghost"
        icon
        aria-label="Open menu"
        aria-expanded={menuOpen}
        onClick={onOpenMenu}
        className="-ml-2 lg:hidden"
      >
        <Menu size={18} />
      </Button>
      <div className="min-w-0 flex-1">
        <Breadcrumb pageLabel={pageLabel} />
      </div>
      <ProductSearch />
      <SegmentedControl<Theme>
        ariaLabel="Theme"
        value={theme}
        onChange={onThemeChange}
        options={[
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
      />
    </header>
  );
}
