# Phase 4 dry run: steps B to E

**Generated:** 2026-10-13T15:29:21.204Z by `npm run catalogue:phase4` (APPLY).
**Scope:** `PHASE4_INSTRUCTIONS.md` B to E. Product data only: no pages, menus, SEO or publishing.

## B. Hide the confirmed duplicate

| Product | Duda status | Category links removed |
|---|---|---|
| EX Vapour Extraction System (SAPVES) | ACTIVE → HIDDEN | Products; Products › Fume, Dust, LEV and Vapour Control; Site Challenges › Toxic Fume and Vapour Extraction; Site Challenges |

Before deleting it later: 0 other product(s) list it under Compatible Products. A hidden product is already left out of every public listing and carousel.

## C. SKU updates

| Product | Now | After |
|---|---|---|
| Portable Trolley | (blank) | SAAF/TR01 |
| EX 400VA Transformer | SPTR | SPTR400 |

The Tasklight Floor Stand and Base Unit SKUs are not touched. After this, `SPTR` is on the EX 3.8KVA Transformer only.

## D. Partial assignments for 5 held products

| Ref | Product | Site Challenges (card order) | Industries | Category | SA logo |
|---|---|---|---|---|---|
| D1 | EX 400VA Transformer | — → **Temporary Power Distribution; Shutdown and Turnaround Packages** | — → 6 industries | Lighting and Power (unchanged) | SA Powernet (already on) |
| D2 | Compact Filtration Unit (SAECFU) | — → **Dust Extraction, Filtration and Containment; Confined-Space Ventilation; Shutdown and Turnaround Packages** | — → 5 industries | Fume, Dust, LEV and Vapour Control (unchanged) | SA Endure (already on) |
| D3 | Container LEV System | — → **Welding Fume Control; Dust Extraction, Filtration and Containment; Toxic Fume and Vapour Extraction** | — → 7 industries | Fume, Dust, LEV and Vapour Control (unchanged) | SA Endure (already on) |
| D4 | Mobile LEV System | — → **Welding Fume Control; Dust Extraction, Filtration and Containment; Toxic Fume and Vapour Extraction** | — → 7 industries | Fume, Dust, LEV and Vapour Control (unchanged) | SA Endure (already on) |
| D5 | Portable LEV System | — → **Welding Fume Control; Dust Extraction, Filtration and Containment; Toxic Fume and Vapour Extraction** | — → 7 industries | Fume, Dust, LEV and Vapour Control (unchanged) | SA Endure (already on) |

Industries, from the sheet:

- **D1 EX 400VA Transformer** (6): Distilleries & Breweries; Renewables & Hydrogen; Petrochemical & Chemical Processing; Utilities; Nuclear; Oil & Gas
- **D2 Compact Filtration Unit (SAECFU)** (5): Petrochemical & Chemical Processing; Utilities; Marine & Commercial Ship Repair; Construction & Major Projects; Oil & Gas
- **D3 Container LEV System** (7): Distilleries & Breweries; Pharmaceuticals; Rail & Transport Engineering; Aviation & Aerospace; Marine & Commercial Ship Repair; Construction & Major Projects; Defence & Naval Shipbuilding
- **D4 Mobile LEV System** (7): Distilleries & Breweries; Pharmaceuticals; Rail & Transport Engineering; Aviation & Aerospace; Marine & Commercial Ship Repair; Construction & Major Projects; Defence & Naval Shipbuilding
- **D5 Portable LEV System** (7): Distilleries & Breweries; Pharmaceuticals; Rail & Transport Engineering; Aviation & Aerospace; Marine & Commercial Ship Repair; Construction & Major Projects; Defence & Naval Shipbuilding

Left out, as instructed: Hydrogen and Hazardous-Gas Ventilation (D1), Paint and Coating Drying (D2). Certification and zone logos are not touched.

⚠️ **Order differs from the sheet's `site_challenges_display_order`** (which decides the two labels a card shows). The plan follows the instructions:

- D3 Container LEV System: instructions **Welding Fume Control > Dust Extraction, Filtration and Containment > Toxic Fume and Vapour Extraction**; sheet **Dust Extraction, Filtration and Containment > Toxic Fume and Vapour Extraction > Welding Fume Control**
- D4 Mobile LEV System: instructions **Welding Fume Control > Dust Extraction, Filtration and Containment > Toxic Fume and Vapour Extraction**; sheet **Dust Extraction, Filtration and Containment > Toxic Fume and Vapour Extraction > Welding Fume Control**
- D5 Portable LEV System: instructions **Welding Fume Control > Dust Extraction, Filtration and Containment > Toxic Fume and Vapour Extraction**; sheet **Dust Extraction, Filtration and Containment > Toxic Fume and Vapour Extraction > Welding Fume Control**

## Category counts after B and D (every product)

