# Phase 5a report: site challenges and industries for every product

**Date:** 13 October 2026
**Scope:** `PHASE5A_INSTRUCTIONS.md`, Josh's decisions. Challenges (stored in the given order) and industries, plus hiding 3 duplicate filter products. **No logo, certification, category, SKU or name changes.** Nothing published.
**Applied and re-checked live.** The script's own report is `PHASE5A_APPLY.md`.

## What was done

- **Backups:** `migration/backups/2026-10-13-phase5a/pre-apply/` (1,389 category links, 98 products) and the Duda backup point `pre-phase5a-2026-10-13`.
- **Challenges and industries:** set for 17 products, 231 links added and none removed:
  - 7 SA ENDURE safe-area products, including the 2 hidden new ones;
  - the 7 CYCLONE-labelled SAE/SE products;
  - the 3 weekly rentals, each copied from its sale product.
- **Filters:** "Filter", "Filter - Purchase Only" and "Filters - PURCHASE ONLY" (SAFU/RF) are HIDDEN in Duda, with their 6 category links removed. **Filters (SAFU/)** is kept exactly as it is.
- **Duda sync:** 25 categories updated, 0 failed. A second run finds all 33 correct.

## Final counts, visible products (all match the file)

| Challenge | Before | After | File | Duda (incl. hidden) |
|---|---|---|---|---|
| Confined-Space Ventilation | 17 | 22 | 22 ✓ | 22 |
| Tank and Vessel Entry | 52 | 55 | 55 ✓ | 55 |
| Shutdown and Turnaround Packages | 29 | 39 | 39 ✓ | 40 |
| Dust Extraction, Filtration and Containment | 10 | 14 | 14 ✓ | 15 |
| Toxic Fume and Vapour Extraction | 16 | 19 | 19 ✓ | 19 |
| Paint Spray Fume Control | 1 | 2 | 2 ✓ | 2 |
| Hydrogen and Hazardous-Gas Ventilation | 27 | 30 | 30 ✓ | 30 |
| Temporary Power Distribution | 7 | 9 | 9 ✓ | 9 |
| Welding Fume Control | 3 | 3 | unchanged ✓ | 4 |
| Hazardous-Area Lighting, Paint and Coating Drying, Humidity, Cooling, Heating, Equipment Protection | 36, 21, 2, 1, 7, 9 | unchanged | unchanged ✓ | same |

**Category:** Fume, Dust, LEV and Vapour Control 38 → **35** ✓, because the 3 filters were linked only there and under Products. Lighting and Power 48 and Climate Control and Heating 9 are unchanged.

**Industries** (the file gives no expected numbers):

| Industry | Before | After |
|---|---|---|
| Distilleries & Breweries | 74 | 89 |
| Marine & Commercial Ship Repair | 75 | 89 |
| Defence & Naval Shipbuilding | 72 | 86 |
| Petrochemical & Chemical Processing | 73 | 83 |
| Utilities | 73 | 83 |
| Oil & Gas | 73 | 83 |
| Renewables & Hydrogen | 70 | 80 |
| Nuclear | 70 | 80 |
| Construction & Major Projects | 59 | 73 |
| Pharmaceuticals | 56 | 70 |
| Rail & Transport Engineering | 56 | 70 |
| Aviation & Aerospace | 56 | 70 |

**Why Duda shows more than the site:** Duda's counts include the 2 hidden new products, so Shutdown, Dust Extraction and Welding read 1 higher there (40, 15, 4), and 7 industries read 2 higher. Visitors see the visible counts above.

## Every visible product has a challenge and an industry

Confirmed live: all **92** visible products have at least one Site Challenge and at least one Industry. **No exceptions.**

## What still points at the hidden filters

- **Nothing on the site:**
  - no Compatible Products list, product description or download refers to them;
  - none of the 779 pages in the sitemap links to their addresses;
  - Duda's own text search finds nothing either.
