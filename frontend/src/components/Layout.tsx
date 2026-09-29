import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  ChevronDown,
  FolderTree,
  Globe,
  Images,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  KeyRound,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
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
  /** Rendered as a collapsible group under this item. */
  children?: NavItem[];
}

const NAV: NavItem[] = [
  { to: "/website", label: "Website Editor", icon: Globe },
  {
    to: "/",
    label: "Products",
    icon: Package,
    end: true,
    // Everything that describes a product lives under it, rather than as ten
    // flat siblings where "Logos" and "Status" read as equally important.
    children: [
      { to: "/categories", label: "Categories", icon: FolderTree },
      { to: "/options", label: "Product Options", icon: SlidersHorizontal },
      { to: "/media", label: "Media", icon: Images },
      { to: "/logos", label: "Logos", icon: ShieldCheck },
    ],
  },
  { to: "/widgets", label: "Widgets", icon: LayoutGrid },
  { to: "/quotes", label: "Quote Requests", icon: BarChart3 },
  { to: "/users", label: "Users", icon: Users },
  { to: "/security", label: "Security", icon: KeyRound },
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

/** One row. Shared by top-level items and the nested children. */
function NavRow({
  item,
  onNavigate,
  nested = false,
}: {
  item: NavItem;
  onNavigate?: () => void;
  nested?: boolean;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      // The accent bar is a ::before pinned to the sidebar's left edge,
      // which is why the row carries the negative inset rather than the
      // pill doing it.
      className={({ isActive }) =>
        // Same type and icon size as a top-level row — only the indent
        // differs, which is all the hierarchy needs to read.
        cn(rowBase, "text-body", nested && "pl-6", isActive ? rowActive : rowIdle)
      }
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
          {item.label}
        </>
      )}
    </NavLink>
  );
}

/**
 * A parent row plus its collapsible children.
 *
 * ⚠️ The parent is still a LINK — Products is a real page, not just a
 * heading — so the disclosure lives in its own button beside it rather than
 * swallowing the click. Making the whole row toggle would cost a click to
 * reach the product list, which is the most-used page in the app.
 */
function NavGroup({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const Icon = item.icon;
  const children = item.children ?? [];
  const childActive = children.some((c) => pathname === c.to || pathname.startsWith(c.to + "/"));
  // Mirrors NavLink's own matching, since the highlight now lives on the
  // wrapper rather than on the link itself.
  const selfActive = item.end
    ? pathname === item.to
    : pathname === item.to || pathname.startsWith(item.to + "/");

  const [open, setOpen] = useState(childActive);
  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  const groupId = `nav-group-${item.to.replace(/\W+/g, "-")}`;

  return (
    <div className="flex flex-col gap-0.5">
      {/*
        The ROW carries the highlight, not the link, so the chevron sits inside
        the same background rather than floating beside it. The link keeps the
        click target for the page; the chevron is a separate button because a
        <button> cannot live inside an <a>, and because Products is a real page
        whose click should not be spent on expanding a menu.
      */}
      <div className={cn(rowBase, "text-body", selfActive ? rowActive : rowIdle)}>
        <NavLink
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <Icon
            size={18}
            strokeWidth={2}
            className={cn(
              "shrink-0 transition-colors duration-150",
              selfActive ? "text-accent" : "text-sidebar-subtle group-hover:text-sidebar-muted",
            )}
          />
          {item.label}
        </NavLink>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={groupId}
          aria-label={`${open ? "Collapse" : "Expand"} ${item.label}`}
          /*
           * ⚠️ No box: no width, no height, no padding.
           *
           * An h-7 w-7 button is 28px tall, which is taller than the row's
           * text line, so it forced the Products row open and left it out of
           * step with every other nav item. The chevron now contributes no
           * height of its own — the row is sized by its text exactly as the
           * others are. Hover is a colour change only.
           */
          className="flex shrink-0 items-center text-sidebar-subtle transition-colors hover:text-sidebar-foreground"
        >
          <ChevronDown
            size={18}
            strokeWidth={2.5}
            className={cn(
              "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
              open ? "rotate-180" : "rotate-0",
            )}
          />
        </button>
      </div>

      {/*
        The slide.
        
        ⚠️ `grid-template-rows: 0fr -> 1fr`, not max-height and not the
        `hidden` attribute.

        - `height:auto` cannot be transitioned, and the usual max-height hack
          needs a guessed ceiling: too small clips the list, too large makes
          the open feel instant and the close feel delayed, because the
          easing is spent travelling through empty space.
        - The `hidden` ATTRIBUTE was the previous approach and did nothing at
          all: `[hidden]{display:none}` from preflight and `.flex{display:flex}`
          have identical specificity, and utilities are emitted after
          preflight, so `flex` won.

        A grid row measured in `fr` animates to the content's real height, so
        the timing is honest at any number of children.

        `visibility` is what keeps collapsed links out of the tab order — a
        0fr row still contains focusable anchors. It flips to hidden only
        AFTER the collapse finishes (hence the delay) so the rows do not
        vanish mid-slide, and back to visible immediately on open.
      */}
      <div
        id={groupId}
        className="grid transition-[grid-template-rows,visibility] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          visibility: open ? "visible" : "hidden",
          transitionDelay: open ? "0ms" : "0ms, 300ms",
        }}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-0.5 pt-0.5">
            {children.map((c, i) => (
              <div
                key={c.to}
                // A short stagger on the way in gives the list a sense of
                // arriving rather than appearing. On the way out every row
                // leaves together — a staggered exit reads as sluggish.
                className="transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
                style={{
                  opacity: open ? 1 : 0,
                  transform: open ? "translateY(0)" : "translateY(-6px)",
                  transitionDelay: open ? `${60 + i * 45}ms` : "0ms",
                }}
              >
                <NavRow item={c} onNavigate={onNavigate} nested />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5">
      <p className="px-3 pb-2.5 pt-1 text-small font-medium uppercase tracking-wider text-sidebar-subtle">
        Main menu
      </p>

      {NAV.map((item) =>
        item.children?.length ? (
          <NavGroup key={item.to} item={item} onNavigate={onNavigate} />
        ) : (
          <NavRow key={item.to} item={item} onNavigate={onNavigate} />
        ),
      )}
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
/**
 * `children` overrides the routed <Outlet/>, so the error boundary can render
 * inside the normal shell — the sidebar stays usable when a page throws
 * instead of the whole tree being replaced.
 */
export function Layout({ children }: { children?: ReactNode }) {
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
          {children ?? <Outlet />}
        </div>
      </main>
    </div>
  );
}
