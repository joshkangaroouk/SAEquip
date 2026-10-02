import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ImageOff } from "lucide-react";
import { Modal, Skeleton } from "./ui";
import type { AssetUsage, UsageProduct } from "../lib/types";

const PILL = "rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted";

const LOGO_KIND = { SA_LOGO: "SA logo", CERT_LOGO: "Cert logo" } as const;

/**
 * A usage count that opens the list of products behind it.
 *
 * Shared by the Media Centre and the Logos page so the pill and its popup look
 * and behave the same in both. The popup fetches when opened rather than with
 * the page: 24 tiles would otherwise mean 24 product lists nobody asked for.
 *
 * At 0 it is a plain pill — a popup listing nothing is a click wasted.
 */
export function UsagePill({
  count,
  label,
  subject,
  load,
}: {
  count: number;
  label: string;
  /** What the popup is about — a filename or a logo's name. */
  subject: string;
  load: () => Promise<AssetUsage>;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  if (count === 0) return <span className={PILL}>{label}</span>;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        title="See which products use this"
        className={`${PILL} transition-colors hover:bg-border hover:text-text focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50`}
      >
        {label}
      </button>
      {open && <UsageDialog count={count} subject={subject} load={load} onClose={close} />}
    </>
  );
}

function UsageDialog({
  count,
  subject,
  load,
  onClose,
}: {
  count: number;
  subject: string;
  load: () => Promise<AssetUsage>;
  onClose: () => void;
}) {
  const [data, setData] = useState<AssetUsage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    load()
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Could not load usage"));
    return () => {
      live = false;
    };
    // `load` is a fresh closure on every parent render; fetching once per
    // opening is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The count the page loaded with until the list arrives, then the list's
  // own length — another tab may have changed it since.
  const n = data ? data.products.length : count;
  const products = data?.products ?? [];

  // When every product is reached the same single way (all through one logo),
  // say it once in the heading instead of on every row.
  const first = products[0]?.via.join(" · ") ?? "";
  const sharedVia = products.length > 0 && products.every((p) => p.via.join(" · ") === first) ? first : "";

  return (
    <Modal
      open
      onClose={onClose}
      title={`Used on ${n} product${n === 1 ? "" : "s"}`}
      description={
        <span className="[overflow-wrap:anywhere]">
          {subject}
          {sharedVia && ` · ${sharedVia}`}
        </span>
      }
    >
      {data?.logos && data.logos.length > 0 && (
        <p className="mb-3 rounded-lg bg-surface-2 px-3 py-2 text-small text-muted">
          In the logo catalogue as{" "}
          {data.logos.map((l, i) => (
            <span key={l.id}>
              {i > 0 && ", "}
              <span className="font-semibold text-text">{l.label?.trim() || "an unnamed logo"}</span> (
              {LOGO_KIND[l.kind]})
            </span>
          ))}
          .{" "}
          <Link to="/logos" className="font-semibold text-text underline underline-offset-2">
            Manage logos
          </Link>
        </p>
      )}

      {error && <p className="text-small text-danger">{error}</p>}

      {/* ⚠️ The list scrolls inside the dialog: a certification logo is on
          up to ~50 products, which would otherwise push the dialog off-screen. */}
      {!error && (
        <ul
          className="-mx-2 max-h-[60vh] overflow-y-auto"
          aria-busy={!data}
          aria-label={data ? undefined : "Loading products"}
        >
          {!data &&
            Array.from({ length: Math.min(count, 6) }, (_, i) => (
              <li key={i} className="flex items-center gap-3 px-2 py-2">
                <Skeleton className="h-10 w-10 shrink-0" />
                <span className="flex-1">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="mt-1.5 h-3 w-1/4" />
                </span>
              </li>
            ))}
          {data && products.length === 0 && (
            <li className="px-2 py-2 text-small text-muted">No products use this any more.</li>
          )}
          {products.map((p) => (
            <li key={p.dudaProductId}>
              <ProductRow product={p} showVia={!sharedVia} />
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function ProductRow({ product: p, showVia }: { product: UsageProduct; showVia: boolean }) {
  const [broken, setBroken] = useState(false);
  return (
    <Link
      to={`/products/${p.dudaProductId}`}
      className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-white">
        {p.thumbnailUrl && !broken ? (
          <img
            src={p.thumbnailUrl}
            alt=""
            loading="lazy"
            onError={() => setBroken(true)}
            className="h-full w-full object-contain"
          />
        ) : (
          <ImageOff className="h-4 w-4 text-subtle" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-semibold text-text">{p.name || "Untitled product"}</span>
        <span className="block truncate text-xs text-muted">
          {p.sku || "No SKU"}
          {showVia && p.via.length > 0 && ` · ${p.via.join(" · ")}`}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-subtle transition-colors group-hover:text-text" aria-hidden="true" />
    </Link>
  );
}
