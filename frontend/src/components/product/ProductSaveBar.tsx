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
}: {
  dirtyLabels: string[];
  isValid: boolean;
  saving: boolean;
  savingLabel: string | null;
  saveErrors: ErrorMap;
  validationErrors: ErrorMap;
  onSave: () => void;
  onReset: () => void;
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
    // ⚠ `lg:left-[17rem]` must match SIDEBAR_W / MAIN_OFFSET in Layout.tsx —
    // that file already notes the two literals have to stay in step, and this
    // is now a third. Below `lg` the sidebar is a top bar, so left-0 is right.
    // ProductDetail.tsx pairs this with bottom padding so the last section
    // isn't hidden underneath.
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-surface/95 backdrop-blur lg:left-[17rem]">
      {/* Inner container mirrors Layout's content wrapper, so the text and
          buttons stay aligned with the page content rather than drifting to
          the far edges on a wide screen. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-3 lg:px-8">
        <div className="min-w-0 flex-1">
          {saving ? (
            <p className="text-small font-semibold text-text">
              Saving{savingLabel ? ` ${savingLabel}` : ""}…
            </p>
          ) : (
            <p className="truncate text-small text-muted">
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
            <p className="mt-1 text-small text-danger">
              {invalidKeys.map((k) => `${SECTION_LABELS[k]}: ${validationErrors[k]}`).join(" · ")}
            </p>
          )}

          {failedKeys.length > 0 && !saving && (
            <div className="mt-1 flex flex-wrap gap-1">
              {failedKeys.map((k) => (
                <a
                  key={k}
                  href={`#section-${k}`}
                  className="rounded-full border border-danger/40 bg-danger/10 px-2 py-0.5 text-small font-semibold text-danger hover:bg-danger/20"
                  title={saveErrors[k]}
                >
                  {SECTION_LABELS[k]} failed
                </a>
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
