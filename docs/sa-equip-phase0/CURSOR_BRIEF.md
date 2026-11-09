# SA Equip: product assignment brief for Cursor

**Prepared by:** Josh Wright, Kangaroo UK (with Claude)
**Date:** 13 October 2026
**Client:** SA Equip (contact: Gill Houston, Marketing Manager)

Read this whole file before doing anything. You have no prior context on this work, and everything you need is in this file and the two data files next to it.

---

## 1. Background

SA Equip is a hazardous-area equipment supplier. Their website runs on **Duda**, with a custom **hub** (the code you have access to) that powers product pages, menus and filters.

We are adding three ways to browse the catalogue:

1. **Site Challenges.** 15 challenges in a mega menu, laid out as three columns of five. Each column answers a question.
2. **Industries.** 12 industries.
3. **Logo toggles on each product page.** These are SA range logos (Cyclone, Endure, etc.) and certification logos (Ex, IECEx, zones, etc.), switched on or off per product in the editor.

SA Equip have sent a spreadsheet assigning challenges, industries and certifications to every product. We have cleaned it into `sa-equip-products.json`. Some rows depend on answers from the client, and those are marked **HOLD**. **Do not touch HOLD rows.**

## 2. Files

| File | What it is |
|---|---|
| `CURSOR_BRIEF.md` | This file. Instructions, rules, phases. |
| `sa-equip-products.json` | **Source of truth.** One record per product, keyed by Duda product ID, plus the master lists (challenges, industries, categories) in `meta`. |
| `sa-equip-products.csv` | The same data flattened, for humans to scan. If it disagrees with the JSON, the JSON wins. |

## 3. Ground rules

1. **Audit before you change anything** (Phase 1, step 1). Report back to Josh and wait for approval.
2. **Back up first.** Export the current state of every product and taxonomy you will touch before writing to it.
3. **Work one phase at a time.** Stop at the end of each phase and report. Don't start the next phase without Josh's go-ahead.
4. **Only update products with `"status": "READY"`.** Skip `HOLD`, `NEW_PRODUCT_HOLD` and everything in `duda_products_not_in_sheet`.
5. **`null` means unknown.** Never write a `null` field to Duda. Leave the existing value exactly as it is. For example, `ukca`, `made_in_britain` and `rental` are `null` for every product, so leave those toggles alone.
6. **Match products by `duda_product_id` only.** Several SKUs are duplicated, and names differ between Duda and the source sheet.
7. **Do not change product names, SKUs, prices, descriptions or images.** SKU changes are listed in `notes` for a later phase. They're not for now.
8. **Do not delete, create or publish products** in Phases 1 to 3.
9. **Do not publish the site** without Josh's approval.
10. The `internal_reference` fields (bracketed suitability text, raw cert text, key product and accessory flags) are **for reference only**. Do not show them on the site.

## 4. Master lists

These are also in `meta` in the JSON. Use these exact spellings.

### Site Challenges (mega menu: 3 columns of 5)

| 01: What Needs Removing from the Air? | 02: Where Must Work Happen Safely? | 03: What Conditions Need Controlling? |
|---|---|---|
| Welding Fume Control | Confined-Space Ventilation | Paint and Coating Drying |
| Dust Extraction, Filtration and Containment | Tank and Vessel Entry | Humidity and Condensation Control |
| Toxic Fume and Vapour Extraction | Hazardous-Area Lighting | Hazardous-Area Cooling |
| Paint Spray Fume Control | Temporary Power Distribution | Temporary and Process Heating |
| Hydrogen and Hazardous-Gas Ventilation | Shutdown and Turnaround Packages | Equipment and Material Protection |

### Industries (12)

Distilleries & Breweries · Pharmaceuticals · Rail & Transport Engineering · Aviation & Aerospace · Renewables & Hydrogen · Petrochemical & Chemical Processing · Utilities · Nuclear · Marine & Commercial Ship Repair · Construction & Major Projects · Oil & Gas · Defence & Naval Shipbuilding

### Top-level categories (3)

Climate Control and Heating · Fume, Dust, LEV and Vapour Control · Lighting and Power

### Logo toggles (what the editor currently has)

- **SA Logos:** SA Cyclone, SA Endure, SA Flexiheat, SA Lumin, SA Powernet, SA Rental
- **Cert Logos:** Ex logo, UKCA, IECEx, Inmetro, Made in Britain, Zone 0, Zone 1-2, Zone 20, Zone 21-22

