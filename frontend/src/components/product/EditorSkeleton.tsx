import type { ReactNode } from "react";
import { Skeleton } from "../ui";
import { ProductBandSkeleton } from "./ProductBand";
import { EDITOR_GRID, sidePanelClass } from "./editorLayout";
import type { EditorTab } from "./editorTabs";

/** An inline bar on its type role's line box: the row is exactly that role's height. */
const BAR = "inline-block align-middle";

/**
 * The product editor while the product loads (11 §1), in place of a centred
 * spinner: the band, two section cards, and the side panel (the Images card
 * with its featured block and a row of thumbnails, Visibility, Categories),
 * on the editor's own grid (`editorLayout`), so nothing jumps when the
 * product lands.
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
                  <Skeleton className={`${BAR} h-[0.8em] w-[151px]`} />
                </span>
                <Skeleton className="h-[21px] w-[199px]" />
              </>
            }
          >
            <div className="space-y-3">
              <FieldSkeleton />
              <FieldSkeleton input="w-56 max-w-full" />
            </div>
          </SectionSkeleton>
          {tab !== "overview" && (
            <SectionSkeleton title="w-32" description>
              <div className="space-y-3">
                <FieldSkeleton />
                <FieldSkeleton />
                <FieldSkeleton input="w-56 max-w-full" />
              </div>
            </SectionSkeleton>
          )}
        </div>

        <div className={sidePanelClass(tab)}>
          <SectionSkeleton title="w-16" meta>
            <div className="space-y-4">
              <div>
                <div className="t-overline mb-2">
                  <Skeleton className={`${BAR} h-[0.8em] w-16`} />
                </div>
                <Skeleton className="aspect-[4/3] w-full" />
              </div>
              <div>
                <div className="t-overline">
                  <Skeleton className={`${BAR} h-[0.8em] w-14`} />
                </div>
                <div className="t-help mb-2 mt-1">
                  <Lines last="w-28" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Skeleton className="aspect-square w-full" />
                  <Skeleton className="aspect-square w-full" />
                  <Skeleton className="aspect-square w-full" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-8.5 w-full" />
                <Skeleton className="h-8.5 w-full" />
              </div>
              <div className="t-help">
                <Lines last="w-24" count={3} />
              </div>
            </div>
          </SectionSkeleton>
          <div className="min-w-0 space-y-5">
            <SectionSkeleton title="w-20">
              <div className="space-y-5">
                <div>
                  <Skeleton className="h-10 w-[152px]" />
                  <div className="t-help mt-2">
                    <Skeleton className={`${BAR} h-[0.7em] w-52 max-w-full`} />
                  </div>
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
              <div className="space-y-4">
                <ChipsSkeleton chips={["w-48"]} />
                <ChipsSkeleton chips={["w-52", "w-40", "w-44"]} />
                <ChipsSkeleton chips={["w-28"]} />
              </div>
            </SectionSkeleton>
          </div>
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
          <div className="t-section">
            <Skeleton className={`${BAR} h-[0.8em] ${title}`} />
          </div>
          {/* Two bars, about a sentence long, so it wraps on a phone as the real one does. */}
          {description && (
            <div className="t-help">
              <Skeleton className={`${BAR} h-[0.7em] w-40`} /> <Skeleton className={`${BAR} h-[0.7em] w-[154px]`} />
            </div>
          )}
        </div>
        {(meta || aside) && (
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            {meta && (
              <span className="text-label">
                <Skeleton className={`${BAR} h-[0.8em] w-12`} />
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

/** A Field: its label's line, then a 34px (sm) input, as in Details. */
function FieldSkeleton({ input = "w-full" }: { input?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="t-label">
        <Skeleton className={`${BAR} h-[0.8em] w-16`} />
      </div>
      <Skeleton className={`h-8.5 ${input}`} />
    </div>
  );
}

/** Help text in a narrow card: full lines, then a short one (two lines unless `count`). */
function Lines({ last, count = 2 }: { last: string; count?: number }) {
  return (
    <>
      {Array.from({ length: count - 1 }, (_, i) => (
        <span key={i}>
          <Skeleton className={`${BAR} h-[0.7em] w-full`} />
          <br />
        </span>
      ))}
      <Skeleton className={`${BAR} h-[0.7em] ${last}`} />
    </>
  );
}

/** A Categories group: its label's line, then 26px chips. */
function ChipsSkeleton({ chips }: { chips: string[] }) {
  return (
    <div>
      <div className="t-label">
        <Skeleton className={`${BAR} h-[0.8em] w-24`} />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {chips.map((w, i) => (
          <Skeleton key={i} className={`h-6.5 max-w-full ${w}`} />
        ))}
      </div>
    </div>
  );
}
