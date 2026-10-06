/**
 * Chrome's built-in, on-device translator (the Translator API — Chrome 138+,
 * Edge 148+, desktop only). Used to translate content when staff save it, and
 * from the Translations page. Free, and nothing leaves the staff member's
 * computer except the finished translation, which goes to our own API.
 *
 * ⚠️ Nothing produced here is trusted. Every translation is checked by the
 * server (backend services/i18n/validate.ts: numbers, certification marks and
 * HTML must survive) before it can reach the live site, and one that fails is
 * kept in English. So this file is about getting a translation, not about
 * deciding whether it is safe.
 *
 * ⚠️ `Translator.create()` needs a USER ACTIVATION to download a language
 * pack, so startTranslators() must be called synchronously inside a click
 * handler — before the first `await`. Created later, it fails with
 * NotAllowedError on any computer that has not translated that language before.
 *
 * ⚠️ And Chrome downloads only ONE pack per click (measured, Chrome 154: fr
 * downloaded, de and es in the same click were refused). A pack already on the
 * computer needs no click at all. So the first time a computer translates,
 * each further language needs its own click — retry(), behind the "Download"
 * button in the progress dialog. Once per language, per computer.
 */

/** The site's languages other than English: ours → Chrome's code. */
export const TARGETS = [
  { locale: "ar", chrome: "ar", label: "Arabic", rtl: true },
  { locale: "zh", chrome: "zh", label: "Chinese (Simplified)", rtl: false },
  { locale: "fr", chrome: "fr", label: "French", rtl: false },
  { locale: "de", chrome: "de", label: "German", rtl: false },
  { locale: "pt-br", chrome: "pt", label: "Portuguese (Brazil)", rtl: false },
  { locale: "es", chrome: "es", label: "Spanish", rtl: false },
] as const;

export type TargetLocale = (typeof TARGETS)[number]["locale"];

export function targetLabel(locale: string): string {
  return TARGETS.find((t) => t.locale === locale)?.label ?? locale;
}

interface ChromeTranslator {
  translate(text: string, opts?: { signal?: AbortSignal }): Promise<string>;
  destroy(): void;
}

interface TranslatorStatic {
  create(opts: {
    sourceLanguage: string;
    targetLanguage: string;
    signal?: AbortSignal;
    monitor?: (m: EventTarget) => void;
  }): Promise<ChromeTranslator>;
}

function translatorApi(): TranslatorStatic | null {
  const t = (globalThis as { Translator?: TranslatorStatic }).Translator;
  return t && typeof t.create === "function" ? t : null;
}

/** False in Firefox, Safari, on phones, and in Chrome before 138. */
export function translatorSupported(): boolean {
  return translatorApi() !== null;
}

export interface TranslatorSet {
  locales: TargetLocale[];
  get(locale: TargetLocale): Promise<ChromeTranslator>;
  /**
   * Try one language again — ⚠️ synchronously from a click, which is the user
   * activation its download needs. Resolves anything waiting in whenRetried().
   */
  retry(locale: TargetLocale): void;
  /** Settles when retry() is called for `locale`, or the set is closed. */
  whenRetried(locale: TargetLocale): Promise<void>;
  /** Language-pack download, 0..1, for the progress dialog. */
  downloaded: Map<TargetLocale, number>;
  onDownload: ((locale: TargetLocale, fraction: number) => void) | null;
  abort: AbortController;
  /** Stop downloads and translations and free the models. */
  close(): void;
}

/**
 * One translator per language, all started at once so their packs download in
 * parallel. ⚠️ Call synchronously from the click (see the file comment).
 * Returns null where the browser has no translator.
 */
export function startTranslators(locales: readonly TargetLocale[] = TARGETS.map((t) => t.locale)): TranslatorSet | null {
  const api = translatorApi();
  if (!api) return null;
  const abort = new AbortController();
  const promises = new Map<TargetLocale, Promise<ChromeTranslator>>();
  const waiters = new Map<TargetLocale, () => void>();
  const set: TranslatorSet = {
    locales: [...locales],
    downloaded: new Map(),
    onDownload: null,
    abort,
    get: (locale) => promises.get(locale) ?? Promise.reject(new Error("not started")),
    retry: (locale) => {
      create(locale);
      waiters.get(locale)?.();
      waiters.delete(locale);
    },
    whenRetried: (locale) =>
      new Promise<void>((resolve) => {
        if (abort.signal.aborted) return resolve();
        waiters.set(locale, resolve);
        abort.signal.addEventListener("abort", () => resolve(), { once: true });
      }),
    close: () => {
      abort.abort();
      for (const p of promises.values()) p.then((t) => t.destroy()).catch(() => undefined);
    },
  };
  const create = (locale: TargetLocale) => {
    const chrome = TARGETS.find((t) => t.locale === locale)!.chrome;
    let p: Promise<ChromeTranslator>;
    try {
      p = api.create({
        sourceLanguage: "en",
        targetLanguage: chrome,
        signal: abort.signal,
        monitor(m) {
          m.addEventListener("downloadprogress", (e) => {
            const { loaded = 0, total = 1 } = e as unknown as { loaded?: number; total?: number };
            // The spec moved from bytes to a 0..1 fraction; accept either.
            const fraction = total > 1 ? loaded / total : loaded;
            set.downloaded.set(locale, fraction);
            set.onDownload?.(locale, fraction);
          });
        },
      });
    } catch (e) {
      p = Promise.reject(e);
    }
    // Handled here so an unused failure is not an "unhandled rejection".
    p.catch(() => undefined);
    promises.set(locale, p);
  };
  for (const locale of locales) create(locale);
  return set;
}

