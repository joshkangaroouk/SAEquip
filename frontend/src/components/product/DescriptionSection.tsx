import { useState } from "react";
import { Badge, Card, CardHeader, RichTextEditor, Textarea } from "../ui";

/**
 * Product description editor — a WYSIWYG (tiptap) with a raw-HTML escape hatch.
 *
 * Tiptap normalises markup it parses, so the risk is silently rewriting Duda's
 * legacy WordPress HTML. Two things contain that:
 *
 *  1. RichTextEditor only reports genuine user edits, so opening a product and
 *     changing nothing leaves the stored HTML untouched.
 *  2. If tiptap's parse differs from what's stored, we say so and offer the HTML
 *     view — because for migrated content, seeing the real markup is sometimes
 *     the only way to fix it.
 */
export function DescriptionSection({
  value,
  onChange,
  dirty,
}: {
  value: string;
  onChange: (html: string) => void;
  dirty: boolean;
}) {
  const [mode, setMode] = useState<"rich" | "html">("rich");
  const [wouldReformat, setWouldReformat] = useState(false);

  return (
    <Card id="section-description">
      <CardHeader
        title="Description"
        description="Shown on the product page in Duda."
        actions={
          <>
            {dirty && <Badge tone="accent">Unsaved</Badge>}
            <div className="flex rounded-md border border-border p-0.5">
              {(["rich", "html"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded px-2 py-0.5 text-xs font-semibold transition-colors ${
                    mode === m
                      ? "bg-accent text-accent-foreground"
                      : "text-muted hover:text-text"
                  }`}
                >
                  {m === "rich" ? "Rich text" : "HTML"}
                </button>
              ))}
            </div>
          </>
        }
      />

      {mode === "rich" && wouldReformat && !dirty && (
        <p className="mb-3 rounded-md border border-border bg-surface-2 px-3 py-2 text-small text-muted">
          This description was written elsewhere, so editing it here will tidy the underlying HTML.
          Switch to <span className="font-semibold">HTML</span> if you need the original markup kept
          exactly as-is.
        </p>
      )}

      {mode === "rich" ? (
        <RichTextEditor
          value={value}
          onChange={onChange}
          onNormalisedDiffers={setWouldReformat}
        />
      ) : (
        <Textarea
          size="sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-56 font-mono"
          placeholder="<p>Product description…</p>"
          spellCheck={false}
        />
      )}
    </Card>
  );
}
