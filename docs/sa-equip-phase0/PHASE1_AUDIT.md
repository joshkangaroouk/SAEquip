# Phase 1, Step 1 report: audit (read only)

**Date:** 13 October 2026
**Scope:** `CURSOR_BRIEF.md` section 6, Phase 1, Step 1. Covers all 7 audit points, reported in the section 7 template.
**Live site:** Duda site `8a8f03b5` (`saequip.multiscreensite.com`) and the Hub on `sa-equip-backend.vercel.app`.

---

## What was changed

Nothing: no Hub code, database or Duda changes. Only Duda GET requests, read-only database queries and fetches of the published site were used.

What was read:
- all 23 Duda store categories (each fetched individually);
- the Hub's category mirror, drag order and 194 product–category links;
- the logo catalogue (15 logos) and its 368 product–logo links;
- all 96 Duda products;
- Duda's collections;
- the site header and its navigation elements;
- the published homepage, because the mega menu panels can only be read there;
- the page list.

---

## 1. Where each taxonomy lives

All three are **Duda store categories** in one tree. They are not a Duda collection: the site's only collection is "Distributors". They are not product custom fields either: no product has any, and all 96 are empty.

| Taxonomy | Lives under | Parent ID | Parent slug |
|---|---|---|---|
| Top-level categories | **"Products"** | `01M3PV0Y6RJP2VF8E1N4M1K6H6` | `products` |
| Industries | "Industries" | `01M3PV0YMZPQSJCSS4M5MVR1SZ` | `industries` |
| Site Challenges | "Site Challenges" (spelled correctly) | `01M3PV0Z1RDH7TRJBVEEJ1D23X` | `site-challenges` |

- **The brief's "top-level categories" are not top-level in the Hub.** They are children of a "Products" parent, alongside the Industries and Site Challenges parents.
- **The Hub keeps its own copy of the tree** (`CategoryMirror`: 23 rows, identical to Duda) for the public listing pages.
- **Ordering:** the Hub's own order table (`CategoryOrder`) is empty, so order within each parent is Duda's (newest first).
- **Hub code:** nothing is hard-coded except the order of the three parents (`TOP_LEVEL_ORDER`) and the listing widget's default filter group, "Site Challenges".

---

## 2. What exists, compared with section 4

### Top-level categories: 3 of 3 exist, spelled exactly

| Master | In the Hub | ID | Slug | Products now |
|---|---|---|---|---|
| Climate Control and Heating | ✓ exact | `01M3P7N1M4TY1RMPHD9V3Q6JDT` | `climate-control-and-heating` | 11 |
| Fume, Dust, LEV and Vapour Control | ✓ exact | `01KW9TRVXM4DMEART1P68E5ZHP` | `fume-dust-lev-and-vapour-control` | 39 |
| Lighting and Power | ✓ exact | `01M3P7NFYQJHDF546BZJ6GD19H` | `lighting-and-power` | 46 |

### Industries: 12 of 12 exist, spelled exactly, with no extras

| Master | In the Hub | ID | Slug | Products now |
|---|---|---|---|---|
| Distilleries & Breweries | ✓ exact | `01M3PV159Z638XZRF3RVEYT2CD` | `distilleries-breweries` | 0 |
| Pharmaceuticals | ✓ exact | `01M3PV14V4HMBB9316KYXSMP0B` | `pharmaceuticals` | 0 |
| Rail & Transport Engineering | ✓ exact | `01M3PV14EJ6JBR3G1JKPGSJHB1` | `rail-transport-engineering` | 0 |
| Aviation & Aerospace | ✓ exact | `01M3PV141YYQD6V4CW1HZ5KS8Z` | `aviation-aerospace` | 0 |
| Renewables & Hydrogen | ✓ exact | `01M3PV13NC3Y2ZPDPYXPXV3T7V` | `renewables-hydrogen` | 0 |
| Petrochemical & Chemical Processing | ✓ exact | `01M3PV138JCSE0CBTP4P10Q043` | `petrochemical-chemical-processing` | 0 |
| Utilities | ✓ exact | `01M3PV12RVFHRVJTE9QG8TC6C6` | `utilities` | 0 |
| Nuclear | ✓ exact | `01M3PV12BST0RBTT978M7N3QT1` | `nuclear` | 0 |
| Marine & Commercial Ship Repair | ✓ exact (no trailing space) | `01M3PV11ZEGBHGXFYV5SCZ0RZ3` | `marine-commercial-ship-repair` | 0 |
| Construction & Major Projects | ✓ exact | `01M3PV11H17E67RHPNB6Y1JKNC` | `construction-major-projects` | 0 |
| Oil & Gas | ✓ exact | `01M3PV113YAC5ZWWE37GY2D5CN` | `oil-gas` | 0 |
| Defence & Naval Shipbuilding | ✓ exact | `01M3PV10PEJS82940J49GTFWZK` | `defence-naval-shipbuilding` | 0 |

### Site Challenges: 5 of 15 exist (all of column 01, spelled exactly); 10 are missing; no extras

