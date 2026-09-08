import sanitizeHtml from "sanitize-html";

/**
 * Turns a WooCommerce description field into clean, predictable HTML fit for
 * Duda's description box and the public widget.
 *
 * The source is messy in five specific, measured ways (counts are across the
 * 164 populated description fields of the 96 published products):
 *
 *  1. **Line breaks are double-encoded.** The CSV exporter writes every line
 *     break as a real newline followed by the two literal characters `\` and
 *     `n` — 252 real newlines, 252 literal `\n`, a perfect 1:1. Pasted into
 *     Duda untouched, those `\n` show up as visible text on the live page.
 *  2. **114 of 164 fields aren't wrapped in block tags at all.** WordPress
 *     stores bare text and builds paragraphs at render time (`wpautop`), so a
 *     blank line means a paragraph and a single newline means a line break.
 *     Without reproducing that, everything collapses into one run-on block.
 *  3. **157 non-breaking spaces** (as `&nbsp;` and U+00A0) cause odd gaps and
 *     stop text wrapping where it should.
 *  4. **Editor and PDF-converter cruft**: `class="p1"` from Pages/TextEdit
 *     (90), `class="page|section|layoutArea|column"` div wrappers from a PDF
 *     export (32), `title="Page 1"` (8).
 *  5. **Stray inline styles** (23) — `padding-left:40px` indentation,
 *     `text-align:left`, `font-weight:400`, hardcoded colours including one
 *     `color:#ffffff` that would render as invisible white-on-white text.
 *
 * What is deliberately KEPT: real typographic characters — curly quotes
 * (’ ‘), en dashes (–), degree signs (°) and superscripts (³). Those are
 * correct punctuation, not corruption, and flattening them would make the copy
 * worse.
 *
 * ⚠️ Paragraph spacing is a three-way contract (see CLAUDE.md): Duda's Head
 * HTML applies `.productDescription p:not(:last-child){margin-bottom:16px}`,
 * mirrored by RichTextEditor.tsx and RichHtml.tsx. An empty `<p>` has zero
 * height with no margin but a full 16px once that rule applies — which is
 * exactly the "double spacing" to avoid. `dropEmptyParagraphs` is therefore
 * not cosmetic; it is what keeps the rendered spacing honest.
 */

/**
 * Block-level tags that must never be wrapped in a `<p>`.
 *
 * `li` is deliberately absent: it only ever appears inside a `ul`/`ol`, which
 * are matched as whole units, and including it would make the non-greedy split
 * below stop at the first `</li>` and chop a list in half.
 */
const BLOCK_TAGS = ["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "hr", "blockquote", "table", "figure", "pre"];

/** Matches a whole top-level block element, or a void block like `<hr>`. */
const BLOCK_SPLIT_RE = new RegExp(
  `(<(?:${BLOCK_TAGS.join("|")})\\b[^>]*>[\\s\\S]*?</(?:${BLOCK_TAGS.join("|")})\\s*>|<hr\\b[^>]*/?>)`,
  "gi",
);

const STARTS_WITH_BLOCK_RE = new RegExp(`^<\\s*(?:${BLOCK_TAGS.join("|")})\\b`, "i");

/**
 * Undo the CSV exporter's escaping.
 *
 * Every line break arrives as `\n` (real) + `\n` (literal backslash-n), so the
 * pair collapses to one newline. The trailing catch-all handles a literal `\n`
 * that arrives without its real newline partner — none were present in the
 * 2026-09-07 export, but a re-export shouldn't leak backslashes into the page.
 */
export function decodeExportEscapes(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n\\n/g, "\n")
    .replace(/\\n/g, "\n");
}

/**
 * Remove WordPress shortcodes.
 *
 * Only Duda-agnostic markup survives a migration: a shortcode is expanded by
 * WordPress at render time, so carried across verbatim it shows up as literal
 * `[video width="1920" …][/video]` text on the live page. One product
 * (SAEWFC) has an embedded video this way.
 *
 * The media URL inside is NOT silently discarded — `extractShortcodeMedia`
 * reports it so the video can be re-added on the Duda side, which has to
 * happen by hand anyway since it's hosted on the old WordPress domain.
 */
export function stripShortcodes(html: string): string {
  return html
    .replace(/\[([a-zA-Z_][\w-]*)\b[^\]]*\][\s\S]*?\[\/\1\]/g, "")
    .replace(/\[\/?[a-zA-Z_][\w-]*\b[^\]]*\]/g, "");
}