- **Their addresses return 404** in every language.
- ⚠️ **Stale sitemap entries:** the sitemap's translated product entries (95 per language, dated 6 October) still list the 3 filters in all six languages. They lead to a 404 and carry noindex, so they're harmless, and no change was made. The English part of the sitemap is correct: 92 products, no filters.

## Status of every product (updated)

**100 rows: 60 DONE, 40 PARTIAL, 0 ON HOLD.** As applied and re-checked live on 13 October 2026, after Phase 5a.

| # | Product | SKU (Duda now) | Sheet | Status | What's done / missing / to confirm |
|---|---|---|---|---|---|
| 1 | Air Mover | SEF35 | HOLD | **PARTIAL** | **Assumed:** challenge Confined-Space Ventilation, and the 7 safe-area industries; Hazardous-Area Lighting is not used for non-EX products. **Missing:** a safe-area category decision. Logos unchanged. |
| 2 | Anti-Static PU Flexible Duct System | SAFD | READY | **PARTIAL** | Challenges, industries, category and logos done. **To confirm:** the sheet says no Zone 21-22, but the logo is shown (left on). Confirm. |
| 3 | Antistatic Reinforced Ducting | SAFD | READY | **PARTIAL** | Challenges, industries, category and logos done. **To confirm:** brand SA Cyclone was inferred from the Duda description. Confirm. |
| 4 | Compact Dust Extraction System | SAECDS/SAECBS | HOLD | **PARTIAL** | **Assumed non-EX:** challenges Dust Extraction, Shutdown (the sheet's, minus Paint and Coating Drying and Hydrogen) and 12 industries done. **To confirm:** brand (labelled SA CYCLONE; SKU and Duda description say SA ENDURE) and certification. Logos unchanged. |
| 5 | Compact Filtration Unit (SAECFU) | SAECFU | HOLD | **PARTIAL** | Challenges (Dust Extraction, Confined-Space, Shutdown), 5 industries and SA Endure done. **Missing:** Paint and Coating Drying left out: it is non-EX, which SA Equip's rule excludes. Confirm. |
| 6 | Container LEV System | SAEWFC | HOLD | **PARTIAL** | Challenges (Welding Fume Control, Dust Extraction, Toxic Fume), 7 industries and SA Endure done; kept in Fume, Dust, LEV and Vapour Control. **Missing:** a safe-area category decision (non-EX); the sheet's Category column was shifted. |
| 7 | Dust Filter Bundle - 12 Panel Filters & 24 Compact Bag Filters | SEFU/RF-DU/BD2 | HOLD | **PARTIAL** | **Assumed non-EX:** challenges Dust Extraction (the sheet's, minus Paint and Coating Drying and Hydrogen) and 12 industries done. **To confirm:** brand (labelled SA CYCLONE; SKU and Duda description say SA ENDURE) and certification. Logos unchanged. |
| 8 | EX 3.8KVA Transformer | SPTR | READY | **PARTIAL** | Challenges, industries, category and logos done. **To confirm:** the sheet says no Inmetro, but the logo is shown (left on). Confirm. |
| 9 | EX 400VA Transformer | SPTR400 | HOLD | **PARTIAL** | Challenges (Temporary Power Distribution, Shutdown and Turnaround Packages), 6 industries and SA Powernet done; SKU SPTR → SPTR400. **Missing:** certification data (Ex, IECEx, Inmetro, zones), so no cert logos and no Hydrogen and Hazardous-Gas Ventilation. |
| 10 | EX HeatBox | SAHB/02-AP | READY | **PARTIAL** | Challenges, industries, category and logos done. **To confirm:** ATEX certified but not IECEx (the only product like this). Confirm. |
| 11 | EX LED Area Light | SAAL25/FR | READY | **PARTIAL** | Challenges, industries, category and logos done. **To confirm:** the sheet says no Inmetro, but the logo is shown (left on). Confirm. |
| 12 | EX LED Tower Light | SAAL25/TW | READY | **PARTIAL** | Challenges, industries, category and logos done. **To confirm:** the sheet says no Inmetro, but the logo is shown (left on). Confirm. |
| 13 | EX LED Vessel Entry Kit | SAVK | READY | **PARTIAL** | Challenges, industries, category and logos done. **To confirm:** the sheet says no Inmetro, but the logo is shown (left on). Confirm. |
| 14 | EX Mains Distribution Unit | SPDU | READY | **PARTIAL** | Challenges, industries, category and logos done. **To confirm:** the sheet says no Inmetro, but the logo is shown (left on). Confirm. |
| 15 | EX Splitter Unit | SPSB | READY | **PARTIAL** | Challenges, industries, category and logos done. **To confirm:** the sheet says no Inmetro, but the logo is shown (left on). Confirm. |
| 16 | EX Vapour Extraction System | SAPVES | not in sheet | **PARTIAL** | Confirmed duplicate of EX Paint Vapour Extraction System: hidden, category links removed. Delete later; nothing links to it. |
| 17 | Filter | SAFU/RF | not in sheet | **PARTIAL** | **Decided:** one filter product (Filters SAFU/). This one is hidden, its category links removed; nothing on the site links to it. Delete later. |
| 18 | Filter - Purchase Only | SAFU/RF | not in sheet | **PARTIAL** | **Decided:** one filter product (Filters SAFU/). This one is hidden, its category links removed; nothing on the site links to it. Delete later. |
| 19 | Filter, Filters – Purchase Only (all SAFU/RF) | — | HOLD | **PARTIAL** | **Decided:** one filter product. **Filters (SAFU/)** is kept as it is; the three SAFU/RF filter products are hidden, with their category links removed. They will be deleted later. |
| 20 | Filters - PURCHASE ONLY | SAFU/RF | not in sheet | **PARTIAL** | **Decided:** one filter product (Filters SAFU/). This one is hidden, its category links removed; nothing on the site links to it. Delete later. |
| 21 | High Power Air Mover | SEF35HP | HOLD | **PARTIAL** | Same Duda product as the ENDURE row; this CYCLONE row was **ignored**. **To confirm:** which is right (brand, certification). |
| 22 | High Power Air Mover | SEF35HP | HOLD | **PARTIAL** | **Assumed:** the ENDURE row is right: challenge Confined-Space Ventilation, the 7 safe-area industries. **To confirm:** the sheet lists SEF35HP twice (ENDURE and CYCLONE); safe-area category still to decide. |
| 23 | High Volume Dust Extraction System | SAEDES/SAEBDS | HOLD | **PARTIAL** | **Assumed non-EX:** challenges Dust Extraction, Shutdown (the sheet's, minus Paint and Coating Drying and Hydrogen) and 12 industries done. **To confirm:** brand (labelled SA CYCLONE; SKU and Duda description say SA ENDURE) and certification. Logos unchanged. |
| 24 | LED Emergency Tubelight | STE100 | HOLD | **PARTIAL** | **Assumed:** challenge Shutdown and Turnaround Packages, and the 7 safe-area industries (copied from LED Tubelight: the sheet's were blank); Hazardous-Area Lighting is not used for non-EX products. **Missing:** a safe-area category decision. Logos unchanged. |
| 25 | LED Tubelight | ST100 | HOLD | **PARTIAL** | **Assumed:** challenge Shutdown and Turnaround Packages, and the 7 safe-area industries; Hazardous-Area Lighting is not used for non-EX products. **Missing:** a safe-area category decision. Logos unchanged. |
| 26 | LED Worklamp | SAWL | HOLD | **PARTIAL** | **Assumed:** challenge Shutdown and Turnaround Packages, and the 7 safe-area industries; Hazardous-Area Lighting is not used for non-EX products. **Missing:** a safe-area category decision. Logos unchanged. |
| 27 | Lightweight Dust Extraction System | SAELDS/SAELBS | HOLD | **PARTIAL** | **Assumed non-EX:** challenges Dust Extraction, Shutdown (the sheet's, minus Paint and Coating Drying and Hydrogen) and 12 industries done. **To confirm:** brand (labelled SA CYCLONE; SKU and Duda description say SA ENDURE) and certification. Logos unchanged. |
| 28 | Lightweight Extraction System | SACLDS | READY | **PARTIAL** | Challenges, industries, category and logos done. **To confirm:** the sheet says no Inmetro, but the logo is shown (left on). Confirm. |
| 29 | Lightweight Filtration Unit | SAELFU | HOLD | **PARTIAL** | **Assumed non-EX:** challenges Confined-Space, Tank and Vessel Entry, Shutdown (the sheet's, minus Paint and Coating Drying and Hydrogen) and 12 industries done. **To confirm:** brand (labelled SA CYCLONE; SKU and Duda description say SA ENDURE) and certification. Logos unchanged. |
| 30 | Mobile LEV System | SAEWFS | HOLD | **PARTIAL** | Challenges (Welding Fume Control, Dust Extraction, Toxic Fume), 7 industries and SA Endure done; kept in Fume, Dust, LEV and Vapour Control. **Missing:** a safe-area category decision (non-EX); the sheet's Category column was shifted. |
| 31 | Portable LEV System | SAEWFP | HOLD | **PARTIAL** | Challenges (Welding Fume Control, Dust Extraction, Toxic Fume), 7 industries and SA Endure done; kept in Fume, Dust, LEV and Vapour Control. **Missing:** a safe-area category decision (non-EX); the sheet's Category column was shifted. |
| 32 | PVC Flexible Duct System | SEFD | HOLD | **PARTIAL** | **Assumed non-EX:** challenges Confined-Space, Tank and Vessel Entry, Toxic Fume (the sheet's, minus Paint and Coating Drying and Hydrogen) and 12 industries done. **To confirm:** brand (labelled SA CYCLONE; SKU and Duda description say SA ENDURE) and certification. Logos unchanged. |
| 33 | SA ENDURE LED Max Light | SAML | NEW_PRODUCT_HOLD | **PARTIAL** | New, created HIDDEN with SA Equip's copy; challenges (Shutdown and Turnaround Packages) and the 7 safe-area industries done. **Missing:** images, safe-area category, logos, SEO; not visible on the site. |
| 34 | SA ENDURE LEV Accessories | SEHB/SEFD | NEW_PRODUCT_HOLD | **PARTIAL** | New, created HIDDEN with SA Equip's copy; challenges (Welding Fume Control, Dust Extraction) and the 7 safe-area industries done. **Missing:** images, safe-area category, logos, SEO; not visible on the site. |
| 35 | SA LUMIN Tasklight Adjustable Floor Stand | — | READY | **PARTIAL** | Challenges, industries, category and logos done. **To confirm:** SKU still blank: both Tasklight items were given SATL/BU. |
| 36 | SA LUMIN Tasklight Base Unit | — | READY | **PARTIAL** | Challenges, industries, category and logos done. **To confirm:** SKU still blank: both Tasklight items were given SATL/BU. |
| 37 | Vapour Extraction System | SAEVES | HOLD | **PARTIAL** | **Assumed non-EX:** challenges Toxic Fume, Paint Spray Fume Control, Shutdown (the sheet's, minus Paint and Coating Drying and Hydrogen) and 12 industries done. **To confirm:** brand (labelled SA CYCLONE; SKU and Duda description say SA ENDURE) and certification. Logos unchanged. |
| 38 | Weekly Rental of SA CYCLONE Ducting 30cm | R-SAFD30/05-EX | not in sheet | **PARTIAL** | **Assumed kept (Hire):** challenges and industries copied from its sale product, Antistatic Reinforced Ducting. **To confirm:** keep or remove. |
| 39 | Weekly Rental of SA POWERNET Adaptor Lead 110V ATX-CEAG | R-PNAL110EX/01HRE/ATX-CEA17 | not in sheet | **PARTIAL** | **Assumed kept (Hire):** challenges and industries copied from its sale product, EX Adaptor Lead. **To confirm:** keep or remove. |
| 40 | Weekly Rental of SA POWERNET Adaptor Lead 110V Stahl-CEAG | R-PNAL110EX/01HRE/STA-CEA17 | not in sheet | **PARTIAL** | **Assumed kept (Hire):** challenges and industries copied from its sale product, EX Adaptor Lead. **To confirm:** keep or remove. |
| 41 | Antistatic Layflat Ducting | SAFD/LF | READY | **DONE** | Challenges, industries, category and logos. |
| 42 | Charging Unit for EX Rechargeable Torch | EX150/CR | READY | **DONE** | Challenges, industries, category and logos. |
| 43 | Compact Filtration Unit | SACFU | READY | **DONE** | Challenges, industries, category and logos. |
| 44 | Compact Floodlight Protective Film | SAFL/PF-C | READY | **DONE** | Challenges, industries, category and logos. |
| 45 | Compact Floodlight Protective Shield | SAFL/PS-C | READY | **DONE** | Challenges, industries, category and logos. |
| 46 | Duct Couplers | SAFD/CU | READY | **DONE** | Challenges, industries, category and logos. |
| 47 | EX Adaptor Lead | R-PNAL | READY | **DONE** | Challenges, industries, category and logos. |
| 48 | EX Air Conditioner | SAAC11440 | READY | **DONE** | Challenges, industries, category and logos. |
| 49 | EX Air Mover | SAF35 / SAF35D | READY | **DONE** | Challenges, industries, category and logos. |
| 50 | EX Compact Dust Extraction System | SACDES/SACBDS | READY | **DONE** | Challenges, industries, category and logos. |
| 51 | EX Dehumidifier | SADH11440 | READY | **DONE** | Challenges, industries, category and logos. |
| 52 | EX Dust Extraction System | SADSES | READY | **DONE** | Challenges, industries, category and logos. |
| 53 | EX Extension Lead | PNEL | READY | **DONE** | Challenges, industries, category and logos. |
| 54 | EX Extension Reel | PNER | READY | **DONE** | Challenges, industries, category and logos. |
| 55 | EX Headtorch | EX600 | READY | **DONE** | Challenges, industries, category and logos. |
| 56 | EX Heater | SAPH18440 | READY | **DONE** | Challenges, industries, category and logos. |
| 57 | EX Heating Jacket | SAFH150P/SAFH050P | READY | **DONE** | Challenges, industries, category and logos. |
| 58 | EX High Capacity Dust Extraction System | SADSES/SABDES | READY | **DONE** | Challenges, industries, category and logos. |
| 59 | EX High Power Air Mover | SAF35HP | READY | **DONE** | Challenges, industries, category and logos. |
| 60 | EX High Power Heating Jacket | SAFH150H/SAFH050H | READY | **DONE** | Challenges, industries, category and logos. |
| 61 | EX LED Emergency Worklight | SAE100 | READY | **DONE** | Challenges, industries, category and logos. |
| 62 | EX LED Floodlight | SAFL300 | READY | **DONE** | Challenges, industries, category and logos. |
| 63 | EX LED Rechargeable Floodlight | SARF300 | READY | **DONE** | Challenges, industries, category and logos. |
| 64 | EX LED Rechargeable Floodlight Kit | SARF300/KIT1 | READY | **DONE** | Challenges, industries, category and logos. |
| 65 | EX LED Torch | EX160 | READY | **DONE** | Challenges, industries, category and logos. |
| 66 | EX LED Tower Light Trolley | SAAL/TR | READY | **DONE** | Challenges, industries, category and logos. |
| 67 | EX LED Worklight 100 | SA100 | READY | **DONE** | Challenges, industries, category and logos. |
| 68 | EX LED Worklight 200 | SA200 | READY | **DONE** | Challenges, industries, category and logos. |
| 69 | EX Paint Vapour Extraction System | SAPVES | READY | **DONE** | Challenges, industries, category and logos. |
| 70 | EX Temperature Limiter for Heating Jacket | SAFH/STM | READY | **DONE** | Challenges, industries, category and logos. |
| 71 | EX Temperature Limiter for High Power Heating Jacket | SAFH/HTM | READY | **DONE** | Challenges, industries, category and logos. |
| 72 | Extraction Hood | SAFD/H | READY | **DONE** | Challenges, industries, category and logos. |
| 73 | Filters | SAFU/ | READY | **DONE** | Challenges, industries, category and logos. |
| 74 | Filtration Unit | SAFU | READY | **DONE** | Challenges, industries, category and logos. |
| 75 | Floodlight Magnetic Bracket | SAFL/MB | READY | **DONE** | Challenges, industries, category and logos. |
| 76 | Floodlight Protective Film | SAFL/PF | READY | **DONE** | Challenges, industries, category and logos. |
| 77 | Floodlight Protective Shield | SAFL/PS | READY | **DONE** | Challenges, industries, category and logos. |
| 78 | Floodlight Scaffold Bracket | SAFL/SB | READY | **DONE** | Challenges, industries, category and logos. |
| 79 | Floodlight Tripod Stand | SAFL/TS | READY | **DONE** | Challenges, industries, category and logos. |
| 80 | Fuel Tank Adaptor Flange | SAFD FTF | READY | **DONE** | Challenges, industries, category and logos. |
| 81 | LED Tasklight | SATL100/SG | READY | **DONE** | Challenges, industries, category and logos. |
| 82 | LED Tasklight Charging Rack | SATL100/SG/CR5 | READY | **DONE** | Challenges, industries, category and logos. |
| 83 | Manway Adaptor | SAFD/MW | READY | **DONE** | Challenges, industries, category and logos. |
| 84 | Negative Pressure System | SANPES | READY | **DONE** | Challenges, industries, category and logos. |
| 85 | Negative Pressure Unit | SANPU | READY | **DONE** | Challenges, industries, category and logos. |
| 86 | Portable Trolley | SAAF/TR01 | READY | **DONE** | Challenges, industries, category and logos. SKU set to SAAF/TR01. |
| 87 | Rechargeable Floodlight Protective Case | SARF/PBX | READY | **DONE** | Challenges, industries, category and logos. |
| 88 | Tasklight Holster | SATL/HR | READY | **DONE** | Challenges, industries, category and logos. |
| 89 | Trolley for EX Heater | SAPH/WD | READY | **DONE** | Challenges, industries, category and logos. |
| 90 | Venturi Air Mover | SAV | READY | **DONE** | Challenges, industries, category and logos. |
| 91 | Worklight 100 Antistatic Protective Bag (50) | SAPB100/50 | READY | **DONE** | Challenges, industries, category and logos. |
| 92 | Worklight 100 Antistatic Protective Film | SASP113 | READY | **DONE** | Challenges, industries, category and logos. |
| 93 | Worklight 200 Antistatic Protective Bag (50) | SAPB200/50 | READY | **DONE** | Challenges, industries, category and logos. |
| 94 | Worklight 200 Antistatic Protective Film | SASP114 | READY | **DONE** | Challenges, industries, category and logos. |
| 95 | Worklight Magnetic Bracket | SAFB100 | READY | **DONE** | Challenges, industries, category and logos. |
| 96 | Worklight Magnetic Swivel Bracket | SAFB105 | READY | **DONE** | Challenges, industries, category and logos. |
| 97 | Worklight Plain Bracket | SAFB090 | READY | **DONE** | Challenges, industries, category and logos. |
| 98 | Worklight Scaffold Bracket | SAFB110 | READY | **DONE** | Challenges, industries, category and logos. |
| 99 | Worklight Tripod Stand | SAFB150 | READY | **DONE** | Challenges, industries, category and logos. |
| 100 | Worklight Vertical Line Clamp | SAFB115 | READY | **DONE** | Challenges, industries, category and logos. |