JSON keys map to toggles like this:

| JSON key | Editor toggle |
|---|---|
| `sa_range_logos.cyclone` / `endure` / `flexiheat` / `lumin` / `powernet` / `rental` | SA Cyclone / Endure / Flexiheat / Lumin / Powernet / Rental Logo |
| `cert_logos.ex_logo` | Ex logo |
| `cert_logos.ukca` | UKCA (always null for now) |
| `cert_logos.iecex` | IECEx |
| `cert_logos.inmetro` | Inmetro |
| `cert_logos.made_in_britain` | Made in Britain (always null for now) |
| `cert_logos.zone_0` / `zone_1_2` / `zone_20` / `zone_21_22` | Zone 0 / Zone 1-2 / Zone 20 / Zone 21-22 |

## 5. Data dictionary (`products[]`)

| Field | Meaning |
|---|---|
| `status` | `READY` = apply. `HOLD` = skip (see `hold_reasons`). `NEW_PRODUCT_HOLD` = not in Duda yet, skip. |
| `duda_product_id` | Duda store product ID. The only key to match on. |
| `duda_name`, `duda_sku` | What Duda currently has, for checking. |
| `sheet_name`, `sheet_sku` | What SA Equip's sheet says. These may differ from Duda. Do not write them. |
| `brand` | SA range (CYCLONE, ENDURE, FLEXIHEAT, LUMIN, POWERNET). |
| `category` | One of the 3 top-level categories. `null` = leave as is. |
| `site_challenges` | Array of challenges from the master list. |
| `industries` | Array of industries from the master list. |
| `sa_range_logos` | true/false/null per SA range toggle. |
| `cert_logos` | true/false/null per cert toggle. |
| `hold_reasons` | Why a product is on hold. Empty for READY. |
| `notes` | Things to be aware of, e.g. inferred brand, expanded industry names, or SKUs not to touch yet. |

`duda_products_not_in_sheet[]` lists Duda products that aren't in SA Equip's sheet, with the action needed. All of these are for Phase 4, so leave them alone for now.

---

## 6. Phases

### Phase 1: Audit, then taxonomy and menus

**Step 1: Audit (read only). Report back before doing anything else.**

The hub already has some categories (including industries). Find out what's already there before creating anything, so we don't end up with duplicates.

Report on:

1. **Where each taxonomy lives.** For Top Level Categories, Industries and Site Challenges, tell us whether it's in Duda store categories, a Duda collection, product custom fields or the hub code. Include the exact names and IDs.
2. **What already exists, compared with section 4.** For each of the 15 challenges, 12 industries and 3 categories, say whether it exists, is spelled differently, is missing or is an extra we don't have. Watch for small spelling differences ("Ship Repair " with a trailing space, "&" vs "and", "Challanges" vs "Challenges", and so on).
3. **How products link to each taxonomy.** Tell us which field or relationship it uses, and whether it's single or multi-value.
4. **How the logo toggles are stored.** Give the field names and value types, and confirm they match the list in section 4.
5. **How the Site Challenges mega menu is populated.** Is it hard-coded or data-driven? It currently shows placeholder "Megamenu Test List Item" rows.
6. **Whether the product IDs are valid.** Check that all 72 READY `duda_product_id`s exist, and list any whose `duda_name` doesn't match Duda.
7. **A backup plan.** Explain how you'll export the current product data before writing.

**Step 2: Set up the taxonomy (after Josh approves the audit).**

- Create or rename the 15 Site Challenges, 12 Industries and 3 Categories so they match section 4 exactly. Reuse existing entries where possible, and don't create duplicates.
- Wire the Site Challenges mega menu to the real challenges in the 3 × 5 layout above, replacing the placeholder items.
- Wire the Industries menu and filters.
- Don't assign anything to products yet.

**Stop and report.**

### Phase 2: Assign challenges, industries and categories (READY products only)

For each product with `status == "READY"`:

- Set its Site Challenges to `site_challenges`. This replaces any existing values.
- Set its Industries to `industries`. This replaces any existing values.
- Set its top-level category to `category`. Only two READY products should change category: the SA LUMIN Tasklight Adjustable Floor Stand and Base Unit move from Climate Control and Heating to Lighting and Power. Every other READY product's category should already match. Flag any others that differ instead of changing them.

