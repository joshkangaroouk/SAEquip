import { useEffect, useState } from "react";
import { apiJson } from "../../lib/api";
import { AccordionCard } from "../ui";
import { AssignPickList } from "./AssignPickList";
import type { HubTag } from "../../lib/types";

/**
 * Assign Hub tags to the product.
 *
 * Tags are Hub-owned — Duda has no equivalent — so unlike categories there is
 * nothing upstream to reconcile with. Nothing renders them publicly yet; this
 * is the data layer, so the labelling can be done before anything depends on
 * it rather than after.
 */
export function TagsSection({
  selected,
  onChange,
  dirty,
  error,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  dirty: boolean;
  error?: string;
}) {
  const [tags, setTags] = useState<HubTag[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiJson<HubTag[]>("/api/tags")
      .then((d) => !cancelled && setTags(d))
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : "Failed to load tags"));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AccordionCard
      id="section-tags"
      title="Tags"
      description="Free-form labels. Manage the list on the Tags page."
      summary={selected.length ? `${selected.length} selected` : undefined}
      dirty={dirty}
      error={error ?? loadError ?? undefined}
      defaultOpen
    >
      {!tags && !loadError ? (
        <p className="text-small text-subtle">Loading tags…</p>
      ) : (
        <AssignPickList
          items={(tags ?? []).map((t) => ({
            id: t.id,
            label: t.name,
            hint: t.productCount ? `${t.productCount}` : undefined,
          }))}
          selected={selected}
          onChange={onChange}
          searchPlaceholder="Search tags…"
          emptyText="No tags yet — create some on the Tags page."
        />
      )}
    </AccordionCard>
  );
}
