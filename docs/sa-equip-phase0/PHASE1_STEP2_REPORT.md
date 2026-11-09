# Phase 1, Step 2 report: taxonomy and menus

**Date:** 13 October 2026
**Scope:** `CURSOR_BRIEF.md` Phase 1, Step 2, with Josh's answers to the audit questions (`PHASE1_AUDIT.md`).
**No products were assigned. Nothing has been published.**

---

## Before anything was written

**Backups:** `migration/backups/2026-10-13-phase1/`, made with `npm run catalogue:backup`. The counts matched the audit exactly.

| Item | Count |
|---|---|
| Product–category links | **194** |
| Category mirror | **23** |
| Logo toggles | **368** |
| Hub products | **96** |
| Duda products | **96** |
| Duda categories | 23 |
| Logo text translations | 120 |
| Category translations | 136 |

Also saved to the backup folder:
- the before-values of the mobile menu elements;
- the H1 and page settings of all seven `/aviation` pages;
- all 154 page settings;
- the published homepage in all seven languages (the only readable copy of the desktop mega menus).

**Duda site backup point:** `pre-phase1-step2-2026-10-13`, created at 09:55 UTC and confirmed as the newest of the site's 53 backups.

**The 14 products with SA Endure on (asked for before Step 2).** All 14 are **HOLD**, so no phase touches them yet.

| Product | SKU | Sheet brand | JSON `endure` | SA logos on now |
|---|---|---|---|---|
| LED Worklamp | SAWL | ENDURE | true | Endure + Rental |
| LED Tubelight | ST100 | ENDURE | true | Endure + Rental |
| LED Emergency Tubelight | STE100 | ENDURE | true | Endure + Rental |
| Air Mover | SEF35 | ENDURE | true | Endure + Rental |
| High Power Air Mover | SEF35HP | ENDURE | true | Endure + Rental |
| Compact Filtration Unit (SAECFU) | SAECFU | ENDURE | true | Endure |
| Mobile LEV System | SAEWFS | ENDURE | true | Endure + Rental |
| Portable LEV System | SAEWFP | ENDURE | true | Endure + Rental |
| Container LEV System | SAEWFC | ENDURE | true | Endure + Rental |
| Compact Dust Extraction System | SAECDS/SAECBS | **CYCLONE** | false | Endure + Rental |
| Dust Filter Bundle (12 Panel + 24 Compact Bag) | SEFU/RF-DU/BD2 | **CYCLONE** | false | Cyclone + Endure |
| Vapour Extraction System | SAEVES | **CYCLONE** | false | Endure + Rental |
| Lightweight Filtration Unit | SAELFU | **CYCLONE** | false | Endure + Rental |
| PVC Flexible Duct System | SEFD | **CYCLONE** | false | Endure + Rental |

- The five CYCLONE rows are among the "labelled SA CYCLONE, SKU and description say SA ENDURE" products that Phase 5 must have confirmed.
- Phase 3 only touches READY products, so it will not change these.

**The 8 certification logos held for SA Equip to confirm.** The master sheet leaves these off, but they are switched on now. Phase 3 will only switch logos **on**, never off, so all 8 stay on until SA Equip confirms.

| Logo | Product |
|---|---|
| Inmetro | Lightweight Extraction System |
| Inmetro | EX LED Area Light |
| Inmetro | EX LED Tower Light |
| Inmetro | EX LED Vessel Entry Kit |
| Inmetro | EX 3.8KVA Transformer |
| Inmetro | EX Mains Distribution Unit |
| Inmetro | EX Splitter Unit |
| Zone 21-22 | Anti-Static PU Flexible Duct System |

---

## What was changed

