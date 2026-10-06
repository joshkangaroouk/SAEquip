import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Languages, RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Modal,
  Pagination,
  SelectMenu,
  Skeleton,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Textarea,
  toast,
} from "../components/ui";
import { RichHtml } from "../components/RichHtml";
import { TranslationProgressModal } from "../components/TranslationProgressModal";
import { apiJson } from "../lib/api";
import { csvUnguard, downloadCsv, parseCsv } from "../lib/csv";
import { TARGETS, startTranslators, targetLabel, type TargetLocale, type TranslatorSet } from "../lib/translator";
import {
  fetchSources,
  saveBatch,
  translateMissing,
  type LangProgress,
  type SaveResult,
  type SourceItem,
  type SourcesResponse,
  type TranslationKind,
  type TranslationStatus,
} from "../lib/translations";

const PAGE_SIZE = 50;

const KIND_LABEL: Record<TranslationKind, string> = {
  DESCRIPTION: "Description",
  SPEC_LABEL: "Spec label",
  SPEC_VALUE: "Spec value",
  LIST_ITEM: "Benefit / application",
  LOGO_TEXT: "Logo text",
};

const STATUS_LABEL: Record<TranslationStatus, string> = {
  missing: "Missing",
  machine: "Machine",
  staff: "Edited",
  rejected: "Kept in English",
};

function StatusBadge({ status }: { status: TranslationStatus }) {
  const tone = status === "staff" ? "success" : status === "rejected" ? "danger" : status === "missing" ? "accent" : "neutral";
  return <Badge tone={tone}>{STATUS_LABEL[status]}</Badge>;
}

/** Text without markup, for the table and search — descriptions are HTML. */
function plain(s: string): string {
  const el = document.createElement("template");
  el.innerHTML = s;
  return (el.content.textContent ?? "").replace(/\s+/g, " ").trim();
}

const isRtl = (locale: string) => TARGETS.some((t) => t.locale === locale && t.rtl);

/** "EX Heater", "EX Heater +3". */
function usedOn(item: SourceItem, products: Record<string, string>): string {
  if (!item.productIds.length) return item.kind === "LOGO_TEXT" ? "Logo catalogue" : "";
  const first = products[item.productIds[0]] ?? "a product";
  return item.productIds.length > 1 ? `${first} +${item.productIds.length - 1}` : first;
}

/* ------------------------------------------------------------------ edit */

