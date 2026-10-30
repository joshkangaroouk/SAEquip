import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link, Outlet, useLocation, useMatches } from "react-router-dom";
import {
  BarChart3,
  FileDown,
  FolderTree,
  Globe,
  Images,
  Languages,
  LogOut,
  Package,
  KeyRound,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useThemePreference } from "../hooks/useUserPreference";
import { cn } from "../lib/cn";
import { useProductIndex } from "../lib/productIndex";
import { useSignOut } from "../hooks/useSignOut";
import { initialsFrom } from "../lib/initials";
import { Lockup } from "./Lockup";
import { CrumbProvider, TopBar } from "./TopBar";
import { PageHeaderSlot, useDialog } from "./ui";
import { LG, useMediaQuery } from "../hooks/useMediaQuery";

/**
 * The sidebar (docs/redesign 02a Q6): always dark, on the fixed `--sidebar-*`
 * tokens, which the dark theme never redefines. `data-sidebar` on each
 * container turns focus yellow and draws it inside the item (02a Q5).
 *
 * Its width is `sidebar` (272px) in tailwind.config.js — the one value the
 * aside, the main column's offset and the product save bar all use.
 */
const SIDEBAR = "bg-sidebar text-sidebar-fg";
const SIDEBAR_BORDER = "border-sidebar-border";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** When the item is current. Defaults to the route and anything below it. */
  match?: (pathname: string) => boolean;
  /** Products carries the live product count (02a "After 4b"). */
  badge?: "liveProducts";
}

interface NavGroup {
  /** Group label; the first group (Website editor) has none. */
  label?: string;
  items: NavItem[];
}

/*
 * ⚠️ Not in the nav, deliberately, but still routed:
 * - /widgets documents the embed snippets and is Kangaroo's reference, not
 *   something SAEquip staff should change;
 * - /status (02a Q16).
 * The development-only /ui kit is not routed in production at all.
 */
const NAV: NavGroup[] = [
  { items: [{ to: "/website", label: "Website editor", icon: Globe }] },
  {
    label: "Catalogue",
    items: [
      {
        to: "/",
        label: "Products",
        icon: Package,
        // The list is "/", and a product's editor is /products/… — both are Products.
        match: (p) => p === "/" || p.startsWith("/products/"),
        badge: "liveProducts",
      },
      { to: "/categories", label: "Categories", icon: FolderTree },
      { to: "/options", label: "Product options", icon: SlidersHorizontal },
      { to: "/media", label: "Media", icon: Images },
      { to: "/logos", label: "Logos", icon: ShieldCheck },
      { to: "/translations", label: "Translations", icon: Languages },
    ],
  },
  {
    label: "Enquiries",
    // No badges until the batch 6 migration adds handledAt (02a "After 4b").
    items: [
      { to: "/quotes", label: "Quote requests", icon: BarChart3 },
      { to: "/resource-requests", label: "Resource requests", icon: FileDown },
    ],
  },
  {
    label: "Admin",
    items: [
      { to: "/users", label: "Users", icon: Users },
      { to: "/security", label: "Security", icon: KeyRound },
    ],
  },
];

const isCurrent = (item: NavItem, pathname: string) =>
  item.match ? item.match(pathname) : pathname === item.to || pathname.startsWith(item.to + "/");

/**
 * One item: 40px, 18px icon, Inter 14/500; the current one solid yellow with
 * black 600 text, the rest #C9C9C5 going to white on #1A1A1A under the pointer.
 */
