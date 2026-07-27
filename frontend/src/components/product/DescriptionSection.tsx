import { useRef, useState } from "react";
import { Badge, Button, Card, CardHeader, Textarea } from "../ui";
import { RichHtml } from "../RichHtml";

/**
 * Two-pane raw-HTML editor for the product description.
 *
 * Deliberately NOT a WYSIWYG: every rich-text editor normalises markup when it
 * loads, so merely opening a product and saving anything else would silently
 * rewrite Duda's existing (legacy WordPress) HTML. Staff also need to see and
 * fix that markup during migration, not just style it.
 *
 * The preview runs through DOMPurify while the textarea is what actually
 * saves — the header says so, because the two can legitimately differ.
 */
const WRAPS: { label: string; before: string; after: string }[] = [
  { label: "Paragraph", before: "<p>", after: "</p>" },
  { label: "Bold", before: "<strong>", after: "</strong>" },
  { label: "List", before: "<ul>\n  <li>", after: "</li>\n</ul>" },
  { label: "Link", before: '<a href="https://">', after: "</a>" },
];

export function DescriptionSection({
  value,
  onChange,
  dirty,
}: {
  value: string;
  onChange: (next: string) => void;
  dirty: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [showPreview, setShowPreview] = useState(true);

  /** Wraps the selection (or inserts at the caret) without losing focus. */
  function wrap(before: string, after: string) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const selected = value.slice(start, end);
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onChange(next);
    // Restore a sensible caret after React re-renders the value.
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + before.length + selected.length;
      el.setSelectionRange(caret, caret);
    });
  }

  return (
    <Card id="section-description">
      <CardHeader
        title="Description"
        description="Raw HTML — this is what saves to Duda. The preview is sanitised for display only."
        actions={
          <>
            {dirty && <Badge tone="accent">Unsaved</Badge>}
            <Button variant="ghost" size="sm" onClick={() => setShowPreview((p) => !p)}>
              {showPreview ? "Hide preview" : "Show preview"}
            </Button>
          </>
        }
      />

      <div className="mb-2 flex flex-wrap gap-2">
        {WRAPS.map((w) => (
          <Button key={w.label} variant="secondary" size="sm" onClick={() => wrap(w.before, w.after)}>
            {w.label}
          </Button>
        ))}
      </div>

      <div className={showPreview ? "grid grid-cols-1 gap-4 lg:grid-cols-2" : ""}>
        <Textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-64 font-mono text-small"
          placeholder="<p>Product description…</p>"
          spellCheck={false}
        />
        {showPreview && (
          <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-surface-2 p-4">
            {value.trim() ? (
              <RichHtml html={value} />
            ) : (
              <p className="text-small text-subtle">Nothing to preview yet.</p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
