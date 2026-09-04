/**
 * Wraps every case-insensitive occurrence of `query` inside `text` in a brand
 * yellow/black <mark>, so a search result shows *why* it matched.
 *
 * <mark> rather than <span> because it carries the semantic meaning — screen
 * readers can announce marked text — and the brand classes override the
 * browser's own default mark styling.
 */
export function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;

  // Splitting on a CAPTURING group keeps the matches in the resulting array,
  // so it alternates: [before, match, between, match, after…]. Empty strings
  // appear when a match sits at either end; they render as nothing.
  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, "gi"));
  const needle = q.toLowerCase();

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === needle ? (
          <mark
            key={i}
            className="rounded-[2px] bg-accent px-0.5 text-accent-foreground"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

/**
 * Without this, a query containing regex metacharacters would either throw
 * (e.g. an unclosed "(") or match the wrong things (e.g. "." matching every
 * character). Product SKUs and names routinely contain "." and "-".
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
