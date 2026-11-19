import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight, Download, Search, X } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Pagination,
  SegmentedControl,
  SelectMenu,
  Skeleton,
  SkeletonLine,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  toast,
} from "../components/ui";
import { DefinitionGrid, Detail } from "../components/enquiries";
import { useAuth } from "../auth/AuthContext";
import { ApiError, apiFetch, apiJson } from "../lib/api";
import { formatDateTimeSeconds, formatRelative } from "../lib/format";
import { describeDevice } from "../lib/userAgent";
import { useDebounced } from "../hooks/useDebounced";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { cn } from "../lib/cn";

/**
 * Activity (super admin only): everything done in the Hub, who did it, when
 * and from where. Backed by the activity log (backend services/activity.ts),
 * kept for two years and append-only in the database.
 *
 * Every filter lives in the address, so a link from elsewhere ("View
 * activity" on a user, "Activity" on a product) lands filtered, and so does
 * the back button.
 */

interface ActivityItem {
  id: string;
  at: string;
  source: "hub" | "browser" | "duda";
  actorId: string | null;
  actorEmail: string | null;
  category: string;
  action: string;
  outcome: "ok" | "partial" | "failed" | "refused";
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  summary: string;
  ip: string | null;
  country: string | null;
  city: string | null;
  batchId: string | null;
  status: number | null;
  /** How many rows this line stands for: a save's changes are one line (the server groups them). */
  batchCount: number;
}

/** One row of a save, as the detail lists them. */
interface SaveMember {
  id: string;
  at: string;
  category: string;
  action: string;
  outcome: ActivityItem["outcome"];
  summary: string;
  details: unknown;
  status: number | null;
}

interface ActivityDetail extends ActivityItem {
  details: unknown;
  userAgent: string | null;
  method: string | null;
  path: string | null;
  durationMs: number | null;
  sessionId: string | null;
  actorName: string | null;
  /** Every row of its save (empty when it stands alone), and the save's own line and outcome. */
  members: SaveMember[];
  groupSummary: string | null;
  groupOutcome: ActivityItem["outcome"] | null;
}

interface ActivityPage {
  items: ActivityItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

interface Facets {
  categories: { value: string; label: string; count: number }[];
  actions: { value: string; label: string; category: string; count: number }[];
  people: { id: string; email: string | null; name: string | null; count: number }[];
}

const PAGE_SIZE = 50;
const XL = "(min-width: 1280px)";

const RANGES = [
  { value: "24h", label: "Last 24 hours", hours: 24 },
  { value: "7d", label: "Last 7 days", hours: 24 * 7 },
  { value: "30d", label: "Last 30 days", hours: 24 * 30 },
  { value: "90d", label: "Last 90 days", hours: 24 * 90 },
  { value: "all", label: "All time", hours: 0 },
  { value: "custom", label: "Custom dates", hours: 0 },
] as const;

const OUTCOMES = [
  { value: "", label: "All" },
  { value: "ok", label: "Succeeded" },
  { value: "problem", label: "Failed or refused" },
] as const;

/** The filters, as the address holds them. */
const FILTER_KEYS = ["q", "category", "action", "actor", "targetType", "targetId", "outcome", "ip", "batch", "range", "from", "to"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

const TARGET_NOUN: Record<string, string> = {
  product: "product",
  category: "category",
  option: "product option",
  media: "file",
  logo: "logo",
  download: "file",
  quote: "quote request",
  resource_request: "resource request",
  user: "person",
  invite: "invite",
  site: "website",
};

/** Where a target can be opened, when it can. */
function targetHref(type: string | null, id: string | null): string | null {
  if (!type || !id) return null;
  switch (type) {
    case "product":
      return `/products/${encodeURIComponent(id)}`;
    case "category":
      return `/categories/${encodeURIComponent(id)}`;
    case "quote":
      return `/quotes?id=${encodeURIComponent(id)}`;
    case "resource_request":
      return `/resource-requests?id=${encodeURIComponent(id)}`;
    case "user":
    case "invite":
      return "/users";
    case "logo":
      return "/logos";
    case "media":
      return "/media";
    case "option":
      return "/options";
    case "site":
      return "/website";
    default:
      return null;
  }
}

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["en-GB"], { type: "region" });
  } catch {
    return null;
  }
})();
function placeOf(city: string | null, country: string | null): string | null {
  const countryName = country ? (regionNames?.of(country) ?? country) : null;
  return [city, countryName].filter(Boolean).join(", ") || null;
}