/** URLs embedded in shortcodes, so nothing is lost without being reported. */
export function extractShortcodeMedia(html: string): string[] {
  return [...html.matchAll(/\[[^\]]*?(?:mp4|src|url|webm)\s*=\s*"([^"]+)"[^\]]*\]/gi)].map((m) => m[1]);
}

/**
 * Normalise whitespace characters without touching real typography.
 *
 * Non-breaking spaces become ordinary spaces: in this content they are never
 * deliberate, they come from copy-paste, and they defeat normal wrapping.
 */
export function normaliseWhitespaceChars(html: string): string {
  return html
    .replace(/&nbsp;/gi, " ")
    // Written as an escape on purpose: a literal non-breaking space in source
    // is invisible, indistinguishable from a normal space on review, and turns
    // this line into a silent no-op if anyone retypes it.
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

/**
 * WordPress's `wpautop`, narrowed to this content.
 *
 * Splits on existing top-level block elements so they're left alone, then for
 * each run of loose text: blank line → new `<p>`, single newline → `<br>`.
 * This is the step that stops 114 bare-text fields collapsing into one block —
 * and the reason it must not double-wrap anything already in a `<p>`.
 */
export function autoParagraph(html: string): string {
  const parts = html.split(BLOCK_SPLIT_RE).filter((s) => s !== undefined);

  return parts
    .map((part) => {
      if (!part.trim()) return "";
      // Already a block element — pass through untouched.
      if (STARTS_WITH_BLOCK_RE.test(part.trim())) return part.trim();

      return part
        .split(/\n\s*\n+/)
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .map((chunk) => `<p>${chunk.replace(/\n/g, "<br>")}</p>`)
        .join("");
    })
    .filter(Boolean)
    .join("");
}

/**
 * Strip the editor/PDF cruft and normalise tags.
 *
 * `class` and `style` are dropped wholesale rather than filtered: every value
 * present in this export is an artifact (see the file header), and an
 * allowlist of "acceptable" styles would be a standing invitation for the next
 * import to smuggle in white text.
 *
 * `div` and `span` are absent from `allowedTags`, so sanitize-html discards
 * the tags but keeps their content — unwrapping the PDF-converter wrappers
 * exactly as wanted.
 */
export function stripCruft(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "em", "h4", "h5", "h6", "ul", "ol", "li", "a", "hr", "sup", "sub"],
    allowedAttributes: {
      // `title`/`class`/`style` deliberately absent everywhere.
      a: ["href", "target", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {
      // Presentational → semantic.
      b: "strong",
      i: "em",
      // Any link opening a new tab must not leak the referrer or window handle.
      a: (tagName, attribs) => ({
        tagName,
        attribs: attribs.target
          ? { ...attribs, target: "_blank", rel: "noopener noreferrer" }
          : attribs,
      }),
    },
    // Keep the real typography (curly quotes, dashes, °, ³) as literal UTF-8
    // rather than turning it into a wall of numeric entities.
    disallowedTagsMode: "discard",
    parser: { decodeEntities: false },
  });
}

/** Visible text of a fragment, for punctuation and emptiness checks. */
function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

/**
 * True if the fragment leaves an inline tag open — so it can't be closed off
 * as its own paragraph without corrupting the markup.
 */
function hasUnclosedTag(html: string): boolean {
  const open: string[] = [];
  for (const m of html.matchAll(/<(\/?)([a-z0-9]+)\b[^>]*?(\/?)>/gi)) {
    const [, closing, tag, selfClosing] = m;
    const t = tag.toLowerCase();
    if (t === "br" || t === "hr" || selfClosing) continue;
    if (closing) {
      const i = open.lastIndexOf(t);
      if (i !== -1) open.splice(i, 1);
    } else {
      open.push(t);
    }
  }
  return open.length > 0;
}

/**
 * Replace every `<br>` with something better than a hard line break.
 *
 * All 13 `<br>` in this export are paste artifacts rather than deliberate
 * typography, but of two different kinds, so they need different treatment:
 *
 *  - **After a full stop** ("…with ease.<br>You can also…") the author meant a
 *    new paragraph. A `<br>` there gives a cramped break with no spacing.
 *  - **Mid-sentence** ("…designed for easy<br>maneuverability") it's an
 *    accidental wrap carried over from a Word/PDF paste. A hard break there is
 *    the "weird alignment" to eliminate — it re-breaks the line in the wrong
 *    place at every viewport width. A plain space restores the sentence.
 *
 * A `<br>` is only promoted to a paragraph break when the text before it
 * closes every tag it opened; otherwise splitting would strand an open
 * `<strong>` across two paragraphs, so it degrades to a space.
 */
