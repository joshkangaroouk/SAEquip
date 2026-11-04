import type { ReactNode } from "react";
import { Button } from "../ui";
import { SECTION_LABELS, type ErrorMap, type SectionKey } from "./productEditorTypes";

/**
 * The product editor's one Save, in the header band's action area (10 §2).
 * It was the fixed bar along the bottom of the page (ProductSaveBar); the
 * logic is the same and only the rendering moved: the unsaved summary, the
 * failed-section pills, View on website, Discard while dirty, and Save
 * changes, primary and last.
 *
 * Below lg the row wraps under the title and Save changes comes first in it,
 * so it is always in view.
 */
export function ProductSaveArea({
  dirtyLabels,
  isValid,
  saving,
  savingLabel,
  saveErrors,
  validationErrors,
  onSave,
  onReset,
  onOpenSection,
  viewOnWebsite,
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
  /** The "View on website" control, which sits among these actions. */
  viewOnWebsite: ReactNode;
}) {
  const failedKeys = (Object.keys(saveErrors) as SectionKey[]).filter((k) => saveErrors[k]);
  const invalidKeys = (Object.keys(validationErrors) as SectionKey[]).filter(
    (k) => validationErrors[k],
  );
  const isDirty = dirtyLabels.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 lg:justify-end">
      {saving ? (
        <p className="text-help font-semibold text-text">Saving{savingLabel ? ` ${savingLabel}` : ""}…</p>
      ) : (
        // Nothing when clean (10 §2). Which sections: the tabs' dots, and here
        // on hover and for a screen reader.
        isDirty && (
          <p className="text-help font-semibold text-text" title={dirtyLabels.join(", ")}>
            {dirtyLabels.length} unsaved {dirtyLabels.length === 1 ? "section" : "sections"}
            <span className="sr-only">: {dirtyLabels.join(", ")}</span>
          </p>
        )
      )}

      {failedKeys.length > 0 &&
        !saving &&
        failedKeys.map((k) => (
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

      {viewOnWebsite}
      {isDirty && (
        // `secondary` is the design's "ghost": transparent, bordered.
        <Button variant="secondary" onClick={onReset} disabled={saving}>
          Discard
        </Button>
      )}
      <Button
        variant="primary"
        onClick={onSave}
        disabled={!isDirty || !isValid}
        loading={saving}
        className="max-lg:order-first"
      >
        Save changes
      </Button>

      {invalidKeys.length > 0 && !saving && (
        <p className="basis-full text-help text-danger lg:text-right">
          {invalidKeys.map((k) => `${SECTION_LABELS[k]}: ${validationErrors[k]}`).join(" · ")}
        </p>
      )}
    </div>
  );
}
