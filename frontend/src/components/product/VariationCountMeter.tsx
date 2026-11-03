import { cn } from "../../lib/cn";

/**
 * Live current → projected variation count.
 *
 * This exists because the cartesian blow-up is genuinely non-obvious: adding one
 * choice to a product with 6 options doesn't add one variation, it multiplies.
 * Showing the projection before the save is the only way that's visible.
 */
export function VariationCountMeter({
  current,
  projected,
  max,
}: {
  current: number;
  projected: number;
  max: number | null;
}) {
  const over = max != null && projected > max;
  const near = max != null && !over && projected > max * 0.8;
  const changed = projected !== current;

  return (
    // The Product options meter's tones (02a "Batch 8"), never yellow:
    // muted, --warning above 80%, --danger over the limit.
    <div
      className={cn(
        "border px-3 py-1.5 text-help",
        over
          ? "border-danger bg-danger-bg text-danger"
          : near
            ? "border-warning bg-warning-bg text-warning"
            : "border-border bg-surface-2 text-muted",
      )}
    >
      <span className={cn("font-semibold tabular-nums", over || near ? undefined : "text-text")}>
        {changed ? `${current} → ${projected}` : projected}
      </span>{" "}
      {projected === 1 ? "variation" : "variations"}
      {max != null && <span className="ml-1">(limit {max})</span>}
      {over && <span className="ml-1 font-semibold">— over the limit</span>}
    </div>
  );
}