| Category | Now | After | Expected | |
|---|---|---|---|---|
| Site Challenges › Equipment and Material Protection | 9 | 9 | 9 | ✓ |
| Site Challenges › Temporary and Process Heating | 7 | 7 | 7 | ✓ |
| Site Challenges › Hazardous-Area Cooling | 1 | 1 | 1 | ✓ |
| Site Challenges › Humidity and Condensation Control | 2 | 2 | 2 | ✓ |
| Site Challenges › Paint and Coating Drying | 21 | 21 | 21 | ✓ |
| Site Challenges › Shutdown and Turnaround Packages | 27 | 29 | 29 | ✓ |
| Site Challenges › Temporary Power Distribution | 6 | 7 | 7 | ✓ |
| Site Challenges › Hazardous-Area Lighting | 36 | 36 | 36 | ✓ |
| Site Challenges › Tank and Vessel Entry | 52 | 52 | 52 | ✓ |
| Site Challenges › Confined-Space Ventilation | 16 | 17 | 17 | ✓ |
| Site Challenges › Hydrogen and Hazardous-Gas Ventilation | 27 | 27 | 27 | ✓ |
| Site Challenges › Paint Spray Fume Control | 1 | 1 | 1 | ✓ |
| Site Challenges › Toxic Fume and Vapour Extraction | 14 | 16 | 16 | ✓ |
| Site Challenges › Dust Extraction, Filtration and Containment | 6 | 10 | 10 | ✓ |
| Site Challenges › Welding Fume Control | 0 | 3 | 3 | ✓ |
| Industries › Distilleries & Breweries | 70 | 74 | — | changes |
| Industries › Pharmaceuticals | 53 | 56 | — | changes |
| Industries › Rail & Transport Engineering | 53 | 56 | — | changes |
| Industries › Aviation & Aerospace | 53 | 56 | — | changes |
| Industries › Renewables & Hydrogen | 69 | 70 | — | changes |
| Industries › Petrochemical & Chemical Processing | 71 | 73 | — | changes |
| Industries › Utilities | 71 | 73 | — | changes |
| Industries › Nuclear | 69 | 70 | — | changes |
| Industries › Marine & Commercial Ship Repair | 71 | 75 | — | changes |
| Industries › Construction & Major Projects | 55 | 59 | — | changes |
| Industries › Oil & Gas | 71 | 73 | — | changes |
| Industries › Defence & Naval Shipbuilding | 69 | 72 | — | changes |
| Products › Fume, Dust, LEV and Vapour Control | 39 | 38 | — | changes |

Rows not listed do not change. Industries change only through D's five products.

## E. Two new products, created HIDDEN

### E1. SA ENDURE LED Max Light, SKU `SAML`

- **Duda:** create, status HIDDEN, type PHYSICAL, price 0.00 GBP (as 74 of 96 products are), web address /product/sa-endure-led-max-light (Duda's own). Duda gets the description; it cannot take links, and there are none.
- **Hub:** the same description for the Overview tab; 6 key benefits; 9 spec rows.
- **Not added:** categories, challenges, industries, logos, images, SEO. The text is English only until the pre-launch translation pass.

Description:

```html
<p>The SA ENDURE Max Light is an exceptionally durable freestanding floodlight designed to deliver an even light output of almost 4,000 lumens over a wide area. Built for rigorous industrial environments such as aircraft maintenance facilities, shipyards, and heavy industry sites, it features a stable, robust design that keeps it secure even on rough surfaces. Linkable options allow multiple units to be connected from a single power supply.</p>
```

Key benefits:

- Powerful LED light spread (3,800 lumens, 180-degree beam).
- Suitable for use in all weather conditions.
- Low energy consumption with high light output.
- Freestanding stability on rough surfaces.
- Portable, lightweight, and switchable (on/off).
- Linkable variants enable multiple lights from one power supply.

| Specification | Value |
|---|---|
| Voltage Options | 12V, 24V, 42V, 48V, 110V, 230V |
| Light Output | 3,800 lumens (180°) |
| Light Source | High-efficacy LEDs (50,000 hours lifespan) |
| Operating Temperature | -30°C to +50°C |
| Ingress Protection | IP54 |
| Plugs/Sockets | IEC IP44, IEC IP67 |
| Cable Length | 5m (linkable) / 10m (non-linkable) |
| Dimensions | 423mm (h) x 215mm (w) x 139mm (d) |
| Weight | 1kg |

### E2. SA ENDURE LEV Accessories, SKU `SEHB/SEFD`

- **Duda:** create, status HIDDEN, type PHYSICAL, price 0.00 GBP (as 74 of 96 products are), web address /product/sa-endure-lev-accessories (Duda's own). Duda gets the description; it cannot take links, and there are none.
- **Hub:** the same description for the Overview tab; 5 key benefits; no spec rows (the order codes are in the description, as instructed).
- **Not added:** categories, challenges, industries, logos, images, SEO. The text is English only until the pre-launch translation pass.

Description:

```html
<p>The SA ENDURE range of LEV quick-release accessories has been developed in close collaboration with welding operatives to enhance the flexibility of SA LEV systems. The accessory range enables rapid installation, adjustment, and reconfiguration of ducting and extraction hoods right at the workface, even multiple times during a shift.</p>
<p><strong>Order codes</strong></p>
<ul><li><strong>SEHB/MB</strong>: SA ENDURE Hood Swivel Bracket, Magnetic</li>
<li><strong>SEHB/SCS</strong>: SA ENDURE Hood Swivel Bracket, Suction Cup</li>
<li><strong>SEHB/SB</strong>: SA ENDURE Hood Swivel Bracket, Scaffold Clamp</li>
<li><strong>SEFD10/MB</strong>: SA ENDURE 10cm Ducting Bracket, Magnetic</li>
<li><strong>SEFD10/SCS</strong>: SA ENDURE 10cm Ducting Bracket, Suction Cup</li>
<li><strong>SEFD10/SB</strong>: SA ENDURE 10cm Ducting Bracket, Scaffold Clamp</li>
<li><strong>SEFD10/FT</strong>: SA ENDURE Fishtail LEV Hood with bracket keyway</li>
<li><strong>SEFD10/FL</strong>: SA ENDURE Flared LEV Hood with bracket keyway</li>
</ul>
```

Key benefits:

- Complete range of mounting and connection options.
- Quick-release keyway connectivity for fast changes.
- Compatible with all SA Equip LEV systems.
- Enables fine adjustment to achieve compliance with HSE Guideline HSG258.
- Exceptionally robust and durable anodised aluminium construction.

## Checks

- ✓ every product found and named as expected, no SKU clash, no existing product with a new name or SKU, every category unchanged, every expected count met.
