import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { PageHeader, Table, THead, TBody, TR, TH, TD, Badge, Modal, Button, Loader, EmptyState } from "../components/ui";
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
      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-subtle">Name</div>
          <div className="font-medium text-text">{quote.name}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-subtle">Email</div>
          <div className="font-medium text-text">{quote.email}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-subtle">Company</div>
          <div className="font-medium text-text">{quote.company || "—"}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-subtle">Phone</div>
          <div className="font-medium text-text">{quote.phone || "—"}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-subtle">Submitted</div>
          <div className="font-medium text-text">{formatDate(quote.createdAt)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-subtle">Emailed</div>
          <Badge tone={quote.emailSent ? "success" : "neutral"}>{quote.emailSent ? "Yes" : "No"}</Badge>
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
      <PageHeader
        title="Quote Requests"
        description="Submissions captured from the public basket-page widget."
        actions={
          <Button
            variant="secondary"
            size="sm"
            disabled={requests.length === 0}
            onClick={() => downloadCsv(requests)}
          >
            Export CSV
          </Button>
        }
      />

      {data && !data.emailEnabled && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-accent/50 bg-accent/10 px-4 py-3 text-sm text-text">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-accent-hover" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.18A1.5 1.5 0 0 0 3.5 20.5h17a1.5 1.5 0 0 0 1.39-2.46L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>
            Email notifications are not active yet. Quote requests are still being captured below — add{" "}
            <code className="rounded bg-surface px-1 py-0.5 text-xs">RESEND_API_KEY</code>,{" "}
            <code className="rounded bg-surface px-1 py-0.5 text-xs">QUOTE_NOTIFY_FROM</code>, and{" "}
            <code className="rounded bg-surface px-1 py-0.5 text-xs">QUOTE_NOTIFY_TO</code> to the backend
            environment to enable email alerts.
          </span>
        </div>
      )}

      {loading && <Loader label="Loading quote requests…" />}
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}
      {!loading && !error && requests.length === 0 && (
        <EmptyState
          title="No quote requests yet"
          description="Submissions from the basket-page widget will show up here."
        />
      )}

      {!loading && !error && requests.length > 0 && (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Email</TH>
              <TH>Company</TH>
              <TH>Items</TH>
              <TH>Date</TH>
              <TH>Emailed</TH>
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
                <TD>
                  <Badge tone={q.emailSent ? "success" : "neutral"}>{q.emailSent ? "Yes" : "No"}</Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={selected !== null} onClose={() => setSelected(null)} title={selected?.name} size="lg">
        {selected && <QuoteDetail quote={selected} />}
      </Modal>
    </>
  );
}
