import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3,
  FolderTree,
  Globe,
  Images,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { cn } from "../lib/cn";
import logoUrl from "../assets/saequip-logo.svg";

/**
 * Dark sidebar against the light content area.
 *
 * Colours come from the `--sidebar-*` tokens rather than being hardcoded, so
 * the whole panel can be retuned in index.css. The active route gets three
 * cues at once: a soft yellow-tinted pill, a bright accent bar pinned to the
 * panel's left edge, and an accent-coloured icon.
 */
const SIDEBAR = "bg-sidebar text-sidebar-foreground";
const SIDEBAR_BORDER = "border-sidebar-border";
/** Declared once — the aside's width and the main content's offset must match. */
const SIDEBAR_W = "w-[17rem]";
const MAIN_OFFSET = "lg:pl-[17rem]";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: "/website", label: "Website Editor", icon: Globe },
  { to: "/", label: "Products", icon: Package, end: true },
  { to: "/categories", label: "Categories", icon: FolderTree },
  { to: "/options", label: "Product Options", icon: SlidersHorizontal },
  { to: "/media", label: "Media", icon: Images },
  { to: "/logos", label: "Logos", icon: ShieldCheck },
  { to: "/widgets", label: "Widgets", icon: LayoutGrid },
  { to: "/quotes", label: "Quote Requests", icon: BarChart3 },
  { to: "/status", label: "Status", icon: Sparkles },
];

/** Shared row treatment so parents and children can't drift apart visually. */
const rowBase =
  "group relative flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors duration-150 " +
  "before:absolute before:-left-3 before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2 " +
  "before:rounded-r-full before:transition-all before:duration-150";
const rowActive = "bg-accent/[0.12] font-medium text-sidebar-foreground before:bg-accent";
const rowIdle =
  "text-sidebar-muted before:bg-transparent hover:bg-white/[0.04] hover:text-sidebar-foreground";

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5">
      <p className="px-3 pb-2.5 pt-1 text-small font-medium uppercase tracking-wider text-sidebar-subtle">
        Main menu
      </p>

      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          // The accent bar is a ::before pinned to the sidebar's left edge,
          // which is why the row carries the negative inset rather than the
          // pill doing it.
          className={({ isActive }) => cn(rowBase, "text-body", isActive ? rowActive : rowIdle)}
        >
          {({ isActive }) => (
            <>
              <Icon
                size={18}
                strokeWidth={2}
                className={cn(
                  "shrink-0 transition-colors duration-150",
                  isActive ? "text-accent" : "text-sidebar-subtle group-hover:text-sidebar-muted",
                )}
              />
              {label}
            </>
          )}
        </NavLink>
      ))}

      {/* Temporary: component-kit showcase (removed after verification). */}
      <NavLink
        to="/ui"
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            rowBase,
            "mt-2 text-small",
            isActive
              ? rowActive
              : "text-sidebar-subtle before:bg-transparent hover:bg-white/[0.04] hover:text-sidebar-muted",
          )
        }
      >
        <Palette size={18} strokeWidth={2} className="shrink-0" />
        Component kit
      </NavLink>
    </nav>
  );
}

/**
 * Initials for the avatar, derived from the email's local part: a separator
 * gives two initials (josh.wright -> JW), otherwise the first two letters
 * (josh -> JO). Falls back to the brand mark when there's no email yet.
 */
function initialsFrom(email: string | null | undefined): string {
  const local = (email ?? "").split("@")[0];
  if (!local) return "SA";
  const parts = local.split(/[._\-+]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="px-4 py-5">
        <NavLink to="/" onClick={onNavigate} className="flex items-center gap-3">
          <img src={logoUrl} alt="SAEquip" className="h-14 w-auto shrink-0" />
          <span className="text-h3 font-semibold leading-tight text-sidebar-foreground">
            SAEquip
            <br />
            Admin
          </span>
        </NavLink>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <NavItems onNavigate={onNavigate} />
      </div>

      {/* Account */}
      <div className={cn("border-t px-3 py-4", SIDEBAR_BORDER)}>
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-body font-semibold text-accent-foreground"
          >
            {initialsFrom(user?.email)}
          </span>
          <span
            className="min-w-0 flex-1 truncate text-body text-sidebar-muted"
            title={user?.email ?? undefined}
          >
            {user?.email}
          </span>
          <button
            onClick={handleSignOut}
            title="Sign out"
            aria-label="Sign out"
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sidebar-subtle",
              "transition-colors hover:bg-white/[0.06] hover:text-sidebar-foreground outline-none",
              "focus-visible:ring-[3px] focus-visible:ring-ring/50",
            )}
          >
            <LogOut size={18} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** App shell: fixed dark sidebar on desktop; dark top bar + drawer on mobile. */
export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r lg:block",
          SIDEBAR_W,
          SIDEBAR,
          SIDEBAR_BORDER,
        )}
      >
        <SidebarBody />
      </aside>

      {/* Mobile top bar */}
      <header
        className={cn(
          "sticky top-0 z-30 flex items-center justify-between border-b px-4 py-2.5 lg:hidden",
          SIDEBAR,
          SIDEBAR_BORDER,
        )}
      >
        <NavLink to="/" className="inline-flex items-center gap-2">
          <img src={logoUrl} alt="SAEquip" className="h-10 w-auto" />
          <span className="text-body font-semibold text-sidebar-foreground">SAEquip Admin</span>
        </NavLink>
        <button
          aria-label="Open menu"
          onClick={() => setDrawerOpen(true)}
          className="rounded-md p-2 text-sidebar-muted transition-colors hover:bg-white/[0.06] hover:text-sidebar-foreground"
        >
          <Menu size={18} strokeWidth={2} />
        </button>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <aside className={cn("absolute inset-y-0 left-0 w-72 border-r", SIDEBAR, SIDEBAR_BORDER)}>
            <button
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3.5 rounded-md p-1.5 text-sidebar-muted transition-colors hover:bg-white/[0.06] hover:text-sidebar-foreground"
            >
              <X size={18} strokeWidth={2} />
            </button>
            <SidebarBody onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className={MAIN_OFFSET}>
        <div className="mx-auto max-w-6xl px-5 py-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
