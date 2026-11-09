# Phase 2 report: challenges, industries and categories

**Date:** 13 October 2026
**Scope:** `CURSOR_BRIEF.md` Phase 2, READY products only (72), as approved in the dry run (`PHASE2_DRY_RUN.md`).
**Nothing was published.**

## What was changed

| Field | Products | Detail |
|---|---|---|
| Site Challenges | 72 | Set from the sheet, in SA Equip's `site_challenges_display_order` |
| Industries | 72 | Set from the sheet |
| Category | 2 | SA LUMIN Tasklight Adjustable Floor Stand and Base Unit: Climate Control and Heating → Lighting and Power |
| Flagged instead of changed | 0 | |

- **Links:** 1,145 product–category links added and 2 removed, taking the total from 194 to 1,337. A re-plan after applying finds nothing left to change.
- **Display order:** stored with each of the 224 Site Challenge links. A listing card shows each product's first two, then "+N more".
- **Duda:** 30 categories updated, 3 already correct, 0 failed. A second sync finds all 33 correct.

**Card labels with SA Equip's order:** `phase2-card-labels-display-order.png`. EX LED Worklight 100 shows Hazardous-Area Lighting + Tank and Vessel Entry + "+4 more".

## Order of work

1. **Database change:** one new column for the order, nothing else. It came first, because the dry run reads it.
2. **Dry run:** same counts as approved.
3. **Screenshot.**
4. **Push:** live within about 45 seconds. The served widget's build hash matches, and the production smoke test passed 12/12.
5. **Backup:** `migration/backups/2026-10-13-phase2/pre-apply/`. Its counts are 194 links, 33 categories, 368 logo toggles and 96 products.
6. **Apply.**
7. **Duda sync:** dry run, then for real.
8. **Live re-check.**

## Expected vs actual, checked live

These are the public catalogue (what the site's widgets read) and Duda's own counts.

| Site Challenge | Brief | Live | All products | Duda |
|---|---|---|---|---|
| Welding Fume Control | 0 | 0 | 0 | 0 |
| Dust Extraction, Filtration and Containment | 6 | 6 | 6 | 6 |
| Toxic Fume and Vapour Extraction | 13 | 13 | 14 | 14 |
| Paint Spray Fume Control | 1 | 1 | 1 | 1 |
| Hydrogen and Hazardous-Gas Ventilation | 27 | 27 | 27 | 27 |
| Confined-Space Ventilation | 16 | 16 | 16 | 16 |
| Tank and Vessel Entry | 52 | 52 | 52 | 52 |
| Hazardous-Area Lighting | 36 | 36 | 36 | 36 |
| Temporary Power Distribution | 6 | 6 | 6 | 6 |
| Shutdown and Turnaround Packages | 27 | 27 | 27 | 27 |
| Paint and Coating Drying | 21 | 21 | 21 | 21 |
| Humidity and Condensation Control | 2 | 2 | 2 | 2 |
| Hazardous-Area Cooling | 1 | 1 | 1 | 1 |
| Temporary and Process Heating | 7 | 7 | 7 | 7 |
| Equipment and Material Protection | 9 | 9 | 9 | 9 |

| Industry | Brief | Live | Duda |
|---|---|---|---|
| Distilleries & Breweries | 70 | 70 | 70 |
| Pharmaceuticals | 53 | 53 | 53 |
| Rail & Transport Engineering | 53 | 53 | 53 |
| Aviation & Aerospace | 53 | 53 | 53 |
| Renewables & Hydrogen | 69 | 69 | 69 |
| Petrochemical & Chemical Processing | 71 | 71 | 71 |
| Utilities | 71 | 71 | 71 |
| Nuclear | 69 | 69 | 69 |
| Marine & Commercial Ship Repair | 71 | 71 | 71 |
| Construction & Major Projects | 55 | 55 | 55 |
| Oil & Gas | 71 | 71 | 71 |
| Defence & Naval Shipbuilding | 69 | 69 | 69 |

| Category | Brief | Live | All products | Duda |
|---|---|---|---|---|
| Lighting and Power | 42 | 42 | 48 | 48 |
| Fume, Dust, LEV and Vapour Control | 21 | 21 | 39 | 39 |
| Climate Control and Heating | 9 | 9 | 9 | 9 |

**30/30 match the brief.** All 72 READY products send their challenges in SA Equip's display order.

## Skipped, and why

HOLD, NEW_PRODUCT_HOLD and products not in the sheet were not touched, per the brief.

## Anything unexpected

- **Toxic Fume and Vapour Extraction shows 14 products on the site, not 13.** The extra one is the duplicate EX Vapour Extraction System, which already had the link and is due for deletion in Phase 4.
- **The product editor's category save used to delete and recreate every link**, which would have reset the display order. It now keeps the links that stay. This is checked by typecheck and review, but not exercised live, since that would need a throwaway product.
