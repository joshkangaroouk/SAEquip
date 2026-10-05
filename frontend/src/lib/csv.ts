/**
 * CSV export for the pages that list what the PUBLIC typed — quote requests and
 * resource requests. One copy of the guard, so neither export can lose it.
 */

/**
 * One CSV cell.
 *
 * ⚠️ FORMULA INJECTION: every one of these values is typed by a member of the
 * public. A spreadsheet runs any cell starting with `=`, `+`, `-` or `@` (and
 * some read a leading tab or CR the same way), so a "name" of `=HYPERLINK(…)`
 * would execute on whoever opened the export. Prefixing a single quote makes it
 * text — the OWASP mitigation, and the same guard the products export uses
 * (backend services/csv.ts).
 */
export function csvEscape(raw: string): string {
  const value = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Build the file and hand it to the browser as a download. */
export function downloadCsv(filename: string, header: string[], rows: string[][]) {
  // The BOM makes Excel read the file as UTF-8 — names like "Curaçao" or an
  // accented surname otherwise arrive garbled.
  const csv = "﻿" + [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
