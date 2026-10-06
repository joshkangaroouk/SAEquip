import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "../ui";
import { startTranslators, type TargetLocale, type TranslatorSet } from "../../lib/translator";
import { listLabels, translateMissing, type LangProgress } from "../../lib/translations";

/**
 * Translate-on-save, shared by every screen that saves translatable English —
 * the product editor and the New product page — so they cannot drift. See
 * "Languages" in CLAUDE.md.
 *
 *   const translate = useTranslateOnSave();
 *   // ⚠️ In the click, before any await (Chrome only downloads on a click):
 *   const session = wantsTranslation ? translate.begin() : undefined;
 *   …save…
 *   const note = await translate.finish(session, dudaProductId);
 *   <TranslationProgressModal progress={translate.progress} onSkip={translate.skip} onDownload={translate.download} />
 *
 * `undefined` means nothing translatable was saved; `null` (from begin()) means
 * this browser has no translator, which finish() reports.
 */
export function useTranslateOnSave() {
  const [progress, setProgress] = useState<LangProgress[] | null>(null);
  const current = useRef<TranslatorSet | null>(null);
  const navigate = useNavigate();

  /** ⚠️ Synchronous, inside the click. Null where the browser has no translator. */
  const begin = useCallback((): TranslatorSet | null => startTranslators(), []);

  /** The English was not saved after all: free the translators. */
  const cancel = useCallback((session: TranslatorSet | null | undefined) => session?.close(), []);

  /**
   * Translate what is now missing for the product, behind the progress dialog,
   * and report anything left in English. Returns the phrase to add to the
   * caller's success toast ("and translated into 6 languages"), or null.
   */
  const finish = useCallback(
    async (session: TranslatorSet | null | undefined, productId: string): Promise<string | null> => {
      if (session === undefined) return null;
      const openTranslations = { label: "Translations", onClick: () => navigate("/translations") };
      if (session === null) {
        toast.warning("Not translated yet: this browser has no built-in translator.", {
          description: "Save in Chrome or Edge on a computer, or translate from the Translations page.",
          action: openTranslations,
          duration: 10_000,
        });
        return null;
      }
      current.current = session;
      const summary = await translateMissing({ translators: session, productId, onProgress: setProgress });
      session.close();
      current.current = null;
      setProgress(null);
      const failed = summary.progress.filter((p) => p.phase === "failed");
      const rejected = summary.progress.reduce((n, p) => n + p.rejected, 0);
      const translated = summary.progress.filter((p) => p.phase === "done" && p.total > 0).length;
      if (failed.length) {
        toast.warning(
          summary.skipped
            ? `Translation skipped for ${listLabels(failed.map((p) => p.locale))}.`
            : `Not translated into ${listLabels(failed.map((p) => p.locale))}: ${failed[0].error ?? "the translator failed"}`,
          { description: "Those languages show the English until translated.", action: openTranslations, duration: 10_000 },
        );
      }
      if (rejected) {
        toast.warning(`${rejected} ${rejected === 1 ? "translation was" : "translations were"} kept in English`, {
          description: "The translator changed a number, certification mark or link. Check them on the Translations page.",
          action: openTranslations,
          duration: 10_000,
        });
      }
      return translated && !failed.length
        ? ` and translated into ${translated} ${translated === 1 ? "language" : "languages"}`
        : null;
    },
    [navigate],
  );

  /** "Skip for now". The English is already saved. */
  const skip = useCallback(() => current.current?.close(), []);
  /** A language's "Download" button — synchronous, so the click counts as Chrome's permission. */
  const download = useCallback((locale: TargetLocale) => current.current?.retry(locale), []);

  return { progress, begin, cancel, finish, skip, download };
}
