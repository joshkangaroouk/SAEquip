import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { parseTab, type EditorTab } from "./editorTabs";

/**
 * The editor's active tab, held in `?tab=` (02a "Batch 8"): deep-linkable and
 * kept on reload. Written with `replace`, so switching tabs adds no history
 * entries, and Overview — the default — clears it. An unknown value reads as
 * Overview. Other params are kept.
 *
 * Switching tabs changes only the query, so the unsaved-changes blocker, which
 * compares pathnames, lets it through.
 */
export function useEditorTab(): [EditorTab, (tab: EditorTab) => void] {
  const [params, setParams] = useSearchParams();
  const tab = parseTab(params.get("tab"));
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
