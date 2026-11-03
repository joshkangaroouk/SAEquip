import { Link } from "react-router-dom";
import { Badge, Card, CardHeader, ToggleTrack } from "./ui";
import { cn } from "../lib/cn";
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
}: {
  id: string;
  kind: "SA_LOGO" | "CERT_LOGO";
  title: string;
  entries: ProductLogoEntry[];
  activeIds: string[];
  onToggle: (logoId: string) => void;
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
            {entries.length > 0 && <Badge tone="neutral">{active.size} active</Badge>}
          </>
        }
      />

      {entries.length === 0 ? (
        <p className="text-body text-muted">
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
                // On is the selected treatment (02a "After 4a"), not a yellow
                // tint: the --selected-bar edge on --selected-bg and a 600
                // label, beside the toggle that carries the state.
                className={cn(
                  "flex flex-col items-center border-2 p-2 text-left transition-colors duration-[120ms]",
                  on ? "border-selected-bar bg-selected" : "border-border hover:border-border-strong",
                )}
              >
                <div className="flex h-16 w-full items-center justify-center bg-paper">
                  {/* The visible label names the button, so with one the image
                      is decorative; without one the alt text is the name. */}
                  <img
                    src={entry.url}
                    alt={entry.label ? "" : entry.alt || "logo"}
                    className="max-h-16 max-w-full object-contain"
                  />
                </div>
                <div className="mt-2 flex w-full items-center justify-between gap-1">
                  <span
                    className={cn("truncate text-help", on ? "font-semibold text-text" : "text-muted")}
                    title={entry.label ?? ""}
                  >
                    {entry.label || "—"}
                  </span>
                  {/* The card is the toggle (aria-pressed); this only draws its state. */}
                  <ToggleTrack checked={on} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
