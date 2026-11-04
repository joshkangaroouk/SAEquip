import { cn } from "../../lib/cn";
import type { EditorTab } from "./editorTabs";

/**
 * The product editor's layout classes, shared by the editor and its loading
 * skeleton so the skeleton stands exactly where the page will.
 *
 * The grid: the tab panels, and from 1280 the side panel beside them at
 * clamp(18rem, 28%, 30rem) of the grid (11 §3), about 305px at 1440 and
 * never under 288 or over 480.
 */
export const EDITOR_GRID =
  "grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_clamp(18rem,28%,30rem)] xl:items-start";

/**
 * The side panel (Visibility, then Categories). From 1280 it is beside every
 * tab; below that it stacks under the tabs and shows with Overview only
 * (batch 10). The two-column layout below 1280 was for the featured image,
 * and went with it to Files & media (12 §1).
 */
export const sidePanelClass = (tab: EditorTab) =>
  cn("min-w-0 space-y-5 xl:col-start-2 xl:row-start-1", tab !== "overview" && "hidden xl:block");
