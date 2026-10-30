import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { Button, Highlight, Input, Thumb } from "./ui";
import { cn } from "../lib/cn";
import { useProductIndex } from "../lib/productIndex";
import { LG, useMediaQuery } from "../hooks/useMediaQuery";
import type { ProductSummary } from "../lib/types";

const MAX_RESULTS = 8;
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** Name or SKU contains the query; names that START with it first. */
function search(products: ProductSummary[], query: string): ProductSummary[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits = products.filter(
    (p) => (p.name ?? "").toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q),
  );
  const starts = (p: ProductSummary) => ((p.name ?? "").toLowerCase().startsWith(q) ? 0 : 1);
  return hits.sort((a, b) => starts(a) - starts(b) || (a.name ?? "").localeCompare(b.name ?? ""));
}

/**
 * The top bar's product search (docs/redesign 02a Q20, "After 4b"): products
 * only, matched by name or SKU in the browser over the session's product list
 * (lib/productIndex — no new endpoint). A combobox: the arrows move through
 * the results, Enter opens the product, Escape closes the list (and a second
 * Escape leaves the field). ⌘K / Ctrl+K focuses it from anywhere.
 *
 * From xl it is a 280px field (224px between lg and xl, where the bar is
 * tight). Below lg it collapses to an icon button that
 * opens a full-width row under the top bar (02a Q23).
 */
export function ProductSearch() {
  const wide = useMediaQuery(LG);
  const { products, error } = useProductIndex();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [rowOpen, setRowOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const optionId = (i: number) => `${listId}-o${i}`;

  const all = useMemo(() => (products ? search(products, query) : []), [products, query]);
  const results = all.slice(0, MAX_RESULTS);
  useEffect(() => setActive(0), [query]);

  const open = focused && (wide || rowOpen);
  const showList = open && results.length > 0;

  // ⌘K / Ctrl+K from anywhere: focus the field, opening the row first below lg.
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      e.preventDefault();
      if (wide) input.current?.focus();
      else setRowOpen(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wide]);

  // The row's field takes focus as it opens.
  useEffect(() => {
    if (rowOpen && !wide) input.current?.focus();
  }, [rowOpen, wide]);

  function closeRow() {
    setRowOpen(false);
    setQuery("");
    opener.current?.focus();
  }

  function go(p: ProductSummary) {
    setQuery("");
    setRowOpen(false);
    input.current?.blur();
    navigate(`/products/${p.id}`);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && results.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length) {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      // Stopped here so a dialog underneath (if any) is not closed with it.
      e.stopPropagation();
      if (query) setQuery("");
      else if (!wide) closeRow();
      else input.current?.blur();
    }
  }

  /** The list's message when it has no options to show. */
  const message = !open
    ? null
    : error
      ? "Couldn't load products."
      : !products
        ? "Loading products…"
        : !query.trim()
          ? `Search ${products.length} products by name or SKU.`
          : results.length === 0
            ? `No products match "${query.trim()}".`
            : null;

  const field = (
    <div className={cn("relative", wide ? "w-56 xl:w-70" : "w-full")}>
      <Search
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
      />
      <Input
        ref={input}
        size="sm"
        type="text"
        role="combobox"
        aria-label="Search products"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? optionId(active) : undefined}
        autoComplete="off"
        spellCheck={false}
        value={query}
        placeholder="Search products…"
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        className={cn("pl-9", wide && "pr-14")}
      />
      {wide && !query && (
        <kbd
          aria-hidden="true"
          className="t-code-sm pointer-events-none absolute right-2 top-1/2 inline-flex h-5 -translate-y-1/2 items-center border border-border px-1.5 text-muted"
        >
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      )}

      {open && (
        <div
          // Keeps focus in the field while an option is clicked.
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "absolute left-0 top-full z-50 mt-1 border border-border bg-surface py-1 shadow-menu",
            wide ? "w-[26rem]" : "w-full",
          )}
        >
          <ul id={listId} role="listbox" aria-label="Products">
            {showList &&
              results.map((p, i) => (
                <li
                  key={p.id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(p)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 px-3 py-1.5 transition-colors duration-[120ms]",
                    i === active && "bg-surface-2",
                  )}
                >
                  <Thumb src={p.thumbnail} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body text-text">
                      <Highlight text={p.name ?? "Untitled product"} query={query} />
                    </span>
                    <span className="t-code-sm block truncate text-muted">
                      {p.sku ? <Highlight text={p.sku} query={query} /> : "No SKU"}
                    </span>
                  </span>
                </li>
              ))}
          </ul>
          {/* Polite, so a screen reader hears "no match" without leaving the field. */}
          <p role="status" className={cn("text-help text-muted", (message || all.length > results.length) && "px-3 py-2")}>
            {message ??
              (all.length > results.length
                ? `${results.length} of ${all.length} shown — keep typing to narrow it.`
                : "")}
          </p>
        </div>
      )}
    </div>
  );

  if (wide) return <div role="search">{field}</div>;

  return (
    <>
      <Button
        ref={opener}
        variant="ghost"
        icon
        aria-label="Search products"
        aria-expanded={rowOpen}
        onClick={() => (rowOpen ? closeRow() : setRowOpen(true))}
      >
        <Search size={18} />
      </Button>
      {rowOpen && (
        <div role="search" className="absolute inset-x-0 top-full z-20 flex items-center gap-2 border-b border-border bg-surface px-5 py-3">
          <div className="min-w-0 flex-1">{field}</div>
          <Button variant="ghost" icon aria-label="Close search" onClick={closeRow}>
            <X size={18} />
          </Button>
        </div>
      )}
    </>
  );
}
