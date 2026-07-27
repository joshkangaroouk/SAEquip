import { useState } from "react";
import type { Blocker } from "react-router-dom";
import { Button, Modal } from "./ui";

/**
 * Rendered when useUnsavedChangesWarning's blocker intercepts a navigation.
 *
 * Deliberately not built on useConfirm(): that resolves to a boolean, and this
 * has three outcomes — stay, discard, or save-then-leave.
 *
 * `onSave` should resolve true only when EVERY pending change committed. On a
 * partial save we reset the blocker so the user stays on the page and can see
 * which section still failed, rather than navigating away from the error.
 */
export function UnsavedChangesModal({
  blocker,
  onSave,
  dirtyLabels = [],
}: {
  blocker: Blocker;
  onSave?: () => Promise<boolean>;
  dirtyLabels?: string[];
}) {
  const [saving, setSaving] = useState(false);
  const open = blocker.state === "blocked";

  async function saveAndLeave() {
    if (!onSave || saving) return;
    setSaving(true);
    try {
      const ok = await onSave();
      if (ok) blocker.proceed?.();
      else blocker.reset?.();
    } catch {
      blocker.reset?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => blocker.reset?.()}
      dismissable={!saving}
      size="sm"
      title="You have unsaved changes"
      description={
        dirtyLabels.length > 0
          ? `Unsaved: ${dirtyLabels.join(", ")}. Leaving now discards these edits.`
          : "Leaving now discards your edits."
      }
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => blocker.reset?.()} disabled={saving}>
            Stay on page
          </Button>
          <Button variant="secondary" onClick={() => blocker.proceed?.()} disabled={saving}>
            Discard changes
          </Button>
          {onSave && (
            <Button variant="primary" onClick={saveAndLeave} loading={saving}>
              Save and leave
            </Button>
          )}
        </div>
      }
    />
  );
}
