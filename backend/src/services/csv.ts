/**
 * CSV for spreadsheets — RFC 4180 quoting, plus the two things that make a
 * file open correctly in Excel rather than merely parse.
 */

/** A cell: text, a number, or empty. Numbers are written bare so they stay numeric. */
export type Cell = string | number | null | undefined;

/**
 * ⚠️ FORMULA INJECTION. A spreadsheet executes any cell that starts with `=`,
 * `+`, `-` or `@` (and some read a leading tab or CR the same way), so a
 * product name typed as `=HYPERLINK("https://…","Click")` — or worse, a DDE
 * payload — would run on whoever opened the export. These fields are
 * staff-editable and come from Duda, so they are not trusted.
 *
 * The OWASP mitigation: prefix such TEXT cells with a single quote, which
 * spreadsheets treat as "this is text" and do not display. Numbers are not
 * touched — they are written as numbers, never as strings that could carry a
 * formula — which is why a negative number is safe and a string "-5" is not.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

function cell(v: Cell): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  const text = FORMULA_LEAD.test(v) ? `'${v}` : v;
  // Quote only when needed: a comma, a quote or a line break would otherwise
  // shift every column after it. Inner quotes are doubled.
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Header plus rows to CSV text.
 *
 * ⚠️ Starts with a UTF-8 BOM. Without it Excel assumes the system codepage,
 * and the catalogue's degree signs, en dashes and curly quotes ("-40°C",
 * "2560m³/hr") arrive as mojibake. CRLF line endings, as RFC 4180 specifies
 * and Excel expects.
 */
export function toCsv(header: string[], rows: Cell[][]): string {
  const lines = [header.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}
