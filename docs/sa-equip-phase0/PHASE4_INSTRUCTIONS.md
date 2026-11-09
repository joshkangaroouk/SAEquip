# Phase 4: everything we can do without SA Equip

**Prepared by:** Josh / Claude, 13 Oct 2026
**Scope:** product data only. No pages, menus or publishing.
**Rules from CURSOR_BRIEF.md still apply:** back up first, dry run, match by `duda_product_id` only, `null` = untouched.

Do the steps in order. Do a **single dry run covering steps B to E**, report it, and wait for Josh's OK before applying. (Step A is already approved.)

---

## A. Apply Phase 3 (already approved)

Switch-on only, exactly as in `PHASE3_DRY_RUN.md`. Back up, apply, re-check live.

## B. Hide the confirmed duplicate (don't delete yet)

| Duda ID | Product | Action |
|---|---|---|
| `01M1XPVWR8EGD4KDMBRN0H4669` | EX Vapour Extraction System (SAPVES) | SA Equip confirmed it's the same product as **EX Paint Vapour Extraction System**. Set it to **HIDDEN** in Duda and remove its category links (it's currently in Toxic Fume and Vapour Extraction). Deleting it comes later, once we're happy nothing links to it. |

Expected after: Toxic Fume and Vapour Extraction drops from 14 to **13**.

## C. SKU updates (from SA Equip's sheet)

| Duda ID | Product | Current SKU | New SKU |
|---|---|---|---|
| `01M1XPS4YM9H6KWZZJ01TNYBTT` | Portable Trolley | (blank) | `SAAF/TR01` |
| `01M1XPQTR5A31K13F5W5PZ9BPS` | EX 400VA Transformer | `SPTR` | `SPTR400` |

**Do not** change the Tasklight Floor Stand or Base Unit SKUs. SA Equip gave both the same SKU (SATL/BU), and we're waiting for them to confirm.

## D. Partial assignments for 5 held products

These are on HOLD because one part of their data is in doubt. Apply only the parts listed here, and leave the rest alone.

### D1. EX 400VA Transformer: `01M1XPQTR5A31K13F5W5PZ9BPS`
- **Held because:** the sheet has no certification data, so it can't keep the Hydrogen challenge or get any cert logos.
- **Site Challenges (in this order):** Temporary Power Distribution, Shutdown and Turnaround Packages. Leave out Hydrogen and Hazardous-Gas Ventilation.
- **Industries:** as in the JSON for this product (6, already expanded to full names).
- **Category:** Lighting and Power (unchanged).
- **SA logos:** SA Powernet **on**.
- **Cert and zone logos:** no change.

### D2. SA ENDURE Compact Filtration Unit: `01M1XPYYP79FXTPEN8S6Y7QHGN` (Duda name "Compact Filtration Unit (SAECFU)")
- **Held because:** it's non-EX but was tagged Paint and Coating Drying, which SA Equip's own rule excludes.
- **Site Challenges (in this order):** Dust Extraction, Filtration and Containment, Confined-Space Ventilation, Shutdown and Turnaround Packages. Leave out Paint and Coating Drying.
- **Industries:** as in the JSON for this product (5).
- **Category:** Fume, Dust, LEV and Vapour Control (unchanged).
- **SA logos:** SA Endure **on** (already on).
- **Cert and zone logos:** no change.

### D3 to D5. SA ENDURE welding LEV systems
- **Held because:** the sheet's Category column is shifted. Their challenges and industries are clean.
- **Category:** keep the current Duda category, **Fume, Dust, LEV and Vapour Control**. Confirm it's what Duda has now, and don't change it.

| Duda ID | Product |
|---|---|
| `01M1XPXAPZHT3A3DFJSA0T9H5S` | Container LEV System (SAEWFC) |
| `01M1XPW3A15CA51720DG3A798G` | Mobile LEV System (SAEWFS) |
| `01M1XPWJX7X6BKXZX2TB81VDAF` | Portable LEV System (SAEWFP) |

