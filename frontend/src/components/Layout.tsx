import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { cn } from "../lib/cn";
import logoUrl from "../assets/saequip-logo.svg";

/**
 * Light sidebar, following shadcn's dashboard shell: a near-white panel divided
 * from the content by a hairline border, muted nav labels, and a soft rounded
 * "pill" for the active route rather than a hard accent bar.
 *
 * This was previously dark because the logo was assumed to need a dark ground.
 * The current asset carries its own yellow and black blocks, so it reads
 * correctly on light — verified against #fafafa.
 */
const SIDEBAR = "bg-surface text-text";
const SIDEBAR_BORDER = "border-border";

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Products", end: true },
  { to: "/media", label: "Media" },
  { to: "/logos", label: "Logos" },
  { to: "/widgets", label: "Widgets" },
  { to: "/quotes", label: "Quote Requests" },
  { to: "/status", label: "Status" },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center rounded-md px-3 py-2 text-body transition-colors",
              isActive
                ? "bg-surface-2 font-medium text-text"
                : "text-muted hover:bg-surface-2/70 hover:text-text",
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
      {/* Temporary: component-kit showcase (removed after verification). */}
      <NavLink
        to="/ui"
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            "mt-1 flex items-center rounded-md px-3 py-2 text-small transition-colors",
            isActive
              ? "bg-surface-2 font-medium text-text"
              : "text-subtle hover:bg-surface-2/70 hover:text-muted",
          )
        }
      >
        Component kit
      </NavLink>
    </nav>
  );
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
      {/* Logo */}
      <div className="px-4 py-5">
        <NavLink to="/" onClick={onNavigate} className="flex items-center gap-2.5">
          <img src={logoUrl} alt="SAEquip" className="h-10 w-auto" />
          <span className="text-small font-medium leading-tight text-muted">
            Product
            <br />
            Manager
          </span>
        </NavLink>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-3">
        <NavItems onNavigate={onNavigate} />
      </div>

      {/* User + sign out, pinned to bottom */}
      <div className={cn("border-t px-3 py-3", SIDEBAR_BORDER)}>
        <p className="truncate px-1 pb-2 text-small text-subtle" title={user?.email ?? undefined}>
          {user?.email}
        </p>
        <button
          onClick={handleSignOut}
          className={cn(
            "h-8 w-full rounded-md border border-border bg-surface px-3 text-body font-medium text-text",
            "shadow-xs transition-colors hover:bg-surface-2 outline-none",
            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          )}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

/** App shell: fixed light sidebar on desktop; top bar + drawer on mobile. */
export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden w-64 border-r lg:block",
          SIDEBAR,
          SIDEBAR_BORDER,
        )}
      >
        <SidebarBody />
      </aside>

      {/* Mobile top bar */}
      <header
        className={cn(
          "sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 lg:hidden",
          SIDEBAR,
          SIDEBAR_BORDER,
        )}
      >
        <NavLink to="/" className="inline-flex items-center gap-2">
          <img src={logoUrl} alt="SAEquip" className="h-8 w-auto" />
        </NavLink>
        <button
          aria-label="Open menu"
          onClick={() => setDrawerOpen(true)}
          className="rounded-md border border-border p-2 text-muted shadow-xs hover:bg-surface-2 hover:text-text"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <aside className={cn("absolute inset-y-0 left-0 w-72 border-r", SIDEBAR, SIDEBAR_BORDER)}>
            <button
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-4 rounded-md border border-border p-1.5 text-muted shadow-xs hover:bg-surface-2 hover:text-text"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            <SidebarBody onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-5 py-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
