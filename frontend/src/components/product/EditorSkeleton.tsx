import type { ReactNode } from "react";
import { Skeleton, SkeletonField, SkeletonLine } from "../ui";
import { ProductBandSkeleton } from "./ProductBand";
import { CategoriesSkeleton } from "./CategoriesSection";
import { EDITOR_GRID, sidePanelClass } from "./editorLayout";
import type { EditorTab } from "./editorTabs";

/**
 * The product editor while the product loads (11 §1), in place of a centred
 * spinner: the band, the section cards, and the side panel (Visibility,
 * Categories),
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
      {/* In the editor's order: the panel's sections, the side panel, then
          (Overview only) Delete product, where the grid puts each. */}
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
          {tab !== "overview" && (
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
            <div className="space-y-5">
              <div>
                <Skeleton className="h-10 w-[152px]" />
                <SkeletonLine text="t-help mt-2" className="h-[0.7em] w-52 max-w-full" />
              </div>
              <div>
                <Skeleton className="h-6 w-56 max-w-full" />
                <div className="t-help mt-2">
                  <Lines last="w-24" />
                </div>
              </div>
            </div>
          </SectionSkeleton>
          <SectionSkeleton title="w-24" meta>
            <CategoriesSkeleton />
          </SectionSkeleton>
        </div>

        {tab === "overview" && (
          <div className="min-w-0 xl:col-start-1 xl:row-start-2">
            <SectionSkeleton title="w-32" description>
              <Skeleton className="h-8.5 w-24" />
            </SectionSkeleton>
          </div>
        )}
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
  description?: boolean;
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
          {description && (
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

/** Help text in a narrow card: full lines, then a short one (two lines unless `count`). */
function Lines({ last, count = 2 }: { last: string; count?: number }) {
  return (
    <>
      {Array.from({ length: count - 1 }, (_, i) => (
        <span key={i}>
          <Skeleton className="inline-block h-[0.7em] w-full align-middle" />
          <br />
        </span>
      ))}
      <Skeleton className={`inline-block h-[0.7em] align-middle ${last}`} />
    </>
  );
}
