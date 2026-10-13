import { useEffect } from "react";
import { useBlocker, type Blocker } from "react-router-dom";

/**
 * Warn before losing unsaved edits.
 *
 * Two mechanisms are needed because they cover different exits:
 *   - useBlocker intercepts in-app navigation (sidebar links, back button) and
 *     hands back a blocker the caller renders a modal for. It requires a data
 *     router — see the comment in App.tsx.
 *   - beforeunload covers tab close / refresh / external links, which
 *     useBlocker does NOT see. The browser shows its own generic dialog here;
 *     the message can't be customised.
 *
 * Returns the blocker so the caller can drive <UnsavedChangesModal/> from
 * blocker.state and choose between reset()/proceed().
 */
export function useUnsavedChangesWarning({
  when,
  suppress,
}: {
  when: boolean;
  /**
   * Read AT NAVIGATION TIME, not at render. ⚠️ `when` is captured by the
   * render before the navigation, so a ref flipped just before navigating
   * (deleting the product, then leaving its page) was not seen: the
   * "unsaved changes" dialog appeared for a product that no longer existed,
   * and its "Save and leave" would PATCH the deleted product (fixed
   * 2026-10-12).
   */
  suppress?: () => boolean;
}): Blocker {
  // Compare pathname only: a query/hash change (e.g. a modal deep-link) is not
  // leaving the editor and shouldn't trip the guard.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when && !(suppress?.() ?? false) && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!when) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy browsers keyed off a returned string; harmless to keep.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [when]);

  return blocker;
}
