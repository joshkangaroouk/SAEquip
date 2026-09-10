import { Button } from "./Button";

/**
 * Prev / next pager with a "page X of Y" readout.
 *
 * Deliberately not a numbered page list: the media library is browsed by
 * search and sort rather than by page number, and a numbered strip over 15
 * pages of assets is noise. Renders nothing at all for a single page.
 */
export function Pagination({
  page,
  pageCount,
  total,
  onChange,
  label = "items",
}: {
  page: number;
  pageCount: number;
  total: number;
  onChange: (page: number) => void;
  label?: string;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="mt-5 flex items-center justify-between gap-3">
      <span className="text-xs text-subtle">
        Page {page} of {pageCount} · {total} {label}
      </span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          ← Prev
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onChange(Math.min(pageCount, page + 1))}
          disabled={page >= pageCount}
        >
          Next →
        </Button>
      </div>
    </div>
  );
}