function outcomeBadge(outcome: ActivityItem["outcome"]): ReactNode {
  if (outcome === "ok") return null;
  const label = outcome === "refused" ? "Refused" : outcome === "partial" ? "Partly done" : "Failed";
  return <Badge tone={outcome === "partial" ? "warning" : "danger"}>{label}</Badge>;
}

/** Start of a local day, as an ISO instant ("2026-11-18" → that midnight here). */
function dayStart(date: string, addDays = 0): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + addDays);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function Activity() {
  const { isSuperAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const wide = useMediaQuery(XL);
  const listTop = useRef<HTMLDivElement>(null);
  const searchId = useId();

  const get = (k: FilterKey) => params.get(k) ?? "";
  const range = get("range") || "7d";
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const selectedId = params.get("id");

  /** Change filters: back to the first page, and the address replaced rather than pushed. */
  const setFilters = useCallback(
    (changes: Partial<Record<FilterKey | "page" | "id", string | null>>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(changes)) {
            if (v) next.set(k, v);
            else next.delete(k);
          }
          if (!("page" in changes)) next.delete("page");
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  // The search box edits locally and reaches the address (and the server) a beat later.
  const [q, setQ] = useState(get("q"));
  const debouncedQ = useDebounced(q, 300);
  useEffect(() => {
    if (debouncedQ !== get("q")) setFilters({ q: debouncedQ.trim() || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  /** The request's query string: the filters, with the date range turned into instants. */
  const query = useMemo(() => {
    const out = new URLSearchParams();
    for (const k of ["q", "category", "action", "actor", "targetType", "targetId", "outcome", "ip", "batch"] as const) {
      const v = params.get(k);
      if (v) out.set(k, v);
    }
    const preset = RANGES.find((r) => r.value === range);
    if (preset && preset.hours > 0) {
      out.set("from", new Date(Date.now() - preset.hours * 3600 * 1000).toISOString());
    } else if (range === "custom") {
      const from = dayStart(params.get("from") ?? "");
      const to = dayStart(params.get("to") ?? "", 1);
      if (from) out.set("from", from);
      if (to) out.set("to", to);
    }
    return out;
    // `range` presets are relative to now: recomputed when the filters change.
  }, [params, range]);
  const queryKey = query.toString();

  const [data, setData] = useState<ActivityPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!isSuperAdmin) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const withPage = new URLSearchParams(query);
    withPage.set("page", String(page));
    withPage.set("pageSize", String(PAGE_SIZE));
    apiJson<ActivityPage>(`/api/activity?${withPage}`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Couldn't load the activity log.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, page, isSuperAdmin, reloadTick]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    apiJson<Facets>("/api/activity/facets")
      .then(setFacets)
      .catch(() => setFacets(null));
  }, [isSuperAdmin, reloadTick]);

  const people = useMemo(() => new Map((facets?.people ?? []).map((p) => [p.id, p])), [facets]);
  const categoryLabel = useMemo(() => new Map((facets?.categories ?? []).map((c) => [c.value, c.label])), [facets]);
  const actionLabel = useMemo(() => new Map((facets?.actions ?? []).map((a) => [a.value, a.label])), [facets]);
  const whoOf = (item: { actorId: string | null; actorEmail: string | null }) =>
    (item.actorId && people.get(item.actorId)?.name) || item.actorEmail || "Unknown";

  const category = get("category");
  const categoryOptions = [
    { value: "", label: "All categories" },
    ...(facets?.categories ?? []).filter((c) => c.count > 0 || c.value === category).map((c) => ({ value: c.value, label: `${c.label} (${c.count})` })),
  ];
  const action = get("action");
  const actionOptions = [
    { value: "", label: "All actions" },
    ...(facets?.actions ?? [])
      .filter((a) => (!category || a.category === category) && (a.count > 0 || a.value === action))
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((a) => ({ value: a.value, label: `${a.label} (${a.count})` })),
  ];
  const actor = get("actor");
  const personOptions = [
    { value: "", label: "Everyone" },
    ...(facets?.people ?? []).map((p) => ({ value: p.id, label: p.name ? `${p.name} (${p.email ?? "no email"})` : (p.email ?? p.id) })),
  ];

  // The narrowing that has no dropdown of its own shows as a removable chip.
  const chips: { key: string; label: string; clear: Partial<Record<FilterKey, null>> }[] = [];
  if (get("targetId"))
    chips.push({
      key: "target",
      label: `${TARGET_NOUN[get("targetType")] ? `This ${TARGET_NOUN[get("targetType")]}` : "This item"}`,
      clear: { targetType: null, targetId: null },
    });
  if (get("ip")) chips.push({ key: "ip", label: `IP ${get("ip")}`, clear: { ip: null } });
  if (get("batch")) chips.push({ key: "batch", label: "One save", clear: { batch: null } });
  const filtered = FILTER_KEYS.some((k) => k !== "range" && k !== "from" && k !== "to" && params.get(k)) || range !== "7d";

  function clearFilters() {
    setQ("");
    setParams(new URLSearchParams(), { replace: true });
  }

  function goToPage(next: number) {
    setFilters({ page: String(next) });
    listTop.current?.scrollIntoView({ block: "start" });
  }

  // ---- The detail ----------------------------------------------------------------
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId || !isSuperAdmin) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailError(null);
    apiJson<ActivityDetail>(`/api/activity/${encodeURIComponent(selectedId)}`)
      .then((d) => !cancelled && setDetail(d))
      .catch(() => !cancelled && setDetailError("Couldn't load this entry."));
    return () => {
      cancelled = true;
    };
  }, [selectedId, isSuperAdmin]);
  const select = (id: string | null) => setFilters({ id, page: page > 1 ? String(page) : null });

  /** A quick filter from the detail: everything by this person, on this item, from this IP, in this save. */
  function narrow(changes: Partial<Record<FilterKey, string | null>>) {
    setFilters({ ...changes, id: null, range: "all" });
  }

  // ---- Export --------------------------------------------------------------------
  const [exporting, setExporting] = useState(false);
  async function exportCsv() {
    setExporting(true);
    try {
      const res = await apiFetch(`/api/activity/export.csv?${query}`);
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "saequip-activity.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      // The file has a size limit (the server's EXPORT_BYTES): say when it was reached.
      const cut = res.headers.get("x-export-truncated");
      if (cut) {
        const [got, of] = cut.split("/");
        toast.warning(`The file holds the newest ${got} of ${of} entries, the most one download can carry. Narrow the dates for the rest.`);
      }
      setReloadTick((t) => t + 1); // the export is itself an entry
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  if (!isSuperAdmin) {
    return (
      <>
        <PageHeader title="Activity" />
        <EmptyState title="Only the super admin can see this page" description="The activity log records everything done in the Hub, so it is kept to the super admin." />
      </>
    );
  }

  const items = data?.items ?? [];
  const initialLoad = loading && data === null;
  const detailBody = detail && detail.id === selectedId ? (
    <ActivityDetailView
      entry={detail}
      categoryLabel={categoryLabel.get(detail.category) ?? detail.category}
      actionLabel={actionLabel.get(detail.action) ?? detail.action}
      onNarrow={narrow}
    />
  ) : detailError ? (
    <Alert tone="danger">{detailError}</Alert>
  ) : selectedId ? (
    <div aria-busy="true" className="space-y-3">
      <SkeletonLine text="t-section" className="w-2/3" />
      <SkeletonLine text="t-help" className="w-1/2" />
      <SkeletonLine text="t-help" className="w-3/4" />
    </div>
  ) : null;

  return (
    <>
      <PageHeader
        title="Activity"
        description="Everything done in the Hub: who did it, when and from where. Kept for two years."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void exportCsv()} loading={exporting} disabled={!data?.total}>
            <Download size={16} aria-hidden="true" />
            Export CSV
          </Button>
        }
      />

      <div ref={listTop} className="mb-4 flex scroll-mt-20 flex-col gap-3 lg:scroll-mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full min-w-0 sm:w-72">
            <label htmlFor={searchId} className="sr-only">
              Search the activity log
            </label>
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              id={searchId}
              size="xs"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="What, who, item or IP…"
              className="pl-9"
            />
          </div>
          <SelectMenu
            className="min-w-0 flex-1 sm:w-44 sm:flex-none"
            ariaLabel="Date range"
            value={range}
            onChange={(v) => setFilters({ range: v === "7d" ? null : v, from: null, to: null })}
            options={RANGES.map((r) => ({ value: r.value, label: r.label }))}
          />
          {range === "custom" && (
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <label className="sr-only" htmlFor={`${searchId}-from`}>
                From
              </label>
              <Input
                id={`${searchId}-from`}
                size="xs"
                type="date"
                value={get("from")}
                onChange={(e) => setFilters({ from: e.target.value || null })}
                className="w-full [color-scheme:light] sm:w-40 [[data-theme=dark]_&]:[color-scheme:dark]"
              />
              <span className="text-help text-muted">to</span>
              <label className="sr-only" htmlFor={`${searchId}-to`}>
                To
              </label>
              <Input
                id={`${searchId}-to`}
                size="xs"
                type="date"
                value={get("to")}
                onChange={(e) => setFilters({ to: e.target.value || null })}
                className="w-full [color-scheme:light] sm:w-40 [[data-theme=dark]_&]:[color-scheme:dark]"
              />
            </div>
          )}
          <SegmentedControl
            ariaLabel="Outcome"
            value={get("outcome")}
            onChange={(v) => setFilters({ outcome: v || null })}
            options={OUTCOMES.map((o) => ({ value: o.value, label: o.label }))}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SelectMenu
            className="min-w-0 flex-1 sm:w-56 sm:flex-none"
            ariaLabel="Category"
            value={category}
            onChange={(v) => setFilters({ category: v || null, action: null })}
            options={categoryOptions}
          />
          <SelectMenu
            className="min-w-0 flex-1 sm:w-64 sm:flex-none"
            ariaLabel="Action"
            value={action}
            onChange={(v) => setFilters({ action: v || null })}
            options={actionOptions}
          />
          <SelectMenu
            className="min-w-0 flex-1 sm:w-64 sm:flex-none"
            ariaLabel="Person"
            value={actor}
            onChange={(v) => setFilters({ actor: v || null })}
            options={personOptions}
          />
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilters(c.clear)}
              className="inline-flex h-8 items-center gap-1.5 border border-border bg-chip px-2.5 text-help text-text transition-colors duration-[120ms] hover:bg-surface-2"
              aria-label={`Remove the filter: ${c.label}`}
            >
              {c.label}
              <X size={14} aria-hidden="true" />
            </button>
          ))}
          {filtered && (
            <Button variant="ghost" size="xs" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <div className={cn(wide && "grid grid-cols-[minmax(0,1fr)_24rem] items-start gap-5")}>
        <div className="min-w-0">
          {error && <Alert tone="danger">{error}</Alert>}

          {initialLoad && <ActivitySkeleton />}

          {!initialLoad && !error && items.length === 0 && (
            <EmptyState
              title={filtered ? "Nothing matches those filters" : "Nothing recorded yet"}
              description={filtered ? "Try a wider date range, or clear the filters." : "Actions in the Hub appear here as they happen."}
              action={
                filtered ? (
                  <Button variant="secondary" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          )}

          {!error && items.length > 0 && (
            <>
              <p className="t-help mb-2 tabular-nums text-muted" role="status">
                {data!.total.toLocaleString("en-GB")} {data!.total === 1 ? "entry" : "entries"}
              </p>
              <div className={cn("transition-opacity", loading && "pointer-events-none opacity-50")} aria-busy={loading}>
                <Table>
                  <THead>
                    <TR>
                      <TH className="w-px whitespace-nowrap">When</TH>
                      <TH className="hidden md:table-cell">Who</TH>
                      <TH>What</TH>
                      <TH className="hidden lg:table-cell">Where</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {items.map((item) => {
                      const selected = item.id === selectedId;
                      return (
                        <TR key={item.id} hover selected={selected} onClick={() => select(item.id)}>
                          <TD className="whitespace-nowrap align-top">
                            <time dateTime={item.at} title={formatDateTimeSeconds(item.at)} className="tabular-nums text-text">
                              {formatRelative(item.at)}
                            </time>
                            <p className="t-help tabular-nums text-muted">{new Date(item.at).toLocaleTimeString("en-GB", { timeZone: "Europe/London" })}</p>
                          </TD>
                          <TD className="hidden align-top md:table-cell">
                            <span className="break-words text-text">{whoOf(item)}</span>
                            {item.source === "browser" && <p className="t-help text-muted">Reported by the browser</p>}
                          </TD>
                          <TD primary className="align-top">
                            <button
                              type="button"
                              onClick={() => select(item.id)}
                              aria-pressed={selected}
                              className="text-left text-text [overflow-wrap:anywhere]"
                            >
                              {item.summary}
                            </button>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="t-help text-muted [overflow-wrap:anywhere]">
                                {[
                                  item.targetLabel,
                                  categoryLabel.get(item.category) ?? item.category,
                                  item.batchCount > 1 ? `${item.batchCount} changes in one save` : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                                {/* Who, on narrow screens, where its column is hidden. */}
                                <span className="md:hidden"> · {whoOf(item)}</span>
                              </span>
                              {outcomeBadge(item.outcome)}
                            </div>
                          </TD>
                          <TD className="hidden align-top lg:table-cell">
                            <span className="t-code text-text">{item.ip ?? "—"}</span>
                            {placeOf(item.city, item.country) && <p className="t-help text-muted">{placeOf(item.city, item.country)}</p>}
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              </div>
              <Pagination className="mt-5" page={data!.page} total={data!.total} pageSize={PAGE_SIZE} onPageChange={goToPage} label="entries" />
            </>
          )}
        </div>

        {wide && (
          <aside aria-label="Entry details" className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto border border-border bg-surface">
            {selectedId ? (
              <>
                <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
                  <h2 className="t-section min-w-0 text-text [overflow-wrap:anywhere]">{detail?.id === selectedId ? (detail.groupSummary ?? detail.summary) : "Entry"}</h2>
                  <button
                    type="button"
                    onClick={() => select(null)}
                    aria-label="Close the entry details"
                    className="-mr-2 -mt-1 flex h-8.5 w-8.5 shrink-0 items-center justify-center text-muted transition-colors duration-[120ms] hover:bg-surface-2 hover:text-text"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
                <div className="p-5">{detailBody}</div>
              </>
            ) : (
              <p className="px-5 py-10 text-center text-help text-muted">Select an entry to see exactly what changed, and from where.</p>
            )}
          </aside>
        )}
      </div>

      {!wide && (
        <Modal open={selectedId !== null} onClose={() => select(null)} title={detail?.id === selectedId ? (detail.groupSummary ?? detail.summary) : "Entry"} size="lg">
          {detailBody}
        </Modal>
      )}
    </>
  );
}

/** The table, standing where it will be: the same columns and two-line cells. */
function ActivitySkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" aria-label="Loading the activity log">
      <SkeletonLine text="t-help" className="mb-2 w-24" />
      <Table>
        <THead>
          <TR>
            <TH className="w-px whitespace-nowrap">When</TH>
            <TH className="hidden md:table-cell">Who</TH>
            <TH>What</TH>
            <TH className="hidden lg:table-cell">Where</TH>
          </TR>
        </THead>
        <TBody>
          {Array.from({ length: 12 }, (_, i) => (
            <TR key={i}>
              <TD className="align-top">
                <SkeletonLine text="text-body" className="w-20" />
                <SkeletonLine text="t-help" className="w-14" />
              </TD>
              <TD className="hidden align-top md:table-cell">
                <SkeletonLine text="text-body" className="w-36" />
              </TD>
              <TD className="align-top">
                <SkeletonLine text="text-body" className="w-3/4" />
                <SkeletonLine text="t-help" className="w-1/2" />
              </TD>
              <TD className="hidden align-top lg:table-cell">
                <SkeletonLine text="text-body" className="w-28" />
                <SkeletonLine text="t-help" className="w-20" />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <Skeleton className="mt-5 h-8 w-64" />
    </div>
  );
}

// ---- One entry, in full ---------------------------------------------------------------

type Change = { field?: string; label: string; before?: unknown; after?: unknown };

// `origin` and `engine` are how a translation was made, shown as nothing; `locale` is shown as a language.
const KNOWN_DETAIL_KEYS = new Set(["changes", "description", "added", "removed", "before", "after", "variations", "edits", "origin", "engine", "locale"]);

const LANGUAGE_NAMES: Record<string, string> = { ar: "Arabic", zh: "Chinese", fr: "French", de: "German", "pt-br": "Portuguese", es: "Spanish" };

function ActivityDetailView({
  entry,
  categoryLabel,
  actionLabel,
  onNarrow,
}: {
  entry: ActivityDetail;
  categoryLabel: string;
  actionLabel: string;
  onNarrow: (changes: Partial<Record<FilterKey, string | null>>) => void;
}) {
  const [raw, setRaw] = useState(false);
  const href = targetHref(entry.targetType, entry.targetId);
  const device = describeDevice(entry.userAgent);
  const place = placeOf(entry.city, entry.country);
  const noun = entry.targetType ? TARGET_NOUN[entry.targetType] ?? "item" : null;
  const outcome = entry.groupOutcome ?? entry.outcome;
  const save = entry.members.length > 1 ? entry.members : null;

  return (
    <div className="space-y-6">
      {outcome !== "ok" && (
        <Alert tone={outcome === "partial" ? "warning" : "danger"}>
          {outcome === "refused" ? "This was refused." : outcome === "partial" ? "This was only partly done." : "This failed."}
          {!save && entry.status ? ` The server answered ${entry.status}.` : ""}
        </Alert>
      )}

      <DefinitionGrid>
        <Detail label="When">
          <time dateTime={entry.at} className="tabular-nums">
            {formatDateTimeSeconds(entry.at)}
          </time>
          {/* Not tabular-nums: Inter's tabular figures widen the hyphen. */}
          <span className="t-help block text-muted">{entry.at.replace("T", " ").replace("Z", " UTC")}</span>
        </Detail>
        <Detail label="Who">
          {entry.actorName ? (
            <>
              {entry.actorName}
              <span className="t-help block text-muted [overflow-wrap:anywhere]">{entry.actorEmail}</span>
            </>
          ) : (
            entry.actorEmail
          )}
        </Detail>
        <Detail label="What">
          {actionLabel}
          <span className="t-help block text-muted">
            {categoryLabel}
            {entry.source === "browser" ? " · reported by the browser" : entry.source === "duda" ? " · from Duda's site log" : ""}
          </span>
        </Detail>
        <Detail label={noun ? noun.charAt(0).toUpperCase() + noun.slice(1) : "Item"}>
          {entry.targetLabel || entry.targetId ? (
            href ? (
              <Link to={href} className="text-text underline underline-offset-2 [overflow-wrap:anywhere]">
                {entry.targetLabel ?? entry.targetId}
              </Link>
            ) : (
              <span className="[overflow-wrap:anywhere]">{entry.targetLabel ?? entry.targetId}</span>
            )
          ) : null}
        </Detail>
        <Detail label="IP address">{entry.ip ? <span className="t-code">{entry.ip}</span> : null}</Detail>
        <Detail label="Location">{place}</Detail>
        <Detail label="Device" wide>
          {device ?? (entry.userAgent ? "Unrecognised" : null)}
          {entry.userAgent && <span className="t-help block break-all text-muted">{entry.userAgent}</span>}
        </Detail>
        {entry.method && (
          <Detail label="Request" wide>
            <span className="t-code break-all">
              {entry.method} {entry.path}
            </span>
            <span className="t-help block tabular-nums text-muted">
              {entry.status ? `Answered ${entry.status}` : ""}
              {entry.durationMs !== null ? ` in ${entry.durationMs.toLocaleString("en-GB")} ms` : ""}
            </span>
          </Detail>
        )}
        {entry.sessionId && (
          <Detail label="Session">
            <span className="t-code">{entry.sessionId.slice(0, 8)}</span>
          </Detail>
        )}
      </DefinitionGrid>

      {save ? (
        <section>
          <h3 className="t-label mb-2">{`In this save (${save.length} changes)`}</h3>
          <ul className="divide-y divide-border border border-border">
            {save.map((m) => (
              <li key={m.id}>
                <details open={m.id === entry.id} className="group/member">
                  {/* A flex summary loses the browser's own marker, hence the chevron. */}
                  <summary className="flex cursor-pointer list-none items-start gap-2 px-3 py-2.5 transition-colors duration-[120ms] hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                    <ChevronRight
                      size={14}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-muted transition-transform duration-[120ms] group-open/member:rotate-90"
                    />
                    <span className="min-w-0 flex-1 text-help text-text [overflow-wrap:anywhere]">{m.summary}</span>
                    {memberBadge(m)}
                    <time dateTime={m.at} className="t-help shrink-0 tabular-nums text-muted">
                      {new Date(m.at).toLocaleTimeString("en-GB", { timeZone: "Europe/London" })}
                    </time>
                  </summary>
                  <div className="border-t border-border px-3 py-3">
                    <ChangesView details={m.details} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <ChangesView details={entry.details} />
      )}

      <section>
        <h3 className="t-label mb-2">Show everything…</h3>
        <div className="flex flex-wrap gap-2">
          {entry.actorId && (
            <Button variant="secondary" size="xs" onClick={() => onNarrow({ actor: entry.actorId })}>
              By this person
            </Button>
          )}
          {entry.targetType && entry.targetId && (
            <Button variant="secondary" size="xs" onClick={() => onNarrow({ targetType: entry.targetType, targetId: entry.targetId })}>
              On this {noun ?? "item"}
            </Button>
          )}
          {entry.ip && (
            <Button variant="secondary" size="xs" onClick={() => onNarrow({ ip: entry.ip })}>
              From this IP
            </Button>
          )}
        </div>
      </section>

      {(save || (entry.details !== null && entry.details !== undefined)) && (
        <section>
          <button type="button" onClick={() => setRaw((r) => !r)} aria-expanded={raw} className="t-help text-muted underline underline-offset-2">
            {raw ? "Hide raw details" : "Show raw details"}
          </button>
          {raw && (
            // Focusable, so the box can be scrolled from the keyboard too.
            <pre
              tabIndex={0}
              aria-label="Raw details"
              className="mt-2 max-h-80 overflow-auto border border-border bg-surface-2 p-3 font-mono text-help text-text"
            >
              {JSON.stringify(save ? save.map((m) => ({ summary: m.summary, details: m.details })) : entry.details, null, 2)}
            </pre>
          )}
        </section>
      )}
    </div>
  );
}

/** What one row changed: its before → after, description diff, added/removed lines and other facts. */
function ChangesView({ details: raw }: { details: unknown }) {
  const details = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const changes = Array.isArray(details.changes) ? (details.changes as Change[]) : [];
  const description = details.description as { before?: string | null; after?: string | null } | undefined;
  const added = Array.isArray(details.added) ? (details.added as unknown[]) : null;
  const removed = Array.isArray(details.removed) ? (details.removed as unknown[]) : null;
  const variations = Array.isArray(details.variations) ? (details.variations as { variation: string; changes: Change[]; failed?: boolean }[]) : [];
  const edits = Array.isArray(details.edits)
    ? (details.edits as { kind: string; english: string; before: string | null; after: string; status?: string; reason?: string }[])
    : [];
  const otherFacts = Object.entries(details).filter(([k, v]) => !KNOWN_DETAIL_KEYS.has(k) && v !== null && v !== undefined && typeof v !== "object");
  const counts = details.counts && typeof details.counts === "object" ? Object.entries(details.counts as Record<string, unknown>) : [];
  const beforeAfterLists =
    !added && Array.isArray(details.before) && Array.isArray(details.after) ? { before: details.before as unknown[], after: details.after as unknown[] } : null;
  const nothing =
    !changes.length && !description && !added?.length && !removed?.length && !beforeAfterLists && !variations.length && !edits.length && !otherFacts.length && !counts.length && typeof details.locale !== "string";
  if (nothing) return <p className="t-help text-muted">No further detail.</p>;

  return (
    <div className="space-y-6">
      {changes.length > 0 && <ChangesTable changes={changes} />}

      {description && (description.before ?? null) !== (description.after ?? null) && (
        <section>
          <h3 className="t-label mb-2">Description</h3>
          <ParagraphDiff before={description.before ?? ""} after={description.after ?? ""} />
        </section>
      )}

      {(added?.length || removed?.length) ? (
        <section className="space-y-3">
          {added && added.length > 0 && <LineList title="Added" lines={added} tone="add" />}
          {removed && removed.length > 0 && <LineList title="Removed" lines={removed} tone="remove" />}
        </section>
      ) : null}

      {beforeAfterLists && (
        <section className="grid gap-3 sm:grid-cols-2">
          <LineList title="Before" lines={beforeAfterLists.before} />
          <LineList title="After" lines={beforeAfterLists.after} />
        </section>
      )}

      {variations.length > 0 && (
        <section className="space-y-3">
          <h3 className="t-label">Variations</h3>
          {variations.map((v, i) => (
            <div key={i}>
              <p className="text-body text-text">
                {v.variation} {v.failed && <Badge tone="danger">Failed</Badge>}
              </p>
              {v.changes.length > 0 ? <ChangesTable changes={v.changes} compact /> : <p className="t-help text-muted">No change</p>}
            </div>
          ))}
        </section>
      )}

      {edits.length > 0 && (
        <section className="space-y-3">
          <h3 className="t-label">Translations</h3>
          {edits.map((e, i) => (
            <div key={i} className="border border-border p-3">
              <p className="t-help text-muted [overflow-wrap:anywhere]">{e.english}</p>
              <p className="mt-1 text-body text-muted line-through [overflow-wrap:anywhere]">{e.before ?? "—"}</p>
              <p className="text-body text-text [overflow-wrap:anywhere]">{e.after}</p>
              {e.status && e.status !== "saved" && (
                <p className="t-help mt-1 text-muted">
                  {e.status}
                  {e.reason ? `: ${e.reason}` : ""}
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      {otherFacts.length > 0 && (
        <DefinitionGrid>
          {otherFacts.map(([k, v]) => (
            <Detail key={k} label={humanise(k)}>
              {typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}
            </Detail>
          ))}
        </DefinitionGrid>
      )}

      {(counts.length > 0 || typeof details.locale === "string") && (
        <DefinitionGrid>
          {typeof details.locale === "string" && <Detail label="Language">{LANGUAGE_NAMES[details.locale] ?? details.locale}</Detail>}
          {counts.map(([k, v]) => (
            <Detail key={k} label={COUNT_LABEL[k] ?? humanise(k)}>
              {String(v)}
            </Detail>
          ))}
        </DefinitionGrid>
      )}
    </div>
  );
}

/** A machine translation's counts, in words. */
const COUNT_LABEL: Record<string, string> = {
  saved: "Translated",
  rejected: "Kept in English",
  unchanged: "Already up to date",
  "kept-staff": "Kept a staff edit",
  "pass-through": "Needs no translation",
};

/**
 * A save's row, flagged. ⚠️ A machine translation the safety check refused is
 * not a failure (the English shows instead), whatever an older row stored.
 */
function memberBadge(m: SaveMember): ReactNode {
  const d = (m.details ?? {}) as { origin?: unknown; counts?: { rejected?: unknown } };
  if (m.action === "translation.save" && d.origin === "MT") {
    return typeof d.counts?.rejected === "number" && d.counts.rejected > 0 ? <Badge tone="neutral">Kept in English</Badge> : null;
  }
  return outcomeBadge(m.outcome);
}

function humanise(key: string): string {
  const words = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Field by field, before → after. A "before" the server could not read shows as unknown. */
function ChangesTable({ changes, compact = false }: { changes: Change[]; compact?: boolean }) {
  return (
    <section>
      {!compact && <h3 className="t-label mb-2">Changes</h3>}
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border">
            <th className="t-th py-1.5 pr-3">Field</th>
            <th className="t-th py-1.5 pr-3">Before</th>
            <th className="t-th py-1.5">After</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((c, i) => (
            <tr key={c.field ?? i} className="border-b border-border last:border-0 align-top">
              <td className="py-2 pr-3 text-help text-muted">{c.label}</td>
              <td className="py-2 pr-3 text-help text-muted line-through decoration-muted [overflow-wrap:anywhere]">
                {c.before === undefined ? <span className="no-underline">unknown</span> : show(c.before)}
              </td>
              <td className="py-2 text-help text-text [overflow-wrap:anywhere]">{show(c.after)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function LineList({ title, lines, tone }: { title: string; lines: unknown[]; tone?: "add" | "remove" }) {
  return (
    <div>
      <h3 className="t-label mb-1.5">{title}</h3>
      {lines.length === 0 ? (
        <p className="t-help text-muted">Nothing</p>
      ) : (
        <ul className="space-y-1">
          {lines.map((l, i) => (
            <li
              key={i}
              className={cn(
                "border-l-2 py-0.5 pl-2 text-help [overflow-wrap:anywhere]",
                tone === "add" ? "border-ok text-text" : tone === "remove" ? "border-danger text-muted line-through" : "border-border text-text",
              )}
            >
              <span className="sr-only">{tone === "add" ? "Added: " : tone === "remove" ? "Removed: " : ""}</span>
              {typeof l === "object" && l !== null && "url" in l
                ? `${(l as { alt?: string | null }).alt || "(no alt text)"} — ${(l as { url: string }).url.split("/").pop()}`
                : show(l)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * A description's change, paragraph by paragraph: unchanged paragraphs muted,
 * removed ones struck through, added ones marked. The HTML is read as TEXT
 * (DOMParser builds an inert document that runs nothing) and never rendered.
 */
function ParagraphDiff({ before, after }: { before: string; after: string }) {
  const rows = useMemo(() => diffParagraphs(paragraphs(before), paragraphs(after)), [before, after]);
  return (
    <ol className="space-y-1.5">
      {rows.map((r, i) => (
        <li
          key={i}
          className={cn(
            "border-l-2 py-0.5 pl-2 text-help [overflow-wrap:anywhere]",
            r.kind === "add" ? "border-ok text-text" : r.kind === "remove" ? "border-danger text-muted line-through" : "border-transparent text-muted",
          )}
        >
          <span className="sr-only">{r.kind === "add" ? "Added: " : r.kind === "remove" ? "Removed: " : ""}</span>
          {r.text}
        </li>
      ))}
    </ol>
  );
}

function paragraphs(html: string): string[] {
  if (!html.trim()) return [];
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const blocks = doc.body.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6");
  const texts = blocks.length ? [...blocks].map((b) => b.textContent ?? "") : [doc.body.textContent ?? ""];
  return texts.map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean);
}

/** Longest common subsequence over paragraphs: a description has dozens at most. */
function diffParagraphs(a: string[], b: string[]): { kind: "same" | "add" | "remove"; text: string }[] {
  const m = a.length;
  const n = b.length;
  const lcs = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: { kind: "same" | "add" | "remove"; text: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) out.push({ kind: "remove", text: a[i++] });
    else out.push({ kind: "add", text: b[j++] });
  }
  while (i < m) out.push({ kind: "remove", text: a[i++] });
  while (j < n) out.push({ kind: "add", text: b[j++] });
  return out;
}