export function resolveLineBreaks(html: string): string {
  return html.replace(/<p>([\s\S]*?)<\/p>/gi, (_match, inner: string) => {
    const segments = inner.split(/<br\s*\/?>/i);
    if (segments.length === 1) return `<p>${inner}</p>`;

    const paragraphs: string[] = [];
    let current = segments[0];

    for (let i = 1; i < segments.length; i++) {
      const endsSentence = /[.!?][)"'’”]?\s*$/.test(stripTags(current));
      if (endsSentence && !hasUnclosedTag(current)) {
        paragraphs.push(current.trim());
        current = segments[i];
      } else {
        current = `${current.replace(/\s+$/, "")} ${segments[i].replace(/^\s+/, "")}`;
      }
    }
    paragraphs.push(current.trim());

    return paragraphs
      .filter((p) => stripTags(p).trim().length > 0)
      .map((p) => `<p>${p}</p>`)
      .join("");
  });
}

/**
 * Point WordPress product links at the Duda equivalent.
 *
 * Duda uses the same `/product/<slug>` URL pattern as the old site (it's what
 * the public widget's own slug detection relies on), so an absolute
 * `https://saequip.com/product/x` becomes root-relative `/product/x`. That
 * survives the domain move in both directions — it resolves on
 * saequip-2.multiscreensite.com today and on saequip.com after the cutover —
 * whereas the absolute form breaks the moment saequip.com stops serving
 * WordPress.
 *
 * Non-product saequip.com links are deliberately left alone: they point at
 * WordPress pages (e.g. /sa-equip-products/) with no guaranteed Duda
 * counterpart, so rewriting them would invent a URL. `reviewableLinks()`
 * reports them instead.
 */
export function rewriteInternalLinks(html: string): string {
  return html.replace(
    /(href=")https?:\/\/(?:www\.)?saequip\.com(\/product\/[^"]*)/gi,
    (_m, prefix: string, path: string) => `${prefix}${path.replace(/\/$/, "")}`,
  );
}

/** Links a human should check after import — absolute links to the old site. */
export function reviewableLinks(html: string): string[] {
  return [...html.matchAll(/href="(https?:\/\/(?:www\.)?saequip\.com[^"]*)"/gi)].map((m) => m[1]);
}

/**
 * Unwrap links to the old site that have no Duda equivalent, keeping the text.
 *
 * Runs AFTER `rewriteInternalLinks`, so genuine product links have already
 * been converted to a root-relative `/product/<slug>`. What's left points at
 * WordPress-only pages (e.g. `/sa-equip-products/`) that will 404 the moment
 * saequip.com stops serving WordPress. Better to ship no link than a dead one.
 */
export function unwrapDeadLinks(html: string): string {
  return html.replace(
    /<a\b[^>]*href="https?:\/\/(?:www\.)?saequip\.com[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
    (_m, text: string) => text,
  );
}

/**
 * A paragraph that LABELS a list rather than being an item in it.
 *
 * Matched on the opening words, not the closing ones: "Includes: -" ends with
 * its keyword, but "PRODUCT CODE: SAVK100" carries a value afterwards, and an
 * end-anchored pattern turned that heading into the first bullet of the kit
 * list.
 */
const LIST_INTRO_RE = /^(?:includes|contains|comprises|consists of|supplied with|product code)\b/i;

/**
 * Turn runs of one-line paragraphs into a real bulleted list.
 *
 * WordPress stored kit contents as separate paragraphs (each line break became
 * its own `<p>`), so a five-item kit renders as five stacked paragraphs each
 * carrying a 16px gap — technically valid but it reads as loose prose rather
 * than a list.
 *
 * Detected by SHAPE, not by keyword: three or more consecutive paragraphs that
 * are short and don't end in sentence punctuation. Every such run in this
 * export is genuinely a list, and requiring three in a row keeps it away from
 * ordinary prose, which has long paragraphs ending in full stops. An
 * introducer line ("Includes: -", "PRODUCT CODE: X") stays a paragraph above
 * the list rather than becoming a bullet.
 */
