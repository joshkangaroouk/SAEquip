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
        "[&_p]:mb-2 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 " +
        "[&_img]:inline [&_img]:align-middle [&_img]:mr-1 " +
        "[&_a]:text-text [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-muted " +
        className
      }
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
