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

/**
 * Parse a CSV file (RFC 4180: quoted fields, doubled quotes, CRLF or LF, a
 * leading BOM). For importing a file this dashboard exported and a person
 * edited in a spreadsheet.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** Undo csvEscape()'s formula guard on a cell read back in. */
export function csvUnguard(cell: string): string {
  return /^'[=+\-@\t\r]/.test(cell) ? cell.slice(1) : cell;
}
