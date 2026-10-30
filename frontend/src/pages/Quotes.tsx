import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  PageHeader,
  SplitDetailHeader,
  SplitListItem,
  SplitView,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Thumb,
  useSelection,
} from "../components/ui";
import {
  DefinitionGrid,
  Detail,
  EnquiryActions,
  EnquiryListSkeleton,
  EnquiryToolbar,
  HandledStatus,
  filterEnquiries,
  isNew,
  useMarkHandled,
  withHandled,
  type EnquiryFilter,
} from "../components/enquiries";
import type { QuoteRequest, QuotesResponse } from "../lib/types";
import { downloadCsv } from "../lib/csv";
import { refreshEnquiryCounts } from "../lib/enquiryCounts";
import { formatDateTime, formatShortDate } from "../lib/format";
import { languageName } from "../lib/language";

function itemsSummary(quote: QuoteRequest): string {
  return quote.items.map((item) => `${item.name} x${item.quantity}`).join("; ");
}

function exportQuotes(requests: QuoteRequest[]) {
  const header = [
    "Name", "First name", "Last name", "Company", "Email", "Telephone", "When needed",
    "Address", "Postcode", "Country", "Message", "Language", "Date", "Items",
  ];
  const rows = requests.map((q) => [
    q.name,
    q.firstName ?? "",
    q.lastName ?? "",
    q.company ?? "",
    q.email,
    q.phone ?? "",
    q.requiredBy ?? "",
    q.address ?? "",
    q.postcode ?? "",
    q.country ?? "",
    q.message ?? "",
    q.locale ? languageName(q.locale) : "",
    formatDateTime(q.createdAt),
    itemsSummary(q),
  ]);
  downloadCsv(`quote-requests-${new Date(Date.now()).toISOString().slice(0, 10)}.csv`, header, rows);
}

