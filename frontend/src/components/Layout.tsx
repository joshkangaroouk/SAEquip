import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { cn } from "../lib/cn";
import logoUrl from "../assets/saequip-logo.svg";

/**
 * The sidebar is intentionally kept DARK against the light content area — the
 * SAEquip logo is built for dark backgrounds. All sidebar colours are hardcoded
 * (black bg, light text, yellow active bar) and do NOT follow the light tokens.
 */
const SIDEBAR = "bg-[#0A0A0A] text-white";
const SIDEBAR_BORDER = "border-white/10";

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Products", end: true },
  { to: "/media", label: "Media" },
  { to: "/logos", label: "Logos" },
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
              "relative flex items-center px-4 py-2.5 text-body transition-colors",
              // Left accent bar for the active route (no rounding).
              "before:absolute before:left-0 before:top-0 before:h-full before:w-0.5 before:transition-colors",
              isActive
                ? "bg-white/10 text-white font-semibold before:bg-accent"
                : "text-white/60 hover:bg-white/5 hover:text-white before:bg-transparent",
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
            "relative mt-1 flex items-center px-4 py-2.5 text-small transition-colors",
            "before:absolute before:left-0 before:top-0 before:h-full before:w-0.5",
            isActive
              ? "bg-white/10 text-accent font-semibold before:bg-accent"
              : "text-white/40 hover:bg-white/5 hover:text-white/70 before:bg-transparent",
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
      <div className="px-6 py-7">
        <NavLink to="/" onClick={onNavigate} className="inline-flex items-center gap-3">
          <img src={logoUrl} alt="SAEquip" className="h-10 w-auto" />
          <span className="text-body font-semibold uppercase tracking-widest text-white">
            SAEquip
          </span>
        </NavLink>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-2">
        <NavItems onNavigate={onNavigate} />
      </div>

      {/* User + sign out, pinned to bottom */}
      <div className={cn("border-t px-4 py-4", SIDEBAR_BORDER)}>
        <p className="truncate px-2 pb-3 text-small text-white/50" title={user?.email ?? undefined}>
          {user?.email}
        </p>
        <button
          onClick={handleSignOut}
          className={cn(
            "w-full rounded-md border border-white/20 px-4 py-2 text-small font-semibold text-white",
            "transition-colors hover:bg-white/10",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]",
          )}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

/** App shell: fixed dark left sidebar on desktop; dark top bar + drawer on mobile. */
export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Desktop sidebar (dark) */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden w-64 border-r lg:block",
          SIDEBAR,
          SIDEBAR_BORDER,
        )}
      >
        <SidebarBody />
      </aside>

      {/* Mobile top bar (dark) */}
      <header
        className={cn(
          "sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 lg:hidden",
          SIDEBAR,
          SIDEBAR_BORDER,
        )}
      >
        <NavLink to="/" className="inline-flex items-center gap-2">
          <img src={logoUrl} alt="SAEquip" className="h-8 w-auto" />
          <span className="text-small font-semibold uppercase tracking-widest text-white">
            SAEquip
          </span>
        </NavLink>
        <button
          aria-label="Open menu"
          onClick={() => setDrawerOpen(true)}
          className="rounded-md border border-white/20 p-2 text-white hover:bg-white/10"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </header>

      {/* Mobile drawer (dark) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <aside className={cn("absolute inset-y-0 left-0 w-72 border-r", SIDEBAR, SIDEBAR_BORDER)}>
            <button
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-4 rounded-md border border-white/20 p-1.5 text-white hover:bg-white/10"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            <SidebarBody onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content (light) */}
      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