/** Refused for want of a click: the pack needs downloading (see the file comment). */
export function needsActivation(e: unknown): boolean {
  return e instanceof DOMException && e.name === "NotAllowedError";
}

/** A translator error, in words a member of staff can act on. */
export function translatorErrorMessage(e: unknown, label: string): string {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotSupportedError") return `This browser can't translate into ${label}.`;
  if (name === "NotAllowedError") return `${label} needs a one-off download on this computer.`;
  if (name === "AbortError") return "Skipped.";
  if (name === "QuotaExceededError") return "Too much text for the on-device translator.";
  return e instanceof Error && e.message ? e.message : `Couldn't translate into ${label}.`;
}

/** Range names the server also protects in their normal casing (validate.ts GLOSSARY). */
const BRANDS = ["Cyclone", "Endure", "Flexiheat", "Lumin", "Powernet"];

/**
 * Shouted English the server lets a translation translate (validate.ts
 * SHOUTED_WORDS) — ⚠️ never restored, or French "air" would become "AIR".
 */
const SHOUTED = new Set([
  "PRODUCT", "CODE", "FREE", "VERSION", "THE", "LIGHTS", "TRANSFORMER",
  "CONNECTION", "OPTIONS", "AIR", "FLOW", "AIRFLOW", "SET", "AND", "FOR", "WITH",
]);

/**
 * Put back the English casing of protected words the translator merely
 * RE-CASED. Measured: Chrome turns "SA FLEXIHEAT" into "SA FlexiHeat", and
 * the server rightly refuses a translation that changed a mark or brand — so
 * without this nearly every description (they all name a range in capitals)
 * would be kept in English. Only a case-insensitive whole-word match is
 * restored: a word the translator actually translated stays missing, and the
 * server still refuses it. Applied outside tags only.
 */