Run a dry run first that lists every change (product, field, old value → new value). Share it with Josh, then apply it.

**Expected counts after Phase 2 (READY products only, 72 total):**

| Site challenge | Products |
|---|---|
| Welding Fume Control | **0** (all welding products are on HOLD; the menu item will be empty for now) |
| Dust Extraction, Filtration and Containment | 6 |
| Toxic Fume and Vapour Extraction | 13 |
| Paint Spray Fume Control | 1 |
| Hydrogen and Hazardous-Gas Ventilation | 27 |
| Confined-Space Ventilation | 16 |
| Tank and Vessel Entry | 52 |
| Hazardous-Area Lighting | 36 |
| Temporary Power Distribution | 6 |
| Shutdown and Turnaround Packages | 27 |
| Paint and Coating Drying | 21 |
| Humidity and Condensation Control | 2 |
| Hazardous-Area Cooling | 1 |
| Temporary and Process Heating | 7 |
| Equipment and Material Protection | 9 |

| Industry | Products |
|---|---|
| Petrochemical & Chemical Processing / Utilities / Oil & Gas / Marine & Commercial Ship Repair | 71 each |
| Distilleries & Breweries | 70 |
| Renewables & Hydrogen / Nuclear / Defence & Naval Shipbuilding | 69 each |
| Construction & Major Projects | 55 |
| Pharmaceuticals / Rail & Transport Engineering / Aviation & Aerospace | 53 each |

| Category | Products |
|---|---|
| Lighting and Power | 42 |
| Fume, Dust, LEV and Vapour Control | 21 |
| Climate Control and Heating | 9 |

Ask Josh how an empty menu item should behave (Welding Fume Control), whether that's hiding it or showing a "coming soon" or contact message.

**Stop and report**, including the counts above as checked against the live data.

### Phase 3: Logo toggles (READY products only)

This is compliance-sensitive: certification logos are claims about the product. Only apply exactly what the JSON says.

For each READY product:

- For each key in `sa_range_logos` and `cert_logos`: if the value is `true`, switch the toggle on. If it's `false`, switch it off. If it's `null`, **leave it alone**.

Do a dry run first, listing any toggle that will change from its current state, especially any certification logo that's currently on and will be switched off, or the other way round. Share it with Josh before applying.

**Expected "on" counts (READY products):**

- SA Cyclone 23 · SA Endure 0 · SA Flexiheat 7 · SA Lumin 36 · SA Powernet 6
- Ex logo 44 · IECEx 43 · Inmetro 19 · Zone 0: 3 · Zone 1-2: 44 · Zone 20: 1 · Zone 21-22: 37
- UKCA, Made in Britain and SA Rental aren't touched (null).

**Stop and report.**

### Phase 4: Catalogue changes (not yet, waiting on the client)

For reference only, don't do these yet:

- Delete the duplicate "EX Vapour Extraction System" (SAPVES), which SA Equip confirm is the same as the EX Paint Vapour Extraction System.
- Decide what to do with the 3 filter products (SAFU/RF) and the 3 weekly rental products.
- Create 2 new products: SA ENDURE LED Max Light (SAML) and SA ENDURE LEV Accessories (SEHB/SEFD). Copy will come from Josh.
- SKU updates: Portable Trolley → SAAF/TR01, EX 400VA Transformer → SPTR400. The Tasklight Floor Stand and Base Unit SKUs are TBC.

### Phase 5: HOLD products and new features (not yet)

For reference only, don't do these yet:

- 8 products labelled SA CYCLONE whose SKU and current description say SA ENDURE. Brand and certification are to be confirmed by SA Equip.
- The SEF35HP duplicate (two sheet rows map to one Duda product).
- 10 SA ENDURE safe-area (non-EX) products, which need a new safe-area category.
- The EX 400VA Transformer has no certification data.
- Possible features: hiding non-EX products from hazardous-area filters, and an ATEX zone filter.

---

## 7. Report template (end of each phase)

```
Phase X report
- What was changed (counts by field)
- Dry-run diff location / summary
- Expected vs actual counts (tables from this brief)
- Anything skipped and why
- Anything unexpected in Duda / the hub
- Questions for Josh
```
