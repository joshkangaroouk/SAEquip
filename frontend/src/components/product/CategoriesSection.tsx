import { useEffect, useState, type ReactNode } from "react";
import { apiJson } from "../../lib/api";
import { Alert, Badge, Button, Modal, RemoveButton, Skeleton, SkeletonLine } from "../ui";
import { EditorSection } from "./EditorSection";
import { AssignPickList } from "./AssignPickList";

export interface CategoryNode {
  id: string;
  title: string;
  depth: number;
  /** Duda's own key. Top-level rows carry the sentinel "ROOT", not null. */
  parent_id: string;
  products_count?: number;
}

/**
 * The category tree from /api/categories, loaded once by the editor: the side
 * panel lists it, and the band's overline names the product type from it.
 */
export function useCategoryList(): { cats: CategoryNode[] | null; loadError: string | null } {
  const [cats, setCats] = useState<CategoryNode[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    apiJson<{ categories: CategoryNode[] }>("/api/categories")
      .then((d) => !cancelled && setCats(d.categories))
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : "Failed to load categories"));
    return () => {
      cancelled = true;
    };
  }, []);
  return { cats, loadError };
}

/**
 * Assign the product to Duda categories.
 *
 * ⚠️ Stored HUB-SIDE, not written back to Duda. Duda exposes no working
 * product-side assignment — `PATCH /products/{id}` with `categories` returns
 * 200 and changes nothing — and the one path that does work rewrites a whole
 * category's product list, which two editors can silently clobber. The
 * category LIST still comes from Duda, so the names and nesting are always
 * Duda's; only the assignment is ours.
 */
