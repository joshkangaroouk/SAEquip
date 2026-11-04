import { useEffect, useRef, useState, type FocusEvent, type ReactNode } from "react";
import { HeaderSlotPortal, Skeleton, Thumb } from "../ui";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { cn } from "../../lib/cn";

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
 * (the save area's failed pills, a focused field) stops 16px below it at its
 * CURRENT height, compact or not.
 *
 * From 1280 it shrinks as the page scrolls (12 §4, `useCompactBand`): the
 * overline and the meta row fold away, the picture goes 64 → 40 and the name
 * 28 → 20px, and the padding tightens; the save area and the tabs stay as
 * they are. The h1 is the same element in both states.
 */
export function ProductBand({
  imageUrl,
  overline,
  title,
  meta,
  actions,
  tabs,
  compact: pinned,
}: {
  imageUrl: string | null;
  overline?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
  /**
   * Holds the band in one state instead of following the scroll: the UI kit
   * shows it expanded and compact, in place on a long page. The editor and
   * New product never pass it.
   */
  compact?: boolean;
}) {
  const sticky = useMediaQuery(STICKY);
  // Focus inside the meta row (Refresh) holds the band open until it leaves.
  const [metaFocused, setMetaFocused] = useState(false);
  const scrolled = useCompactBand(sticky && pinned === undefined);
  const compact = pinned ?? (scrolled && !metaFocused);
  return (
    <BandFrame
      compact={compact}
      onMetaFocusChange={setMetaFocused}
      picture={<Thumb src={imageUrl} size={64} fallback="box" className={cn(EASE, "transition-[width,height]", compact && "h-10 w-10")} />}
      overline={overline && <p className="t-overline">{overline}</p>}
      title={
        <h1
          className={cn(
            "t-editor-title text-text [overflow-wrap:anywhere]",
            EASE,
            "transition-[font-size]",
            compact && "text-[1.25rem]",
          )}
        >
          {title}
        </h1>
      }
      meta={meta && <div className="flex flex-wrap items-center gap-x-3 gap-y-2">{meta}</div>}
      actions={actions}
      tabs={tabs}
    />
  );
}

/** Where the band is sticky, and so where it shrinks (the shell slot's `xl:` rule). */
const STICKY = "(min-width: 1280px)";

/** The band's transitions (12 §4): 200ms ease-out, none under reduced motion. */
const EASE = "duration-200 ease-out motion-reduce:transition-none";

/**
 * The scroll positions that switch the band (12 §4), with hysteresis: compact
 * past 120, expanded again under 24. The gap is what stops it flapping.
 * Shrinking takes ~72px out of the page above the content, so the page gets
 * shorter and, at its very end, the browser pulls scrollY back; as long as
 * that is less than the 96px between the two lines, the pulled-back
 * position is still compact.
 */
const COMPACT_PAST = 120;
const EXPAND_UNDER = 24;

/**
 * Whether the band is compact, from the window's scroll position, read once
 * per frame (a passive listener throttled with requestAnimationFrame). Off,
 * and so expanded, while `enabled` is false (below 1280, where the band
 * scrolls away rather than sticking).
 */
function useCompactBand(enabled: boolean): boolean {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setCompact(false);
      return;
    }
    let frame = 0;
    const read = () => {
      frame = 0;
      const y = window.scrollY;
      setCompact((was) => (was ? y >= EXPAND_UNDER : y > COMPACT_PAST));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [enabled]);
  return enabled && compact;
}

/** The editor's tab labels' widths at 14px, so the skeleton's tab row matches it. */
const TAB_WIDTHS = [88, 100, 105, 92, 128, 52];

/**
 * The band while the product loads (11 §1): the same frame, with a block for
 * each part, each as tall as the real one (a bar on the line box of the same
 * type role, the chip's 26px, the buttons' 40px, the tab row's 44px), so
 * nothing moves when the product lands. The blocks are aria-hidden; the
 * editor announces "Loading product" once, and a visually hidden h1 stands
 * in for the name. It stays expanded: the page under it is loading.
 */
