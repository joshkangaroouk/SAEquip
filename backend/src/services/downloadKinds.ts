import type { CertScheme, DownloadKind } from "@prisma/client";
import type { Locale } from "./i18n/locales.js";

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
 * The resource request form's two checkboxes, word for word, in every language
 * the widget speaks. `privacy` is the WHOLE sentence, link text included, as
 * the visitor reads it.
 *
 * ⚠️ The SERVER's copy is what a request records as consented to, so each
 * language must match what the widget shows for that language. `widget:test`
 * builds every language's sentence from the widget's own table and fails if
 * any differs — or if either side has a language the other lacks. Change the
 * wording in widget.js and here together.
 *
 * ⚠️ Non-English wording was machine-drafted (2026-10-06) and needs a
 * native-speaker review before it is relied on — it is legal text.
 */
export const CONSENT_TEXT: Record<Locale, { privacy: string; marketing: string }> = {
  en: {
    privacy: "I agree to my data being stored in line with our Privacy Policy",
    marketing: "I'm happy to receive the latest news and promotions by email.",
  },
  ar: {
    privacy: "أوافق على تخزين بياناتي بما يتوافق مع سياسة الخصوصية",
    marketing: "يسعدني تلقي آخر الأخبار والعروض الترويجية عبر البريد الإلكتروني.",
  },
  zh: {
    privacy: "我同意按照我们的隐私政策存储我的数据",
    marketing: "我愿意通过电子邮件接收最新消息和促销信息。",
  },
  fr: {
    privacy: "J'accepte que mes données soient conservées conformément à notre Politique de confidentialité",
    marketing: "J'accepte de recevoir les dernières actualités et promotions par e-mail.",
  },
  de: {
    privacy: "Ich bin mit der Speicherung meiner Daten gemäß unserer Datenschutzerklärung einverstanden",
    marketing: "Ich möchte die neuesten Nachrichten und Angebote per E-Mail erhalten.",
  },
  "pt-br": {
    privacy: "Concordo que meus dados sejam armazenados de acordo com nossa Política de Privacidade",
    marketing: "Aceito receber as últimas novidades e promoções por e-mail.",
  },
  es: {
    privacy: "Acepto que mis datos se almacenen de acuerdo con nuestra Política de privacidad",
    marketing: "Acepto recibir las últimas noticias y promociones por correo electrónico.",
  },
};