| Area | Change | Where | Live? |
|---|---|---|---|
| Site Challenges | **10 created** under "Site Challenges", each with a clean slug and SEO title = its name. The other 5 reused. Nothing duplicated or deleted | Duda store + Hub mirror | **Yes** (store data is live, not a draft). They are empty and not yet linked from any menu |
| Order | The Hub's order for the 15 challenges, 12 industries and 3 categories set to the master lists' order | Hub `CategoryOrder` (30 rows) | Yes (Hub listings and filters only) |
| Logo labels | "Made in Britan" → **"Made in Britain"** (label and alt), "EX logo" → **"Ex logo"** (label; the alt stays "EX", which is what the cards show) | Hub `Logo` | Yes |
| Logo translations | The 6 translations of each old text carried over to the new text, with every check passing | Hub `Translation` (12 rows) | Yes |
| `/aviation`, all 7 languages | H1, page title (which also names its navigation item) and SEO title → "Aviation & Aerospace", in Duda's own wording for that category in each language. ⚠️ All seven SEO titles read **"Careers \| SA Equip"** before, apparently copied from the Careers page | Duda pages | **Draft** |
| Mobile menu ("Solutions" accordion) | The three "Air Quality and Extraction" headings → the three column questions. The 12 placeholder links → **14 real challenge links** (4 / 5 / 5); Welding Fume Control is hidden | Duda header | **Draft** |
| Scripts | `catalogue:backup` and `taxonomy:setup` added. The import and rebuild scripts now use the corrected logo labels | Repo, commit `71234ef` | n/a |

### New Site Challenges

| Column | Name | Duda ID | URL |
|---|---|---|---|
| 02 | Confined-Space Ventilation | `01M4TB2GW12JC09EKAECD2Y3W9` | `/category/confined-space-ventilation` |
| 02 | Tank and Vessel Entry | `01M4TB2K3GN6BGWEV5MQ74VFTH` | `/category/tank-and-vessel-entry` |
| 02 | Hazardous-Area Lighting | `01M4TB2N6BR6F5TPZSSH4386F7` | `/category/hazardous-area-lighting` |
| 02 | Temporary Power Distribution | `01M4TB2Q7T02FFDVXWFH42FA0B` | `/category/temporary-power-distribution` |
| 02 | Shutdown and Turnaround Packages | `01M4TB2S9G39SENZFF6213ENCH` | `/category/shutdown-and-turnaround-packages` |
| 03 | Paint and Coating Drying | `01M4TB2VBV42QZW2ZMBXWE57W6` | `/category/paint-and-coating-drying` |
| 03 | Humidity and Condensation Control | `01M4TB2XHYEYNXN2H9CG5VF5DX` | `/category/humidity-and-condensation-control` |
| 03 | Hazardous-Area Cooling | `01M4TB2ZDSY8955DF7G647CQGW` | `/category/hazardous-area-cooling` |
| 03 | Temporary and Process Heating | `01M4TB324P8HAC3SD1R5E3NNAP` | `/category/temporary-and-process-heating` |
| 03 | Equipment and Material Protection | `01M4TB3423YT7W1KXPSYD0MQF9` | `/category/equipment-and-material-protection` |

---

## Dry run and verification

- **Dry run:** `taxonomy:setup` without `--confirm` listed exactly the 10 creates, no extras and no slug clashes. A second dry run after applying finds nothing to do.
- **Category sync dry run:**
  - 33 categories, all "already correct";
  - **194** links in the Hub and **194** in Duda, with 0 to drop: product assignments are untouched.
- **Read back from Duda:** all 10 new challenges have their slug, SEO title and the right parent.
- **Live:**
  - the new `/category/…` pages return 200;
  - the public catalogue lists 33 categories, challenges and industries in master order;
  - product cards read "Made in Britain".

---

## Expected vs actual counts

| | Expected (section 4) | Actual |
|---|---|---|
| Site Challenges | 15 | **15**, all exact titles |
| Industries | 12 | **12**, all exact, unchanged |
| Top-level categories | 3 | **3**, all exact, unchanged |
| Products assigned | 0 (Step 2 assigns none) | **0** new (194 links unchanged) |

---

## Skipped, and why

Duda's API can't reach the **desktop** mega menu panels: the navigation items are read-only through the API, and the panels' contents aren't exposed. So the edits below must be made by hand in Duda's editor.

For every link, use the same kind of link as the Products panel's "View All" links (a store category link), **not** a URL. Those are the only menu links that get the language prefix on `/fr/` etc.

### Site Challenges panel

1. **"CHALLANGES" → "CHALLENGES".**
2. **Column 01, "What Needs Removing from the Air?":** replace the 4 placeholders. Welding Fume Control stays hidden until it has products.
   - Dust Extraction, Filtration and Containment → `dust-extraction-filtration-and-containment`
   - Toxic Fume and Vapour Extraction → `toxic-fume-and-vapour-extraction`
   - Paint Spray Fume Control → `paint-spray-fume-control`
   - Hydrogen and Hazardous-Gas Ventilation → `hydrogen-and-hazardous-gas-ventilation`