function formatOptions(options: Record<string, unknown> | null): string | null {
  if (!options || typeof options !== "object") return null;
  const entries = Object.entries(options);
  if (entries.length === 0) return null;
  return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function QuoteDetail({
  quote,
  busy,
  onHandled,
}: {
  quote: QuoteRequest;
  busy: boolean;
  onHandled: (handled: boolean) => void;
}) {
  /*
   * Every field is shown, with "—" when it was not given. They used to appear
   * only when filled in, which made a field the form never asked for (older
   * quotes) indistinguishable from one the page was failing to show.
   */
  const address = [quote.address, quote.postcode, quote.country].filter(Boolean).join("\n");
  const units = quote.items.reduce((n, item) => n + item.quantity, 0);
  return (
    <>
      <SplitDetailHeader
        title={quote.name}
        subtitle={quote.company ?? quote.email}
        actions={
          <EnquiryActions
            kind="quote"
            enquiry={quote}
            busy={busy}
            onHandled={onHandled}
            onExport={() => exportQuotes([quote])}
          />
        }
      />

      <div className="space-y-6 px-6 py-5">
        <DefinitionGrid>
          <Detail label="First name">{quote.firstName}</Detail>
          <Detail label="Last name">{quote.lastName}</Detail>
          <Detail label="Company">{quote.company}</Detail>
          <Detail label="Email">{quote.email}</Detail>
          <Detail label="Telephone">{quote.phone}</Detail>
          <Detail label="When needed">{quote.requiredBy}</Detail>
          <Detail label="Address">{address}</Detail>
          <Detail label="Submitted">{formatDateTime(quote.createdAt)}</Detail>
          {/* The page language the customer used, so a reply can be in it.
              Unknown (—) for quotes from before 2026-10-07. */}
          <Detail label="Language">{quote.locale ? languageName(quote.locale) : null}</Detail>
          <Detail label="Status">
            <HandledStatus enquiry={quote} />
          </Detail>
          <Detail label="Message" wide>
            {quote.message}
          </Detail>
        </DefinitionGrid>

        <section aria-labelledby="quote-items">
          <h3 id="quote-items" className="t-overline mb-2">
            Items
          </h3>
          {/* No price column: SAEquip quotes prices, so the basket never carries one. */}
          <Table>
            <THead>
              <TR>
                <TH>Product</TH>
                <TH>SKU</TH>
                <TH>Options</TH>
                <TH className="text-right">Qty</TH>
              </TR>
            </THead>
            <TBody>
              {quote.items.map((item) => (
                <TR key={item.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Thumb src={item.imageUrl} size={40} />
                      {item.dudaProductId ? (
                        <Link
                          to={`/products/${item.dudaProductId}`}
                          className="font-medium text-text underline-offset-2 hover:underline"
                          title="Open this product in the editor"
                        >
                          {item.name}
                        </Link>
                      ) : (
                        <span>{item.name}</span>
                      )}
                    </div>
                  </TD>
                  <TD className="t-code">{item.sku || "—"}</TD>
                  <TD className="text-muted">{formatOptions(item.options) ?? "—"}</TD>
                  <TD className="t-code text-right">{item.quantity}</TD>
                </TR>
              ))}
            </TBody>
            {/* Units only: no prices (02a Q17). */}
            <tfoot className="border-t border-border bg-surface-2">
              <tr>
                <td colSpan={4} className="px-5 py-2.5 text-right text-body font-semibold text-text">
                  {plural(quote.items.length, "item", "items")} · {plural(units, "unit", "units")}
                </td>
              </tr>
            </tfoot>
          </Table>
        </section>
      </div>
    </>
  );
}

export default function Quotes() {
  const [data, setData] = useState<QuotesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<EnquiryFilter>("all");
  const { selectedId, select, hrefFor } = useSelection();
  const { busy, setHandled } = useMarkHandled(
    (id) => `/api/quotes/${id}/handled`,
    (res) => setData((d) => d && { ...d, requests: withHandled(d.requests, res) }),
    "quote request",
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch("/api/quotes")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json: QuotesResponse) => {
        if (cancelled) return;
        setData(json);
        // The badge should agree with the list just loaded.
        refreshEnquiryCounts();
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load quote requests");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const requests = data?.requests ?? [];
  const shown = filterEnquiries(requests, filter, query, (q) => [q.name, q.company, q.email]);
  const selected = selectedId ? requests.find((q) => q.id === selectedId) ?? null : null;

  return (
    <>
      {/*
        * ⚠️ No email-status banner, badge or column. Resend is not being set
        * up — these will feed SAEquip's own CRM later — so `emailSent` is
        * false on every row and a column of "No" reads as a fault rather than
        * a setting nobody chose. The backend still stores every submission
        * independently of email, which is what makes leaving it off safe.
        */}
      <PageHeader
        title="Quote requests"
        description="Submissions captured from the public basket-page widget. Every request is stored here regardless of any notification setup."
        actions={
          <Button
            variant="secondary"
            size="sm"
            disabled={requests.length === 0}
            onClick={() => exportQuotes(requests)}
          >
            Export CSV
          </Button>
        }
      />

      {error && <Alert tone="danger">{error}</Alert>}

      {!loading && !error && requests.length === 0 && (
        <EmptyState
          title="No quote requests yet"
          description="Submissions from the basket-page widget will show up here."
        />
      )}

      {!error && (loading || requests.length > 0) && (
        <SplitView
          className="lg:flex-1"
          listLabel="Quote requests"
          selectedId={selectedId}
          onBack={() => select(null)}
          list={
            loading ? (
              <EnquiryListSkeleton />
            ) : (
              <>
                <EnquiryToolbar
                  all={requests}
                  query={query}
                  onQuery={setQuery}
                  filter={filter}
                  onFilter={setFilter}
                  searchLabel="Search quote requests"
                />
                {shown.length === 0 ? (
                  <p className="px-5 py-6 text-body text-muted">No quote requests match.</p>
                ) : (
                  <ul>
                    {shown.map((q) => (
                      <li key={q.id}>
                        <SplitListItem
                          to={hrefFor(q.id)}
                          selected={q.id === selectedId}
                          title={q.name}
                          subtitle={q.company ?? q.email}
                          meta={formatShortDate(q.createdAt)}
                          badge={isNew(q) ? <Badge tone="new">New</Badge> : undefined}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )
          }
          detail={
            selectedId === null || loading ? null : selected ? (
              <QuoteDetail
                quote={selected}
                busy={busy === selected.id}
                onHandled={(handled) => void setHandled(selected.id, handled)}
              />
            ) : (
              <>
                <SplitDetailHeader title="Not found" />
                <p className="px-6 py-5 text-body text-muted">There's no quote request with that link in the list.</p>
              </>
            )
          }
          emptyDetail={
            <EmptyState
              className="m-6"
              title="Select a quote request"
              description="Its details and items show here."
            />
          }
        />
      )}
    </>
  );
}