| Col | Master | In the Hub | ID | Slug |
|---|---|---|---|---|
| 01 | Welding Fume Control | ✓ exact | `01M3PV15PHAEFVGBR5VW2Q46J8` | `welding-fume-control` |
| 01 | Dust Extraction, Filtration and Containment | ✓ exact | `01M3PV162VKYZF5GYFTEP03R8G` | `dust-extraction-filtration-and-containment` |
| 01 | Toxic Fume and Vapour Extraction | ✓ exact | `01M3PV16FV7Y6NAY007399CKKB` | `toxic-fume-and-vapour-extraction` |
| 01 | Paint Spray Fume Control | ✓ exact | `01M3PV16WK0N6QAAYF8CMFW8J1` | `paint-spray-fume-control` |
| 01 | Hydrogen and Hazardous-Gas Ventilation | ✓ exact | `01M3PV17B83PMC51QMFEQZDP0K` | `hydrogen-and-hazardous-gas-ventilation` |
| 02 | Confined-Space Ventilation | **missing** | n/a | n/a |
| 02 | Tank and Vessel Entry | **missing** | n/a | n/a |
| 02 | Hazardous-Area Lighting | **missing** | n/a | n/a |
| 02 | Temporary Power Distribution | **missing** | n/a | n/a |
| 02 | Shutdown and Turnaround Packages | **missing** | n/a | n/a |
| 03 | Paint and Coating Drying | **missing** | n/a | n/a |
| 03 | Humidity and Condensation Control | **missing** | n/a | n/a |
| 03 | Hazardous-Area Cooling | **missing** | n/a | n/a |
| 03 | Temporary and Process Heating | **missing** | n/a | n/a |
| 03 | Equipment and Material Protection | **missing** | n/a | n/a |

### Spelling problems found outside the category tree

- The Site Challenges mega menu's heading text reads **"CHALLANGES"**.
- The only industry page, `/aviation`, is titled **"Aviation & Airspace"** in English. Its translations say "airspace" too.

---

## 3. How products link to each taxonomy

- **One relationship for all three:** the Hub's `ProductCategory` table, one row per product and category. It is **multi-value**, Hub-owned, and has no foreign key, because the categories live in Duda.
- **Pushed to Duda in a batch:** `npm run duda:sync-categories` sends it to Duda, one way (Hub → Duda), replacing each category's whole product list.
- **Two ways to write it:**
  - `PUT /api/products/:id/categories` sets a product's whole set and refuses unknown IDs;
  - `PUT /api/categories/:id/products` changes only that one category.
- **A product is never in a child without its parent:** the server adds the parent automatically. Assigning a challenge therefore also adds "Site Challenges", and an industry adds "Industries".

### Today

- Every product is in "Products" plus exactly one of the three categories (none has two, none has zero).
- No industry has any products.
- Exactly one product is in a challenge: **EX Vapour Extraction System (SAPVES)**, under Toxic Fume and Vapour Extraction.
  - It is the duplicate that Phase 4 deletes.
  - It is not READY, so Phase 2 won't touch it, and it will keep showing under that challenge until Phase 4.

---

## 4. How the logo toggles are stored

- **Not boolean fields, and not in Duda.** There's a shared catalogue table, `Logo` (kind `SA_LOGO` or `CERT_LOGO`, label, alt text, image). A toggle is **on when a `ProductLogo` row exists** for that product and logo.
- **"On" adds a row, "off" deletes it.** The editor does this one logo at a time through `PUT` or `DELETE /api/products/:id/logos/:logoId`, both safe to repeat.
- **Off means absent.** There is no separate "off" state.

| Brief | Hub label | Kind | Products on now |
|---|---|---|---|
| SA Cyclone / Endure / Flexiheat / Lumin / Powernet / Rental | "SA Cyclone Logo" … "SA Rental Logo" | SA_LOGO | 24 / 14 / 7 / 36 / 9 / 51 |
| Ex logo | **"EX logo"** (capital EX) | CERT_LOGO | 38 |
| UKCA | UKCA | CERT_LOGO | 26 |
| IECEx | IECEx | CERT_LOGO | 26 |
| Inmetro | Inmetro | CERT_LOGO | 23 |
| Made in Britain | **"Made in Britan"** (misspelled) | CERT_LOGO | 47 |
| Zone 0 / 1-2 / 20 / 21-22 | same | CERT_LOGO | 3 / 39 / 1 / 24 |

- **All 15 toggles in the brief exist.** The two label differences are cosmetic and appear on the live product cards.
- **UKCA is already on for 26 products.** During the WordPress import, the old site's "UKEX" value was mapped to the UKCA logo, on your instruction. The brief leaves UKCA untouched, so those 26 stay.

---

## 5. How the Site Challenges mega menu is populated

**It is hard-coded in Duda's header, not data-driven.** The desktop navigation is a list of hand-typed links, and "Site Challenges" opens a Duda mega menu panel, `mega-menu-ae1b42d1`.

The Site Challenges panel has:
- the eyebrow text "CHALLANGES";
- the heading "What Site Problem Do You Need to Solve?";
- the three correct column headings;
- **12 "Megamenu Test List Item" links, 4 per column rather than 5, all pointing to `https://google.com`.**

