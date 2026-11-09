# Phase 5b report: SA Equip's answers applied

**Date:** 14 October 2026
**Scope:** `PHASE5B_INSTRUCTIONS.md` sections 1 to 4 (applied), and section 5 (investigated only). Nothing published.
**Backups:** `migration/backups/2026-10-14-phase5b/pre-apply/` (1,616 category links, 426 logo toggles, 98 products) and the Duda backup point `pre-phase5b-2026-10-14`. The script's own record is `PHASE5B_APPLY.md`.

## 1. SA ENDURE: industrial only (safety-critical): done and checked live

All **17 SA ENDURE products** now show, as visitors see them:
- SA Endure on and SA Cyclone off;
- **no** Ex, IECEx, Inmetro or Zone logos (UKCA and Made in Britain left as they were);
- exactly the 7 industrial industries;
- only the challenges SA Equip set.

The 4 SA ENDURE lights have no challenge, deliberately. The script re-checked the rule on the stored data after writing, and again on the live site: **17/17 clean**.

## Every logo switched OFF (9)

| Product | Logo | Why |
|---|---|---|
| Dust Filter Bundle - 12 Panel Filters & 24 Compact Bag Filters | SA Cyclone | SA ENDURE product (section 1) |
| EX 3.8KVA Transformer | Inmetro | Confirmed by SA Equip (section 2) |
| EX 400VA Transformer | Inmetro | Confirmed by SA Equip (section 2) |
| EX LED Area Light | Inmetro | Confirmed by SA Equip (section 2) |
| EX LED Tower Light | Inmetro | Confirmed by SA Equip (section 2) |
| EX LED Vessel Entry Kit | Inmetro | Confirmed by SA Equip (section 2) |
| EX Mains Distribution Unit | Inmetro | Confirmed by SA Equip (section 2) |
| EX Splitter Unit | Inmetro | Confirmed by SA Equip (section 2) |
| Lightweight Extraction System | Inmetro | Confirmed by SA Equip (section 2) |

No SA ENDURE product had any Ex, IECEx, Inmetro or Zone logo before this phase, so section 1 switched off only the one SA Cyclone logo.

## Every logo switched ON (3)

| Product | Logo |
|---|---|
| High Volume Dust Extraction System | SA Endure |
| Lightweight Dust Extraction System | SA Endure |
| SA ENDURE LED Max Light | SA Endure |

The EX 400VA Transformer already had Ex, IECEx, UKCA, Zone 1-2 and Zone 21-22, so it needed no switch-on. Its challenges are now Temporary Power Distribution > Hydrogen and Hazardous-Gas Ventilation > Shutdown and Turnaround Packages.

## 3 and 4: hidden, and the SKU

**Hidden in Duda, with all their category links removed** (each now returns 404 and is on no listing):
- SA LUMIN Tasklight Adjustable Floor Stand;
- Filters (SAFU/);
- the 3 weekly rentals;
- SA ENDURE LEV Accessories, which is flagged for deletion.

**SKU:** SA LUMIN Tasklight Base Unit is now **SATL/BU**.

⚠️ **Both new SA ENDURE products had been switched to ACTIVE since 13 October**, and each has 1 image. The instructions describe both as hidden. So:
- **LEV Accessories** was hidden again, as section 3 says.
- **Max Light** was left ACTIVE, because no section asks to hide it. ⚠️ It is in **no product category**, so it does not appear on the Lighting and Power page. Section 1 assumes the ENDURE lights are found there; the other three are.

## Other SA ENDURE / SAE / SE products not in the table (not changed)

- **EX LED Emergency Worklight (SAE100):** found only because its SKU starts with "SAE". It is an EX product (SA Lumin), not ENDURE, so this is a coincidence of SKU.
- **SA ENDURE LEV Accessories (SEHB/SEFD):** handled in section 3.

No other product has SA Endure on.

## Final counts (visible on the site; Duda now matches exactly)

