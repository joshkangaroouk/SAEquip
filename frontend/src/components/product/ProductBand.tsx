import { useEffect, useState, type ReactNode } from "react";
import { HeaderSlotPortal, Thumb } from "../ui";

/**
 * The product editor's header band (10 §2), also used by New product: edge to
 * edge under the top bar, on --surface with a bottom rule. On the left a 64px
 * picture on paper, an overline, the name (`t-editor-title`, the page's h1)
 * and a meta row; on the right the actions (the save area). `tabs`, when
 * given, sit flush with the bottom rule, so the active tab's 3px bar covers
 * it.
 *
 * Sticky under the top bar from 1280 (11 §4; the shell's slot sticks when it
 * holds a `data-sticky-band`). Below that it scrolls away, and below lg the
 * actions wrap under the title. While it is on screen it writes its height to `--sticky-band`,
 * which index.css adds to the page's scroll padding, so anything scrolled to
 * (the save area's failed pills, a focused field) stops below it rather than
 * underneath it.
 */
export function ProductBand({
  imageUrl,
  overline,
  title,
  meta,
  actions,
  tabs,
}: {
  imageUrl: string | null;
  overline?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
}) {
  // A state ref, not useRef: the band is portalled, so it exists only from
  // the render after the shell's slot attaches.
  const [band, setBand] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!band) return;
    const root = document.documentElement;
    const write = () => root.style.setProperty("--sticky-band", `${band.offsetHeight}px`);
    const ro = new ResizeObserver(write);
    ro.observe(band);
    write();
    return () => {
      ro.disconnect();
      root.style.removeProperty("--sticky-band");
    };
  }, [band]);

  return (
    <HeaderSlotPortal>
      <div ref={setBand} data-sticky-band className="border-b border-border bg-surface">
        {/* The content's own side padding (40, or 20 below 640), as the page header's. */}
        <div className={tabs ? "px-5 pt-8 sm:px-10" : "px-5 pb-7 pt-8 sm:px-10"}>
          {/* Below lg the actions wrap under the title. From lg they sit beside
              it while the title keeps at least 18rem, and wrap under it when
              they don't fit (New product's three buttons at 1024). */}
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-start lg:justify-between lg:gap-x-6">
            <div className="flex min-w-0 items-start gap-4 lg:min-w-[18rem] lg:flex-1">
              {/* On paper; a box icon when there is no picture yet. */}
              <Thumb src={imageUrl} size={64} fallback="box" />
              <div className="min-w-0">
                {overline && <p className="t-overline">{overline}</p>}
                <h1 className="t-editor-title mt-1 text-text [overflow-wrap:anywhere]">{title}</h1>
                {meta && <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">{meta}</div>}
              </div>
            </div>
            {actions && <div className="min-w-0 lg:max-w-full">{actions}</div>}
          </div>
          {/* -mb-px: the tab row sits ON the band's bottom rule, so the active
              tab's bar replaces the rule under it (pass the TabList
              `shadow-none`: the band's rule replaces the row's own). */}
          {tabs && <div className="-mb-px mt-5">{tabs}</div>}
        </div>
      </div>
    </HeaderSlotPortal>
  );
}
