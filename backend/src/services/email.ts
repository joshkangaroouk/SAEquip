import { Resend } from "resend";
import { env } from "../env.js";
import type { QuoteRequest, QuoteRequestItem } from "@prisma/client";

let loggedNotConfigured = false;

/** True only when all three Resend env vars are present. */
export function isEmailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY && env.QUOTE_NOTIFY_FROM && env.QUOTE_NOTIFY_TO);
}

type SendResult = { sent: true } | { sent: false; reason: "not_configured" | "send_failed" };

function formatOptions(options: unknown): string {
  if (!options || typeof options !== "object") return "";
  return Object.entries(options as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}

function buildSummary(quote: QuoteRequest, items: QuoteRequestItem[]): string {
  const contactLines = [
    `Name: ${quote.name}`,
    `Email: ${quote.email}`,
    quote.company ? `Company: ${quote.company}` : null,
    quote.phone ? `Phone: ${quote.phone}` : null,
  ].filter(Boolean);

  const itemLines = items.map((item) => {
    const details = [
      item.sku ? `SKU: ${item.sku}` : null,
      `Qty: ${item.quantity}`,
      item.price ? `Price: ${item.price}` : null,
      formatOptions(item.options) || null,
    ]
      .filter(Boolean)
      .join(" · ");
    return `- ${item.name}${details ? ` (${details})` : ""}`;
  });

  const parts = [
    "New quote request",
    "",
    ...contactLines,
    quote.message ? `\nMessage:\n${quote.message}` : null,
    "\nItems:",
    ...itemLines,
  ].filter((l): l is string => l !== null);

  return parts.join("\n");
}

/**
 * Sends a plain-text notification email for a new quote request. No-op (and
 * logs once) if Resend isn't configured. A send failure is caught and never
 * thrown — email is a best-effort side effect, not part of the request contract.
 */
export async function sendQuoteNotification(
  quote: QuoteRequest,
  items: QuoteRequestItem[],
): Promise<SendResult> {
  if (!isEmailConfigured()) {
    if (!loggedNotConfigured) {
      console.log(
        "[email] Resend not configured (RESEND_API_KEY / QUOTE_NOTIFY_FROM / QUOTE_NOTIFY_TO) — quote notifications disabled",
      );
      loggedNotConfigured = true;
    }
    return { sent: false, reason: "not_configured" };
  }

  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: env.QUOTE_NOTIFY_FROM!,
      to: env.QUOTE_NOTIFY_TO!,
      subject: `New quote request from ${quote.name}`,
      text: buildSummary(quote, items),
    });
    if (error) {
      console.error("[email] Resend send failed:", error);
      return { sent: false, reason: "send_failed" };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] Resend send threw:", err);
    return { sent: false, reason: "send_failed" };
  }
}
