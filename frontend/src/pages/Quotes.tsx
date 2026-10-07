import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { Table, THead, TBody, TR, TH, TD, Modal, Button, Skeleton, EmptyState } from "../components/ui";
import type { QuoteRequest, QuotesResponse } from "../lib/types";
import { downloadCsv } from "../lib/csv";
import { languageName } from "../lib/language";
import { ProductThumb } from "../components/ProductThumb";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
    formatDate(q.createdAt),
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

/** One labelled value in the detail grid. "—" when empty, so a field is never silently missing. */
function Detail({ label, children, wide = false }: { label: string; children?: React.ReactNode; wide?: boolean }) {
  const empty = children == null || children === "";
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <div className="text-xs font-semibold uppercase tracking-wide text-subtle">{label}</div>
      <div className="whitespace-pre-line text-sm font-medium text-text">{empty ? "—" : children}</div>
    </div>
  );
}

function QuoteDetail({ quote }: { quote: QuoteRequest }) {
  /*
   * Every field is shown, with "—" when it was not given. They used to appear
   * only when filled in, which made a field the form never asked for (older
   * quotes) indistinguishable from one the page was failing to show.
   */
  const address = [quote.address, quote.postcode, quote.country].filter(Boolean).join("\n");
  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold text-text">{quote.name}</h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Detail label="First name">{quote.firstName}</Detail>
        <Detail label="Last name">{quote.lastName}</Detail>
        <Detail label="Company">{quote.company}</Detail>
        <Detail label="Email">{quote.email}</Detail>
        <Detail label="Telephone">{quote.phone}</Detail>
        <Detail label="When needed">{quote.requiredBy}</Detail>
        <Detail label="Address">{address}</Detail>
        <Detail label="Submitted">{formatDate(quote.createdAt)}</Detail>
        {/* The page language the customer used, so a reply can be in it.
            Unknown (—) for quotes from before 2026-10-07. */}
        <Detail label="Language">{quote.locale ? languageName(quote.locale) : null}</Detail>
        <Detail label="Message" wide>
          {quote.message}
        </Detail>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
          Items ({quote.items.length})
        </div>
        {/* No price column: SAEquip quotes prices, so the basket never carries one. */}
        <Table>
          <THead>
            <TR>
              <TH>Item</TH>
              <TH>SKU</TH>
              <TH>Options</TH>
              <TH>Qty</TH>
            </TR>
          </THead>
          <TBody>
            {quote.items.map((item) => (
              <TR key={item.id}>
                <TD>
                  <div className="flex items-center gap-3">
                    <ProductThumb url={item.imageUrl} />
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
                <TD>{item.sku || "—"}</TD>
                <TD className="text-subtle">{formatOptions(item.options) ?? "—"}</TD>
                <TD>{item.quantity}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}

export default function Quotes() {
  const [data, setData] = useState<QuotesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<QuoteRequest | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch("/api/quotes")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json: QuotesResponse) => {
        if (!cancelled) setData(json);
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

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-text">Quote Requests</h1>
        <Button
          variant="secondary"
          size="sm"
          disabled={requests.length === 0}
          onClick={() => exportQuotes(requests)}
        >
          Export CSV
        </Button>
      </div>
      {/*
        * ⚠️ No email-status banner, badge or column. Resend is not being set
        * up — these will feed SAEquip's own CRM later — so `emailSent` is
        * false on every row and a column of "No" reads as a fault rather than
        * a setting nobody chose. The backend still stores every submission
        * independently of email, which is what makes leaving it off safe.
        */}
      <p className="mt-1 text-sm text-muted">
        Submissions captured from the public basket-page widget. Every request is stored here
        regardless of any notification setup.
      </p>


      {/* The real table, so only the cells change when the data lands. */}
      {loading && (
        <div className="mt-6" aria-busy="true" aria-live="polite" aria-label="Loading quote requests">
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Email</TH>
                <TH>Company</TH>
                <TH>Items</TH>
                <TH>Date</TH>
              </TR>
            </THead>
            <TBody>
              {Array.from({ length: 6 }, (_, i) => (
                <TR key={i}>
                  <TD>
                    <Skeleton className="h-4 w-32" />
                  </TD>
                  <TD>
                    <Skeleton className="h-4 w-44" />
                  </TD>
                  <TD>
                    <Skeleton className="h-4 w-28" />
                  </TD>
                  <TD>
                    <Skeleton className="h-4 w-8" />
                  </TD>
                  <TD>
                    <Skeleton className="h-4 w-36" />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
      {error && (
        <div className="mt-8 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}
      {!loading && !error && requests.length === 0 && (
        <EmptyState
          className="mt-8"
          title="No quote requests yet"
          description="Submissions from the basket-page widget will show up here."
        />
      )}

      {!loading && !error && requests.length > 0 && (
        <div className="mt-6">
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Email</TH>
                <TH>Company</TH>
                <TH>Items</TH>
                <TH>Date</TH>
              </TR>
            </THead>
            <TBody>
              {requests.map((q) => (
                <TR key={q.id} hover onClick={() => setSelected(q)}>
                  <TD className="font-semibold text-text">{q.name}</TD>
                  <TD>{q.email}</TD>
                  <TD>{q.company || "—"}</TD>
                  <TD>{q.items.length}</TD>
                  <TD>{formatDate(q.createdAt)}</TD>

                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      <Modal open={selected !== null} onClose={() => setSelected(null)} size="lg">
        {selected && <QuoteDetail quote={selected} />}
      </Modal>
    </>
  );
}
