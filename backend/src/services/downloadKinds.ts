import type { CertScheme, DownloadKind } from "@prisma/client";

/**
 * Download types and certificate schemes: what each resources page shows, and
 * the button labels on it.
 *
 * Plain data, no imports beyond types — the public route and the backfill both
 * use it, and the public route is in the serverless function's import graph.
 */

/** `?type=` on /public/resources → the kind it lists. */
export const RESOURCE_TYPES: Record<string, DownloadKind> = {
  datasheet: "DATASHEET",
  manual: "MANUAL",
  certificate: "CERTIFICATE",
};

/** The button on a Datasheets / User Manuals row. Certificates use the scheme. */
export const KIND_BUTTON: Record<DownloadKind, string> = {
  DATASHEET: "Download Datasheet",
  MANUAL: "Download User Manual",
  CERTIFICATE: "Download Certificate",
};

/** The certificate buttons, in the order they appear on a row. */
export const SCHEME_ORDER: CertScheme[] = ["INMETRO", "UKEX", "IECEX", "EX", "COMPLIANCE"];
export const SCHEME_BUTTON: Record<CertScheme, string> = {
  INMETRO: "INMETRO",
  UKEX: "UKEX",
  IECEX: "IECEX",
  EX: "EX",
  COMPLIANCE: "Compliance",
};

/**
 * The imported titles → type and scheme. Closed: anything else is a hard failure
 * in the backfill rather than a guess, since a certificate under the wrong
 * scheme on hazardous-area equipment is the worst thing to get wrong quietly.
 * ATEX is "EX" — the old site's button label.
 */
export const TITLE_CLASSIFICATION: Record<string, { kind: DownloadKind; certScheme: CertScheme | null }> = {
  Datasheet: { kind: "DATASHEET", certScheme: null },
  "User Manual": { kind: "MANUAL", certScheme: null },
  "ATEX Certificate": { kind: "CERTIFICATE", certScheme: "EX" },
  "IECEx Certificate": { kind: "CERTIFICATE", certScheme: "IECEX" },
  "UKEX Certificate": { kind: "CERTIFICATE", certScheme: "UKEX" },
  "INMETRO Certificate": { kind: "CERTIFICATE", certScheme: "INMETRO" },
  /* The one generic title: the SA Filtration Unit compliance statement (on two
     products), which is none of the four schemes. */
  Certificate: { kind: "CERTIFICATE", certScheme: "COMPLIANCE" },
};

/**
 * The resource request form's two checkboxes, word for word.
 *
 * ⚠️ The SERVER's copy is what a request records as consented to, so it must
 * match what the widget shows. `widget:test` reads both and fails if they
 * differ — change the wording in widget.js and here together.
 */
export const CONSENT_TEXT = {
  privacy: "I agree to my data being stored in line with our Privacy Policy",
  marketing: "I'm happy to receive the latest news and promotions by email.",
} as const;