| Site Challenge | Before | After |
|---|---|---|
| Welding Fume Control | 3 | 3 |
| Dust Extraction, Filtration and Containment | 14 | 13 |
| Toxic Fume and Vapour Extraction | 19 | 17 |
| Paint Spray Fume Control | 2 | 2 |
| Hydrogen and Hazardous-Gas Ventilation | 30 | 28 |
| Confined-Space Ventilation | 22 | 21 |
| Tank and Vessel Entry | 55 | 51 |
| Hazardous-Area Lighting | 36 | 35 |
| Temporary Power Distribution | 9 | 7 |
| Shutdown and Turnaround Packages | 39 | 28 |
| Paint and Coating Drying | 21 | 21 |
| Humidity and Condensation Control | 2 | 2 |
| Hazardous-Area Cooling | 1 | 1 |
| Temporary and Process Heating | 7 | 7 |
| Equipment and Material Protection | 9 | 9 |

**Industries:**

| Industry | Count |
|---|---|
| Distilleries & Breweries | 87 |
| Marine & Commercial Ship Repair | 86 |
| Defence & Naval Shipbuilding | 85 |
| Petrochemical & Chemical Processing | 70 |
| Utilities | 70 |
| Construction & Major Projects | 70 |
| Oil & Gas | 70 |
| Pharmaceuticals | 69 |
| Rail & Transport Engineering | 69 |
| Aviation & Aerospace | 69 |
| Renewables & Hydrogen | 69 |
| Nuclear | 69 |

**Categories:** Lighting and Power 45, Fume, Dust, LEV and Vapour Control 33, Climate Control and Heating 9.

**88 visible products.** All have at least one industry. The only ones without a challenge are the 4 SA ENDURE lights, deliberately.

## 5. Filter options on the filtration units (investigated, not built)

