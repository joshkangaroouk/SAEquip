import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "./Button";
import { SegmentedControl } from "./SegmentedControl";

export type PageSize = 20 | 50 | "all";

const SIZE_LABEL: Record<string, string> = { "20": "20", "50": "50", all: "All" };

/**
 * The page numbers to show: first, last, and the current page ±1, with a gap
 * marker between runs (02a Q26). A gap of exactly one page shows that page
 * instead — "1 … 3" says less than "1 2 3" in the same space.
 */
function pageList(page: number, pageCount: number): (number | "gap")[] {
  const keep = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount));
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined && p - prev === 2) out.push(p - 1);
    else if (prev !== undefined && p - prev > 2) out.push("gap");
    out.push(p);
  });
  return out;
}

/**
 * Pagination (00): "Showing 1–20 of 91 products" on the left, an optional
 * "Rows per page" SegmentedControl (20 / 50 / All) in the middle, and on the
 * right the previous/next buttons (34px, bordered) with numbered pages in
 * mono — the current one yellow.
 *
 * Works for a list paged in the browser (see `usePagedList`, which also owns
 * the page-size state) and for one paged on the server (Media: pass the
 * server's `total` and its fixed page size, and leave out `onPageSizeChange`).
 *
 * Renders whenever there is anything to page — even a single page, so the
 * rows-per-page control stays reachable on "All".
 */
export function Pagination({
  page,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [20, 50, "all"],
  label = "items",
  className,
}: {
  page: number;
  total: number;
  /** A fixed size (server-paged callers), or 20 / 50 / "all". */
  pageSize: PageSize | number;
  onPageChange: (page: number) => void;
  /** Shows the rows-per-page control. Leave it out for a fixed page size. */
  onPageSizeChange?: (size: PageSize) => void;
  pageSizeOptions?: PageSize[];
  /** What is being paged, plural: "products". */
  label?: string;
  className?: string;
}) {
  if (total <= 0) return null;
  const size = pageSize === "all" ? total : pageSize;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), pageCount);
  const from = (current - 1) * size + 1;
  const to = Math.min(total, current * size);

  return (
    <nav aria-label="Pagination" className={cn("flex flex-wrap items-center justify-between gap-x-6 gap-y-3", className)}>
      <p className="text-body text-muted" aria-live="polite">
        Showing{" "}
        <span className="font-mono text-text">
          {from === to ? from : `${from}–${to}`}
        </span>{" "}
        of <span className="font-mono text-text">{total}</span> {label}
      </p>

      {onPageSizeChange && (
        <div className="flex items-center gap-2">
          <span className="text-body text-muted" aria-hidden="true">
            Rows per page
          </span>
          <SegmentedControl
            ariaLabel="Rows per page"
            value={String(pageSize)}
            onChange={(v) => onPageSizeChange((v === "all" ? "all" : Number(v)) as PageSize)}
            options={pageSizeOptions.map((s) => ({ value: String(s), label: SIZE_LABEL[String(s)] }))}
          />
        </div>
      )}

      <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          size="sm"
          icon
          aria-label="Previous page"
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
        >
          <ChevronLeft size={16} />
        </Button>
        {pageList(current, pageCount).map((p, i) =>
          p === "gap" ? (
            <span key={`gap-${i}`} aria-hidden="true" className="inline-flex h-8.5 w-6 items-center justify-center font-mono text-help text-muted">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-label={`Page ${p}`}
              aria-current={p === current ? "page" : undefined}
              onClick={() => p !== current && onPageChange(p)}
              className={cn(
                "inline-flex h-8.5 min-w-8.5 items-center justify-center border px-1.5 font-mono text-help transition-colors duration-[120ms]",
                p === current
                  ? "border-accent bg-accent font-medium text-accent-ink"
                  : "border-transparent text-text hover:bg-surface-2",
              )}
            >
              {p}
            </button>
          ),
        )}
        <Button
          variant="secondary"
          size="sm"
          icon
          aria-label="Next page"
          disabled={current >= pageCount}
          onClick={() => onPageChange(current + 1)}
        >
          <ChevronRight size={16} />
        </Button>
      </div>
    </nav>
  );
}

/**
 * Pages a list held in the browser: the slice to render plus the state the
 * Pagination needs. Back to page 1 when the page size changes or any of
 * `resetKeys` (search, tab, filters, sort) does; the page is clamped when the
 * list shrinks under it.
 *
 *   const paged = usePagedList(filtered, { resetKeys: [query, status] });
 *   paged.pageItems.map(…)
 *   <Pagination {...paged} onPageChange={paged.setPage} onPageSizeChange={paged.setPageSize} />
 */
// eslint-disable-next-line react-refresh/only-export-components
export function usePagedList<T>(
  items: T[],
  { defaultPageSize = 20, resetKeys = [] }: { defaultPageSize?: PageSize; resetKeys?: unknown[] } = {},
) {
  const [page, setPage] = useState(1);
  const [pageSize, setSize] = useState<PageSize>(defaultPageSize);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setPage(1), resetKeys);

  const total = items.length;
  const pageCount = pageSize === "all" ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);
  const pageItems = pageSize === "all" ? items : items.slice((current - 1) * pageSize, current * pageSize);

  return {
    pageItems,
    page: current,
    setPage,
    pageSize,
    setPageSize: (s: PageSize) => {
      setSize(s);
      setPage(1);
    },
    total,
    pageCount,
  };
}