function EditTranslation({
  item,
  locale,
  products,
  onClose,
  onSaved,
}: {
  item: SourceItem;
  locale: TargetLocale;
  products: Record<string, string>;
  onClose: () => void;
  onSaved: (text: string) => void;
}) {
  const [text, setText] = useState(item.text ?? "");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const html = item.kind === "DESCRIPTION";
  const rtl = isRtl(locale);

  async function save() {
    setSaving(true);
    setProblem(null);
    try {
      const [r] = await saveBatch(locale, "STAFF", [{ kind: item.kind, sourceText: item.sourceText, text }]);
      if (r?.status === "rejected") setProblem(r.reason ?? "The translation failed the safety check.");
      else onSaved(text.trim());
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissable={!saving}
      size="lg"
      title={`${KIND_LABEL[item.kind]} - ${targetLabel(locale)}`}
      description={
        item.productIds.length ? (
          <>
            Used on{" "}
            {item.productIds.slice(0, 3).map((id, i) => (
              <span key={id}>
                {i > 0 && ", "}
                <Link to={`/products/${id}`} className="underline underline-offset-2 hover:text-text">
                  {products[id] ?? "a product"}
                </Link>
              </span>
            ))}
            {item.productIds.length > 3 && ` and ${item.productIds.length - 3} more`}. A correction applies everywhere this English appears.
          </>
        ) : (
          "A correction applies everywhere this English appears."
        )
      }
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void save()} loading={saving} disabled={!text.trim()}>
            Save translation
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">English</div>
          {html ? (
            <div className="max-h-48 overflow-auto rounded-md border border-border bg-surface-2 p-3">
              <RichHtml html={item.sourceText} />
            </div>
          ) : (
            <p className="rounded-md border border-border bg-surface-2 px-3 py-2 text-body text-text">{item.sourceText}</p>
          )}
        </div>

        {item.status === "rejected" && item.lastError && (
          <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-small text-danger">
            The machine translation was kept in English: {item.lastError}.
          </p>
        )}

        <div>
          <label htmlFor="translation-text" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-subtle">
            {targetLabel(locale)}
            {html && <span className="ml-2 font-normal normal-case tracking-normal">HTML - keep every tag and link as it is</span>}
          </label>
          <Textarea
            id="translation-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={html ? 10 : 3}
            lang={locale}
            // HTML source reads left to right, like code; the preview below is the real direction.
            dir={rtl && !html ? "rtl" : "ltr"}
            className={html ? "font-mono text-small" : undefined}
          />
          {html && text.trim() && (
            <div className="mt-2 max-h-48 overflow-auto rounded-md border border-border p-3" lang={locale} dir={rtl ? "rtl" : "ltr"}>
              <RichHtml html={text} />
            </div>
          )}
        </div>

        <p className="text-small text-muted">
          Numbers, certification marks (ATEX, IECEx, UKEX…), product codes and links must stay exactly as in the English,
          or the translation is refused - that is what keeps a rating from changing in translation.
        </p>
        {problem && (
          <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-small text-danger">
            Not saved: {problem}.
          </p>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------- names from Duda */

interface DudaName {
  entity: "PRODUCT" | "CATEGORY";
  dudaId: string;
  english: string;
  text: string | null;
  stale: boolean;
  fetchedAt: string | null;
}

function DudaNames({ locale }: { locale: TargetLocale }) {
  const [items, setItems] = useState<DudaName[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const rtl = isRtl(locale);

  const load = useCallback(() => {
    setItems(null);
    setError(null);
    apiJson<{ items: DudaName[] }>(`/api/translations/duda?locale=${locale}`)
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [locale]);
  useEffect(load, [load]);

  /**
   * Re-copy EVERY language on the Duda site, one request each (a language
   * takes ~15s, inside the function's time limit; all of them would not be).
   * ⚠️ All of them, not just the tab on screen: it refreshed only the selected
   * language, and the first live use refreshed Chinese while expecting French.
   */
  async function refreshAll() {
    type Report = { locale: string; products: { total: number; translated: number }; categories: { total: number; translated: number } };
    const done: Report[] = [];
    try {
      setRefreshing("…");
      let next: string[] | null = null;
      let first = true;
      while (first || (next && next.length)) {
        const target: string | undefined = first ? undefined : next!.shift();
        if (target) setRefreshing(targetLabel(target));
        const r: { report: Report; remaining: string[] } = await apiJson("/api/translations/duda/refresh", {
          method: "POST",
          body: JSON.stringify(target ? { locale: target } : {}),
        });
        done.push(r.report);
        if (first) next = r.remaining;
        first = false;
      }
      toast.success(`Copied names from Duda for ${done.length} ${done.length === 1 ? "language" : "languages"}`, {
        description: done
          .map((r) => `${targetLabel(r.locale)}: ${r.products.translated}/${r.products.total} products, ${r.categories.translated}/${r.categories.total} categories`)
          .join(" · "),
        duration: 12_000,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed", {
        description: done.length ? `Finished before it stopped: ${done.map((r) => targetLabel(r.locale)).join(", ")}.` : undefined,
      });
    } finally {
      setRefreshing(null);
      load();
    }
  }

  const missing = items?.filter((i) => !i.text).length ?? 0;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-small text-muted">
          Product names and category titles are translated in Duda (the site's language settings), and copied here so the
          widgets' cards and lists say exactly what Duda's own pages say. After adding a language or changing a name in
          Duda, republish the site and press Refresh.
        </p>
        <Button variant="secondary" size="sm" onClick={() => void refreshAll()} loading={refreshing !== null}>
          <RefreshCw size={16} aria-hidden="true" />
          {refreshing && refreshing !== "…" ? `Copying ${refreshing}…` : "Refresh all languages from Duda"}
        </Button>
      </div>
      {error && <div className="mt-6 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}
      {!items && !error && (
        <div className="mt-6" aria-busy="true" aria-label="Loading names">
          <Skeleton className="h-64 w-full" />
        </div>
      )}
      {items && (
        <>
          {missing > 0 && (
            <p className="mt-4 text-small text-muted">
              {missing === items.length
                ? `Nothing copied for ${targetLabel(locale)} yet. Add the language to the Duda site, wait for Duda to translate it, then press Refresh.`
                : `${missing} still in English in Duda, so they show in English here too. Translate them in Duda, republish, then press Refresh.`}
            </p>
          )}
          <div className="mt-4">
            <Table>
              <THead>
                <TR>
                  <TH>Type</TH>
                  <TH>English</TH>
                  <TH>{targetLabel(locale)}</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((n) => (
                  <TR key={`${n.entity}:${n.dudaId}`}>
                    <TD className="whitespace-nowrap text-small text-muted">{n.entity === "PRODUCT" ? "Product" : "Category"}</TD>
                    <TD>{n.english}</TD>
                    <TD lang={locale} dir={rtl ? "rtl" : "ltr"}>
                      {n.text ?? <span className="text-subtle">-</span>}
                      {n.stale && (
                        <Badge tone="neutral" className="ms-2">
                          English changed since
                        </Badge>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ page */

/**
 * Translations — every piece of Hub content in each of the website's other
 * languages. See "Languages" in CLAUDE.md.
 *
 * Machine translations come from the one-off mass translation and from
 * Chrome's translator when staff save. A correction made here is a STAFF
 * translation, which no machine translation ever replaces.
 */
export default function Translations() {
  const [params, setParams] = useSearchParams();
  const locale = (TARGETS.find((t) => t.locale === params.get("lang"))?.locale ?? "ar") as TargetLocale;
  const tab = params.get("tab") === "names" ? "names" : "content";
  const setParam = (key: string, value: string | null) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  const [data, setData] = useState<SourcesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<"" | TranslationKind>("");
  const [status, setStatus] = useState<"" | TranslationStatus>("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<SourceItem | null>(null);
  const [progress, setProgress] = useState<LangProgress[] | null>(null);
  const translators = useRef<TranslatorSet | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setError(null);
    fetchSources(locale)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load translations"));
  }, [locale]);
  useEffect(() => {
    setData(null);
    load();
  }, [load]);
  useEffect(() => setPage(1), [locale, kind, status, query]);

  const items = data?.items ?? [];
  const products = data?.products ?? {};
  const counts = useMemo(() => {
    const c: Record<TranslationStatus, number> = { missing: 0, machine: 0, staff: 0, rejected: 0 };
    for (const i of items) c[i.status]++;
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (kind && i.kind !== kind) return false;
      if (status && i.status !== status) return false;
      if (!q) return true;
      return (
        i.sourceText.toLowerCase().includes(q) ||
        (i.text ?? "").toLowerCase().includes(q) ||
        i.productIds.some((id) => (products[id] ?? "").toLowerCase().includes(q))
      );
    });
  }, [items, kind, status, query, products]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rtl = isRtl(locale);

  /** ⚠️ Synchronous up to startTranslators(): it needs this click's user activation. */
  function translateNow() {
    const set = startTranslators([locale]);
    if (!set) {
      toast.warning("This browser has no built-in translator.", {
        description: "Use Chrome or Edge on a computer, or edit the translations by hand.",
      });
      return;
    }
    translators.current = set;
    void translateMissing({ translators: set, onProgress: setProgress }).then((summary) => {
      set.close();
      translators.current = null;
      setProgress(null);
      const p = summary.progress[0];
      if (p?.phase === "failed" && p.error !== "Skipped.") toast.error(p.error ?? "Translation failed");
      else if (p) {
        toast.success(`${p.saved} translated into ${p.label}${p.rejected ? ` - ${p.rejected} kept in English` : ""}`);
      }
      load();
    });
  }

  function exportCsv() {
    const header = ["Language", "Type", "Key", "Status", "Used on", "English", "Translation"];
    const rows = filtered.map((i) => [
      locale,
      KIND_LABEL[i.kind],
      `${i.kind}:${i.sourceHash}`,
      STATUS_LABEL[i.status],
      i.productIds.map((id) => products[id] ?? id).join("; "),
      i.sourceText,
      i.text ?? "",
    ]);
    downloadCsv(`translations-${locale}-${new Date().toISOString().slice(0, 10)}.csv`, header, rows);
  }

  /**
   * Import a CSV exported above and edited by a person. Only the Key and
   * Translation columns are read: the English always comes from the Hub, so a
   * row can only ever attach to the text it was made for. Rows whose
   * translation did not change are skipped — re-importing an untouched export
   * must not turn every machine translation into a "staff" one.
   */
  async function importCsv(file: File) {
    const rows = parseCsv(await file.text());
    const header = rows.shift()?.map((h) => h.trim().toLowerCase()) ?? [];
    const col = (name: string) => header.indexOf(name);
    const [cLang, cKey, cText] = [col("language"), col("key"), col("translation")];
    if (cKey < 0 || cText < 0) {
      toast.error("That file has no Key and Translation columns. Start from Export CSV.");
      return;
    }
    const byKey = new Map(items.map((i) => [`${i.kind}:${i.sourceHash}`, i]));
    let otherLanguage = 0;
    let unknown = 0;
    const changes: { kind: TranslationKind; sourceText: string; text: string }[] = [];
    for (const r of rows) {
      if (cLang >= 0 && r[cLang]?.trim() && r[cLang].trim() !== locale) {
        otherLanguage++;
        continue;
      }
      const item = byKey.get(csvUnguard(r[cKey] ?? "").trim());
      const text = csvUnguard(r[cText] ?? "").trim();
      if (!item) {
        unknown++;
        continue;
      }
      if (text && text !== (item.text ?? "")) changes.push({ kind: item.kind, sourceText: item.sourceText, text });
    }
    if (!changes.length) {
      toast.message("Nothing to import - no translation in that file differs from what is saved.", {
        description: [
          otherLanguage && `${otherLanguage} rows are for another language - switch to it to import them.`,
          unknown && `${unknown} rows are for English that has since changed.`,
        ]
          .filter(Boolean)
          .join(" "),
      });
      return;
    }
    try {
      const results: SaveResult[] = await saveBatch(locale, "STAFF", changes);
      const saved = results.filter((r) => r.status === "saved").length;
      const refused = results.filter((r) => r.status === "rejected");
      toast.success(`Imported ${saved} ${targetLabel(locale)} translations`, {
        description: [
          refused.length && `${refused.length} refused (${refused[0].reason}${refused.length > 1 ? "…" : ""}) - fix those here.`,
          otherLanguage && `${otherLanguage} rows for another language were skipped.`,
          unknown && `${unknown} rows for changed English were skipped.`,
        ]
          .filter(Boolean)
          .join(" "),
        duration: 10_000,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    }
    load();
  }

  const head = (
    <THead>
      <TR>
        <TH className="w-36">Type</TH>
        <TH>English</TH>
        <TH>{targetLabel(locale)}</TH>
        <TH className="w-36">Status</TH>
      </TR>
    </THead>
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-text">
          <Languages size={22} className="text-accent" aria-hidden="true" />
          Translations
        </h1>
        {tab === "content" && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!filtered.length}>
              Export CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()} disabled={!data}>
              Import CSV
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void importCsv(f);
              }}
            />
            <Button size="sm" onClick={translateNow} disabled={!data || counts.missing === 0}>
              Translate missing ({counts.missing})
            </Button>
          </div>
        )}
      </div>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Product content in the website's other languages. Anything missing or kept in English shows in English on that
        language's pages. Machine translations are checked automatically; a correction made here is never overwritten.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {TARGETS.map((t) => (
          <button
            key={t.locale}
            onClick={() => setParam("lang", t.locale)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              locale === t.locale ? "bg-accent text-accent-foreground" : "border border-border text-muted hover:bg-surface-2"
            }`}
            aria-pressed={locale === t.locale}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex gap-4 border-b border-border text-sm" role="tablist">
        {(
          [
            ["content", "Product content"],
            ["names", "Names from Duda"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setParam("tab", key === "content" ? null : key)}
            className={`-mb-px border-b-2 px-1 pb-2 font-semibold ${
              tab === key ? "border-accent text-text" : "border-transparent text-muted hover:text-text"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "names" ? (
          <DudaNames locale={locale} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-72">
                <Input
                  size="xs"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search text or product…"
                  aria-label="Search translations"
                />
              </div>
              <SelectMenu
                className="min-w-0 flex-1 sm:w-52 sm:flex-none"
                ariaLabel="Filter by type"
                value={kind}
                onChange={(v) => setKind(v as "" | TranslationKind)}
                options={[
                  { value: "", label: "All types" },
                  ...(Object.keys(KIND_LABEL) as TranslationKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] })),
                ]}
              />
              <SelectMenu
                className="min-w-0 flex-1 sm:w-52 sm:flex-none"
                ariaLabel="Filter by status"
                value={status}
                onChange={(v) => setStatus(v as "" | TranslationStatus)}
                options={[
                  { value: "", label: `All statuses (${items.length})` },
                  ...(Object.keys(STATUS_LABEL) as TranslationStatus[]).map((s) => ({
                    value: s,
                    label: `${STATUS_LABEL[s]} (${counts[s]})`,
                  })),
                ]}
              />
            </div>

            {error && (
              <div className="mt-6 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
            )}
            {!data && !error && (
              <div className="mt-4" aria-busy="true" aria-live="polite" aria-label="Loading translations">
                <Table>
                  {head}
                  <TBody>
                    {Array.from({ length: 8 }, (_, i) => (
                      <TR key={i}>
                        <TD>
                          <Skeleton className="h-4 w-24" />
                        </TD>
                        <TD>
                          <Skeleton className="h-4 w-64" />
                        </TD>
                        <TD>
                          <Skeleton className="h-4 w-64" />
                        </TD>
                        <TD>
                          <Skeleton className="h-4 w-20" />
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
            {data && filtered.length === 0 && (
              <EmptyState
                className="mt-8"
                title={items.length ? "Nothing matches" : "No content to translate"}
                description={items.length ? "Try another filter or search." : undefined}
              />
            )}
            {data && filtered.length > 0 && (
              <div className="mt-4">
                <Table>
                  {head}
                  <TBody>
                    {shown.map((i) => (
                      <TR key={`${i.kind}:${i.sourceHash}`} hover onClick={() => setEditing(i)}>
                        <TD className="align-top text-small text-muted">
                          {KIND_LABEL[i.kind]}
                          <div className="mt-0.5 truncate text-xs text-subtle" title={usedOn(i, products)}>
                            {usedOn(i, products)}
                          </div>
                        </TD>
                        <TD className="align-top">
                          <span className="line-clamp-2">{i.kind === "DESCRIPTION" ? plain(i.sourceText) : i.sourceText}</span>
                        </TD>
                        <TD className="align-top" lang={locale} dir={rtl ? "rtl" : "ltr"}>
                          {i.text ? (
                            <span className="line-clamp-2">{i.kind === "DESCRIPTION" ? plain(i.text) : i.text}</span>
                          ) : (
                            <span className="text-subtle">Shown in English</span>
                          )}
                        </TD>
                        <TD className="align-top">
                          <StatusBadge status={i.status} />
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
                <Pagination page={page} pageCount={pageCount} total={filtered.length} onChange={setPage} label="strings" />
              </div>
            )}
          </>
        )}
      </div>

      {editing && (
        <EditTranslation
          item={editing}
          locale={locale}
          products={products}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setData((d) =>
              d && {
                ...d,
                items: d.items.map((x) =>
                  x.kind === editing.kind && x.sourceHash === editing.sourceHash
                    ? { ...x, text, origin: "STAFF", status: "staff", lastError: null }
                    : x,
                ),
              },
            );
            setEditing(null);
            toast.success("Translation saved");
          }}
        />
      )}
      <TranslationProgressModal
        progress={progress}
        onSkip={() => translators.current?.close()}
        onDownload={(l) => translators.current?.retry(l)}
        title="Translating missing content…"
      />
    </>
  );
}