3. **Column 02, "Where Must Work Happen Safely?":** replace the 4 placeholders and add a 5th item.
   - Confined-Space Ventilation
   - Tank and Vessel Entry
   - Hazardous-Area Lighting
   - Temporary Power Distribution
   - Shutdown and Turnaround Packages
4. **Column 03, "What Conditions Need Controlling?":** replace the 4 placeholders and add a 5th item.
   - Paint and Coating Drying
   - Humidity and Condensation Control
   - Hazardous-Area Cooling
   - Temporary and Process Heating
   - Equipment and Material Protection

### Industries panel

Point each of the 12 industries at its category. 11 of them currently go to the homepage, and Aviation goes to the `/aviation` page.

| Industry | Slug |
|---|---|
| Distilleries & Breweries | `distilleries-breweries` |
| Pharmaceuticals | `pharmaceuticals` |
| Rail & Transport Engineering | `rail-transport-engineering` |
| Aviation & Aerospace | `aviation-aerospace` |
| Renewables & Hydrogen | `renewables-hydrogen` |
| Petrochemical & Chemical Processing | `petrochemical-chemical-processing` |
| Utilities | `utilities` |
| Nuclear | `nuclear` |
| Marine & Commercial Ship Repair | `marine-commercial-ship-repair` |
| Construction & Major Projects | `construction-major-projects` |
| Oil & Gas | `oil-gas` |
| Defence & Naval Shipbuilding | `defence-naval-shipbuilding` |

### Products panel

**Remove the 12 "Megamenu Test List Item" placeholder links** (they go to google.com). Keep the three "View All" links. (Josh, 13 October 2026.)

### `/aviation` page

**Repoint the product carousel at "Aviation & Aerospace".** Select the "SAEquip - Compatible Products External" widget, open its content panel, and set Product Category to Aviation & Aerospace. It is currently set to "Products", so it shows the whole catalogue under the heading "Aviation Products". Do this after Phase 2 is applied, when that category has its 53 products.

---

## Anything unexpected

- **Duda's API can't edit the desktop mega menus** (above).
- **Store links in navigation elements don't get the language prefix.**
  - The footer's existing EX Heater link stays `/product/ex-heater` on the French page.
  - So the new mobile menu links take visitors on `/fr/`, `/ar/` and so on to the **English** category page. That's the same as the footer today.
  - The desktop panels don't have this problem if store category links are used, as above.
- **All seven `/aviation` SEO titles were "Careers | SA Equip"**; they're fixed in the drafts.
- **The mobile menu's three headings shared one translation key.** I removed it from the new headings, since they now say three different things.

---

## Answers (Josh, 13 October 2026)

1. **Don't publish yet.** The order is: Phase 2, then Josh's desktop mega menu edits by hand, then one publish, then the translation check.
2. **Products panel:** remove the 12 placeholders and keep the "View All" links. This is in the manual checklist above.
3. **Mobile accordion:** renamed "Solutions" → **"Site Challenges"** (draft, read back from Duda).
4. **Mobile menu and footer language prefix:** accepted for now. Recorded in the backlog in `CLAUDE.md`.
5. **Translation check:** ~~planned for after the publish~~ **cancelled** (Josh, 13 October 2026). The six languages are being paused until the English site is finished, then translated in one pre-launch pass, recorded in the backlog in `CLAUDE.md`.

## Questions for Josh (as asked)

1. **Publishing.** Do the desktop mega menu edits above in Duda's editor first, then publish the site once; or say if you want me to publish the drafts now. Nothing has been published.
2. **Products panel.** The 12 placeholders sit under the three product types. Should they be removed (each column already has its "View All" link), or filled, and with what?
3. **Mobile menu title.** The accordion is still titled "Solutions" (unchanged). Should it say "Site Challenges" to match the desktop?
4. **Mobile menu language.** Accept that its links go to the English category pages from translated pages, for now? The alternative is a separate mobile menu per language, which is a bigger change.
5. **Translation follow-up (planned).** After publishing, Duda translates the new category names and the new header text in the background; this took 10–30 minutes per language before. Then I run "Refresh all languages from Duda" to copy the category names into the Hub, and check every language. If Duda doesn't translate the new header text on its own, it's done from the editor's translation panel. Shall I schedule that check after you publish?

**Stopping here for your go-ahead before Phase 2.**
