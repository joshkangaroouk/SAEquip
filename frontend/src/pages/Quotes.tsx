import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { Table, THead, TBody, TR, TH, TD, Modal, Button, Skeleton, EmptyState } from "../components/ui";
import type { QuoteRequest, QuotesResponse } from "../lib/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function itemsSummary(quote: QuoteRequest): string {
  return quote.items.map((item) => `${item.name} x${item.quantity}`).join("; ");
}

function downloadCsv(requests: QuoteRequest[]) {
  const header = ["Name", "Email", "Company", "Phone", "Date", "Items"];
  const rows = requests.map((q) => [
    q.name,
    q.email,
    q.company ?? "",
    q.phone ?? "",
    formatDate(q.createdAt),
    itemsSummary(q),
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `quote-requests-${new Date(Date.now()).toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatOptions(options: Record<string, unknown> | null): string | null {
  if (!options || typeof options !== "object") return null;
  const entries = Object.entries(options);
  if (entries.length === 0) return null;
  return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
}

function QuoteDetail({ quote }: { quote: QuoteRequest }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-text">{quote.name}</h3>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-subtle">Email</div>
          <div className="text-sm font-medium text-text">{quote.email}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-subtle">Company</div>
          <div className="text-sm font-medium text-text">{quote.company || "—"}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-subtle">Phone</div>
          <div className="text-sm font-medium text-text">{quote.phone || "—"}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-subtle">Submitted</div>
          <div className="text-sm font-medium text-text">{formatDate(quote.createdAt)}</div>
        </div>
      </div>

      {quote.message && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-subtle">Message</div>
          <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-text">{quote.message}</p>
        </div>
      )}

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
          Items ({quote.items.length})
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Item</TH>
              <TH>SKU</TH>
              <TH>Options</TH>
              <TH>Qty</TH>
              <TH>Price</TH>
            </TR>
          </THead>
          <TBody>
            {quote.items.map((item) => (
              <TR key={item.id}>
                <TD>{item.name}</TD>
                <TD>{item.sku || "—"}</TD>
                <TD className="text-subtle">{formatOptions(item.options) ?? "—"}</TD>
                <TD>{item.quantity}</TD>
                <TD>{item.price || "—"}</TD>
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
          onClick={() => downloadCsv(requests)}
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
