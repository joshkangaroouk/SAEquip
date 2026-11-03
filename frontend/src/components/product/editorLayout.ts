import { cn } from "../../lib/cn";
import type { EditorTab } from "./editorTabs";

/**
 * The product editor's layout classes, shared by the editor and its loading
 * skeleton so the skeleton stands exactly where the page will.
 *
 * The grid: the tab panels, and from 1280 the side panel beside them at
 * clamp(18rem, 28%, 30rem) of the grid (11 §3), about 305px at 1440 and
 * never under 288 or over 480. Rows auto then 1fr: the side panel spans both
 * and is often the taller, and the extra height must go below Delete product,
 * not between the tabs and it.
 */
export const EDITOR_GRID =
  "grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_clamp(18rem,28%,30rem)] xl:grid-rows-[auto_1fr] xl:items-start";

/**
 * The side panel (Images, then Visibility and Categories). From 1280 it is
 * beside every tab. Below that it shows with Overview only, in two columns
 * from 640, Images beside the other two, so each card keeps about the width
 * it has beside the tabs (a full-width 4:3 featured image was ~500px tall).
 *
 * ⚠️ Not `hidden` plus `sm:grid` on the other tabs: sm:grid would win from
 * 640 and show the panel on every tab.
 */
export const sidePanelClass = (tab: EditorTab) =>
  cn(
    "min-w-0 space-y-5 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:block xl:space-y-5",
    tab === "overview" ? "sm:grid sm:grid-cols-2 sm:items-start sm:gap-5 sm:space-y-0" : "hidden",
  );
