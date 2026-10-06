import { apiJson } from "./api";
import {
  needsActivation,
  protectTerms,
  restoreMarks,
  targetLabel,
  translateHtml,
  translatorErrorMessage,
  type TargetLocale,
  type TranslatorSet,
} from "./translator";

/**
 * The Translations API and the one routine that translates what is missing and
 * saves it — shared by the product editor's save and the Translations page, so
 * the two cannot drift. See "Languages" in CLAUDE.md.
 */

export type TranslationKind = "DESCRIPTION" | "SPEC_LABEL" | "SPEC_VALUE" | "LIST_ITEM" | "LOGO_TEXT";
export type TranslationStatus = "missing" | "machine" | "staff" | "rejected";

export interface SourceItem {
  kind: TranslationKind;
  sourceText: string;
  sourceHash: string;
  productIds: string[];
  text: string | null;
  origin: "MT" | "STAFF" | null;
  status: TranslationStatus;
  lastError: string | null;
}

export interface SourcesResponse {
  locale: string;
  products: Record<string, string>;
  items: SourceItem[];
}

export interface SaveResult {
  sourceHash: string;
  status: "saved" | "kept-staff" | "rejected" | "pass-through" | "unchanged";
  reason?: string;
}

export function fetchSources(locale: string, productId?: string): Promise<SourcesResponse> {
  const q = new URLSearchParams({ locale });
  if (productId) q.set("productId", productId);
  return apiJson<SourcesResponse>(`/api/translations/sources?${q}`);
}

/**
 * Save through PUT /api/translations/batch, in chunks: the API's JSON body
 * limit is 100KB, and a page of Arabic descriptions can pass that.
 */
export async function saveBatch(
  locale: string,
  origin: "MT" | "STAFF",
  items: { kind: TranslationKind; sourceText: string; text: string }[],
  engine?: string,
): Promise<SaveResult[]> {
  const out: SaveResult[] = [];
  let chunk: typeof items = [];
  let size = 0;
  const flush = async () => {
    if (!chunk.length) return;
    const res = await apiJson<{ results: SaveResult[] }>("/api/translations/batch", {
      method: "PUT",
      body: JSON.stringify({ locale, origin, engine, items: chunk }),
    });
    out.push(...res.results);
    chunk = [];
    size = 0;
  };
  for (const item of items) {
    const n = item.sourceText.length + item.text.length * 2 + 80; // UTF-8 headroom for non-Latin text
    if (chunk.length && (size + n > 60_000 || chunk.length >= 100)) await flush();
    chunk.push(item);
    size += n;
  }
  await flush();
  return out;
}

/** "needs-click": Chrome wants a click before downloading this language (see translator.ts). */
export type LangPhase = "waiting" | "needs-click" | "downloading" | "translating" | "saving" | "done" | "failed";

export interface LangProgress {
  locale: TargetLocale;
  label: string;
  phase: LangPhase;
  /** Language-pack download, 0..1, while `phase` is "downloading". */
  downloaded: number;
  done: number;
  total: number;
  saved: number;
  /** Kept in English by the server's checks (a number or mark changed). */
  rejected: number;
  error?: string;
}

export interface TranslateSummary {
  progress: LangProgress[];
  skipped: boolean;
}

/**
 * Translate, with `translators`, every MISSING string in each language — for
 * one product (the editor's save) or the whole site (the Translations page) —
 * and save the results as machine translations. `pick` narrows which items to
 * do; by default every missing one.
 *
 * Languages run one after another (the model translates one request at a
 * time anyway), and a failure in one never stops the next. Never throws.
 */