Duda's tools can't read inside mega menu panels, so this was read from the published homepage HTML.

The other menus:
- **Mobile (hamburger) menu:** has its own copy, a "Solutions" accordion with three placeholder blocks of four links. All three are headed "Air Quality and Extraction".
- **Industries panel:** also hand-typed.
  - Its labels match the master list.
  - **11 of 12 link to `/`** (the homepage). Only Aviation goes to `/aviation`, and "View All Industries" goes to `/industries`.
  - Every industry already has a working category page at `/category/<slug>`. Several were checked, including `oil-gas` and `aviation-aerospace`.
- **Products panel:** also contains placeholders, 12 more links to `google.com`.

---

## 6. Are the product IDs valid?

- All **72 READY** `duda_product_id`s exist in Duda and in the Hub.
- **0** name mismatches, **0** SKU mismatches, and **0** hidden in Duda.
- All 96 Duda products are accounted for in the JSON (READY, HOLD or not in the sheet).
- High Power Air Mover (`01M1XPTTF35NZANG1VP31N3Q1A`) is the one ID mapped twice; both of its rows are on HOLD.

---

## 7. Backup plan

There are no database backups on this Supabase plan, so these exports are the only restore point. Before any write, they go to `migration/backups/2026-10-13-phase1/`, which git ignores.

**Hub:**
- all `ProductCategory` rows (194);
- `CategoryMirror` (23) and `CategoryOrder`;
- `Logo` (15) and `ProductLogo` (368);
- each product's Hub ID, Duda ID, name and SKU.

**Duda:**
- every category's full single-category read: title, parent, SEO, image and product list;
- every product's name, SKU, status and categories (`duda:snapshot` for anything touched individually).

**Menus:**
- the header element tree, with all properties;
- the published mega menu HTML (the only readable copy of the panels);
- a Duda site backup point before editing the header. Kangaroo's account has that permission; the staff accounts don't.

Each export is re-read and its counts checked (194, 23, 368, 96) before anything is written. Restoring the links is a re-import followed by `duda:sync-categories`, which refuses to empty Duda from an empty Hub.

---

## Expected vs actual counts

These were checked against the JSON (READY products only) and the tables in the brief.

| Area | Result |
|---|---|
| Challenge, industry and category counts | All match the brief exactly (e.g. Tank and Vessel Entry 52, Welding 0, industries 71/70/69/55/53, categories 42/21/9) |
| Logo on-counts after Phase 3 | All match: Cyclone 23, Endure 0, Flexiheat 7, Lumin 36, Powernet 6, Ex 44, IECEx 43, Inmetro 19, Zones 3/44/1/37 |
| Phase 2 category changes against the live data | Exactly the **2 Tasklights**, as the brief predicts; no other READY product differs |
| Phase 3 certification logos that are on now and would be switched off | **8** (listed below); 54 certification logos would be switched on |

The 8 certification logos that Phase 3 would switch off:
- **Inmetro** on:
  - Lightweight Extraction System;
  - EX LED Area Light;
  - EX LED Tower Light;
  - EX LED Vessel Entry Kit;
  - EX 3.8KVA Transformer;
  - EX Mains Distribution Unit;
  - EX Splitter Unit.
- **Zone 21-22** on Anti-Static PU Flexible Duct System.

---

## Anything skipped

Nothing in scope. HOLD, NEW_PRODUCT_HOLD and not-in-sheet products were only checked for existence.

---

## Questions for Josh

1. **The 3 × 5 columns can't live in the category tree** without adding a column level. That would break the listing page's Site Challenges filter, which treats the parent's direct children as the filter options. Suggestion: the 15 challenges stay as plain children of "Site Challenges", and the columns are built in the Duda mega menu as links to each `/category/<slug>`. Agree?
2. **Should the menu's other placeholders be fixed while editing it?** That means:
   - "CHALLANGES";
   - the mobile "Solutions" accordion (three "Air Quality and Extraction" headings);
   - the Products panel's placeholders;
   - the 11 industry links that go to the homepage (pointing them at `/category/<slug>`).
3. **"Wire the Industries filters":** the listing page currently filters by Site Challenges only. This was deliberate: on an industry or category page, industries are how the visitor arrived, not how they narrow down. Should industries be added as a second filter?
4. **Should these labels be corrected?** They are outside the brief's scope:
   - "Made in Britan" → "Made in Britain";
   - "EX logo" → "Ex logo";
   - the `/aviation` page title, "Airspace" → "Aerospace".
5. **The 8 certification logos that Phase 3 switches off** (7 Inmetro and 1 Zone 21-22) are compliance claims. Should SA Equip confirm those before Phase 3?
6. **Welding Fume Control will have no READY products.** Should its menu item be hidden, or show a "coming soon" or contact message?
7. **Translations:** the 10 new challenges will show in English on the six other language pages until Duda translates them; Duda's names then need copying into the Hub again. They will also need SEO titles, because that script only ran on the original 23. Should both be included in Step 2?

Step 2 waits for approval of this audit.
