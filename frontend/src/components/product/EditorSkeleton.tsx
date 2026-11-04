import type { ReactNode } from "react";
import { Skeleton, SkeletonField, SkeletonLine } from "../ui";
import { ProductBandSkeleton } from "./ProductBand";
import { CategoriesSkeleton } from "./CategoriesSection";
import { EDITOR_GRID, sidePanelClass } from "./editorLayout";
import type { EditorTab } from "./editorTabs";

/**
 * Words drawn as a bar: the grey is on this span and the words inside are
 * `invisible`, so they keep their exact box but are never painted (nor read
 * as low-contrast text).
 */
function Words({ children, className }: { children: string; className?: string }) {
  return (
    <span className={`animate-pulse bg-surface-2 motion-reduce:animate-none ${className ?? ""}`}>
      <span className="invisible">{children}</span>
    </span>
  );
}

/**
 * The product editor while the product loads (11 §1), in place of a centred
 * spinner: the band, the section cards (Details and Description on
 * Overview), and the side panel (Visibility, Categories),
 * on the editor's own grid (`editorLayout`) and in its order, so nothing
 * jumps when the product lands.
 *
 * `aria-busy` on the region and ONE polite announcement; the blocks are
 * aria-hidden. Skeleton's pulse stops under reduced motion.
 */
export function ProductEditorSkeleton({ tab }: { tab: EditorTab }) {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Loading product
      </p>
      <ProductBandSkeleton />
      {/* In the editor's order: the panel's sections, then the side panel. */}
      <div className={EDITOR_GRID}>
        <div className="min-w-0 space-y-5 xl:col-start-1 xl:row-start-1">
          {/* Details: its header carries a meta line and a checkbox, which wrap
              under the title on a narrow screen as the real ones do. */}
          <SectionSkeleton
            title="w-20"
            description
            aside={
              <>
                <span className="text-label">
                  <Skeleton className="inline-block h-[0.8em] w-[151px] align-middle" />
                </span>
                <Skeleton className="h-[21px] w-[199px]" />
              </>
            }
          >
            <div className="space-y-3">
              <SkeletonField />
              <SkeletonField control="h-8.5 w-56 max-w-full" />
            </div>
          </SectionSkeleton>
          {/* Overview: the Description after Details (12 §3), its editor at its
              160px minimum (a longer description is taller once it lands). */}
          {tab === "overview" ? (
            <SectionSkeleton
              title="w-28"
              // One bar, the width of its real line (about 294px), so it stays one line as that does.
              description="w-[294px]"
              aside={
                <>
                  <span className="text-label">
                    <Skeleton className="inline-block h-[0.8em] w-14 align-middle" />
                  </span>
                  <Skeleton className="h-10 w-[160px]" />
                </>
              }
            >
              {/* The card border, as Details' cards use: the editor's own darker
                  input border read as too dark among the blocks. */}
              <div className="border border-border">
                <div className="flex h-[43px] items-center gap-2 border-b border-border px-2">
                  {Array.from({ length: 8 }, (_, i) => (
                    <Skeleton key={i} className="h-5 w-5" />
                  ))}
                </div>
                <div className="h-40 px-3 py-2.5">
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            </SectionSkeleton>
          ) : (
            <SectionSkeleton title="w-32" description>
              <div className="space-y-3">
                <SkeletonField />
                <SkeletonField />
                <SkeletonField control="h-8.5 w-56 max-w-full" />
              </div>
            </SectionSkeleton>
          )}
        </div>

        <div className={sidePanelClass(tab)}>
          <SectionSkeleton title="w-20">
            {/* The help lines are static copy, so they show as themselves and wrap as the real ones do. */}
            <div className="space-y-5" aria-hidden="true">
              <div>
                <Skeleton className="h-10 w-[152px]" />
                <p className="t-help mt-2">Hidden products aren't shown in the store.</p>
              </div>
              {/* The toggle and the Delete link are inline-flex on a text line,
                  as the real ones are (Toggle's label, the link's text), so each
                  row gets the same line box: the words are there, unpainted,
                  on a bar. */}
              <div>
                <span className="inline-flex items-center gap-2">
                  <Skeleton className="h-6 w-10" />
                  <Words className="text-body">This product is an accessory</Words>
                </span>
                <p className="t-help mt-2">Listing pages can hide accessories with "Hide accessories".</p>
              </div>
              {/* Delete product, under its full-width rule (12 §2). */}
              <div className="-mx-5 border-t border-border px-5 pt-4">
                <span className="inline-flex items-center gap-2 text-body font-semibold">
                  <Skeleton className="h-4 w-4" />
                  <Words>Delete product</Words>
                </span>
              </div>
            </div>
          </SectionSkeleton>
          <SectionSkeleton title="w-24" meta>
            <CategoriesSkeleton />
          </SectionSkeleton>
        </div>
      </div>
    </div>
  );
}

/** EditorSection's chrome: the heading row (title, optional description and meta) over the body. */
function SectionSkeleton({
  title,
  description,
  meta,
  aside,
  children,
}: {
  /** The title bar's width class. */
  title: string;
  /**
   * A description line: two bars about a sentence long, or, given a width
   * class, one bar that wide (for a sentence that must stay on one line).
   */
  description?: boolean | string;
  meta?: boolean;
  /** Anything else on the header's right (Details' checkbox). */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="border border-border bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0 space-y-1">
          <SkeletonLine text="t-section" className={`h-[0.8em] ${title}`} />
          {/* Two bars, about a sentence long, so it wraps on a phone as the real one does. */}
          {typeof description === "string" ? (
            <div className="t-help">
              <Skeleton className={`inline-block h-[0.7em] max-w-full align-middle ${description}`} />
            </div>
          ) : description && (
            <div className="t-help">
              <Skeleton className="inline-block h-[0.7em] w-40 align-middle" />{" "}
              <Skeleton className="inline-block h-[0.7em] w-[154px] align-middle" />
            </div>
          )}
        </div>
        {(meta || aside) && (
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            {meta && (
              <span className="text-label">
                <Skeleton className="inline-block h-[0.8em] w-12 align-middle" />
              </span>
            )}
            {aside}
          </div>
        )}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}
