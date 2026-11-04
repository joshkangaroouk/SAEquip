# Batch 11: product editor refinements (binding, decided by Josh 3 Nov)

These follow Josh's review of batch 10. Where this file differs from 02, 02a or 10, this file wins.

## 1. Loading skeleton for the product editor
- Today the editor shows a centred `Loader` ("Loading product…"). Replace it with a skeleton of the real layout, sized to match the loaded page so nothing jumps:
  - **Band:** 64px thumb block, overline bar, title bar, meta row (SKU, chip, "Loaded"), the action buttons, and the tab row (six tab-width bars).
  - **Main column:** two section cards (header row plus a few field rows).
  - **Side panel:** the Images card (a large featured block plus a row of gallery thumbs), then Visibility, then Categories.
- Use `ui/Skeleton`.
  - `aria-busy` on the region, with one polite announcement "Loading product".
  - It must respect reduced motion; no shimmer when reduced.
- Keep the error state (Alert) as it is.
- Check other pages for any remaining text-only loaders (CompatibleProducts "Loading products…", ProductSearch). Inline list loaders inside a control may stay as text. Any full page or full card that loads gets a skeleton.

## 2. Images move to the top of the side panel (WordPress-style featured image)
- **Location:** a new "Images" card at the TOP of the side panel, above Visibility. Remove the Images section from the Files & media tab; that tab keeps the 3D model and Downloads, and its count drops images.
- **Featured image:**
  - the current primary image (use the existing primary rule; confirm in the code whether that's the first in sort order) shown large
  - full card width, a 4:3 box, `object-contain` on paper
  - a "Featured" overline above it
  - an empty state: a dashed paper box with "Add a featured image", which opens the same add flow
- **Gallery underneath:**
  - a 3-column grid of square thumbs on paper, all images in sort order, the featured one included and marked with a small solid "Featured" chip
  - drag to reorder with the existing SortableList/dnd logic and keyboard sorting
  - moving an image to first makes it featured, if that's how primary works today; if primary is a separate flag, keep that flag
  - a "Pending upload" chip where it applies
- **Clicking a thumb** opens an "Image" Modal with:
  - a larger preview on paper
  - the alt text Input (the same field and validation as today)
  - "Set as featured" (does what making it primary does today)
  - Remove (with the existing confirm, if there is one)
  - focus returns to the thumb on close
- **Adding images:** "Add from Media" (the existing MediaPicker) and "Upload" (the existing FileDropzone, PNG/JPEG/WebP). Dropping files onto the card is also supported.
- **Save key:** `images`, unchanged payloads.
  - It becomes a side-panel key like Categories and Accessory: from 1280, no tab dot.
  - Its failed pill scrolls to and focuses the Images card.
  - Below 1280 the side panel shows only on Overview (as now), so the images dot goes on Overview there.

## 3. Side panel width as a percentage
- **From 1280, the grid is the main column plus the side panel at `clamp(18rem, 28%, 30rem)`.** That gives about 327px at 1440, wider on large screens, and never under 288px or over 480px.
- **Check:** at 1280 all six tabs still fit (the 7.9 constraint), and the featured image reads well at both ends of the clamp.

## 4. Sticky band only from 1280
The band is 181–223px tall. Below 1280 it scrolls with the page, and from 1280 it stays sticky. The failed-pill scroll offset must follow this rule.

## 5. Widget text contrast (#878787)
No change in the redesign. It's the live product pages' brand grey, so it's a separate decision for the website. Logged on the backlog.

## Rules
Same as batch 10:
- fixtures harness only
- no backend, API or data-shape changes
- payloads compared with main for a product save touching every key (including an images reorder, set featured, alt text change, add and remove), and for New product create
- translate-on-save stays click-synchronous
- don't touch Josh's uncommitted files
- commit locally; no push or merge
