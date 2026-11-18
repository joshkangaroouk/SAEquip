/**
 * The Activity page shows ONE row per save (Josh, 2026-11-18): a product save
 * writes a row per request it makes (the details, each logo switched, each
 * language's machine translations), all sharing an `X-Activity-Batch` id.
 * This folds such a group into one line. Pure, so it is tested without a
 * database (activity:test).
 *
 * The rows themselves are untouched (the log is append-only): grouping happens
 * when it is read.
 */

export type GroupMember = {
  id: string;
  at: Date;
  category: string;
  action: string;
  outcome: string;
  summary: string;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  details: unknown;
};

const LANGUAGES: Record<string, string> = {
  ar: "Arabic",
  zh: "Chinese",
  fr: "French",
  de: "German",
  "pt-br": "Portuguese",
  es: "Spanish",
};

/** A machine translation batch (translate-on-save, "Translate missing"). */
export function isMachineTranslation(m: Pick<GroupMember, "action" | "details">): boolean {
  if (m.action !== "translation.save") return false;
  const d = m.details as { origin?: unknown } | null;
  return d?.origin === "MT";
}

function translationCounts(m: GroupMember): { locale: string; saved: number; kept: number } {
  const d = (m.details ?? {}) as { locale?: unknown; counts?: Record<string, unknown> };
  const n = (k: string) => (typeof d.counts?.[k] === "number" ? (d.counts[k] as number) : 0);
  return { locale: typeof d.locale === "string" ? d.locale : "", saved: n("saved"), kept: n("rejected") };
}

const RANK: Record<string, number> = { ok: 0, partial: 1, failed: 2, refused: 3 };

/**
 * The group's one line, its outcome and the member that represents it (whose
 * time, target, who and where the row shows).
 *
 * - The representative is the first member that is not a machine translation:
 *   the save itself, not one of its side effects.
 * - Several rows of the same action fold into one part: "Switched a logo on (3)".
 * - Machine translations fold into "translated into 5 languages", naming any
 *   language whose strings were kept in English.
 * - ⚠️ A machine translation the safety check refused is NOT a failure (the
 *   English is shown, by design), so translation rows never set the outcome
 *   while the save itself is there. Before 2026-11-18 such a row was stored
 *   as "failed", and this keeps those rows from flagging their save.
 */
export function summariseGroup(
  members: GroupMember[],
  actionLabel: (action: string) => string,
): { representative: GroupMember; summary: string; outcome: string } {
  const sorted = [...members].sort((a, b) => a.at.getTime() - b.at.getTime());
  const machine = sorted.filter(isMachineTranslation);
  const own = sorted.filter((m) => !isMachineTranslation(m));
  const representative = own[0] ?? sorted[0];
  if (sorted.length === 1) return { representative, summary: representative.summary, outcome: representative.outcome };

  // The save's own changes, same-action rows folded together, in the order made.
  const byAction = new Map<string, GroupMember[]>();
  for (const m of own) byAction.set(m.action, [...(byAction.get(m.action) ?? []), m]);
  const parts = [...byAction.entries()].map(([action, rows]) => (rows.length === 1 ? rows[0].summary : `${actionLabel(action)} (${rows.length})`));

  // Its machine translations, as languages.
  let translated: string | null = null;
  if (machine.length) {
    const perLocale = new Map<string, { saved: number; kept: number }>();
    for (const m of machine) {
      const c = translationCounts(m);
      const prev = perLocale.get(c.locale) ?? { saved: 0, kept: 0 };
      perLocale.set(c.locale, { saved: prev.saved + c.saved, kept: prev.kept + c.kept });
    }
    const savedIn = [...perLocale.values()].filter((v) => v.saved > 0).length;
    const keptIn = [...perLocale.entries()].filter(([, v]) => v.kept > 0).map(([l]) => LANGUAGES[l] ?? l);
    const strings = [...perLocale.values()].reduce((n, v) => n + v.saved, 0);
    const base = own.length
      ? savedIn
        ? `translated into ${savedIn} ${savedIn === 1 ? "language" : "languages"}`
        : "no new translations"
      : `Saved ${strings} machine ${strings === 1 ? "translation" : "translations"} in ${savedIn} ${savedIn === 1 ? "language" : "languages"}`;
    translated = keptIn.length ? `${base} (${keptIn.join(", ")} kept in English)` : base;
  }

  const summary = [...parts, translated].filter(Boolean).join(" · ");
  const counted = own.length ? own : sorted;
  const worst = counted.reduce((w, m) => ((RANK[m.outcome] ?? 0) > (RANK[w] ?? 0) ? m.outcome : w), "ok");
  // Some changes landed and some did not: that is partly done, not failed.
  const outcome = worst !== "ok" && counted.some((m) => m.outcome === "ok") ? "partial" : worst;
  return { representative, summary: summary || representative.summary, outcome };
}