export async function translateMissing(opts: {
  translators: TranslatorSet;
  productId?: string;
  pick?: (item: SourceItem) => boolean;
  onProgress: (progress: LangProgress[]) => void;
}): Promise<TranslateSummary> {
  const { translators, productId, onProgress } = opts;
  const pick = opts.pick ?? ((i: SourceItem) => i.status === "missing");
  const signal = translators.abort.signal;
  const progress: LangProgress[] = translators.locales.map((locale) => ({
    locale,
    label: targetLabel(locale),
    phase: "waiting",
    downloaded: translators.downloaded.get(locale) ?? 0,
    done: 0,
    total: 0,
    saved: 0,
    rejected: 0,
  }));
  const emit = () => onProgress(progress.map((p) => ({ ...p })));
  const update = (i: number, patch: Partial<LangProgress>) => {
    progress[i] = { ...progress[i], ...patch };
    emit();
  };
  translators.onDownload = (locale, fraction) => {
    const i = progress.findIndex((p) => p.locale === locale);
    if (i >= 0 && (progress[i].phase === "waiting" || progress[i].phase === "downloading")) {
      update(i, { phase: "downloading", downloaded: fraction });
    }
  };
  emit();

  for (let i = 0; i < progress.length; i++) {
    const { locale, label } = progress[i];
    if (signal.aborted) break;
    try {
      // Ask what is missing first: a language with nothing to do never waits
      // for its pack to download.
      const sources = await fetchSources(locale, productId);
      const todo = sources.items.filter(pick);
      update(i, { total: todo.length });
      if (!todo.length) {
        update(i, { phase: "done" });
        continue;
      }
      if (progress[i].phase === "waiting") update(i, { phase: translators.downloaded.has(locale) ? "downloading" : "waiting" });
      // Chrome downloads one language per click, so a second new language is
      // refused until someone presses its "Download" button — wait for that
      // (or a skip) rather than failing the language.
      let translator: Awaited<ReturnType<TranslatorSet["get"]>>;
      for (;;) {
        try {
          translator = await translators.get(locale);
          break;
        } catch (e) {
          if (!needsActivation(e) || signal.aborted) throw e;
          update(i, { phase: "needs-click" });
          await translators.whenRetried(locale);
          if (signal.aborted) throw e;
          update(i, { phase: "downloading", downloaded: 0 });
        }
      }
      update(i, { phase: "translating" });
      const tr = protectTerms((s: string) => translator.translate(s, { signal }));
      let pending: { kind: TranslationKind; sourceText: string; text: string }[] = [];
      let translated = 0;
      // Saved every 25, so closing the tab during a long run on the
      // Translations page loses at most a few strings, not the whole run.
      const flush = async () => {
        const saved = await saveBatch(locale, "MT", pending, "chrome");
        pending = [];
        update(i, {
          saved: progress[i].saved + saved.filter((r) => r.status === "saved" || r.status === "unchanged").length,
          rejected: progress[i].rejected + saved.filter((r) => r.status === "rejected").length,
        });
      };
      for (const item of todo) {
        if (signal.aborted) break;
        try {
          const raw = item.kind === "DESCRIPTION" ? await translateHtml(item.sourceText, tr) : await tr(item.sourceText);
          const text = restoreMarks(item.sourceText, raw);
          pending.push({ kind: item.kind, sourceText: item.sourceText, text });
          translated++;
        } catch (e) {
          if (signal.aborted) break;
          // One string the model chokes on must not lose the rest.
          console.warn(`translate ${locale}`, e);
        }
        update(i, { done: progress[i].done + 1 });
        if (pending.length >= 25) await flush();
      }
      update(i, { phase: "saving" });
      await flush();
      const cut = signal.aborted && translated < todo.length;
      update(i, { phase: cut ? "failed" : "done", error: cut ? "Skipped." : undefined });
    } catch (e) {
      update(i, { phase: "failed", error: signal.aborted ? "Skipped." : translatorErrorMessage(e, label) });
    }
  }
  // Anything not reached because of a skip.
  for (let i = 0; i < progress.length; i++) {
    if (["waiting", "downloading", "needs-click"].includes(progress[i].phase)) update(i, { phase: "failed", error: "Skipped." });
  }
  translators.onDownload = null;
  return { progress, skipped: signal.aborted };
}

/** "Arabic and French", for a toast. */
export function listLabels(locales: readonly string[]): string {
  const names = locales.map(targetLabel);
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