export function CategoriesSection({
  cats,
  loadError,
  selected,
  onChange,
  error,
  onStaleCount,
}: {
  /** From useCategoryList(). */
  cats: CategoryNode[] | null;
  loadError: string | null;
  selected: string[];
  onChange: (next: string[]) => void;
  error?: string;
  /**
   * How many selected categories Duda no longer has, once the list has
   * loaded — the editor header's "No longer in Duda" chip. From the list this
   * section already loads, so no second fetch.
   */
  onStaleCount?: (n: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const stale = cats ? selected.filter((id) => !cats.some((c) => c.id === id)).length : 0;
  useEffect(() => {
    if (cats) onStaleCount?.(stale);
  }, [cats, stale, onStaleCount]);

  const groups = cats ? summarise(cats, selected) : null;
  /** Untick one category, and anything beneath it, as the pick list does. */
  const remove = (id: string) => {
    const gone = new Set([id]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const c of cats ?? []) {
        if (gone.has(c.parent_id) && !gone.has(c.id)) {
          gone.add(c.id);
          grew = true;
        }
      }
    }
    onChange(selected.filter((x) => !gone.has(x)));
  };
  const add = (
    <button type="button" onClick={() => setEditing(true)} disabled={!cats} className={TEXT_BUTTON}>
      + Add
    </button>
  );

  return (
    // A compact summary (10 §3); "Edit" and "+ Add" open the full pick list.
    <EditorSection
      id="section-categories"
      title="Categories"
      error={error ?? loadError}
      actions={
        <button type="button" onClick={() => setEditing(true)} disabled={!cats} className={TEXT_BUTTON}>
          Edit
        </button>
      }
    >
      {/* The "no longer exist" fault stays at the top of the card (10 §3). */}
      {stale > 0 && (
        <Alert
          tone="danger"
          className="mb-3"
          action={
            <Button variant="secondary" size="sm" onClick={() => onChange(selected.filter((id) => cats?.some((c) => c.id === id)))}>
              Remove
            </Button>
          }
        >
          {stale === 1 ? "1 selected category no longer exists" : `${stale} selected categories no longer exist`} (deleted in
          Duda), so the categories cannot be saved until {stale === 1 ? "it is" : "they are"} removed.
        </Alert>
      )}
      {!groups ? (
        // The card's own load (11 §1: a card that loads gets a skeleton).
        !loadError && (
          <div aria-busy="true">
            <p role="status" className="sr-only">
              Loading categories
            </p>
            <CategoriesSkeleton />
          </div>
        )
      ) : (
        <div className="space-y-4">
          <Group label="Product type">
            {groups.types.length ? (
              groups.types.map((c) => (
                <Badge key={c.id} tone="solid" className="max-w-full">
                  <ChipText>{c.title}</ChipText>
                </Badge>
              ))
            ) : (
              <span className="text-help text-muted">None</span>
            )}
          </Group>
          <Group label={`Site challenges · ${groups.challenges.length}`}>
            {groups.challenges.map((c) => (
              <Badge key={c.id} className="max-w-full">
                <ChipText>{c.title}</ChipText>
                <RemoveButton size="sm" title={`Remove ${c.title}`} onClick={() => remove(c.id)} />
              </Badge>
            ))}
            {add}
          </Group>
          {groups.industryTotal > 0 && (
            <Group label={`Industries · ${groups.industries.length} of ${groups.industryTotal}`}>
              {groups.industries.length === groups.industryTotal ? (
                <Badge>All industries</Badge>
              ) : groups.industries.length ? (
                groups.industries.map((c) => (
                  <Badge key={c.id} className="max-w-full">
                    <ChipText>{c.title}</ChipText>
                  </Badge>
                ))
              ) : (
                <span className="text-help text-muted">None</span>
              )}
              {groups.industries.length === groups.industryTotal && (
                <p className="t-help basis-full">
                  Every industry is ticked. Narrowing this makes the industry pages more useful.
                </p>
              )}
            </Group>
          )}
          {groups.other.map((g) => (
            <Group key={g.title} label={`${g.title} · ${g.items.length}`}>
              {g.items.map((c) => (
                <Badge key={c.id} className="max-w-full">
                  <ChipText>{c.title}</ChipText>
                </Badge>
              ))}
            </Group>
          ))}
        </div>
      )}

      {/*
        The full pick list (search, only-show-selected, the tree), unchanged.
        It edits the same state as you tick — no separate save — and Done
        just closes; focus goes back to the button that opened it.
      */}
      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Categories"
        footer={
          <div className="flex justify-end">
            <Button onClick={() => setEditing(false)}>Done</Button>
          </div>
        }
      >
        <AssignPickList
          // parentId is what lets the list keep a child from being selected
          // without its parent, in both directions.
          items={(cats ?? []).map((c) => ({
            id: c.id,
            label: c.title,
            depth: c.depth,
            parentId: c.parent_id,
          }))}
          selected={selected}
          onChange={onChange}
          searchPlaceholder="Search categories…"
          emptyText="No categories yet — create them on the Categories page."
        />
      </Modal>
    </EditorSection>
  );
}

/** "Edit" and "+ Add": text buttons (10 §3), on the heading's line. */
const TEXT_BUTTON =
  "text-help font-semibold text-text underline-offset-2 enabled:hover:underline disabled:cursor-not-allowed disabled:text-muted";

/** A chip's label: truncated inside the side panel, the full name on hover. */
function ChipText({ children }: { children: string }) {
  return (
    <span className="min-w-0 truncate" title={children}>
      {children}
    </span>
  );
}

/** One labelled group of chips. */
/**
 * The summary's groups as blocks: Product type, Site challenges, Industries,
 * each a label's line and its chips. Also the editor skeleton's Categories card.
 */
export function CategoriesSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      {[["w-48"], ["w-52", "w-40", "w-44"], ["w-28"]].map((chips, g) => (
        <div key={g}>
          <SkeletonLine text="t-label" className="h-[0.8em] w-24" />
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {chips.map((w) => (
              <Skeleton key={w} className={`h-6.5 max-w-full ${w}`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="t-label">{label}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

/**
 * The selection by top-level group: Products (the product type), Site
 * Challenges and Industries, the three parents the tree is built from
 * (CLAUDE.md "Categories"). A group's own parent link is implied by its
 * children, so it is not a chip. Any other top-level group is listed as it is.
 */
function summarise(cats: CategoryNode[], selected: string[]) {
  const byId = new Map(cats.map((c) => [c.id, c]));
  const rootOf = (c: CategoryNode): CategoryNode => {
    let at = c;
    for (let p = byId.get(at.parent_id); p; p = byId.get(at.parent_id)) at = p;
    return at;
  };
  const chosen = selected.map((id) => byId.get(id)).filter((c): c is CategoryNode => !!c && c.parent_id !== "ROOT");
  const under = (title: string) => chosen.filter((c) => rootOf(c).title === title);
  const industriesRoot = cats.find((c) => c.parent_id === "ROOT" && c.title === "Industries");
  const known = new Set(["Products", "Site Challenges", "Industries"]);
  const other = new Map<string, CategoryNode[]>();
  for (const c of chosen) {
    const root = rootOf(c).title;
    if (!known.has(root)) other.set(root, [...(other.get(root) ?? []), c]);
  }
  return {
    types: under("Products"),
    challenges: under("Site Challenges"),
    industries: under("Industries"),
    industryTotal: industriesRoot ? cats.filter((c) => rootOf(c).id === industriesRoot.id && c.id !== industriesRoot.id).length : 0,
    other: [...other].map(([title, items]) => ({ title, items })),
  };
}
