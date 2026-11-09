# Phase 5c report: final decisions applied

**Date:** 14 October 2026
**Backups:**
- `migration/backups/2026-10-14-phase5c/pre-apply/`: 1,475 category links, 420 logo toggles, 98 products.
- Duda backup point `pre-phase5c-deletes-2026-10-14`.
- **Full snapshot of every deleted product** (Duda record and Hub rows): `migration/backups/2026-10-14-phase5c/deleted-products-1791981773911.json`.

Nothing was published.

## What was done, checked live

1. **Antistatic Reinforced Ducting:** confirmed SA CYCLONE. Status only; no data change.
2. **SA ENDURE LED Max Light:** kept live and added to **Lighting and Power**, which now has 46 products. Its Site Challenges stay empty, like the other SA ENDURE lights, and the SA ENDURE rule still holds (SA Endure, no hazardous logos).
3. **Filter Type option**, live on the product pages:

   | Product | Choices | Variations |
   |---|---|---|
   | Filtration Unit (SAFU) | Dust, Breathable Dust, Vapour | 3 |
   | Compact Filtration Unit (SACFU) | Dust, Breathable Dust | 2 |
   | Lightweight Filtration Unit (SAELFU) | Dust, Breathable Dust | 2 |

   - The option shows as three choices next to "Add to Quote List" (screenshot: `phase5c-filter-type-option.png`).
   - **Tested end to end on the live page:** choosing Breathable Dust and adding to the quote stores the line as "Filter Type: Breathable Dust", with Duda's option and choice IDs, so it translates and reaches staff in English.
   - ⚠️ **Duda pre-selects the first choice (Dust)**, so a visitor who doesn't choose is quoted for Dust.
   - The store now uses 2 of its 20 options. The ENDURE Compact (SAECFU) is untouched.
4. **Permanently deleted** from Duda and the Hub:
   - SA LUMIN Tasklight Adjustable Floor Stand;
   - Filters (SAFU/);
   - Filter, Filter - Purchase Only and Filters - PURCHASE ONLY (SAFU/RF);
   - SA ENDURE LEV Accessories;
   - EX Vapour Extraction System.

   Each was HIDDEN with no category links first. The Floor Stand was still listed under Compatible Products on EX HeatBox, LED Tasklight and LED Tasklight Charging Rack; those three entries went with it (hidden, it had not been showing).
5. **The 3 weekly rentals stay HIDDEN**, not deleted.
6. **Duda sync:** 1 category updated (Lighting and Power 45 → 46), 0 failed, all 33 correct afterwards.

**Duda now holds 91 products:** 88 visible, plus the 3 hidden rentals.

## Status of every product (final)

**100 rows: 97 DONE, 0 PARTIAL, 3 ON HOLD**, after Phase 5c, re-checked live on 14 October 2026. 7 products were deleted (marked DONE: Deleted). Outstanding for every product: UKCA and Made in Britain per product (SA Equip still to answer); untouched.

