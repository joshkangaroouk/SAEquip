# Phase 4 report: steps A to E applied

**Date:** 13 October 2026
**Scope:** `PHASE4_INSTRUCTIONS.md`. Product data only: no pages, menus, SEO or publishing.
**Status:** step A applied and verified live. Steps B to E were **applied on 13 October 2026** with Josh's four decisions, then verified live:
- Backups: `migration/backups/2026-10-13-phase4/pre-apply/` and the Duda backup point `pre-phase4-2026-10-13`.
- All 30 category counts match on the site and in Duda.
- The duplicate and both new products are HIDDEN in Duda and on no listing. Both SKUs are set. No logo changed.

The dry run is in `PHASE4_DRY_RUN.md`.

## A. Phase 3 applied (switch-on only)

- **Backup:** `migration/backups/2026-10-13-phase3/pre-apply/`, holding 368 logo toggles and 1,337 category links.
- **Applied:** 58 logos switched on (4 SA range, 32 certification, 22 zone) and **none switched off**. The 8 held logos are still on.
- **Re-checked live:**
  - All 72 READY product cards show exactly the planned certifications.
  - Live on-counts: Ex 44, IECEx 43, Inmetro 26 (19 + 7 held), Zone 0 3, Zone 1-2 44, Zone 20 1, Zone 21-22 38 (37 + 1 held).
  - UKCA 24 and Made in Britain 36 are untouched.
- **Product pages:** the four extraction systems now show SA Cyclone, and EX Heater shows IECEx.

## B to E dry run, in summary

| Step | What would change |
|---|---|
| B | EX Vapour Extraction System (SAPVES): ACTIVE → HIDDEN in Duda, and its 4 category links removed: Products, Fume, Dust, LEV and Vapour Control, Site Challenges, Toxic Fume and Vapour Extraction. No other product links to it. |
| C | Portable Trolley: blank → `SAAF/TR01`. EX 400VA Transformer: `SPTR` → `SPTR400`, which leaves `SPTR` on the EX 3.8KVA Transformer only. Neither SKU is in use elsewhere. |
| D | 5 held products: 56 category links added, none removed. All 5 categories are unchanged, as the instructions said. SA Powernet and SA Endure are already on, so no logo changes. |
| E | 2 new products created HIDDEN, at 0.00 GBP like 74 of 96 products: SA ENDURE LED Max Light (`SAML`) with 6 benefits and 9 specs, and SA ENDURE LEV Accessories (`SEHB/SEFD`) with 5 benefits and the order codes in the description. Names, SKUs and web addresses are all free. |

**Challenge counts after B and D (every product):** Welding Fume Control 0 → **3**, Toxic Fume 14 → **16**, Dust Extraction 6 → **10**, Temporary Power Distribution 6 → **7**, Shutdown 27 → **29**, Confined-Space 16 → **17**. All match the instructions, and every other challenge is unchanged.

**Decisions (all four approved by Josh, 13 October 2026):**
1. **Order of the 3 LEV systems' challenges.** The instructions say Welding > Dust > Toxic. The sheet's own `site_challenges_display_order` says Dust > Toxic > Welding. The order decides the two labels on each card. The plan follows the instructions.
2. **Step B removes all 4 of the duplicate's category links**, not just Toxic Fume, so Fume, Dust, LEV and Vapour Control goes from 39 to 38. It's hidden either way.
3. **Industry counts rise** with D's five products, by 1 to 4 each (for example Marine 71 → 75 and Distilleries 70 → 74). The instructions only mention the challenge counts.
4. **Two presentation choices in E:**
   - Spec labels in the catalogue's Title Case ("Voltage Options", "Light Output"…), which also reuses their existing translations.
   - E2's order codes as a list, because the product description cannot show tables.

## Languages

Disabled languages stay reachable by direct link: accepted for now, with no redirects. Recorded in `CLAUDE.md`.

## Status of every product (for SA Equip)

**100 rows: 60 DONE, 20 PARTIAL, 20 ON HOLD.** Steps B to E are applied, and every fact this list states was re-checked live on 13 October 2026.

