/**
 * Download types and certificate schemes, as the product editor offers them.
 *
 * The type decides which public resources page lists a file (Datasheets, User
 * Manuals, Certificates); a certificate's scheme decides which button it sits
 * under there. The values mirror the Prisma enums `DownloadKind`/`CertScheme`,
 * and the backend's own labels live in `services/downloadKinds.ts`.
 */
export type DownloadKind = "DATASHEET" | "MANUAL" | "CERTIFICATE";
export type CertScheme = "INMETRO" | "UKEX" | "IECEX" | "EX" | "COMPLIANCE";

export const KIND_OPTIONS: { value: DownloadKind; label: string }[] = [
  { value: "DATASHEET", label: "Datasheet" },
  { value: "MANUAL", label: "User Manual" },
  { value: "CERTIFICATE", label: "Certificate" },
];

/** In the order the buttons appear on the Certificates page. */
export const SCHEME_OPTIONS: { value: CertScheme; label: string }[] = [
  { value: "INMETRO", label: "INMETRO" },
  { value: "UKEX", label: "UKEX" },
  { value: "IECEX", label: "IECEx" },
  { value: "EX", label: "EX (ATEX)" },
  { value: "COMPLIANCE", label: "Compliance" },
];

/** The title a download gets for its type — the labels the imported files carry. */
export function canonicalTitle(kind: DownloadKind | null, scheme: CertScheme | null): string | null {
  switch (kind) {
    case "DATASHEET":
      return "Datasheet";
    case "MANUAL":
      return "User Manual";
    case "CERTIFICATE":
      switch (scheme) {
        case "EX":
          return "ATEX Certificate";
        case "IECEX":
          return "IECEx Certificate";
        case "UKEX":
          return "UKEX Certificate";
        case "INMETRO":
          return "INMETRO Certificate";
        case "COMPLIANCE":
          return "Compliance Statement";
        default:
          return "Certificate";
      }
    default:
      return null;
  }
}

/** Every title `canonicalTitle` can produce. */
export const CANONICAL_TITLES = new Set([
  "Datasheet",
  "User Manual",
  "Certificate",
  "ATEX Certificate",
  "IECEx Certificate",
  "UKEX Certificate",
  "INMETRO Certificate",
  "Compliance Statement",
]);

/**
 * A first title for a newly added file: the filename without its extension,
 * underscores spaced out. Only a starting point until a type is chosen.
 */
export const titleFromFilename = (name: string) =>
  name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_]+/g, " ")
    .trim()
    .slice(0, 200);

/**
 * The title after a type or scheme change. It follows the type only while
 * nobody has typed it — empty, the filename default, or a title an earlier
 * type choice filled in. A title someone wrote is never overwritten.
 */
export function retitle(
  current: { title: string; filename: string },
  kind: DownloadKind | null,
  scheme: CertScheme | null,
): string {
  const automatic =
    !current.title.trim() || current.title === titleFromFilename(current.filename) || CANONICAL_TITLES.has(current.title);
  return automatic ? (canonicalTitle(kind, scheme) ?? current.title) : current.title;
}