**Which products** (from the old pages' SKUs):

| Old page | Duda product | Range | Filter types |
|---|---|---|---|
| filtration-unit | Filtration Unit (SAFU) | SA CYCLONE | Dust, Breathable Dust, Vapour |
| compact-filtration-unit | **Compact Filtration Unit (SACFU)**, the CYCLONE one, *not* the ENDURE SAECFU | SA CYCLONE | Dust, Breathable Dust |
| lightweight-filtration-unit-2 | Lightweight Filtration Unit (SAELFU) | SA ENDURE | Dust, Breathable Dust |

None of the three has options or variations in Duda today.

**Recommendation: a Duda product option, "Filter Type".** Create it once in the store with the choices Dust, Breathable Dust and Vapour. Attach it to each product with just that product's choices, from the Hub's product editor (the Options section).
- **It works with the quote list as it is:**
  - Add to Quote already reads Duda's option dropdowns.
  - It will not add the product until a filter is chosen ("Please select all options before adding to your quote").
  - It stores the choice on the basket line and shows it in every language.
  - The quote reaches staff in English, as "Filter Type: Breathable Dust".
  - This is exactly how EX Heater's Hire/Purchase works live today.
- **No code, low risk:**
  - It uses 2 of the store's 20 options.
  - Duda generates 2 or 3 variations per product. As none has variations now, no SKU data can be lost.
  - Per-filter SKUs can be added to the variations later if SA Equip have them.
- **The alternatives fall short:**
  - **A spec line** only lists the filters: a visitor cannot pick one, and the quote would not record which.
  - **A Hub field** needs a new widget section *and* changes to the Add to Quote widget, which is pasted into Duda by hand. That is more work for the same result.

**Questions for SA Equip:**
- Does the **ENDURE Compact Filtration Unit (SAECFU)** also take filter options? It is not on their list.
- The old pages also offered **Purchase/Hire** and a **20 / 30 / 40cm** size on all three. Hire is under discussion; is the size needed?

## Status of every product (updated)

**100 rows: 84 DONE, 16 PARTIAL, 0 ON HOLD**, after Phase 5b, re-checked live on 14 October 2026. Outstanding for every product: UKCA and Made in Britain per product (SA Equip still to answer); they are untouched.

| # | Product | SKU (Duda now) | Sheet | Status | What's done / missing / to confirm |
|---|---|---|---|---|---|
| 1 | Antistatic Reinforced Ducting | SAFD | READY | **PARTIAL** | Challenges, industries, category and logos done. **To confirm:** brand SA Cyclone was inferred from the Duda description. |
| 2 | Compact Filtration Unit | SACFU | READY | **PARTIAL** | Challenges, industries, category and logos done. **To build:** filter-type options (Dust, Breathable Dust): see the section 5 proposal. |
| 3 | EX Vapour Extraction System | SAPVES | not in sheet | **PARTIAL** | Confirmed duplicate of EX Paint Vapour Extraction System: hidden, links removed. **To do:** delete later. |
| 4 | Filter | SAFU/RF | not in sheet | **PARTIAL** | **Hidden:** filters are options on the filtration units, not products. **To do:** delete later. |
| 5 | Filter - Purchase Only | SAFU/RF | not in sheet | **PARTIAL** | **Hidden:** filters are options on the filtration units, not products. **To do:** delete later. |
| 6 | Filter, Filters – Purchase Only (all SAFU/RF) | SAFU/RF | HOLD | **PARTIAL** | **Hidden:** filters are options on the filtration units, not products (SA Equip). All four filter products are hidden. **To do:** delete them later. |
| 7 | Filters | SAFU/ | READY | **PARTIAL** | **Hidden:** SA Equip don't sell filters separately; they become options on the filtration units (section 5 proposal). **To do:** delete later. |
| 8 | Filters - PURCHASE ONLY | SAFU/RF | not in sheet | **PARTIAL** | **Hidden:** filters are options on the filtration units, not products. **To do:** delete later. |
| 9 | Filtration Unit | SAFU | READY | **PARTIAL** | Challenges, industries, category and logos done. **To build:** filter-type options (Dust, Breathable Dust, Vapour): see the section 5 proposal. |
| 10 | Lightweight Filtration Unit | SAELFU | HOLD | **PARTIAL** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; challenges as SA Equip set them. Category unchanged. **To build:** filter-type options (Dust, Breathable Dust): see the section 5 proposal. |
| 11 | SA ENDURE LED Max Light | SAML | NEW_PRODUCT_HOLD | **PARTIAL** | SA ENDURE rule applied: SA Endure, 7 industrial industries, no challenge. **Now ACTIVE on the site (with 1 image)** but in **no product category**, so it is not on the Lighting and Power page. **Missing:** Lighting and Power category, the rest of the images, SEO. |
| 12 | SA ENDURE LEV Accessories | SEHB/SEFD | NEW_PRODUCT_HOLD | **PARTIAL** | **Hidden, flagged for deletion:** sold with the LEV systems, not a separate product (SA Equip). Its category links are removed. |
| 13 | SA LUMIN Tasklight Adjustable Floor Stand | — | READY | **PARTIAL** | **Hidden:** old product (SA Equip). Category links removed. **To do:** delete later. |
| 14 | Weekly Rental of SA CYCLONE Ducting 30cm | R-SAFD30/05-EX | not in sheet | **PARTIAL** | **Hidden:** rental is to be handled differently (SA Equip, to be discussed). Category links removed. |
| 15 | Weekly Rental of SA POWERNET Adaptor Lead 110V ATX-CEAG | R-PNAL110EX/01HRE/ATX-CEA17 | not in sheet | **PARTIAL** | **Hidden:** rental is to be handled differently (SA Equip, to be discussed). Category links removed. |
| 16 | Weekly Rental of SA POWERNET Adaptor Lead 110V Stahl-CEAG | R-PNAL110EX/01HRE/STA-CEA17 | not in sheet | **PARTIAL** | **Hidden:** rental is to be handled differently (SA Equip, to be discussed). Category links removed. |
| 17 | Air Mover | SEF35 | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; challenges as SA Equip set them. Category unchanged. |
| 18 | Anti-Static PU Flexible Duct System | SAFD | READY | **DONE** | **Confirmed:** Zone 21-22 is correct (left on). Challenges, industries, category and logos done. |
| 19 | Antistatic Layflat Ducting | SAFD/LF | READY | **DONE** | Challenges, industries, category and logos. |
| 20 | Charging Unit for EX Rechargeable Torch | EX150/CR | READY | **DONE** | Challenges, industries, category and logos. |
| 21 | Compact Dust Extraction System | SAECDS/SAECBS | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; challenges as SA Equip set them. Category unchanged. |
| 22 | Compact Filtration Unit (SAECFU) | SAECFU | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; challenges as SA Equip set them. Category unchanged. |
| 23 | Compact Floodlight Protective Film | SAFL/PF-C | READY | **DONE** | Challenges, industries, category and logos. |
| 24 | Compact Floodlight Protective Shield | SAFL/PS-C | READY | **DONE** | Challenges, industries, category and logos. |
| 25 | Container LEV System | SAEWFC | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; challenges as SA Equip set them. Category unchanged. |
| 26 | Duct Couplers | SAFD/CU | READY | **DONE** | Challenges, industries, category and logos. |
| 27 | Dust Filter Bundle - 12 Panel Filters & 24 Compact Bag Filters | SEFU/RF-DU/BD2 | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; challenges as SA Equip set them. Category unchanged. |
| 28 | EX 3.8KVA Transformer | SPTR | READY | **DONE** | **Confirmed:** no Inmetro (switched off). Challenges, industries, category and logos done. |
| 29 | EX 400VA Transformer | SPTR400 | HOLD | **DONE** | **Confirmed:** Ex, IECEx, UKCA, Zone 1-2, Zone 21-22 on; Inmetro off; Hydrogen added (Temporary Power > Hydrogen > Shutdown); SKU SPTR400. |
| 30 | EX Adaptor Lead | R-PNAL | READY | **DONE** | Challenges, industries, category and logos. |
| 31 | EX Air Conditioner | SAAC11440 | READY | **DONE** | Challenges, industries, category and logos. |
| 32 | EX Air Mover | SAF35 / SAF35D | READY | **DONE** | Challenges, industries, category and logos. |
| 33 | EX Compact Dust Extraction System | SACDES/SACBDS | READY | **DONE** | Challenges, industries, category and logos. |
| 34 | EX Dehumidifier | SADH11440 | READY | **DONE** | Challenges, industries, category and logos. |
| 35 | EX Dust Extraction System | SADSES | READY | **DONE** | Challenges, industries, category and logos. |
| 36 | EX Extension Lead | PNEL | READY | **DONE** | Challenges, industries, category and logos. |
| 37 | EX Extension Reel | PNER | READY | **DONE** | Challenges, industries, category and logos. |
| 38 | EX Headtorch | EX600 | READY | **DONE** | Challenges, industries, category and logos. |
| 39 | EX HeatBox | SAHB/02-AP | READY | **DONE** | **Confirmed:** ATEX but not IECEx is correct. Challenges, industries, category and logos done. |
| 40 | EX Heater | SAPH18440 | READY | **DONE** | Challenges, industries, category and logos. |
| 41 | EX Heating Jacket | SAFH150P/SAFH050P | READY | **DONE** | Challenges, industries, category and logos. |
| 42 | EX High Capacity Dust Extraction System | SADSES/SABDES | READY | **DONE** | Challenges, industries, category and logos. |
| 43 | EX High Power Air Mover | SAF35HP | READY | **DONE** | Challenges, industries, category and logos. |
| 44 | EX High Power Heating Jacket | SAFH150H/SAFH050H | READY | **DONE** | Challenges, industries, category and logos. |
| 45 | EX LED Area Light | SAAL25/FR | READY | **DONE** | **Confirmed:** no Inmetro (switched off). Challenges, industries, category and logos done. |
| 46 | EX LED Emergency Worklight | SAE100 | READY | **DONE** | Challenges, industries, category and logos. |
| 47 | EX LED Floodlight | SAFL300 | READY | **DONE** | Challenges, industries, category and logos. |
| 48 | EX LED Rechargeable Floodlight | SARF300 | READY | **DONE** | Challenges, industries, category and logos. |
| 49 | EX LED Rechargeable Floodlight Kit | SARF300/KIT1 | READY | **DONE** | Challenges, industries, category and logos. |
| 50 | EX LED Torch | EX160 | READY | **DONE** | Challenges, industries, category and logos. |
| 51 | EX LED Tower Light | SAAL25/TW | READY | **DONE** | **Confirmed:** no Inmetro (switched off). Challenges, industries, category and logos done. |
| 52 | EX LED Tower Light Trolley | SAAL/TR | READY | **DONE** | Challenges, industries, category and logos. |
| 53 | EX LED Vessel Entry Kit | SAVK | READY | **DONE** | **Confirmed:** no Inmetro (switched off). Challenges, industries, category and logos done. |
| 54 | EX LED Worklight 100 | SA100 | READY | **DONE** | Challenges, industries, category and logos. |
| 55 | EX LED Worklight 200 | SA200 | READY | **DONE** | Challenges, industries, category and logos. |
| 56 | EX Mains Distribution Unit | SPDU | READY | **DONE** | **Confirmed:** no Inmetro (switched off). Challenges, industries, category and logos done. |
| 57 | EX Paint Vapour Extraction System | SAPVES | READY | **DONE** | Challenges, industries, category and logos. |
| 58 | EX Splitter Unit | SPSB | READY | **DONE** | **Confirmed:** no Inmetro (switched off). Challenges, industries, category and logos done. |
| 59 | EX Temperature Limiter for Heating Jacket | SAFH/STM | READY | **DONE** | Challenges, industries, category and logos. |
| 60 | EX Temperature Limiter for High Power Heating Jacket | SAFH/HTM | READY | **DONE** | Challenges, industries, category and logos. |
| 61 | Extraction Hood | SAFD/H | READY | **DONE** | Challenges, industries, category and logos. |
| 62 | Floodlight Magnetic Bracket | SAFL/MB | READY | **DONE** | Challenges, industries, category and logos. |
| 63 | Floodlight Protective Film | SAFL/PF | READY | **DONE** | Challenges, industries, category and logos. |
| 64 | Floodlight Protective Shield | SAFL/PS | READY | **DONE** | Challenges, industries, category and logos. |
| 65 | Floodlight Scaffold Bracket | SAFL/SB | READY | **DONE** | Challenges, industries, category and logos. |
| 66 | Floodlight Tripod Stand | SAFL/TS | READY | **DONE** | Challenges, industries, category and logos. |
| 67 | Fuel Tank Adaptor Flange | SAFD FTF | READY | **DONE** | Challenges, industries, category and logos. |
| 68 | High Power Air Mover | SEF35HP | HOLD | **DONE** | Same Duda product as the ENDURE row: **confirmed SA ENDURE**, so this CYCLONE row is wrong. SA ENDURE rule applied. |
| 69 | High Power Air Mover | SEF35HP | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; challenges as SA Equip set them. Category unchanged. |
| 70 | High Volume Dust Extraction System | SAEDES/SAEBDS | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; challenges as SA Equip set them. Category unchanged. |
| 71 | LED Emergency Tubelight | STE100 | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; no challenge, deliberately (found through Lighting and Power). Category unchanged. |
| 72 | LED Tasklight | SATL100/SG | READY | **DONE** | Challenges, industries, category and logos. |
| 73 | LED Tasklight Charging Rack | SATL100/SG/CR5 | READY | **DONE** | Challenges, industries, category and logos. |
| 74 | LED Tubelight | ST100 | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; no challenge, deliberately (found through Lighting and Power). Category unchanged. |
| 75 | LED Worklamp | SAWL | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; no challenge, deliberately (found through Lighting and Power). Category unchanged. |
| 76 | Lightweight Dust Extraction System | SAELDS/SAELBS | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; challenges as SA Equip set them. Category unchanged. |
| 77 | Lightweight Extraction System | SACLDS | READY | **DONE** | **Confirmed:** no Inmetro (switched off). Challenges, industries, category and logos done. |
| 78 | Manway Adaptor | SAFD/MW | READY | **DONE** | Challenges, industries, category and logos. |
| 79 | Mobile LEV System | SAEWFS | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; challenges as SA Equip set them. Category unchanged. |
| 80 | Negative Pressure System | SANPES | READY | **DONE** | Challenges, industries, category and logos. |
| 81 | Negative Pressure Unit | SANPU | READY | **DONE** | Challenges, industries, category and logos. |
| 82 | Portable LEV System | SAEWFP | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; challenges as SA Equip set them. Category unchanged. |
| 83 | Portable Trolley | SAAF/TR01 | READY | **DONE** | Challenges, industries, category and logos. SKU set to SAAF/TR01. |
| 84 | PVC Flexible Duct System | SEFD | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; challenges as SA Equip set them. Category unchanged. |
| 85 | Rechargeable Floodlight Protective Case | SARF/PBX | READY | **DONE** | Challenges, industries, category and logos. |
| 86 | SA LUMIN Tasklight Base Unit | SATL/BU | READY | **DONE** | SKU set to SATL/BU (SA Equip). Challenges, industries, category and logos done. |
| 87 | Tasklight Holster | SATL/HR | READY | **DONE** | Challenges, industries, category and logos. |
| 88 | Trolley for EX Heater | SAPH/WD | READY | **DONE** | Challenges, industries, category and logos. |
| 89 | Vapour Extraction System | SAEVES | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; challenges as SA Equip set them. Category unchanged. |
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
