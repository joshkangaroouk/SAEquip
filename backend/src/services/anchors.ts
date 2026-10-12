/**
 * Removes every `<a href>` from a description, keeping the link text.
 *
 * ⚠️ A WAF in front of api.duda.co rejects any request body containing an
 * anchor WITH an href — `PATCH /ecommerce/products/{id}` returns `403` with an
 * HTML error page rather than Duda's usual JSON error. Probed against a
 * throwaway product: `<p>`, `<strong>`, `<ul>`, `<h5>`, `<hr />`, `&amp;`,
 * curly quotes and 2,000 characters of text all pass; `<a>` with no href
 * passes; `href` on a `<span>` passes; the literal text "href=" passes. Only
 * `<a href="…">` is blocked, absolute or relative.
 *
 * So the Hub keeps the linked HTML (the widget renders it) and Duda receives
 * this link-free version.
 *
 * ⚠️⚠️ THIS FILE MUST IMPORT NOTHING. It is used by `routes/duda.ts`, which is
 * in the serverless function's import graph, and it used to live in
 * `descriptionHtml.ts` — importing it from there pulled `sanitize-html` into
 * the function, which crashes the WHOLE API at module load on Vercel
 * (FUNCTION_INVOCATION_FAILED on every route, the public widget included)
 * while running perfectly under tsx locally. That happened twice; see the note
 * in `routes/public.ts`.
 */
export function stripAnchors(html: string): string {
  /*
   * Opening and closing tags removed SEPARATELY, keeping the text between.
   * ⚠️ It used to match balanced pairs only, so an unclosed `<a href>` typed
   * in the editor's HTML tab reached Duda intact, the WAF 403'd and the whole
   * Details save failed with an opaque error (fixed 2026-10-12). Quoted
   * attribute values are skipped whole, so a `>` inside one cannot end the
   * tag early and leave half of it behind.
   */
  return html.replace(/<a\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi, "").replace(/<\/a\s*>/gi, "");
}