function NavRow({ item, badge, onNavigate }: { item: NavItem; badge?: number; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const current = isCurrent(item, pathname);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex h-10 items-center gap-3 px-3 text-body transition-colors duration-[120ms]",
        current
          ? // The sidebar's yellow focus outline would vanish on the yellow
            // current item, so there it is black — and 4px in rather than 2,
            // or it sits against the black panel and only looks like the item
            // shrank. (Important: the [data-sidebar] offset rule matches it.)
            "bg-sidebar-active font-semibold text-sidebar-active-ink focus-visible:outline-sidebar-active-ink focus-visible:!outline-offset-[-4px]"
          : "font-medium text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-fg",
      )}
    >
      <Icon size={18} strokeWidth={2} aria-hidden="true" className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {/* Never a badge of 0 (02a "After 4b"). */}
      {badge ? (
        <span
          className={cn(
            "t-code-sm inline-flex h-5 min-w-5 shrink-0 items-center justify-center px-1.5",
            current ? "bg-sidebar-active-ink text-sidebar-active" : "bg-sidebar-badge text-sidebar-badge-ink",
          )}
        >
          <span aria-hidden="true">{badge}</span>
          <span className="sr-only">{`${badge} live`}</span>
        </span>
      ) : null}
    </Link>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { products } = useProductIndex();
  const live = products?.filter((p) => p.status === "ACTIVE").length ?? 0;
  // Per instance: the drawer renders a second copy of the nav.
  const idBase = useId();
  return (
    <nav aria-label="Main">
      {NAV.map((group, g) => {
        const labelId = group.label ? `${idBase}-group-${g}` : undefined;
        return (
          <div key={group.label ?? "top"}>
            {group.label && (
              // 02a Q6: Barlow 600 11px uppercase, padding 20 12 6.
              <p id={labelId} className="t-nav-label px-3 pb-1.5 pt-5 text-sidebar-label">
                {group.label}
              </p>
            )}
            <ul aria-labelledby={labelId} className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavRow item={item} badge={item.badge ? live : undefined} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const handleSignOut = useSignOut();

  return (
    <div className="flex h-full flex-col">
      {/* The lockup row is 64px with a rule under it, level with the top bar's. */}
      <div className={cn("flex h-16 shrink-0 items-center border-b px-4", SIDEBAR_BORDER)}>
        <Link to="/" onClick={onNavigate} className="block">
          <Lockup />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 pt-3">
        <NavItems onNavigate={onNavigate} />
      </div>

      {/* Account */}
      <div className={cn("flex shrink-0 items-center gap-2.5 border-t px-3 py-3", SIDEBAR_BORDER)}>
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center bg-sidebar-active text-label font-semibold text-sidebar-active-ink"
        >
          {initialsFrom(user?.email)}
        </span>
        <span className="min-w-0 flex-1 truncate text-help text-sidebar-text" title={user?.email ?? undefined}>
          {user?.email}
        </span>
        <button
          type="button"
          onClick={handleSignOut}
          title="Sign out"
          aria-label="Sign out"
          className="flex h-8.5 w-8.5 shrink-0 items-center justify-center text-sidebar-text transition-colors duration-[120ms] hover:bg-sidebar-hover hover:text-sidebar-fg"
        >
          <LogOut size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/**
 * App shell: the fixed dark sidebar on desktop; a top bar and a drawer below lg.
 *
 * `children` overrides the routed <Outlet/>, so the error boundary can render
 * inside the normal shell — the sidebar stays usable when a page throws
 * instead of the whole tree being replaced.
 */
export function Layout({ children }: { children?: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  // A route with `handle: { layout: "full" }` (the split views) drops the
  // max-w-6xl column and, from lg, fills the viewport height so its panes can
  // scroll on their own.
  const full = useMatches().some((m) => (m.handle as { layout?: string } | undefined)?.layout === "full");
  // Applies the account's light/dark choice once the session has loaded; the
  // top bar's toggle sets it (the only write the shell makes).
  const { theme, setTheme } = useThemePreference();
  // The breadcrumb's last crumb, when the page names itself (usePageCrumb).
  const [pageLabel, setPageLabel] = useState<string | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  // Where a page's PageHeader is drawn: the band under the top bar.
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null);

  /*
   * The drawer below lg is a dialog: focus moves in and is held there, Escape
   * and the backdrop close it, the page behind stops scrolling, and focus
   * returns to the menu button (the same mechanics as Modal). It closes if the
   * window widens to lg, where the fixed sidebar takes over.
   */
  const drawer = useRef<HTMLDivElement>(null);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  useDialog(drawerOpen, drawer, { onClose: closeDrawer, returnFocusTo: menuButton });
  const wide = useMediaQuery(LG);
  useEffect(() => {
    if (wide) setDrawerOpen(false);
  }, [wide]);

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Desktop sidebar */}
      <aside
        data-sidebar
        className={cn("fixed inset-y-0 left-0 z-30 hidden w-sidebar border-r lg:block", SIDEBAR, SIDEBAR_BORDER)}
      >
        <SidebarBody />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-backdrop" onClick={closeDrawer} />
          <div
            ref={drawer}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            tabIndex={-1}
            data-sidebar
            className={cn(
              "absolute inset-y-0 left-0 w-sidebar max-w-[85vw] border-r outline-none",
              SIDEBAR,
              SIDEBAR_BORDER,
            )}
          >
            <button
              type="button"
              aria-label="Close menu"
              onClick={closeDrawer}
              className="absolute right-3 top-[15px] z-10 flex h-8.5 w-8.5 items-center justify-center text-sidebar-text transition-colors duration-[120ms] hover:bg-sidebar-hover hover:text-sidebar-fg"
            >
              <X size={18} strokeWidth={2} aria-hidden="true" />
            </button>
            <SidebarBody onNavigate={closeDrawer} />
          </div>
        </div>
      )}

      {/* Main content */}
      <main className={cn("lg:pl-sidebar", full && "lg:flex lg:h-dvh lg:flex-col")}>
        <TopBar
          theme={theme}
          onThemeChange={setTheme}
          onOpenMenu={() => setDrawerOpen(true)}
          menuButtonRef={menuButton}
          menuOpen={drawerOpen}
          pageLabel={pageLabel}
        />
        <div ref={setHeaderSlot} className="shrink-0" />
        <CrumbProvider value={setPageLabel}>
          <PageHeaderSlot value={{ el: headerSlot, full }}>
            {/*
              Content padding 32 40 56 (00). The first element's own top margin
              is dropped: pages spaced their first block from a heading that is
              now the band above, so the padding alone sets that gap.
            */}
            <div
              className={cn(
                "[&>:first-child]:mt-0",
                full
                  ? "px-5 py-6 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:px-10 lg:py-8"
                  : "mx-auto max-w-6xl px-5 pb-14 pt-6 lg:px-10 lg:pt-8",
              )}
            >
              {children ?? <Outlet />}
            </div>
          </PageHeaderSlot>
        </CrumbProvider>
      </main>
    </div>
  );
}
