import DOMPurify from "dompurify";

/**
 * Renders trusted-but-HTML product content after sanitizing it with DOMPurify.
 * Uses Tailwind arbitrary variants for light typography (no typography plugin).
 */
export function RichHtml({ html, className = "" }: { html: string; className?: string }) {
  const clean = DOMPurify.sanitize(html);
  return (
    <div
      className={
        "text-sm leading-relaxed text-text " +
        // ⚠ Mirrors how the description actually renders on the product page:
        // the widget's Overview tab, whose `.saeh-prose p + p` is
        // `margin-top:12px`. Keep in step with RichTextEditor.tsx and with
        // injectStyles() in widget.js — the editor, this preview and the live
        // page must agree or the editor stops being trustworthy. See CLAUDE.md
        // before changing the value.
        //
        // ⚠ `mt-[12px]`, NOT `mt-3`. Tailwind's spacing scale is rem-based and
        // `html` is set to font-size:110%, so `mt-3` (0.75rem) resolves to
        // 13.2px here while the widget renders a literal 12px — a 1.2px drift
        // that only appears on the live page. Absolute px on both sides is the
        // only way these two stay equal.
        "[&_p]:my-0 [&_p+p]:mt-[12px] [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 " +
        "[&_img]:inline [&_img]:align-middle [&_img]:mr-1 " +
        "[&_a]:text-text [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-muted " +
        className
      }
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
