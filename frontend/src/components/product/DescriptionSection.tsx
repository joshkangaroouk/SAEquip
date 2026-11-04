import { useMemo, useState } from "react";
import { Alert, RichTextEditor, SegmentedControl, Textarea } from "../ui";
import { EditorSection } from "./EditorSection";

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
 *
 * Its own EditorSection (10 §4): the Rich text / HTML switch sits on the
 * header's right, with the word count. `section-description` is the anchor
 * a failed details pill opens on the Content tab.
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
  const words = useMemo(() => wordCount(value), [value]);

  return (
    <EditorSection
      id="section-description"
      title="Description"
      description="Shown in the Overview tab of the product page."
      meta={`${words} ${words === 1 ? "word" : "words"}`}
      actions={
        <SegmentedControl
          ariaLabel="Description editor"
          value={mode}
          onChange={setMode}
          options={[
            { value: "rich", label: "Rich text" },
            { value: "html", label: "HTML" },
          ]}
        />
      }
    >

      {mode === "rich" && wouldReformat && !dirty && (
        <Alert tone="info" live="off" className="mb-3">
          This description was written elsewhere, so editing it here will tidy the underlying HTML.
          Switch to <span className="font-semibold">HTML</span> if you need the original markup kept
          exactly as-is.
        </Alert>
      )}

      {mode === "rich" ? (
        <RichTextEditor
          ariaLabel="Description"
          value={value}
          onChange={onChange}
          onNormalisedDiffers={setWouldReformat}
        />
      ) : (
        <Textarea
          size="sm"
          aria-label="Description HTML"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-56 font-mono"
          placeholder="<p>Product description…</p>"
          spellCheck={false}
        />
      )}
    </EditorSection>
  );
}

/** The words a reader sees: the HTML's text, parsed inertly (nothing in it runs). */
function wordCount(html: string): number {
  const text = new DOMParser().parseFromString(html || "", "text/html").body.textContent ?? "";
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
