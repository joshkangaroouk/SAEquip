# Batch 12: product editor layout changes (binding, decided by Josh 3 Nov)

These come from Josh's review of batch 11. Where this file differs from 02, 02a, 10 or 11, this file wins.

## 1. Images back in the Files & media tab
- **Move:** the Images card from batch 11 moves out of the side panel and becomes the first section of the Files & media tab, above 3D model and Downloads. It keeps everything from batch 11:
  - the large featured image (images[0])
  - the gallery grid underneath, with drag and keyboard reorder
  - the Featured and Pending-upload chips
  - the Image dialog (preview, alt text, Set as featured, Remove)
  - Add from Media, Upload, and dropping files onto the card
- **Layout inside the tab:**
  - from 1024: the featured image on the left (about 40% of the card width, 4:3, on paper) and the gallery grid on the right (4 columns)
  - below 1024: featured on top, gallery underneath (3 columns)
- **Save key:** `images` returns to being a TAB key. Its dot shows on Files & media, and its failed pill switches to Files & media and focuses the Images section. The Files & media count includes images again.
- **Side panel:** now Visibility, then Categories.

## 2. Delete product inside the Visibility card (WordPress-style)
- **Remove** the Delete product danger card from the foot of Overview.
- **Add** to the bottom of the Visibility card: a 1px top divider, then a danger text button with a lucide trash icon and the label "Delete product".
  - Danger text colour, no border. It underlines on hover and gets the standard focus outline.
- **The confirm:** it opens the EXISTING typed-confirmation Modal (same copy, same typed check, same request, same navigation after delete). Focus returns to the button if the dialog is cancelled.
- **Below 1280,** the side panel shows only on Overview, so Delete is reachable there. That's acceptable.

## 3. Description moves to Overview; "Content" becomes "Extra details"
- **Overview** becomes, in order: Details, then Description (and Accessory is already in the side panel).
- **The "Content" tab is renamed "Extra details"** (sentence case, per 02a; Josh wrote "Extras Details"). It holds Technical specs, Key benefits, Applications and Compatible products.
- **URL:** `?tab=extra`. Keep `?tab=content` working as an alias that redirects (replace) to `?tab=extra`, so old links still work.
- **Per-tab dots:** the description field now maps to Overview in the `details` per-field diff (editorTabs.ts).
- **Counts:** the Extra details count = spec rows + benefits + applications + compatible products (whatever Content counted, minus nothing, since the description never counted).
- **Translate-on-save** is unchanged and stays click-synchronous.

## 4. The sticky band shrinks on scroll (from 1280, where it's sticky)
- **Two states:** expanded (as now) and compact.
- **Compact:**
  - the overline ("SA Endure · Lighting and Power") and the meta row (SKU, chip, "Loaded … · Refresh") fade to opacity 0 and collapse to height 0
  - the thumb shrinks from 64 to 40px
  - the title goes from 28px to 20px
  - the vertical padding reduces
  - the save area (unsaved summary, failed pills, View on website, Discard, Save changes) and the tab row stay fully visible and usable
- **Animation:** 200ms ease-out on opacity, height or max-height, padding, the font-size change (or a transform scale on the title) and the thumb size. It reverses smoothly when scrolling back up.
- **No jitter:** shrinking the band moves the page under it. Use hysteresis:
  - compact when scrollY > 120
  - expand when scrollY < 24
  - plus an IntersectionObserver sentinel or a rAF-throttled scroll listener
  - no state flapping at either threshold, and no scroll jump when the state changes
- **Reduced motion:** switch states instantly, with no transition.
- **Accessibility:**
  - In compact, the hidden overline and meta row are `inert` and `aria-hidden`, so Refresh can't be focused while invisible.
  - If keyboard focus is inside the band's meta row when scrolling compacts it, keep it expanded until focus leaves.
  - The h1 stays the same element, so it isn't re-announced.
- **The failed-pill scroll** lands 16px below the band in its CURRENT height (compact height once it's scrolled).
- **Below 1280,** the band isn't sticky and doesn't shrink.

## 5. The failed-pill offset fix
The scroll currently lands 96px below instead of 16px, because EditorSection's scroll margin is added to the page's scroll-padding. Fix it so it lands 16px below the sticky band (from 1280, using its current height) or below the top bar (under 1280).

## Rules
Same as batch 11:
- fixtures harness only, with every write stubbed or blocked
- no backend, API or data-shape changes
- payloads byte-identical to main: a save touching every key (including the image edits), New product create, and Delete product (the same request as main)
- re-run batch 8 scenarios a–h with the new tab names
- axe on the editor in both themes, in the compact and expanded band states
- don't touch Josh's uncommitted files
- update the /ui kit, CLAUDE.md (Cursor's own lines only) and 09-release-checklist.md
- commit locally; no push or merge
