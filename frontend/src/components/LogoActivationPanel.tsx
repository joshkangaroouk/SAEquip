import { Link } from "react-router-dom";
import { Badge, Card, CardHeader } from "./ui";
import type { ProductLogoEntry } from "../lib/types";

/**
 * Per-product logo activation. Renders the whole catalog for a kind as toggle
 * cards; the parent owns which ids are active.
 *
 * Toggling used to apply immediately (PUT/DELETE per click). It is now part of
 * the page's unified save, so a toggle only stages a change — the "Unsaved"
 * badge and the save bar are what tell the user it hasn't committed yet.
 */
export function LogoActivationPanel({
  id,
  kind,
  title,
  entries,
  activeIds,
  onToggle,
  dirty,
}: {
  id: string;
  kind: "SA_LOGO" | "CERT_LOGO";
  title: string;
  entries: ProductLogoEntry[];
  activeIds: string[];
  onToggle: (logoId: string) => void;
  dirty: boolean;
}) {
  const active = new Set(activeIds);

  return (
    <Card id={id}>
      <CardHeader
        title={title}
        description={
          <>
            Select which logos display on this product. Manage the catalog in{" "}
            <Link to="/logos" className="text-text underline underline-offset-2 hover:text-muted">
              Logos
            </Link>
            .
          </>
        }
        actions={
          <>
            {dirty && <Badge tone="accent">Unsaved</Badge>}
            {entries.length > 0 && <Badge tone="neutral">{active.size} active</Badge>}
          </>
        }
      />

      {entries.length === 0 ? (
        <p className="text-body text-subtle">
          No {kind === "SA_LOGO" ? "SA" : "Cert"} logos in the catalog yet —{" "}
          <Link to="/logos" className="text-text underline underline-offset-2 hover:text-muted">
            add some
          </Link>
          .
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {entries.map((entry) => {
            const on = active.has(entry.id);
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onToggle(entry.id)}
                aria-pressed={on}
                className={`flex flex-col items-center rounded-lg border-2 p-2 text-left transition ${
                  on ? "border-accent bg-accent/10" : "border-border hover:border-subtle"
                }`}
              >
                <div className="flex h-16 w-full items-center justify-center bg-surface-2">
                  <img
                    src={entry.url}
                    alt={entry.alt || entry.label || "logo"}
                    className="max-h-16 max-w-full object-contain"
                  />
                </div>
                <div className="mt-2 flex w-full items-center justify-between gap-1">
                  <span className="truncate text-small text-muted" title={entry.label ?? ""}>
                    {entry.label || "—"}
                  </span>
                  <span
                    className={`inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full px-1 ${
                      on ? "justify-end bg-accent" : "justify-start bg-surface-2"
                    }`}
                  >
                    <span className="h-3.5 w-3.5 rounded-full bg-surface shadow-sm" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
