import { useId } from "react";
import { Card, CardHeader, Field, Input, Textarea } from "../ui";
import { LIVE_SITE_ORIGIN } from "../../lib/site";
import { cn } from "../../lib/cn";
import type { NativeForm } from "./productEditorTypes";

/** Roughly what Google shows before it cuts a title or description off. */
const TITLE_LIMIT = 55;
const DESCRIPTION_LIMIT = 160;

/**
 * The product's SEO fields (the SEO tab, 02a "Batch 8"): title, URL slug and
 * meta description — part of the `details` key, saved in the same PATCH as
 * the name. Live counters turn the warning colour past what Google usually
 * shows, and a preview shows roughly how the result reads.
 */
export function SeoSection({
  value,
  onChange,
  productName,
}: {
  value: NativeForm;
  onChange: (next: NativeForm) => void;
  /** Google falls back to the page's name when there is no SEO title. */
  productName: string;
}) {
  const titleCountId = useId();
  const descCountId = useId();
  const set = <K extends keyof NativeForm>(key: K, v: NativeForm[K]) => onChange({ ...value, [key]: v });

  const title = value.seo_title.trim() || productName;
  const slug = value.seo_product_url.trim();
  const host = new URL(LIVE_SITE_ORIGIN).host;

  return (
    <Card id="section-seo">
      <CardHeader title="SEO" />
      <div className="space-y-4">
        <Field label="Title" htmlFor="p-seo-title">
          <Input
            id="p-seo-title"
            size="sm"
            value={value.seo_title}
            onChange={(e) => set("seo_title", e.target.value)}
            aria-describedby={titleCountId}
          />
        </Field>
        <Counter id={titleCountId} count={value.seo_title.length} limit={TITLE_LIMIT} />

        <Field
          label="Product URL slug"
          htmlFor="p-seo-url"
          hint="The product page's address, and how the public widget finds it. Changing it breaks existing links."
        >
          <Input
            id="p-seo-url"
            size="sm"
            value={value.seo_product_url}
            onChange={(e) => set("seo_product_url", e.target.value)}
          />
        </Field>

        <Field label="Meta description" htmlFor="p-seo-desc">
          <Textarea
            id="p-seo-desc"
            size="sm"
            rows={3}
            value={value.seo_description}
            onChange={(e) => set("seo_description", e.target.value)}
            aria-describedby={descCountId}
          />
        </Field>
        <Counter id={descCountId} count={value.seo_description.length} limit={DESCRIPTION_LIMIT} />

        {/* Roughly how a search result reads. Theme colours, not Google's. */}
        <section aria-label="Search result preview" className="border border-border bg-surface-2 p-4">
          <p className="t-overline mb-2">Search result preview</p>
          <p className="truncate text-label text-muted">
            {host} › product › {slug || "…"}
          </p>
          <p className="mt-1 text-[1.125rem] font-medium leading-snug text-text">{clip(title, TITLE_LIMIT + 5)}</p>
          <p className="mt-1 text-help text-muted">
            {value.seo_description.trim() ? clip(value.seo_description.trim(), DESCRIPTION_LIMIT) : "No meta description: Google picks text from the page."}
          </p>
        </section>
      </div>
    </Card>
  );
}

/** "48 / 55", in the warning colour past the limit. Under its field, and described by it. */
function Counter({ id, count, limit }: { id: string; count: number; limit: number }) {
  const over = count > limit;
  return (
    <p id={id} className={cn("-mt-2 text-right text-label tabular-nums", over ? "text-warning" : "text-muted")}>
      {count} / {limit}
      <span className="sr-only">
        {" "}
        characters{over ? `, longer than Google usually shows` : ""}
      </span>
    </p>
  );
}

/** Cut at the last whole word that fits, with an ellipsis — as a results page does. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