| # | Product | SKU (Duda now) | Sheet | Status | What's done / missing / why |
|---|---|---|---|---|---|
| 1 | Air Mover | SEF35 | HOLD | **ON HOLD** | SA ENDURE safe-area (non-EX) product: needs a new safe-area category decision; its sheet challenges are non-standard values. |
| 2 | Compact Dust Extraction System | SAECDS/SAECBS | HOLD | **ON HOLD** | Labelled SA CYCLONE, but the SKU (SAE/SE) and the Duda description say SA ENDURE. Confirm brand and certification. |
| 3 | Dust Filter Bundle - 12 Panel Filters & 24 Compact Bag Filters | SEFU/RF-DU/BD2 | HOLD | **ON HOLD** | Labelled SA CYCLONE, but the SKU (SAE/SE) and the Duda description say SA ENDURE. Confirm brand and certification. |
| 4 | Filter | SAFU/RF | not in sheet | **ON HOLD** | Filter consumable (SAFU/RF): SA Equip merged the filters into one sheet row. Keep, merge or delete? |
| 5 | Filter - Purchase Only | SAFU/RF | not in sheet | **ON HOLD** | Filter consumable (SAFU/RF): SA Equip merged the filters into one sheet row. Keep, merge or delete? |
| 6 | Filter, Filters – Purchase Only (all SAFU/RF) | SAFU/RF | HOLD | **ON HOLD** | Merged sheet row for the SAFU/RF filter products: which Duda filter products to keep, merge or delete? |
| 7 | Filters - PURCHASE ONLY | SAFU/RF | not in sheet | **ON HOLD** | Filter consumable (SAFU/RF): SA Equip merged the filters into one sheet row. Keep, merge or delete? |
| 8 | High Power Air Mover | SEF35HP | HOLD | **ON HOLD** | Labelled SA CYCLONE, but the SKU (SAE/SE) and the Duda description say SA ENDURE. Confirm brand and certification. This is also the SEF35HP duplicate (the sheet has it as both CYCLONE and ENDURE). |
| 9 | High Power Air Mover | SEF35HP | HOLD | **ON HOLD** | SEF35HP duplicate: the sheet lists it as both SA ENDURE and SA CYCLONE High Power Air Mover (one Duda product). Which is right? Also needs the safe-area category decision. |
| 10 | High Volume Dust Extraction System | SAEDES/SAEBDS | HOLD | **ON HOLD** | Labelled SA CYCLONE, but the SKU (SAE/SE) and the Duda description say SA ENDURE. Confirm brand and certification. |
| 11 | LED Emergency Tubelight | STE100 | HOLD | **ON HOLD** | SA ENDURE safe-area (non-EX) product: needs a new safe-area category decision; its sheet challenges are non-standard values. |
| 12 | LED Tubelight | ST100 | HOLD | **ON HOLD** | SA ENDURE safe-area (non-EX) product: needs a new safe-area category decision; its sheet challenges are non-standard values. |
| 13 | LED Worklamp | SAWL | HOLD | **ON HOLD** | SA ENDURE safe-area (non-EX) product: needs a new safe-area category decision; its sheet challenges are non-standard values. |
| 14 | Lightweight Dust Extraction System | SAELDS/SAELBS | HOLD | **ON HOLD** | Labelled SA CYCLONE, but the SKU (SAE/SE) and the Duda description say SA ENDURE. Confirm brand and certification. |
| 15 | Lightweight Filtration Unit | SAELFU | HOLD | **ON HOLD** | Labelled SA CYCLONE, but the SKU (SAE/SE) and the Duda description say SA ENDURE. Confirm brand and certification. |
| 16 | PVC Flexible Duct System | SEFD | HOLD | **ON HOLD** | Labelled SA CYCLONE, but the SKU (SAE/SE) and the Duda description say SA ENDURE. Confirm brand and certification. |
| 17 | Vapour Extraction System | SAEVES | HOLD | **ON HOLD** | Labelled SA CYCLONE, but the SKU (SAE/SE) and the Duda description say SA ENDURE. Confirm brand and certification. |
| 18 | Weekly Rental of SA CYCLONE Ducting 30cm | R-SAFD30/05-EX | not in sheet | **ON HOLD** | Weekly rental product: SA Equip say "rental specific". Keep (Hire) or remove? |
| 19 | Weekly Rental of SA POWERNET Adaptor Lead 110V ATX-CEAG | R-PNAL110EX/01HRE/ATX-CEA17 | not in sheet | **ON HOLD** | Weekly rental product: SA Equip say "rental specific". Keep (Hire) or remove? |
| 20 | Weekly Rental of SA POWERNET Adaptor Lead 110V Stahl-CEAG | R-PNAL110EX/01HRE/STA-CEA17 | not in sheet | **ON HOLD** | Weekly rental product: SA Equip say "rental specific". Keep (Hire) or remove? |
| 21 | Anti-Static PU Flexible Duct System | SAFD | READY | **PARTIAL** | Challenges, industries, category and logos done. **To confirm:** the sheet says no Zone 21-22, but the logo is shown (left on). Confirm. |
| 22 | Antistatic Reinforced Ducting | SAFD | READY | **PARTIAL** | Challenges, industries, category and logos done. **To confirm:** brand SA Cyclone was inferred from the Duda description. Confirm. |
| 23 | Compact Filtration Unit (SAECFU) | SAECFU | HOLD | **PARTIAL** | Challenges (Dust Extraction, Confined-Space, Shutdown), 5 industries and SA Endure done. **Missing:** Paint and Coating Drying left out: it is non-EX, which SA Equip's rule excludes. Confirm. |
| 24 | Container LEV System | SAEWFC | HOLD | **PARTIAL** | Challenges (Welding Fume Control, Dust Extraction, Toxic Fume), 7 industries and SA Endure done; kept in Fume, Dust, LEV and Vapour Control. **Missing:** a safe-area category decision (non-EX); the sheet's Category column was shifted. |
| 25 | EX 3.8KVA Transformer | SPTR | READY | **PARTIAL** | Challenges, industries, category and logos done. **To confirm:** the sheet says no Inmetro, but the logo is shown (left on). Confirm. |
| 26 | EX 400VA Transformer | SPTR | HOLD | **PARTIAL** | Challenges (Temporary Power Distribution, Shutdown and Turnaround Packages), 6 industries and SA Powernet done; SKU SPTR → SPTR400 (step C). **Missing:** certification data (Ex, IECEx, Inmetro, zones), so no cert logos and no Hydrogen and Hazardous-Gas Ventilation. |
| 27 | EX HeatBox | SAHB/02-AP | READY | **PARTIAL** | Challenges, industries, category and logos done. **To confirm:** ATEX certified but not IECEx (the only product like this). Confirm. |
| 28 | EX LED Area Light | SAAL25/FR | READY | **PARTIAL** | Challenges, industries, category and logos done. **To confirm:** the sheet says no Inmetro, but the logo is shown (left on). Confirm. |
| 29 | EX LED Tower Light | SAAL25/TW | READY | **PARTIAL** | Challenges, industries, category and logos done. **To confirm:** the sheet says no Inmetro, but the logo is shown (left on). Confirm. |
| 30 | EX LED Vessel Entry Kit | SAVK | READY | **PARTIAL** | Challenges, industries, category and logos done. **To confirm:** the sheet says no Inmetro, but the logo is shown (left on). Confirm. |
| 31 | EX Mains Distribution Unit | SPDU | READY | **PARTIAL** | Challenges, industries, category and logos done. **To confirm:** the sheet says no Inmetro, but the logo is shown (left on). Confirm. |
| 32 | EX Splitter Unit | SPSB | READY | **PARTIAL** | Challenges, industries, category and logos done. **To confirm:** the sheet says no Inmetro, but the logo is shown (left on). Confirm. |
| 33 | EX Vapour Extraction System | SAPVES | not in sheet | **PARTIAL** | Confirmed duplicate of EX Paint Vapour Extraction System: hidden and its category links removed (step B). Delete later; no other product links to it. |
| 34 | Lightweight Extraction System | SACLDS | READY | **PARTIAL** | Challenges, industries, category and logos done. **To confirm:** the sheet says no Inmetro, but the logo is shown (left on). Confirm. |
| 35 | Mobile LEV System | SAEWFS | HOLD | **PARTIAL** | Challenges (Welding Fume Control, Dust Extraction, Toxic Fume), 7 industries and SA Endure done; kept in Fume, Dust, LEV and Vapour Control. **Missing:** a safe-area category decision (non-EX); the sheet's Category column was shifted. |
| 36 | Portable LEV System | SAEWFP | HOLD | **PARTIAL** | Challenges (Welding Fume Control, Dust Extraction, Toxic Fume), 7 industries and SA Endure done; kept in Fume, Dust, LEV and Vapour Control. **Missing:** a safe-area category decision (non-EX); the sheet's Category column was shifted. |
| 37 | SA ENDURE LED Max Light | SAML | NEW_PRODUCT_HOLD | **PARTIAL** | New: created HIDDEN with SA Equip's description, key benefits and spec table (step E). **Missing:** images, safe-area category, challenges, industries, logos, SEO; not visible on the site. |
| 38 | SA ENDURE LEV Accessories | SEHB/SEFD | NEW_PRODUCT_HOLD | **PARTIAL** | New: created HIDDEN with SA Equip's description, key benefits and order codes (step E). **Missing:** images, safe-area category, challenges, industries, logos, SEO; not visible on the site. |
| 39 | SA LUMIN Tasklight Adjustable Floor Stand | — | READY | **PARTIAL** | Challenges, industries, category and logos done. **To confirm:** SKU still blank: both Tasklight items were given SATL/BU. |
| 40 | SA LUMIN Tasklight Base Unit | — | READY | **PARTIAL** | Challenges, industries, category and logos done. **To confirm:** SKU still blank: both Tasklight items were given SATL/BU. |
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
| 86 | Portable Trolley | — | READY | **DONE** | Challenges, industries, category and logos. SKU blank → SAAF/TR01 (step C). |
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