For all three:
- **Site Challenges (in this order):** Welding Fume Control, Dust Extraction, Filtration and Containment, Toxic Fume and Vapour Extraction.
- **Industries:** as in the JSON for each product (7 each: no Oil & Gas, Nuclear, Petrochemical, Utilities or Renewables, because they're safe-area only).
- **SA logos:** SA Endure **on** (already on).
- **Cert and zone logos:** no change. These products are non-EX, so they have no certification logos.

**Effect:** Welding Fume Control gets its first **3 products**. Toxic Fume goes from 13 (after B) to **16**, and Dust Extraction from 6 to **10** (3 LEVs + Compact Filtration Unit).

## E. Two new products as HIDDEN drafts

Create both as **HIDDEN** (not visible on the site) with SA Equip's copy below. Don't add categories, challenges, industries or logos yet: these are safe-area products, and their category hasn't been decided. Images are still to come.

### E1. SA ENDURE LED Max Light: SKU `SAML`

**Description**
The SA ENDURE Max Light is an exceptionally durable freestanding floodlight designed to deliver an even light output of almost 4,000 lumens over a wide area. Built for rigorous industrial environments such as aircraft maintenance facilities, shipyards, and heavy industry sites, it features a stable, robust design that keeps it secure even on rough surfaces. Linkable options allow multiple units to be connected from a single power supply.

**Key benefits**
- Powerful LED light spread (3,800 lumens, 180-degree beam).
- Suitable for use in all weather conditions.
- Low energy consumption with high light output.
- Freestanding stability on rough surfaces.
- Portable, lightweight, and switchable (on/off).
- Linkable variants enable multiple lights from one power supply.

**Technical specifications**

| Specification | Value |
|---|---|
| Voltage options | 12V, 24V, 42V, 48V, 110V, 230V |
| Light output | 3,800 lumens (180°) |
| Light source | High-efficacy LEDs (50,000 hours lifespan) |
| Operating temperature | -30°C to +50°C |
| Ingress protection | IP54 |
| Plugs/sockets | IEC IP44, IEC IP67 |
| Cable length | 5m (linkable) / 10m (non-linkable) |
| Dimensions | 423mm (h) x 215mm (w) x 139mm (d) |
| Weight | 1kg |

### E2. SA ENDURE LEV Accessories: SKU `SEHB/SEFD`

Create this as **one** product. The order codes go in the description; don't split it into variants for now.

**Description**
The SA ENDURE range of LEV quick-release accessories has been developed in close collaboration with welding operatives to enhance the flexibility of SA LEV systems. The accessory range enables rapid installation, adjustment, and reconfiguration of ducting and extraction hoods right at the workface, even multiple times during a shift.

**Key benefits**
- Complete range of mounting and connection options.
- Quick-release keyway connectivity for fast changes.
- Compatible with all SA Equip LEV systems.
- Enables fine adjustment to achieve compliance with HSE Guideline HSG258.
- Exceptionally robust and durable anodised aluminium construction.

**Order codes**

| Code | Description |
|---|---|
| SEHB/MB | SA ENDURE Hood Swivel Bracket, Magnetic |
| SEHB/SCS | SA ENDURE Hood Swivel Bracket, Suction Cup |
| SEHB/SB | SA ENDURE Hood Swivel Bracket, Scaffold Clamp |
| SEFD10/MB | SA ENDURE 10cm Ducting Bracket, Magnetic |
| SEFD10/SCS | SA ENDURE 10cm Ducting Bracket, Suction Cup |
| SEFD10/SB | SA ENDURE 10cm Ducting Bracket, Scaffold Clamp |
| SEFD10/FT | SA ENDURE Fishtail LEV Hood with bracket keyway |
| SEFD10/FL | SA ENDURE Flared LEV Hood with bracket keyway |

If the product editor stores specs or benefits in structured Hub fields (rather than the description), use those, the same way existing products do.

---

## Still on hold (do NOT touch)

These are waiting on SA Equip:
- the 7 "CYCLONE-labelled" SAE/SE products: Compact Dust Extraction, Dust Filter Bundle, High Volume Dust, Lightweight Dust, Lightweight Filtration Unit, PVC Duct and Vapour Extraction System;
- the SEF35HP duplicate (CYCLONE and ENDURE High Power Air Mover);
- the ENDURE Air Mover (SEF35), LED Tubelight, LED Emergency Tubelight and LED Worklamp, which need a safe-area category decision;
- the filter products (SAFU/RF ×3) and the 3 weekly rental products;
- the Tasklight Floor Stand and Base Unit SKUs;
- the 8 certification logos currently on that the sheet says should be off.

## Report

Use the report template from the brief, and also include:
1. A list of every product in the JSON plus the 2 new products, with a final status column: **DONE**, **PARTIAL** (what's still missing) or **ON HOLD** (why). This becomes the list of questions for SA Equip.
2. The new challenge counts: expect Welding 3, Toxic Fume 16, Dust Extraction 10, Temporary Power Distribution 7, Shutdown 29, and Confined-Space 17. Every other count stays as it was after Phase 2.