export function restoreMarks(source: string, translated: string): string {
  const text = source.replace(/<[^>]*>/g, " ");
  const marks = new Set([
    // Three characters or more, as the server checks: "SA" would otherwise
    // capitalise French "sa".
    ...(text.match(/\b[A-Za-z0-9]*[A-Z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*\b/g) ?? []).filter((t) => t.length >= 3 && !SHOUTED.has(t)),
    ...BRANDS.filter((b) => new RegExp(`\\b${b}\\b`).test(text)),
  ]);
  return translated
    .split(/(<[^>]*>)/)
    .map((part) => {
      if (part.startsWith("<")) return part;
      let out = part;
      // A hit that is already one of the protected forms is left alone: a
      // description can say both "SA CYCLONE" and "Cyclone".
      for (const m of marks) {
        out = out.replace(new RegExp(`\\b${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), (hit) => (marks.has(hit) ? hit : m));
      }
      return out;
    })
    .join("");
}

/**
 * Protected terms → placeholders the translator leaves alone, and back.
 *
 * Measured on Chrome 154: it TRANSLATES range names when they read as words
 * (Chinese "SA CYCLONE" → "SA 旋风", Arabic "SA Endure" → "SA يتحمل"),
 * re-cases marks, and writes "99.98" as "99,98" — each a translation the
 * server refuses, leaving that text in English. It does not honour
 * translate="no" either (it translated inside the span and mangled the
 * attribute). Code-like placeholders such as "X1Q", though, came back
 * untouched in all six languages, so every mark, code, brand and decimal is
 * swapped out before translating and swapped back after.
 */
const PROTECTED =
  /\b(?:[A-Za-z0-9]*[A-Z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*|Cyclone|Endure|Flexiheat|Lumin|Powernet)\b|\d+(?:[.,]\d+)+/g;

export function maskTerms(text: string): { masked: string; terms: string[] } {
  const terms: string[] = [];
  // Text that already contains something placeholder-shaped is sent as it is.
  if (/X\d+Q/i.test(text)) return { masked: text, terms };
  const masked = text
    .split(/(<[^>]*>)/)
    .map((part) =>
      part.startsWith("<")
        ? part
        : part.replace(PROTECTED, (m) => {
            // "SA" and shouted English are words to translate, as the server allows.
            if (/^[A-Za-z]/.test(m) && (m.length < 3 || SHOUTED.has(m))) return m;
            terms.push(m);
            return `X${terms.length}Q`;
          }),
    )
    .join("");
  return { masked, terms };
}

export function unmaskTerms(text: string, terms: string[]): string {
  // Case-insensitive: Portuguese and Spanish sometimes come back with "x1q".
  return terms.length ? text.replace(/X(\d+)Q/gi, (m, n) => terms[Number(n) - 1] ?? m) : text;
}

/** A translate function that protects terms on the way through. */
export function protectTerms(tr: (s: string) => Promise<string>): (s: string) => Promise<string> {
  return async (s) => {
    const { masked, terms } = maskTerms(s);
    return unmaskTerms(await tr(masked), terms);
  };
}

/** Leading/trailing whitespace kept as it was; the words in between translated. */
async function translateKeepingSpace(text: string, tr: (s: string) => Promise<string>): Promise<string> {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
  if (!/\p{L}/u.test(m[2])) return text; // nothing to translate: numbers, punctuation
  return m[1] + (await tr(m[2])) + m[3];
}

/** Blocks translated as a unit, so each sentence keeps its context. */
const BLOCKS = new Set(["P", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "TD", "TH", "DT", "DD", "BLOCKQUOTE", "FIGCAPTION", "CAPTION"]);

function descendants(el: Element | DocumentFragment): Element[] {
  return Array.from(el.querySelectorAll("*"));
}

/**
 * Translate one block that holds inline markup (bold, a link) as a WHOLE, so
 * the sentence keeps its grammar — Chrome's translator accepts HTML and keeps
 * simple tags. ⚠️ Attributes are stripped before sending and put back after,
 * by element order: measured, it rewrote href="/product/x" as
 * href="/ product/x". Returns false — leaving the block untouched — if the
 * translator changed which elements there are, so the caller can fall back.
 */
async function translateBlockWhole(block: Element, tr: (s: string) => Promise<string>): Promise<boolean> {
  const bare = block.cloneNode(true) as Element;
  for (const el of descendants(bare)) for (const a of Array.from(el.attributes)) el.removeAttribute(a.name);
  const out = document.createElement("template");
  // Entities as plain characters: measured, Chrome turns "&amp;" into a
  // visible "& amp;". A bare "&" parses back as text.
  const sent = bare.innerHTML.replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
  out.innerHTML = (await tr(sent)).replace(/&\s+amp;/g, "&");
  const src = descendants(block);
  const got = descendants(out.content);
  if (src.length !== got.length || src.some((el, i) => el.tagName !== got[i].tagName)) return false;
  src.forEach((el, i) => {
    // Exactly the English's attributes: none the translator invented survive.
    for (const a of Array.from(got[i].attributes)) got[i].removeAttribute(a.name);
    for (const a of Array.from(el.attributes)) got[i].setAttribute(a.name, a.value);
    // " cart " inside a link underlines the spaces; keep the English's edges.
    const first = got[i].firstChild;
    const last = got[i].lastChild;
    if (first?.nodeType === Node.TEXT_NODE && !/^\s/.test(el.textContent ?? "")) first.textContent = first.textContent!.trimStart();
    if (last?.nodeType === Node.TEXT_NODE && !/\s$/.test(el.textContent ?? "")) last.textContent = last.textContent!.trimEnd();
  });
  block.replaceChildren(...Array.from(out.content.childNodes));
  return true;
}

/**
 * Translate a description without changing its markup.
 *
 * The server rejects a translation whose tags or links differ from the
 * English, so only TEXT may change. The HTML is parsed inside an inert
 * <template> (nothing loads, no script runs), then each block is translated:
 * a plain one as its text; one with inline markup as a whole, with its tags
 * checked and its attributes restored (translateBlockWhole); and if the
 * translator altered the tags, text node by text node — every tag stays put,
 * at some cost to grammar, which staff can polish on the Translations page.
 */
export async function translateHtml(html: string, tr: (s: string) => Promise<string>): Promise<string> {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const jobs: Array<() => Promise<void>> = [];
  const textNodes = (node: Node, into = jobs) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node as Text;
      into.push(async () => {
        t.data = await translateKeepingSpace(t.data, tr);
      });
    } else if (node.nodeType === Node.ELEMENT_NODE && !["SCRIPT", "STYLE"].includes((node as Element).tagName)) {
      node.childNodes.forEach((c) => textNodes(c, into));
    }
  };
  const visit = (node: Node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return textNodes(node);
    const el = node as Element;
    if (el.tagName === "SCRIPT" || el.tagName === "STYLE") return;
    const isBlock = BLOCKS.has(el.tagName) && !Array.from(el.children).some((c) => BLOCKS.has(c.tagName) || c.tagName === "UL" || c.tagName === "OL");
    if (isBlock && el.children.length === 0) {
      jobs.push(async () => {
        el.textContent = await translateKeepingSpace(el.textContent ?? "", tr);
      });
    } else if (isBlock && /\p{L}/u.test(el.textContent ?? "")) {
      jobs.push(async () => {
        if (await translateBlockWhole(el, tr)) return;
        const fallback: Array<() => Promise<void>> = [];
        el.childNodes.forEach((c) => textNodes(c, fallback));
        for (const job of fallback) await job();
      });
    } else {
      el.childNodes.forEach(visit);
    }
  };
  tpl.content.childNodes.forEach(visit);
  // One at a time: the on-device model processes requests sequentially anyway.
  for (const job of jobs) await job();
  return tpl.innerHTML;
}