export function ProductBandSkeleton() {
  // An inline bar on its role's line box: the row is exactly that role's height.
  const bar = "inline-block align-middle";
  return (
    <BandFrame
      picture={<Skeleton className="h-16 w-16 shrink-0" />}
      overline={
        // Two words' worth (a range, then a product type), so it wraps where
        // a typical overline does: one line from 1280, two in a narrower column.
        <div className="t-overline">
          <Skeleton className={`${bar} h-[0.8em] w-32`} /> <Skeleton className={`${bar} h-[0.8em] w-48`} />
        </div>
      }
      title={
        <>
          {/* The page's h1 while the name is unknown, as the top bar's crumb reads. */}
          <h1 className="sr-only">Product</h1>
          <div className="t-editor-title">
            <Skeleton className={`${bar} h-[0.75em] w-56 max-w-full`} />
          </div>
        </>
      }
      meta={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="t-help">
            <Skeleton className={`${bar} h-[0.8em] w-28`} />
          </span>
          <Skeleton className="h-6.5 w-14" />
          <span className="t-help">
            <Skeleton className={`${bar} h-[0.8em] w-36`} />
          </span>
        </div>
      }
      actions={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 lg:justify-end">
          <Skeleton className="h-10 w-[172px] max-sm:w-10" />
          <Skeleton className="h-10 w-[132px]" />
        </div>
      }
      tabs={
        // The TabList's own -ml-3 and 44px row; clipped, as the real row scrolls on a phone.
        <div className="-ml-3 flex h-11 items-center overflow-hidden">
          {TAB_WIDTHS.map((w, i) => (
            <div key={i} className="flex h-full shrink-0 items-center px-3" style={{ width: w }}>
              <Skeleton className="h-3.5 w-full" />
            </div>
          ))}
        </div>
      }
    />
  );
}

/** The band's frame, shared by the band and its skeleton so the two cannot drift. */
function BandFrame({
  picture,
  overline,
  title,
  meta,
  actions,
  tabs,
  compact = false,
  onMetaFocusChange,
}: {
  picture: ReactNode;
  overline?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
  compact?: boolean;
  onMetaFocusChange?: (focused: boolean) => void;
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
      <div
        ref={setBand}
        data-sticky-band
        data-compact={compact ? "true" : "false"}
        className="border-b border-border bg-surface"
      >
        {/* The content's own side padding (40, or 20 below 640), as the page header's. */}
        <div
          className={cn(
            "px-5 sm:px-10",
            EASE,
            "transition-[padding]",
            compact ? "pt-3" : "pt-8",
            !tabs && (compact ? "pb-3" : "pb-7"),
          )}
        >
          {/* Below lg the actions wrap under the title. From lg they sit beside
              it while the title keeps at least 18rem, and wrap under it when
              they don't fit (New product's three buttons at 1024). */}
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-start lg:justify-between lg:gap-x-6">
            <div className="flex min-w-0 items-start gap-4 lg:min-w-[18rem] lg:flex-1">
              {/* On paper; a box icon when there is no picture yet. */}
              {picture}
              <div className="min-w-0">
                {overline && <Fold open={!compact}>{overline}</Fold>}
                {/* Compact, the 20px name (a 22px line) is centred on the 40px
                    picture and buttons: (40 − 22) / 2 = 9px, eased like the rest. */}
                <div className={cn(EASE, "transition-[margin]", compact ? "mt-[9px]" : "mt-1")}>{title}</div>
                {meta && (
                  <Fold open={!compact} className={compact ? "mt-0" : "mt-2.5"} onFocusChange={onMetaFocusChange}>
                    {meta}
                  </Fold>
                )}
              </div>
            </div>
            {actions && <div className="min-w-0 lg:max-w-full">{actions}</div>}
          </div>
          {/* -mb-px: the tab row sits ON the band's bottom rule, so the active
              tab's bar replaces the rule under it (pass the TabList
              `shadow-none`: the band's rule replaces the row's own). */}
          {tabs && <div className={cn("-mb-px", EASE, "transition-[margin]", compact ? "mt-3" : "mt-5")}>{tabs}</div>}
        </div>
      </div>
    </HeaderSlotPortal>
  );
}

/**
 * A part of the band that folds away when it is compact: its row eases from
 * its height to 0 (grid rows 1fr → 0fr) as it fades out. Folded, it is
 * `inert` and `aria-hidden`, so nothing in it (Refresh) can be focused or
 * read while it cannot be seen.
 *
 * The inner box is clipped to fold, with 4px of room on every side (-m-1
 * p-1, which takes no space) so a focus outline inside it is not cut off.
 */
function Fold({
  open,
  className,
  onFocusChange,
  children,
}: {
  open: boolean;
  className?: string;
  /** Whether focus is inside (focusin / focusout), for the band to stay open while it is. */
  onFocusChange?: (focused: boolean) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // An attribute set directly: React 18 has no `inert` prop.
  useEffect(() => {
    ref.current?.toggleAttribute("inert", !open);
  }, [open]);
  return (
    <div
      ref={ref}
      aria-hidden={open ? undefined : true}
      onFocus={onFocusChange && (() => onFocusChange(true))}
      onBlur={
        onFocusChange &&
        ((e: FocusEvent<HTMLDivElement>) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onFocusChange(false);
        })
      }
      className={cn(
        "grid",
        EASE,
        "transition-[grid-template-rows,opacity,margin]",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        className,
      )}
    >
      <div className="-m-1 min-h-0 overflow-hidden p-1">{children}</div>
    </div>
  );
}