export function paragraphRunsToLists(html: string): string {
  // Split before EVERY block element, not just `<p>`. Splitting on `<p>` alone
  // leaves a trailing `<hr />`/`<h5>` glued to the preceding paragraph, so that
  // paragraph stops looking like a single item and silently cuts the run —
  // which left three of SAVK's four identical kit blocks as loose paragraphs
  // while the fourth became a list.
  const parts = html.split(new RegExp(`(?=<(?:${BLOCK_TAGS.join("|")})\\b)`, "i"));
  const out: string[] = [];
  let run: string[] = [];

  const isItem = (part: string): boolean => {
    const m = /^<p>([\s\S]*?)<\/p>$/i.exec(part.trim());
    if (!m) return false;
    const text = stripTags(m[1]).trim();
    if (!text || text.length > 90) return false;
    if (/[.!?:]$/.test(text)) return false; // sentence or introducer
    if (LIST_INTRO_RE.test(text)) return false;
    return true;
  };

  const flush = () => {
    if (run.length >= 3) {
      const items = run
        .map((p) => /^<p>([\s\S]*?)<\/p>$/i.exec(p.trim())?.[1] ?? "")
        .map((inner) => `<li>${inner.trim()}</li>`)
        .join("");
      out.push(`<ul>${items}</ul>`);
    } else {
      out.push(...run);
    }
    run = [];
  };

  for (const part of parts) {
    if (isItem(part)) run.push(part);
    else {
      flush();
      out.push(part);
    }
  }
  flush();
  return out.join("");
}

/**
 * Remove paragraphs that render as nothing but still occupy 16px.
 *
 * Runs last, because unwrapping a `<div>` or dropping a `<span>` can leave a
 * `<p>` holding only whitespace or a stray `<br>`.
 */
export function dropEmptyParagraphs(html: string): string {
  let out = html;
  let before: string;
  do {
    before = out;
    out = out
      .replace(/<p>\s*(?:<br\s*\/?>\s*)*<\/p>/gi, "")
      .replace(/<(h[4-6]|li)>\s*(?:<br\s*\/?>\s*)*<\/\1>/gi, "");
  } while (out !== before);

  return out
    // A trailing <br> before the close adds a blank line inside the paragraph.
    .replace(/(?:<br\s*\/?>\s*)+<\/p>/gi, "</p>")
    .replace(/<p>\s*(?:<br\s*\/?>\s*)+/gi, "<p>")
    // Collapse runs of <br> — two in a row is a fake paragraph break.
    .replace(/(?:<br\s*\/?>\s*){2,}/gi, "<br>")
    .trim();
}

/**
 * The full pipeline. Order matters, and one ordering is a trap:
 *
 *  1. decode the exporter's escaping, so real newlines exist to work with
 *  2. normalise nbsp/runs of spaces, before anything depends on whitespace
 *  3. strip cruft — which also UNWRAPS the `div`/`span` containers
 *  4. build paragraphs from the now-bare text runs
 *  5. turn the leftover `<br>` into paragraph breaks or spaces
 *  6. group runs of one-line paragraphs into real bulleted lists
 *  7. point old-site product links at the Duda equivalent, unwrap the rest
 *  8. drop the empties the earlier steps can leave behind
 *
 * ⚠️ Steps 3 and 4 must not swap. Paragraphing first makes a field wrapped in
 * `<div class="page">` (the PDF-converter output) look like it already starts
 * with a block element, so it passes through untouched — and then unwrapping
 * the divs leaves the text with no paragraphs at all. Exactly one of the 164
 * fields (SACDES/SACBDS) has that shape, which is precisely why the whole set
 * gets audited rather than spot-checked.
 */
export function sanitiseDescription(raw: string | null | undefined): string {
  if (!raw) return "";
  const decoded = normaliseWhitespaceChars(stripShortcodes(decodeExportEscapes(raw)));
  if (!decoded.trim()) return "";
  const structured = resolveLineBreaks(autoParagraph(stripCruft(decoded)));
  // Empties must go BEFORE list grouping: a leftover `<p></p>` between two
  // kit-content lines breaks the run in half, so half the items stay
  // paragraphs. Run again at the end for anything the later steps leave.
  const listed = paragraphRunsToLists(dropEmptyParagraphs(structured));
  return dropEmptyParagraphs(unwrapDeadLinks(rewriteInternalLinks(listed)));
}

/**
 * Unwrap anchors, keeping their text. Needed only for Duda's API payload.
 *
 * ⚠️ A WAF in front of api.duda.co rejects any request body containing an
 * anchor WITH an href — `PATCH /ecommerce/products/{id}` returns `403` with an
 * HTML error page rather than Duda's usual JSON error. Probed against a
 * throwaway product (`scripts/_probe403.ts`): `<p>`, `<strong>`, `<ul>`,
 * `<h5>`, `<hr />`, `&amp;`, curly quotes and 2,000 characters of text all
 * pass; `<a>` with no href passes; `href` on a `<span>` passes; the literal
 * text "href=" passes. Only `<a href="…">` is blocked, absolute or relative.
 *
 * So the Hub keeps the linked HTML (the widget can render it untouched) and
 * Duda receives this link-free version. Only one product in the catalogue is
 * affected, and the import reports it.
 */
