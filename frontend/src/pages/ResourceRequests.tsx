import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { Table, THead, TBody, TR, TH, TD, Modal, Button, Skeleton, EmptyState, Badge } from "../components/ui";
import type { ResourceRequest, ResourceRequestsResponse } from "../lib/types";
import { downloadCsv } from "../lib/csv";
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

/** "EX Heater - UKEX Certificate", or whichever half is known. */
function fileLabel(r: ResourceRequest): string {
  return [r.file.productName, r.file.title].filter(Boolean).join(" - ") || "—";
}

function exportRequests(requests: ResourceRequest[]) {
  const header = [
    "Name", "First name", "Last name", "Company", "Email", "Telephone", "Mobile",
    "Marketing emails", "Product", "SKU", "File", "File name", "Date",
  ];
  const rows = requests.map((r) => [
    r.name,
    r.firstName ?? "",
    r.lastName ?? "",
    r.company ?? "",
    r.email,
    r.phone ?? "",
    r.mobile ?? "",
    r.marketingConsent ? "Yes" : "No",
    r.file.productName ?? "",
    r.file.productSku ?? "",
    r.file.title ?? "",
    r.file.fileName ?? "",
    formatDate(r.createdAt),
  ]);
  downloadCsv(`resource-requests-${new Date(Date.now()).toISOString().slice(0, 10)}.csv`, header, rows);
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

function RequestDetail({ request: r }: { request: ResourceRequest }) {
  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold text-text">{r.name}</h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Detail label="First name">{r.firstName}</Detail>
        <Detail label="Last name">{r.lastName}</Detail>
        <Detail label="Company">{r.company}</Detail>
        <Detail label="Email">{r.email}</Detail>
        <Detail label="Telephone">{r.phone}</Detail>
        <Detail label="Mobile">{r.mobile}</Detail>
        <Detail label="Marketing emails">{r.marketingConsent ? "Yes - opted in" : "No"}</Detail>
        <Detail label="Submitted">{formatDate(r.createdAt)}</Detail>
        {/* What they agreed to, as the server recorded it at the time. */}
        <Detail label="Consent given" wide>
          {r.consentText}
        </Detail>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">File requested</div>
        <div className="flex items-center gap-3 rounded-md border border-border p-3">
          <ProductThumb url={r.file.imageUrl} />
          <div className="min-w-0">
            {r.file.dudaProductId ? (
              <Link
                to={`/products/${r.file.dudaProductId}`}
                className="font-medium text-text underline-offset-2 hover:underline"
                title="Open this product in the editor"
              >
                {r.file.productName ?? "Product"}
              </Link>
            ) : (
              <span className="font-medium text-text">{r.file.productName ?? "—"}</span>
            )}
            <div className="text-sm text-muted">
              {r.file.title ?? "—"}
              {r.file.productSku ? ` · ${r.file.productSku}` : ""}
            </div>
            <div className="truncate text-xs text-subtle" title={r.file.fileName ?? undefined}>
              {r.file.fileName ?? ""}
            </div>
          </div>
          {!r.file.stillListed && (
            <Badge tone="neutral" className="ml-auto shrink-0">
              Since removed
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Resource Requests — every "File Requests" form submitted on the Datasheets,
 * User Manuals and Certificates pages. Read-only, like Quote Requests.
 */
export default function ResourceRequests() {
  const [data, setData] = useState<ResourceRequestsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ResourceRequest | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch("/api/resource-requests")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json: ResourceRequestsResponse) => {
        if (!cancelled) setData(json);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load resource requests");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const requests = data?.requests ?? [];
  const head = (
    <THead>
      <TR>
        <TH>Name</TH>
        <TH>Email</TH>
        <TH>Company</TH>
        <TH>File</TH>
        <TH>Date</TH>
      </TR>
    </THead>
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-text">Resource Requests</h1>
        <Button variant="secondary" size="sm" disabled={requests.length === 0} onClick={() => exportRequests(requests)}>
          Export CSV
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted">
        Details entered on the Datasheets, User Manuals and Certificates pages before a file is downloaded.
      </p>

      {/* The real table, so only the cells change when the data lands. */}
      {loading && (
        <div className="mt-6" aria-busy="true" aria-live="polite" aria-label="Loading resource requests">
          <Table>
            {head}
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
                    <Skeleton className="h-4 w-48" />
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
        <div className="mt-8 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}
      {!loading && !error && requests.length === 0 && (
        <EmptyState
          className="mt-8"
          title="No resource requests yet"
          description="Requests from the Datasheets, User Manuals and Certificates pages will show up here."
        />
      )}

      {!loading && !error && requests.length > 0 && (
        <div className="mt-6">
          <Table>
            {head}
            <TBody>
              {requests.map((r) => (
                <TR key={r.id} hover onClick={() => setSelected(r)}>
                  <TD className="font-semibold text-text">{r.name}</TD>
                  <TD>{r.email}</TD>
                  <TD>{r.company || "—"}</TD>
                  <TD>{fileLabel(r)}</TD>
                  <TD>{formatDate(r.createdAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      <Modal open={selected !== null} onClose={() => setSelected(null)} size="lg">
        {selected && <RequestDetail request={selected} />}
      </Modal>
    </>
  );
}
