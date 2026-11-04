import { useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { parseTab, TAB_ALIASES, type EditorTab } from "./editorTabs";

/**
 * The editor's active tab, held in `?tab=` (02a "Batch 8"): deep-linkable and
 * kept on reload. Written with `replace`, so switching tabs adds no history
 * entries, and Overview — the default — clears it. An unknown value reads as
 * Overview. Other params are kept.
 *
 * Switching tabs changes only the query, so the unsaved-changes blocker, which
 * compares pathnames, lets it through.
 *
 * An old value (`?tab=content`, the Extra details tab's name until batch 12)
 * opens its tab at once and is rewritten to the current one with replace, so
 * old links keep working and the address bar shows `?tab=extra`.
 */
export function useEditorTab(): [EditorTab, (tab: EditorTab) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab = parseTab(raw);
  const alias = raw ? TAB_ALIASES[raw] : undefined;
  useEffect(() => {
    if (!alias) return;
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        n.set("tab", alias);
        return n;
      },
      { replace: true },
    );
  }, [alias, setParams]);
  const setTab = useCallback(
    (next: EditorTab) =>
      setParams(
        (p) => {
          const n = new URLSearchParams(p);
          if (next === "overview") n.delete("tab");
          else n.set("tab", next);
          return n;
        },
        { replace: true },
      ),
    [setParams],
  );
  return [tab, setTab];
}