export function stripAnchors(html: string): string {
  return html.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, (_m, text: string) => text);
}

/** Comparable words of a fragment, for measuring overlap between the two fields. */
function comparableWords(html: string): string[] {
  return textContent(html)
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/** Share of the short description's words that already appear in the long one. */
function wordCoverage(short: string, long: string): number {
  const sw = comparableWords(short);
  if (!sw.length) return 1;
  const lw = new Set(comparableWords(long));
  return sw.filter((w) => lw.has(w)).length / sw.length;
}

/**
 * Sales terms that appear ONLY in a short description and must never be lost:
 * "available for purchase only", "options for UK hire and sale may vary",
 * "Sales Team will confirm once quote is received". Five products carry one.
 */
const DISCLAIMER_RE = /disclaimer|please note/i;

/**
 * Page furniture, not product copy.
 *
 * SAEWFC's short description is entirely "Ready to Enhance Safety and
 * Productivity on Your Site? Select an option below to request full product
 * information and a custom rental quote." — a call-to-action belonging to the
 * WordPress page template. Prepending it would open the description with a CTA
 * that points at controls Duda doesn't have ("select an option below" — below
 * what?), and the same sentence already appears in the long text.
 */
const CTA_RE = /select an option below|request (?:a|full) (?:quote|product information)|click here|enquire now|contact us today|ready to enhance/i;

/** How the two Woo fields were combined, so the import can report it. */
export type DescriptionDecision =
  | "long-only"
  | "short-only"
  | "short-contained-in-long"
  | "short-dropped-as-paraphrase"
  | "short-dropped-as-cta"
  | "short-prepended"
  | "empty";

export interface ComposedDescription {
  html: string;
  decision: DescriptionDecision;
  /** Word overlap between the fields, when both exist. */
  coverage?: number;
}

/**
 * Collapse WooCommerce's two description fields into the one Duda provides.
 *
 * The premise — "the short is just a truncated version of the long" — holds
 * for most of the catalogue but not all of it. Measured across the 96
 * published products:
 *
 *   48  short is an exact PREFIX of long      → long already contains it
 *    2  short appears verbatim inside long    → long already contains it
 *   24  short only, no long                   → the short becomes the description
 *    2  neither                               → empty
 *   21  short has text the long one does NOT  → needs deciding
 *
 * Of those 21, 11 are harmless paraphrases ("The powerful SA LUMIN LED
 * Rechargeable Floodlight is lightweight and fully portable…" restating the
 * long copy) — dropping those loses nothing and avoids saying it twice.
 *
 * The other 10 must be kept: 5 carry a sales disclaimer, and 5 are simply
 * different copy (SATL100/SG/CR5 and SEFU/RF-DU/BD2 share only 14% of their
 * words with the long text). Those get the short description prepended as the
 * opening paragraph, so a single field loses nothing.
 */
export function composeDescription(
  shortRaw: string | null | undefined,
  longRaw: string | null | undefined,
): ComposedDescription {
  const short = sanitiseDescription(shortRaw);
  const long = sanitiseDescription(longRaw);

  if (!short && !long) return { html: "", decision: "empty" };
  if (!long) return { html: short, decision: "short-only" };
  if (!short) return { html: long, decision: "long-only" };

  if (textContent(long).toLowerCase().includes(textContent(short).toLowerCase())) {
    return { html: long, decision: "short-contained-in-long", coverage: 1 };
  }

  const coverage = wordCoverage(short, long);
  const shortText = textContent(short);

  // A call-to-action is page furniture — never worth promoting to the opening
  // paragraph, however little it overlaps the long text.
  if (CTA_RE.test(shortText)) {
    return { html: long, decision: "short-dropped-as-cta", coverage };
  }

  const mustKeep = DISCLAIMER_RE.test(shortText) || coverage < 0.8;
  if (!mustKeep) {
    return { html: long, decision: "short-dropped-as-paraphrase", coverage };
  }
  return { html: `${short}${long}`, decision: "short-prepended", coverage };
}

/** Visible text only — for length checks and eyeballing that nothing was lost. */
export function textContent(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
