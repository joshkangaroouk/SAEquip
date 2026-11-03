import { Button } from "../ui";
import { SECTION_LABELS, type ErrorMap, type SectionKey } from "./productEditorTypes";

/**
 * Sticky save bar for the product editor. Replaces the per-section Save/Reset
 * buttons with one page-level commit.
 *
 * Stays mounted when clean so the layout doesn't jump as sections go dirty, but
 * renders nothing until there is something to say.
 */
export function ProductSaveBar({
  dirtyLabels,
  isValid,
  saving,
  savingLabel,
  saveErrors,
  validationErrors,
  onSave,
  onReset,
  onOpenSection,
}: {
  dirtyLabels: string[];
  isValid: boolean;
  saving: boolean;
  savingLabel: string | null;
  saveErrors: ErrorMap;
  validationErrors: ErrorMap;
  onSave: () => void;
  onReset: () => void;
  /**
   * A failed section's pill: the editor opens the tab that holds it, then
   * scrolls to and focuses it. (Under tabs a plain `#section-*` link would
   * point into a hidden panel, or one not mounted yet.)
   */
  onOpenSection: (key: SectionKey) => void;
}) {
  const failedKeys = (Object.keys(saveErrors) as SectionKey[]).filter((k) => saveErrors[k]);
  const invalidKeys = (Object.keys(validationErrors) as SectionKey[]).filter(
    (k) => validationErrors[k],
  );
  const isDirty = dirtyLabels.length > 0;

  if (!isDirty && failedKeys.length === 0) return null;

  return (
    // Fixed, not sticky: sticky kept it inside the max-w-6xl content column,
    // so it couldn't reach the viewport edges. Fixed also means showing/hiding
    // it can't shift the page, since it's out of flow.
    //
    // `lg:left-sidebar` is the sidebar's width from tailwind.config.js — the
    // one value the aside and the main column's offset use too. Below `lg`
    // the sidebar is a drawer, so left-0 is right.
    // ProductDetail.tsx pairs this with bottom padding so the last section
    // isn't hidden underneath.
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-surface/95 backdrop-blur lg:left-sidebar">
      {/* Inner container mirrors Layout's content wrapper, so the text and
          buttons stay aligned with the page content rather than drifting to
          the far edges on a wide screen. */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-10">
        <div className="min-w-0 flex-1">
          {saving ? (
            <p className="text-help font-semibold text-text">
              Saving{savingLabel ? ` ${savingLabel}` : ""}…
            </p>
          ) : (
            <p className="truncate text-help text-muted">
              {isDirty ? (
                <>
                  <span className="font-semibold text-text">
                    {dirtyLabels.length} unsaved {dirtyLabels.length === 1 ? "section" : "sections"}:
                  </span>{" "}
                  {dirtyLabels.join(", ")}
                </>
              ) : (
                "All changes saved"
              )}
            </p>
          )}

          {invalidKeys.length > 0 && !saving && (
            <p className="mt-1 text-help text-danger">
              {invalidKeys.map((k) => `${SECTION_LABELS[k]}: ${validationErrors[k]}`).join(" · ")}
            </p>
          )}

          {failedKeys.length > 0 && !saving && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {failedKeys.map((k) => (
                // The fault chip as a button, with --danger-bg (02a Q2: failed pills).
                <button
                  key={k}
                  type="button"
                  onClick={() => onOpenSection(k)}
                  className="inline-flex h-6.5 items-center border border-danger bg-danger-bg px-2.5 text-help font-semibold text-danger transition-colors duration-[120ms] hover:bg-chip"
                  title={saveErrors[k]}
                >
                  {SECTION_LABELS[k]} failed
                  <span className="sr-only">: {saveErrors[k]}. Show the section</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <Button variant="ghost" onClick={onReset} disabled={!isDirty || saving}>
          Reset all
        </Button>
        <Button variant="primary" onClick={onSave} disabled={!isDirty || !isValid} loading={saving}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
