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
import type { ResourceRequest, ResourceRequestsResponse } from "../lib/types";
import { downloadCsv } from "../lib/csv";
import { formatDateTime, formatShortDate } from "../lib/format";
import { languageName } from "../lib/language";

function exportRequests(requests: ResourceRequest[]) {
  const header = [
    "Name", "First name", "Last name", "Company", "Email", "Telephone", "Mobile",
    "Marketing emails", "Language", "Product", "SKU", "File", "File name", "Date",
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
    languageName(r.locale),
    r.file.productName ?? "",
    r.file.productSku ?? "",
    r.file.title ?? "",
    r.file.fileName ?? "",
    formatDateTime(r.createdAt),
  ]);
  downloadCsv(`resource-requests-${new Date(Date.now()).toISOString().slice(0, 10)}.csv`, header, rows);
}

function RequestDetail({
  request: r,
  busy,
  onHandled,
}: {
  request: ResourceRequest;
  busy: boolean;
  onHandled: (handled: boolean) => void;
}) {
  return (
    <>
      <SplitDetailHeader
        title={r.name}
        subtitle={r.company ?? r.email}
        actions={
          <EnquiryActions
            kind="resource"
            enquiry={r}
            busy={busy}
            onHandled={onHandled}
            onExport={() => exportRequests([r])}
          />
        }
      />

      <div className="space-y-6 px-6 py-5">
        <DefinitionGrid>
          <Detail label="Email">{r.email}</Detail>
          <Detail label="Company">{r.company}</Detail>
          <Detail label="Telephone">{r.phone}</Detail>
          <Detail label="Mobile">{r.mobile}</Detail>
          {/* "—" for a request from before languages (02 §6 FLAG), as on quotes. */}
          <Detail label="Language">{r.locale ? languageName(r.locale) : null}</Detail>
          <Detail label="Marketing emails">{r.marketingConsent ? "Yes - opted in" : "No"}</Detail>
          <Detail label="Submitted">{formatDateTime(r.createdAt)}</Detail>
          <Detail label="Status">
            <HandledStatus enquiry={r} />
          </Detail>
          {/* What they agreed to, as the server recorded it at the time — in the
              language they read it in, with the English beneath when that differs. */}
          <Detail label="Consent given" wide>
            {r.consentText}
          </Detail>
          {r.consentTextEn && r.consentTextEn !== r.consentText && (
            <Detail label="Consent given (English)" wide>
              {r.consentTextEn}
            </Detail>
          )}
        </DefinitionGrid>

        <section aria-labelledby="request-file">
          <h3 id="request-file" className="t-overline mb-2">
            File requested
          </h3>
          <div className="flex items-center gap-3 border border-border p-3">
            <Thumb src={r.file.imageUrl} size={56} />
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
              <div className="text-body text-muted">
                {r.file.title ?? "—"}
                {r.file.productSku && (
                  <>
                    {" · "}
                    <span className="t-code-sm">{r.file.productSku}</span>
                  </>
                )}
              </div>
              {r.file.fileName && (
                <div className="t-code-sm truncate text-muted" title={r.file.fileName}>
                  {r.file.fileName}
                </div>
              )}
            </div>
            {/* The download was deleted after the request (02 §6: a fault, kept). */}
            {!r.file.stillListed && (
              <Badge tone="danger" className="ml-auto">
                Since removed
              </Badge>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

/**
 * Resource requests: every "File Requests" form submitted on the Datasheets,
 * User Manuals and Certificates pages, as a split view like Quote requests.
 */
export default function ResourceRequests() {
  const [data, setData] = useState<ResourceRequestsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<EnquiryFilter>("all");
  const { selectedId, select, hrefFor } = useSelection();
  const { busy, setHandled } = useMarkHandled(
    (id) => `/api/resource-requests/${id}/handled`,
    (res) => setData((d) => d && { ...d, requests: withHandled(d.requests, res) }),
    "resource request",
  );

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
  const shown = filterEnquiries(requests, filter, query, (r) => [r.name, r.company, r.email]);
  const selected = selectedId ? requests.find((r) => r.id === selectedId) ?? null : null;

  return (
    <>
      <PageHeader
        title="Resource requests"
        description="Details entered on the Datasheets, User Manuals and Certificates pages before a file is downloaded."
        actions={
          <Button variant="secondary" size="sm" disabled={requests.length === 0} onClick={() => exportRequests(requests)}>
            Export CSV
          </Button>
        }
      />

      {error && <Alert tone="danger">{error}</Alert>}

      {!loading && !error && requests.length === 0 && (
        <EmptyState
          title="No resource requests yet"
          description="Requests from the Datasheets, User Manuals and Certificates pages will show up here."
        />
      )}

      {!error && (loading || requests.length > 0) && (
        <SplitView
          className="lg:flex-1"
          listLabel="Resource requests"
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
                  searchLabel="Search resource requests"
                />
                {shown.length === 0 ? (
                  <p className="px-5 py-6 text-body text-muted">No resource requests match.</p>
                ) : (
                  <ul>
                    {shown.map((r) => (
                      <li key={r.id}>
                        <SplitListItem
                          to={hrefFor(r.id)}
                          selected={r.id === selectedId}
                          title={r.name}
                          subtitle={r.company ?? r.email}
                          meta={formatShortDate(r.createdAt)}
                          badge={isNew(r) ? <Badge tone="new">New</Badge> : undefined}
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
              <RequestDetail
                request={selected}
                busy={busy === selected.id}
                onHandled={(handled) => void setHandled(selected.id, handled)}
              />
            ) : (
              <>
                <SplitDetailHeader title="Not found" />
                <p className="px-6 py-5 text-body text-muted">There's no resource request with that link in the list.</p>
              </>
            )
          }
          emptyDetail={
            <EmptyState
              className="m-6"
              title="Select a resource request"
              description="Its details and the file requested show here."
            />
          }
        />
      )}
    </>
  );
}
