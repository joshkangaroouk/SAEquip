import { Check, Languages, TriangleAlert } from "lucide-react";
import { Button, Modal, Spinner } from "./ui";
import type { LangProgress } from "../lib/translations";

function statusText(p: LangProgress): string {
  switch (p.phase) {
    case "waiting":
      return "Waiting…";
    case "needs-click":
      return "Needs a one-off download on this computer";
    case "downloading":
      // A first-time download of the language, once per computer.
      return `Downloading the ${p.label} translator… ${Math.round(p.downloaded * 100)}%`;
    case "translating":
      return `Translating ${Math.min(p.done + 1, p.total)} of ${p.total}…`;
    case "saving":
      return "Saving…";
    case "done":
      if (p.total === 0) return "Already up to date";
      return p.rejected
        ? `${p.saved} translated · ${p.rejected} kept in English`
        : `${p.saved} translated`;
    case "failed":
      return p.error ?? "Couldn't translate";
  }
}

function fraction(p: LangProgress): number {
  if (p.phase === "done" || p.phase === "saving") return 1;
  if (p.phase === "downloading") return p.downloaded * 0.25;
  if (p.phase === "translating" && p.total) return 0.25 + (p.done / p.total) * 0.75;
  return 0;
}

/**
 * "Saving for multi-languages…" — shown while Chrome's on-device translator
 * turns what was just saved into the site's other languages. The English is
 * already saved by the time this opens, which is why "Skip" is always safe:
 * whatever is skipped stays in English until translated from the
 * Translations page.
 */
export function TranslationProgressModal({
  progress,
  onSkip,
  onDownload,
  title = "Saving for multi-languages…",
}: {
  progress: LangProgress[] | null;
  onSkip: () => void;
  /** ⚠️ Must reach TranslatorSet.retry() synchronously — the click IS the permission. */
  onDownload: (locale: LangProgress["locale"]) => void;
  title?: string;
}) {
  return (
    <Modal
      open={progress !== null}
      onClose={() => undefined}
      dismissable={false}
      title={
        <span className="flex items-center gap-2">
          <Languages size={20} className="text-accent" aria-hidden="true" />
          {title}
        </span>
      }
      description="Translating on this computer. Your English changes are already saved."
      footer={
        <Button variant="secondary" size="sm" onClick={onSkip}>
          Skip for now
        </Button>
      }
    >
      <ul className="space-y-3" aria-live="polite">
        {(progress ?? []).map((p) => (
          <li key={p.locale}>
            <div className="flex items-center justify-between gap-3 text-small">
              <span className="font-semibold text-text">{p.label}</span>
              <span
                className={p.phase === "failed" ? "text-danger" : "text-muted"}
              >
                <span className="inline-flex items-center gap-1.5">
                  {p.phase === "done" && !p.rejected && <Check size={14} className="text-success" aria-hidden="true" />}
                  {(p.phase === "failed" || (p.phase === "done" && p.rejected > 0)) && (
                    <TriangleAlert size={14} className={p.phase === "failed" ? "text-danger" : "text-muted"} aria-hidden="true" />
                  )}
                  {(p.phase === "translating" || p.phase === "saving" || p.phase === "downloading") && <Spinner className="text-muted" />}
                  {statusText(p)}
                </span>
              </span>
            </div>
            {p.phase === "needs-click" && (
              <div className="mt-2 flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-2 px-3 py-2">
                <p className="min-w-0 flex-1 text-small text-muted">
                  Chrome downloads each language once per computer, and only when you click.
                </p>
                <Button size="xs" onClick={() => onDownload(p.locale)}>
                  Download {p.label}
                </Button>
              </div>
            )}
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${p.phase === "failed" ? "bg-danger/60" : "bg-accent"}`}
                style={{ width: `${Math.round(fraction(p) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