| # | Product | SKU (Duda now) | Sheet | Status | What's done / missing / to confirm |
|---|---|---|---|---|---|
| 1 | Weekly Rental of SA CYCLONE Ducting 30cm | R-SAFD30/05-EX | not in sheet | **ON HOLD** | **Hidden** (not deleted) until the rental discussion with SA Equip. |
| 2 | Weekly Rental of SA POWERNET Adaptor Lead 110V ATX-CEAG | R-PNAL110EX/01HRE/ATX-CEA17 | not in sheet | **ON HOLD** | **Hidden** (not deleted) until the rental discussion with SA Equip. |
| 3 | Weekly Rental of SA POWERNET Adaptor Lead 110V Stahl-CEAG | R-PNAL110EX/01HRE/STA-CEA17 | not in sheet | **ON HOLD** | **Hidden** (not deleted) until the rental discussion with SA Equip. |
| 4 | Air Mover | SEF35 | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; challenges as SA Equip set them. Category unchanged. |
| 5 | Anti-Static PU Flexible Duct System | SAFD | READY | **DONE** | **Confirmed:** Zone 21-22 is correct (left on). Challenges, industries, category and logos done. |
| 6 | Antistatic Layflat Ducting | SAFD/LF | READY | **DONE** | Challenges, industries, category and logos. |
| 7 | Antistatic Reinforced Ducting | SAFD | READY | **DONE** | **Confirmed SA CYCLONE** (SA Equip). Challenges, industries, category and logos done. |
| 8 | Charging Unit for EX Rechargeable Torch | EX150/CR | READY | **DONE** | Challenges, industries, category and logos. |
| 9 | Compact Dust Extraction System | SAECDS/SAECBS | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; challenges as SA Equip set them. Category unchanged. |
| 10 | Compact Filtration Unit | SACFU | READY | **DONE** | Challenges, industries, category and logos done. **Filter Type option:** Dust, Breathable Dust (live; it carries through to the quote list). |
| 11 | Compact Filtration Unit (SAECFU) | SAECFU | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; challenges as SA Equip set them. Category unchanged. |
| 12 | Compact Floodlight Protective Film | SAFL/PF-C | READY | **DONE** | Challenges, industries, category and logos. |
| 13 | Compact Floodlight Protective Shield | SAFL/PS-C | READY | **DONE** | Challenges, industries, category and logos. |
| 14 | Container LEV System | SAEWFC | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; challenges as SA Equip set them. Category unchanged. |
| 15 | Duct Couplers | SAFD/CU | READY | **DONE** | Challenges, industries, category and logos. |
| 16 | Dust Filter Bundle - 12 Panel Filters & 24 Compact Bag Filters | SEFU/RF-DU/BD2 | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; challenges as SA Equip set them. Category unchanged. |
| 17 | EX 3.8KVA Transformer | SPTR | READY | **DONE** | **Confirmed:** no Inmetro (switched off). Challenges, industries, category and logos done. |
| 18 | EX 400VA Transformer | SPTR400 | HOLD | **DONE** | **Confirmed:** Ex, IECEx, UKCA, Zone 1-2, Zone 21-22 on; Inmetro off; Hydrogen added (Temporary Power > Hydrogen > Shutdown); SKU SPTR400. |
| 19 | EX Adaptor Lead | R-PNAL | READY | **DONE** | Challenges, industries, category and logos. |
| 20 | EX Air Conditioner | SAAC11440 | READY | **DONE** | Challenges, industries, category and logos. |
| 21 | EX Air Mover | SAF35 / SAF35D | READY | **DONE** | Challenges, industries, category and logos. |
| 22 | EX Compact Dust Extraction System | SACDES/SACBDS | READY | **DONE** | Challenges, industries, category and logos. |
| 23 | EX Dehumidifier | SADH11440 | READY | **DONE** | Challenges, industries, category and logos. |
| 24 | EX Dust Extraction System | SADSES | READY | **DONE** | Challenges, industries, category and logos. |
| 25 | EX Extension Lead | PNEL | READY | **DONE** | Challenges, industries, category and logos. |
| 26 | EX Extension Reel | PNER | READY | **DONE** | Challenges, industries, category and logos. |
| 27 | EX Headtorch | EX600 | READY | **DONE** | Challenges, industries, category and logos. |
| 28 | EX HeatBox | SAHB/02-AP | READY | **DONE** | **Confirmed:** ATEX but not IECEx is correct. Challenges, industries, category and logos done. |
| 29 | EX Heater | SAPH18440 | READY | **DONE** | Challenges, industries, category and logos. |
| 30 | EX Heating Jacket | SAFH150P/SAFH050P | READY | **DONE** | Challenges, industries, category and logos. |
| 31 | EX High Capacity Dust Extraction System | SADSES/SABDES | READY | **DONE** | Challenges, industries, category and logos. |
| 32 | EX High Power Air Mover | SAF35HP | READY | **DONE** | Challenges, industries, category and logos. |
| 33 | EX High Power Heating Jacket | SAFH150H/SAFH050H | READY | **DONE** | Challenges, industries, category and logos. |
| 34 | EX LED Area Light | SAAL25/FR | READY | **DONE** | **Confirmed:** no Inmetro (switched off). Challenges, industries, category and logos done. |
| 35 | EX LED Emergency Worklight | SAE100 | READY | **DONE** | Challenges, industries, category and logos. |
| 36 | EX LED Floodlight | SAFL300 | READY | **DONE** | Challenges, industries, category and logos. |
| 37 | EX LED Rechargeable Floodlight | SARF300 | READY | **DONE** | Challenges, industries, category and logos. |
| 38 | EX LED Rechargeable Floodlight Kit | SARF300/KIT1 | READY | **DONE** | Challenges, industries, category and logos. |
| 39 | EX LED Torch | EX160 | READY | **DONE** | Challenges, industries, category and logos. |
| 40 | EX LED Tower Light | SAAL25/TW | READY | **DONE** | **Confirmed:** no Inmetro (switched off). Challenges, industries, category and logos done. |
| 41 | EX LED Tower Light Trolley | SAAL/TR | READY | **DONE** | Challenges, industries, category and logos. |
| 42 | EX LED Vessel Entry Kit | SAVK | READY | **DONE** | **Confirmed:** no Inmetro (switched off). Challenges, industries, category and logos done. |
| 43 | EX LED Worklight 100 | SA100 | READY | **DONE** | Challenges, industries, category and logos. |
| 44 | EX LED Worklight 200 | SA200 | READY | **DONE** | Challenges, industries, category and logos. |
| 45 | EX Mains Distribution Unit | SPDU | READY | **DONE** | **Confirmed:** no Inmetro (switched off). Challenges, industries, category and logos done. |
| 46 | EX Paint Vapour Extraction System | SAPVES | READY | **DONE** | Challenges, industries, category and logos. |
| 47 | EX Splitter Unit | SPSB | READY | **DONE** | **Confirmed:** no Inmetro (switched off). Challenges, industries, category and logos done. |
| 48 | EX Temperature Limiter for Heating Jacket | SAFH/STM | READY | **DONE** | Challenges, industries, category and logos. |
| 49 | EX Temperature Limiter for High Power Heating Jacket | SAFH/HTM | READY | **DONE** | Challenges, industries, category and logos. |
| 50 | EX Vapour Extraction System | SAPVES | not in sheet | **DONE** | **Deleted** on 14 October 2026, as SA Equip asked (snapshot kept in the backups). It duplicated EX Paint Vapour Extraction System. |
| 51 | Extraction Hood | SAFD/H | READY | **DONE** | Challenges, industries, category and logos. |
| 52 | Filter | SAFU/RF | not in sheet | **DONE** | **Deleted** on 14 October 2026, as SA Equip asked (snapshot kept in the backups). |
| 53 | Filter - Purchase Only | SAFU/RF | not in sheet | **DONE** | **Deleted** on 14 October 2026, as SA Equip asked (snapshot kept in the backups). |
| 54 | Filter, Filters – Purchase Only (all SAFU/RF) | SAFU/RF | HOLD | **DONE** | The three SAFU/RF filter products were **deleted** on 14 October 2026; filters are options on the filtration units. |
| 55 | Filters | SAFU/ | READY | **DONE** | **Deleted** on 14 October 2026, as SA Equip asked (snapshot kept in the backups). Filters are now options on the filtration units. |
| 56 | Filters - PURCHASE ONLY | SAFU/RF | not in sheet | **DONE** | **Deleted** on 14 October 2026, as SA Equip asked (snapshot kept in the backups). |
| 57 | Filtration Unit | SAFU | READY | **DONE** | Challenges, industries, category and logos done. **Filter Type option:** Dust, Breathable Dust, Vapour (live; it carries through to the quote list). |
| 58 | Floodlight Magnetic Bracket | SAFL/MB | READY | **DONE** | Challenges, industries, category and logos. |
| 59 | Floodlight Protective Film | SAFL/PF | READY | **DONE** | Challenges, industries, category and logos. |
| 60 | Floodlight Protective Shield | SAFL/PS | READY | **DONE** | Challenges, industries, category and logos. |
| 61 | Floodlight Scaffold Bracket | SAFL/SB | READY | **DONE** | Challenges, industries, category and logos. |
| 62 | Floodlight Tripod Stand | SAFL/TS | READY | **DONE** | Challenges, industries, category and logos. |
| 63 | Fuel Tank Adaptor Flange | SAFD FTF | READY | **DONE** | Challenges, industries, category and logos. |
| 64 | High Power Air Mover | SEF35HP | HOLD | **DONE** | Same Duda product as the ENDURE row: **confirmed SA ENDURE**, so this CYCLONE row is wrong. SA ENDURE rule applied. |
| 65 | High Power Air Mover | SEF35HP | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; challenges as SA Equip set them. Category unchanged. |
| 66 | High Volume Dust Extraction System | SAEDES/SAEBDS | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; challenges as SA Equip set them. Category unchanged. |
| 67 | LED Emergency Tubelight | STE100 | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; no challenge, deliberately (found through Lighting and Power). Category unchanged. |
| 68 | LED Tasklight | SATL100/SG | READY | **DONE** | Challenges, industries, category and logos. |
| 69 | LED Tasklight Charging Rack | SATL100/SG/CR5 | READY | **DONE** | Challenges, industries, category and logos. |
| 70 | LED Tubelight | ST100 | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; no challenge, deliberately (found through Lighting and Power). Category unchanged. |
| 71 | LED Worklamp | SAWL | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; no challenge, deliberately (found through Lighting and Power). Category unchanged. |
| 72 | Lightweight Dust Extraction System | SAELDS/SAELBS | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; challenges as SA Equip set them. Category unchanged. |
| 73 | Lightweight Extraction System | SACLDS | READY | **DONE** | **Confirmed:** no Inmetro (switched off). Challenges, industries, category and logos done. |
| 74 | Lightweight Filtration Unit | SAELFU | HOLD | **DONE** | Confirmed SA ENDURE (industrial only); SA ENDURE rule applied. **Filter Type option:** Dust, Breathable Dust (live; it carries through to the quote list). |
| 75 | Manway Adaptor | SAFD/MW | READY | **DONE** | Challenges, industries, category and logos. |
| 76 | Mobile LEV System | SAEWFS | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; challenges as SA Equip set them. Category unchanged. |
| 77 | Negative Pressure System | SANPES | READY | **DONE** | Challenges, industries, category and logos. |
| 78 | Negative Pressure Unit | SANPU | READY | **DONE** | Challenges, industries, category and logos. |
| 79 | Portable LEV System | SAEWFP | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; challenges as SA Equip set them. Category unchanged. |
| 80 | Portable Trolley | SAAF/TR01 | READY | **DONE** | Challenges, industries, category and logos. SKU set to SAAF/TR01. |
| 81 | PVC Flexible Duct System | SEFD | HOLD | **DONE** | **Confirmed SA ENDURE (industrial, never hazardous areas):** SA Endure on; SA Cyclone and every hazardous-area certification off; the 7 industrial industries; challenges as SA Equip set them. Category unchanged. |
| 82 | Rechargeable Floodlight Protective Case | SARF/PBX | READY | **DONE** | Challenges, industries, category and logos. |
| 83 | SA ENDURE LED Max Light | SAML | NEW_PRODUCT_HOLD | **DONE** | Live. SA ENDURE rule applied: SA Endure, the 7 industrial industries, no challenge (like the other ENDURE lights). **In Lighting and Power** since 14 Oct. More images and SEO are with Josh. |
| 84 | SA ENDURE LEV Accessories | SEHB/SEFD | NEW_PRODUCT_HOLD | **DONE** | **Deleted** on 14 October 2026, as SA Equip asked (snapshot kept in the backups). Sold with the LEV systems. |
| 85 | SA LUMIN Tasklight Adjustable Floor Stand | — | READY | **DONE** | **Deleted** on 14 October 2026, as SA Equip asked (snapshot kept in the backups). |
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
