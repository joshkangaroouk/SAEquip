import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { cn } from "../lib/cn";
import logoUrl from "../assets/saequip-logo.svg";

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Products", end: true },
  { to: "/media", label: "Media" },
  { to: "/logos", label: "Logos" },
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
                ? "bg-surface-2 text-text font-semibold before:bg-accent"
                : "text-muted hover:bg-surface-2 hover:text-text before:bg-transparent",
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
              ? "bg-surface-2 text-accent font-semibold before:bg-accent"
              : "text-subtle hover:bg-surface-2 hover:text-muted before:bg-transparent",
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
          <span className="text-body font-semibold uppercase tracking-widest text-text">
            SAEquip
          </span>
        </NavLink>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-2">
        <NavItems onNavigate={onNavigate} />
      </div>

      {/* User + sign out, pinned to bottom */}
      <div className="border-t border-border px-4 py-4">
        <p className="truncate px-2 pb-3 text-small text-muted" title={user?.email ?? undefined}>
          {user?.email}
        </p>
        <button
          onClick={handleSignOut}
          className={cn(
            "w-full border border-border px-4 py-2 text-small font-semibold text-text",
            "transition-colors hover:bg-surface-2",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          )}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

/** App shell: fixed left sidebar on desktop; top bar + slide-in drawer on mobile. */
export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-surface lg:block">
        <SidebarBody />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
        <NavLink to="/" className="inline-flex items-center gap-2">
          <img src={logoUrl} alt="SAEquip" className="h-8 w-auto" />
          <span className="text-small font-semibold uppercase tracking-widest">SAEquip</span>
        </NavLink>
        <button
          aria-label="Open menu"
          onClick={() => setDrawerOpen(true)}
          className="border border-border p-2 text-text hover:bg-surface-2"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-border bg-surface">
            <button
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-4 border border-border p-1.5 text-text hover:bg-surface-2"
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
        <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
