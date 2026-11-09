# Phase 5a: complete site challenges and industries for every product

**Decided by:** Josh, 13 Oct 2026. These are our calls, made without waiting for SA Equip. We'll tell Gill what we assumed.
**Scope:** Site Challenges and Industries, plus hiding the 3 duplicate filter products (section 3). **No logo, certification, category, SKU or name changes.**
**Rules from CURSOR_BRIEF.md still apply:** back up first, dry run, match by Duda ID, store the display order as given (the first two show on cards).

Industries use the full master names. "Same 7" means the ENDURE safe-area set: Construction & Major Projects, Aviation & Aerospace, Rail & Transport Engineering, Pharmaceuticals, Distilleries & Breweries, Defence & Naval Shipbuilding, Marine & Commercial Ship Repair.

## 1. SA ENDURE safe-area products

| Duda ID | Product | Site Challenges (in order) | Industries |
|---|---|---|---|
| `01M1XPRZJQ8HZJT1R2KYWNK7SM` | Air Mover (SEF35) | Confined-Space Ventilation | as in JSON (the same 7) |
| `01M1XPTTF35NZANG1VP31N3Q1A` | High Power Air Mover (SEF35HP) | Confined-Space Ventilation | the same 7 (use the **ENDURE** row; ignore the CYCLONE row) |
| `01M1XPRFPJSJJ8AMMNEX9YHX3H` | LED Tubelight (ST100) | Shutdown and Turnaround Packages | as in JSON (the same 7) |
| `01M1XPR96H6VSR07H5YY4GY9SS` | LED Worklamp (SAWL) | Shutdown and Turnaround Packages | as in JSON (the same 7) |
| `01M1XPRK9QPQ5BR0NJB9EXMEY7` | LED Emergency Tubelight (STE100) | Shutdown and Turnaround Packages | the same 7 (the sheet is blank, so copy from its sibling LED Tubelight) |
| (hidden) | SA ENDURE LED Max Light (SAML) | Shutdown and Turnaround Packages | as in JSON (the same 7) |
| (hidden) | SA ENDURE LEV Accessories (SEHB/SEFD) | Welding Fume Control, Dust Extraction, Filtration and Containment | as in JSON (the same 7) |

"Hazardous-Area Lighting" is deliberately **not** used for the non-EX lights.

## 2. The 7 "CYCLONE-labelled" SAE/SE products

Use the sheet's challenges **minus Paint and Coating Drying and minus Hydrogen and Hazardous-Gas Ventilation**, because these are probably non-EX. Industries are as in the JSON (12 each).

| Duda ID | Product | Site Challenges (in order) |
|---|---|---|
| `01M1XPV10E0EVHJ5Q2VPE8E9Y0` | Compact Dust Extraction System | Dust Extraction, Filtration and Containment, Shutdown and Turnaround Packages |
| `01M1XPV4B7FQ0KTM5NGZYR0JJZ` | Dust Filter Bundle | Dust Extraction, Filtration and Containment |
| `01M1XPVFEABW7DD0C7ZVFJJEXD` | High Volume Dust Extraction System | Dust Extraction, Filtration and Containment, Shutdown and Turnaround Packages |
| `01M1XPVM28SMQ4KTSN9KNX86C1` | Lightweight Dust Extraction System | Dust Extraction, Filtration and Containment, Shutdown and Turnaround Packages |
| `01M1XPW0XA8HC8JQ747Y7AS8ZN` | Lightweight Filtration Unit | Confined-Space Ventilation, Tank and Vessel Entry, Shutdown and Turnaround Packages |
| `01M1XPX3AE4734TP9Y98SQNNB2` | PVC Flexible Duct System | Confined-Space Ventilation, Tank and Vessel Entry, Toxic Fume and Vapour Extraction |
| `01M1XPVQ4N6FYRYK69WYA8P99Q` | Vapour Extraction System | Toxic Fume and Vapour Extraction, Paint Spray Fume Control, Shutdown and Turnaround Packages |

## 3. Filters: keep one, hide three

Josh's decision: there should be only **one** filter product. Keep **Filters (SAFU/)** (`01M1XPWW6N9MSPJ9B809ZXSNNP`), the range product that's already DONE, exactly as it is.

**Hide** the three duplicate replacement-filter products (SKU SAFU/RF): set each to **HIDDEN** in Duda and remove all of its category links, the same way you hid the EX Vapour Extraction System duplicate. Don't delete them yet.

| Duda ID | Product |
|---|---|
| `01M1XPPSMPR4M8TAJ9Z1MRDGJD` | Filter |
| `01M1XPSJP5M2T59873K9XFV3B1` | Filter - Purchase Only |
| `01M1XPSXXFV3HVVFFF1086HCVW` | Filters - PURCHASE ONLY |

Check that nothing else (product links, related products or carousels) points at them, and list anything that does.

## 4. Weekly rental products

Each one copies the Site Challenges (same order) **and** Industries of its matching sale product, exactly as they are in the Hub now.

| Duda ID | Rental product | Copy from |
|---|---|---|
| `01M1XPRNYFEYJ21QM1CCR7AN7M` | Weekly Rental of SA CYCLONE Ducting 30cm | Antistatic Reinforced Ducting (SAFD) |
| `01M1XPRW2S2HRB8J6YPNC0MYKN` | Weekly Rental of SA POWERNET Adaptor Lead 110V Stahl-CEAG | EX Adaptor Lead (R-PNAL) |
| `01M1XPRTB1CVYPKYX46N9MZHNN` | Weekly Rental of SA POWERNET Adaptor Lead 110V ATX-CEAG | EX Adaptor Lead (R-PNAL) |

## Not changed

- The EX 400VA Transformer stays without Hydrogen until its certification is known.
- The hidden duplicate EX Vapour Extraction System is left alone.
- All logos, certifications, categories and SKUs are unchanged.

## Expected live counts after applying (visible products only; please verify)

| Challenge | Before | After |
|---|---|---|
| Confined-Space Ventilation | 17 | 22 |
| Tank and Vessel Entry | 52 | 55 |
| Shutdown and Turnaround Packages | 29 | 39 |
| Dust Extraction, Filtration and Containment | 10 | 14 |
| Toxic Fume and Vapour Extraction | 16 | 19 |
| Paint Spray Fume Control | 1 | 2 |
| Hydrogen and Hazardous-Gas Ventilation | 27 | 30 (the rental ducting and 2 rental leads inherit it) |
| Temporary Power Distribution | 7 | 9 |

Category: Fume, Dust, LEV and Vapour Control drops by 3 (the hidden filters), from 38 to **35**, unless they're linked to another category; report what you find. All other challenges are unchanged. Report any difference instead of forcing a match.

**Goal:** after this, every visible product has at least one site challenge and at least one industry. Confirm that, and list any exceptions.
