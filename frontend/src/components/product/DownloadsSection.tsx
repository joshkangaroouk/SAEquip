import { useState } from "react";
import { Badge, Button, Card, CardHeader, SectionError, DragHandle, FilePreview, Input, Select, SortableList } from "../ui";
import { MediaPicker } from "../MediaPicker";
import type { MediaAsset } from "../../lib/types";
import type { DownloadDraft } from "./productEditorTypes";
import {
  KIND_OPTIONS,
  SCHEME_OPTIONS,
  retitle,
  titleFromFilename,
  type CertScheme,
  type DownloadKind,
} from "../../lib/downloadKinds";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The product's downloadable files — datasheets, manuals, certificates.
 *
 * Staged in the unified draft like every other section: nothing is written
 * until Save, which sends the whole list through `PUT /products/:id/downloads`.
 *
 * ⚠️ No gated toggle: EVERY file is gated (decided 2026-10-05), so a visitor
 * fills in the resource request form before it opens, and a newly added file
 * is written `gated: true` by the server. Requests are listed on the Resource
 * Requests page. Removing a file here keeps its requests — each one carries a
 * snapshot of the file and product it was for.
 *
 * Each file has a TYPE — Datasheet, User Manual or Certificate — which decides
 * the public resources page that lists it, and a certificate has a SCHEME,
 * which decides the button it sits under there. Both are required to save, so
 * nothing lands on the wrong page by default.
 *
 * ⚠️ A file can be on a product only once — `@@unique([hubProductId,
 * mediaAssetId])` — so adding one that is already listed is refused here with
 * a message, rather than surfacing later as a 400 from Save.
 */
export function DownloadsSection({
  value,
  onChange,
  dirty,
  error,
}: {
  value: DownloadDraft[];
  onChange: (next: DownloadDraft[]) => void;
  dirty: boolean;
  error?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function handlePick(asset: MediaAsset) {
    setPickerOpen(false);
    if (value.some((d) => d.mediaAssetId === asset.id)) {
      setNotice(`“${asset.filename}” is already on this product.`);
      return;
    }
    setNotice(null);
    onChange([
      ...value,
      {
        mediaAssetId: asset.id,
        title: titleFromFilename(asset.filename),
        kind: null,
        certScheme: null,
        filename: asset.filename,
        sizeBytes: asset.sizeBytes,
        url: asset.url,
        thumbnailUrl: asset.thumbnailUrl ?? null,
      },
    ]);
  }

  const update = (id: string, patch: Partial<DownloadDraft>) =>
    onChange(value.map((d) => (d.mediaAssetId === id ? { ...d, ...patch } : d)));

  /** A type or scheme change, plus the matching title while the title is still automatic. */
  function retype(d: DownloadDraft, kind: DownloadKind | null, certScheme: CertScheme | null) {
    const scheme = kind === "CERTIFICATE" ? certScheme : null;
    update(d.mediaAssetId, { kind, certScheme: scheme, title: retitle(d, kind, scheme) });
  }

  return (
    <Card id="section-downloads">
      <CardHeader
        title="Downloads"
        description="Datasheets, user manuals and certificates for this product. The type decides which resources page lists each file. Drag to set the order."
        actions={
          <div className="flex items-center gap-2">
            {dirty && <Badge tone="accent">Unsaved</Badge>}
            <Button type="button" size="sm" onClick={() => setPickerOpen(true)}>
              + Add download
            </Button>
          </div>
        }
      />

      <SectionError message={error} />
      {notice && <p className="mb-3 text-small text-muted">{notice}</p>}

      {value.length === 0 ? (
        <p className="text-body text-subtle">No downloads on this product yet.</p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          {/* overflow-hidden clips the rows' square backgrounds to the rounded
              border; without it they paint over the corners, which is what
              read as the edge being cut off. */}
          <SortableList
            as="div"
            className="divide-y divide-border"
            items={value}
            getId={(d) => d.mediaAssetId}
            onReorder={onChange}
            renderItem={(d, handle) => (
              <div className="flex items-center gap-2.5 bg-surface px-2.5 py-2">
                <DragHandle handle={handle} />
                <FilePreview
                  thumbnailUrl={d.thumbnailUrl}
                  filename={d.filename}
                  className="h-14 w-11 shrink-0 rounded border border-border"
                  iconClassName="h-9 w-7"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-[10rem] flex-1">
                      <Input
                        size="xs"
                        value={d.title}
                        onChange={(e) => update(d.mediaAssetId, { title: e.target.value })}
                        aria-label={`Title for ${d.filename}`}
                        aria-invalid={!d.title.trim() || undefined}
                      />
                    </div>
                    {/* Widths on wrappers: Select's own w-full would win over a passed class. */}
                    <div className="w-36">
                      <Select
                        size="xs"
                        value={d.kind ?? ""}
                        onChange={(e) => retype(d, (e.target.value || null) as DownloadKind | null, d.certScheme)}
                        aria-label={`Type of ${d.filename}`}
                        aria-invalid={!d.kind || undefined}
                      >
                        <option value="" disabled>
                          Choose type…
                        </option>
                        {KIND_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    {d.kind === "CERTIFICATE" && (
                      <div className="w-36">
                        <Select
                          size="xs"
                          value={d.certScheme ?? ""}
                          onChange={(e) => retype(d, d.kind, (e.target.value || null) as CertScheme | null)}
                          aria-label={`Certificate scheme of ${d.filename}`}
                          aria-invalid={!d.certScheme || undefined}
                        >
                          <option value="" disabled>
                            Which certificate…
                          </option>
                          {SCHEME_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-subtle" title={d.filename}>
                    {d.filename} · {formatBytes(d.sizeBytes)}
                  </p>
                </div>
                {/*
                  * A file that could not be signed comes back with url: null
                  * rather than failing the whole editor — say so on its row,
                  * which is where the problem is.
                  */}
                {d.url ? (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded px-1.5 text-body font-semibold text-muted hover:text-text"
                  >
                    Preview
                  </a>
                ) : (
                  <span className="shrink-0 px-1.5 text-small text-danger" title="This file could not be found in storage.">
                    File missing
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((x) => x.mediaAssetId !== d.mediaAssetId))}
                  title={`Remove ${d.title || d.filename}`}
                  className="shrink-0 rounded px-1.5 text-body font-semibold text-muted hover:text-danger"
                >
                  Remove
                </button>
              </div>
            )}
          />
        </div>
      )}

      {pickerOpen && <MediaPicker kind="file" onPick={handlePick} onClose={() => setPickerOpen(false)} />}
    </Card>
  );
}
