# Batch 10: design fidelity pass (binding, decided 3 Nov)

Josh compared the built editor with the design canvas. The build still centres content in a `max-w-6xl` column with a boxed header card. The design uses full-width bands with the content breathing below. This batch closes that gap. Where this file differs from 02 or 02a, this file wins.

## 1. Full-width layout on every page
- **Remove the centred `max-w-6xl` column** from Layout and PageHeader, for every page, not just the editor.
  - Content is left-aligned and full width, with padding 32px top, 40px sides and 56px bottom (00 "Shell"); 20px sides below 640px.
  - No centring at any width.
- **Bands:**
  - The PageHeader band and the product editor band run edge to edge across the main panel: --surface, with a bottom border.
  - Their inner content uses the same 40px side padding as the content below, so the left edges line up.
- **Reading width:** keep long-text and form widths sensible inside cards, not with a page container.
  - Field rows already sit in grids.
  - Add `max-w-[72ch]` only to free-running prose blocks (help paragraphs, descriptions) if any end up too long.
- **SplitView pages:** already full width; check they still line up with the band.
- **Status:** the page can keep a narrow column inside the full-width layout. Left-align it to the band.

## 2. Product editor header band (replaces the boxed header card)
- **Full-width band** (--surface, bottom border), sticky under the 64px top bar.
- **Left side:**
  - a 64px Thumb of the primary image, on paper
  - an overline in Barlow 12px, uppercase, tracking .14em, muted: the SA range name(s) from the active SA logos, then " · ", then the product-type category name. Use only data the editor already loads; leave out any part that's missing.
  - the name (`t-editor-title`)
  - a meta row: SKU in mono, the Live/Hidden chip, the fault chip if any, and "Loaded … · Refresh"
- **Right side, the save area:** the ProductSaveBar logic moved here unchanged, rendered as:
  - unsaved summary text ("1 unsaved section" / "3 unsaved sections"; nothing when clean)
  - the failed-section pills (each switches tab, as now)
  - "View on website" (ghost, external icon)
  - "Discard" (ghost, shown only when dirty)
  - "Save changes" (primary; disabled when clean or invalid, as now)
  - Saving and saved states as the save bar shows them now.
- **Tabs at the bottom edge of the band:** the tab row sits inside the band, flush with its bottom border. The active tab's 3px yellow bar replaces the border under it. The band, including its tabs, is sticky.
- **Remove the bottom ProductSaveBar** and its reserved bottom padding (`pb-28`) and the sidebar-width offset logic it needed.
  - Keep its component logic: rename or move, don't rewrite.
  - Save payloads, validation, disabled rules, translate-on-save (click-synchronous), the unsaved blocker and beforeunload all stay identical.
- **Narrow screens:**
  - Below 1024 the band is not sticky.
  - Actions wrap under the title. Save changes is always visible: put it first in its row.
  - Below 640, "View on website" becomes an icon button with an accessible name.
- **ProductNew:** the same band (with no tabs and no "Loaded"). Its Create button moves into the band's action area. It stays click-synchronous for translate-on-save.

## 3. Side panel
- **Visibility card:**
  - an Active / Hidden SegmentedControl (the existing Status field) instead of the toggle
  - below it, the Accessory toggle moved here from Overview (the same `accessory` key)
  - each with its one-line help text, as in the design
- **Categories card, a compact summary** (decided):
  - header "Categories" with an "Edit" text button on the right
  - Product type: the selected product-type category as a solid chip
  - Site challenges · N: neutral chips with × to remove (removing changes the same `categories` state)
  - "+ Add" opens the editor
  - Industries · N of M: one chip ("All industries" when all are ticked), plus the muted line "Every industry is ticked. Narrowing this makes the industry pages more useful." only when all are ticked. This is content, not a nag; drop it if it reads as a readiness marker.
  - the "N no longer exist" fault Alert stays at the top of the card when it applies
  - **Edit / + Add** opens the existing AssignPickList (search, only-show-selected, tree) unchanged, inside a Modal titled "Categories". It applies on close, editing the same state, with no separate save. Focus returns to the button that opened it.
- **Width:** the side panel stays 18rem from 1280. Below 1280 it stacks under the tabs as now.

## 4. Section cards (all tabs)
- **Card header row:**
  - left: the title (card heading role) with the description muted under it
  - right: optional meta in muted 12px, e.g. "Synced with Duda on save" on Details, the word count on Description, "14 specs · 14 rows" on Technical specs
- **Description toolbar:** icon buttons (lucide: bold, italic, underline if supported, H2, H3, list, ordered list, link), each 34px with an accessible name and a tooltip. The Rich text / HTML SegmentedControl moves into the card header's right side. Undo and redo stay, as icons, on the right of the toolbar.
- **Spacing:** 20px between cards, and 24px between the band and the first card.

## 5. Check every other page against 00
After the layout change, compare every page to 00-design-reference.md "Pages", and fix any remaining gaps that are layout or styling only. List anything that would need data or API changes instead of building it.

## Rules
The same as every stage:
- fixtures harness only
- no backend, API or data-shape changes
- payloads compared against main for a product save touching every key, and for New product create
- don't touch Josh's uncommitted files
- commit locally; no push or merge

## 6. Carry-overs from batch 9 (decided 3 Nov)
- **Skip link:** add "Skip to main content", the first focusable element, visible on focus, targeting `<main>`.
- **Heading order:** add a heading-level prop to Card/EditorSection.
  - The page title is h1, top-level cards are h2, and nested sections are h3.
  - The product editor: the product name is h1, sections are h2.
  - Re-run axe and aim for zero heading-order findings.
- **SplitView:** list only, below 1280 (was 1024), using the same Back-to-list pattern. That gives the detail pane its full width at 1024.
- **Inner-scroll tables:**
  - The quote items table stacks into rows below 640. With list-only below 1280 it should fit at 1024; check.
  - The Translations content table stacks below 640, like the Names tab.
  - The variations table at 390 may keep its inner scroll, because it's a data grid.
- **Widgets page:** the Tabs preview opens its first panel by default (frontend preview markup only; WIDGET_CSS byte-identical).
- **Wording:** "Media Centre" becomes "Media" everywhere in staff-facing copy ("Add from Media", the Logos messages).
- **Media picker tiles:** the image is decorative next to the visible filename, so use `alt=""`.
- **Release checklist:** update `09-release-checklist.md` for the band Save, and re-run its steps 2–3 after this batch.
