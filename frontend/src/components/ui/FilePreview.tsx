import { useState } from "react";
import { cn } from "../../lib/cn";

/**
 * Colour and label per format. The colours are the conventions people already
 * read files by (PDF red, Word blue, Excel green), so a type is recognisable
 * before the label is read.
 */
const TYPES: { test: RegExp; label: string; color: string }[] = [
  { test: /\.pdf$|application\/pdf/i, label: "PDF", color: "#D93025" },
  { test: /\.docx?$|msword|wordprocessingml/i, label: "DOC", color: "#2B579A" },
  { test: /\.xlsx?$|spreadsheetml|ms-excel/i, label: "XLS", color: "#217346" },
  { test: /\.zip$|application\/zip/i, label: "ZIP", color: "#B7791F" },
  { test: /\.glb$|model\/gltf/i, label: "3D", color: "#6D28D9" },
];

/**
 * ⚠️ Filename and MIME type are tested SEPARATELY. The extension patterns are
 * anchored with `$`, so joining the two into one probe string meant a file
 * with no reported type became `"x.docx "` — trailing space — and silently fell
 * through to the generic icon.
 */
function typeOf(filename: string, mimeType?: string) {
  return (
    TYPES.find((t) => t.test.test(filename) || (!!mimeType && t.test.test(mimeType))) ?? {
      label: "FILE",
      color: "#6B7280",
    }
  );
}

/**
 * A document shape with its format on a coloured band — the fallback when a
 * file has no rendered preview (a Word or Excel file, or a PDF that has not
 * been rendered yet).
 */
export function FileTypeIcon({
  filename,
  mimeType,
  className,
}: {
  filename: string;
  mimeType?: string;
  className?: string;
}) {
  const t = typeOf(filename, mimeType);
  return (
    <svg viewBox="0 0 32 40" className={cn("h-10 w-8 shrink-0", className)} role="img" aria-label={`${t.label} file`}>
      <path d="M4 1h17l10 10v26a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2Z" fill="#fff" stroke="#D4D4D4" strokeWidth="1.2" />
      <path d="M21 1v8a2 2 0 0 0 2 2h8" fill="none" stroke="#D4D4D4" strokeWidth="1.2" />
      <rect x="0" y="22" width="25" height="11" rx="1.5" fill={t.color} />
      <text
        x="12.5"
        y="30.2"
        textAnchor="middle"
        fontSize="7.4"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        fill="#fff"
        letterSpacing="0.3"
      >
        {t.label}
      </text>
    </svg>
  );
}

/**
 * A file's preview: the rendered first page when there is one, the file-type
 * icon otherwise. One component for the Media Centre, the file picker and the
 * product editor's downloads, so the three cannot drift.
 *
 * ⚠️ The image is `object-contain` on white. Datasheets render LANDSCAPE and
 * certificates PORTRAIT A4, so any fixed crop would cut one of them badly.
 *
 * A preview that fails to load (a deleted object, a network blip) falls back
 * to the icon rather than leaving a broken-image glyph in the grid.
 */
export function FilePreview({
  thumbnailUrl,
  filename,
  mimeType,
  className,
  iconClassName,
}: {
  thumbnailUrl?: string | null;
  filename: string;
  mimeType?: string;
  /** Sizes the box; the image fits inside it. */
  className?: string;
  iconClassName?: string;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={cn("flex items-center justify-center overflow-hidden bg-white", className)}>
      {thumbnailUrl && !broken ? (
        <img
          src={thumbnailUrl}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        <FileTypeIcon filename={filename} mimeType={mimeType} className={iconClassName} />
      )}
    </span>
  );
}
