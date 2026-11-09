# Phase 5b: apply SA Equip's answers (Gill, 14 Oct 2026)

**Approved by:** Josh. Apply directly: back up first, no dry run needed.
**Rules from CURSOR_BRIEF.md still apply:** match by Duda ID, store the challenge order as given, `null` = untouched.
**Report:** at the end, list every change, especially **every logo switched OFF**.

---

## 1. SA ENDURE = industrial only, NEVER hazardous areas (safety-critical)

Gill: *"Any ENDURE product is not for use in hazardous areas or the site may go boom. Industrial (e.g. construction) use only, never in a refinery or offshore."* SA CYCLONE = ATEX (black products), SA ENDURE = industrial (grey/black).

**Apply this rule to every SA ENDURE product listed below:**

| Field | Rule |
|---|---|
| SA logos | SA Endure **ON**, SA Cyclone **OFF** |
| Cert logos | **OFF:** Ex logo, IECEx, Inmetro, Zone 0, Zone 1-2, Zone 20, Zone 21-22. **Leave UKCA and Made in Britain as they are.** |
| Industries | Exactly these 7 (replace whatever is there): Construction & Major Projects, Aviation & Aerospace, Rail & Transport Engineering, Pharmaceuticals, Distilleries & Breweries, Defence & Naval Shipbuilding, Marine & Commercial Ship Repair. **No** Oil & Gas, Petrochemical & Chemical Processing, Nuclear, Utilities or Renewables & Hydrogen. |
| Site Challenges | Exactly as in the table below (replace whatever is there). ENDURE products are never in: Hydrogen and Hazardous-Gas Ventilation, Paint and Coating Drying, Tank and Vessel Entry, Shutdown and Turnaround Packages, Hazardous-Area Lighting or Hazardous-Area Cooling. |
| Category | Unchanged |

| Duda ID | Product (SKU) | Site Challenges (in order) |
|---|---|---|
| `01M1XPV10E0EVHJ5Q2VPE8E9Y0` | Compact Dust Extraction System (SAECDS/SAECBS) | Dust Extraction, Filtration and Containment |
| `01M1XPV4B7FQ0KTM5NGZYR0JJZ` | Dust Filter Bundle (SEFU/RF-DU/BD2) | Dust Extraction, Filtration and Containment |
| `01M1XPVFEABW7DD0C7ZVFJJEXD` | High Volume Dust Extraction System (SAEDES/SAEBDS) | Dust Extraction, Filtration and Containment |
| `01M1XPVM28SMQ4KTSN9KNX86C1` | Lightweight Dust Extraction System (SAELDS/SAELBS) | Dust Extraction, Filtration and Containment |
| `01M1XPW0XA8HC8JQ747Y7AS8ZN` | Lightweight Filtration Unit (SAELFU) | Confined-Space Ventilation |
| `01M1XPX3AE4734TP9Y98SQNNB2` | PVC Flexible Duct System (SEFD) | Confined-Space Ventilation, Toxic Fume and Vapour Extraction |
| `01M1XPVQ4N6FYRYK69WYA8P99Q` | Vapour Extraction System (SAEVES) | Toxic Fume and Vapour Extraction, Paint Spray Fume Control |
| `01M1XPYYP79FXTPEN8S6Y7QHGN` | Compact Filtration Unit (SAECFU) | Dust Extraction, Filtration and Containment, Confined-Space Ventilation |
| `01M1XPRZJQ8HZJT1R2KYWNK7SM` | Air Mover (SEF35) | Confined-Space Ventilation |
| `01M1XPTTF35NZANG1VP31N3Q1A` | High Power Air Mover (SEF35HP), confirmed ENDURE | Confined-Space Ventilation |
| `01M1XPXAPZHT3A3DFJSA0T9H5S` | Container LEV System (SAEWFC) | Welding Fume Control, Dust Extraction, Filtration and Containment, Toxic Fume and Vapour Extraction |
| `01M1XPW3A15CA51720DG3A798G` | Mobile LEV System (SAEWFS) | Welding Fume Control, Dust Extraction, Filtration and Containment, Toxic Fume and Vapour Extraction |
| `01M1XPWJX7X6BKXZX2TB81VDAF` | Portable LEV System (SAEWFP) | Welding Fume Control, Dust Extraction, Filtration and Containment, Toxic Fume and Vapour Extraction |
| `01M1XPRFPJSJJ8AMMNEX9YHX3H` | LED Tubelight (ST100) | **none** (remove Shutdown) |
| `01M1XPR96H6VSR07H5YY4GY9SS` | LED Worklamp (SAWL) | **none** (remove Shutdown) |
| `01M1XPRK9QPQ5BR0NJB9EXMEY7` | LED Emergency Tubelight (STE100) | **none** (remove Shutdown) |
| (hidden) | SA ENDURE LED Max Light (SAML) | **none** (remove Shutdown) |

The 4 ENDURE lights end up with **no site challenge**. That's deliberate: they're found through the Lighting and Power category.

Also **search the whole catalogue for any other product with SA Endure on, or with SAE/SE in its SKU**, that isn't in this table. List them and don't change them.

## 2. Certifications confirmed by SA Equip

| Duda ID | Product | Change |
|---|---|---|
| `01M1XPV6RHWS4CNJSZNBB69KBW` | Lightweight Extraction System | Inmetro **OFF** |
| `01M1XPP4PQJAK6WM0MBXNMA9VJ` | EX LED Area Light | Inmetro **OFF** |
| `01M1XPP7N5MVZ61653M04HNX2V` | EX LED Tower Light | Inmetro **OFF** |
| `01M1XPPD1331H1W8M6AN5JT1DZ` | EX LED Vessel Entry Kit | Inmetro **OFF** |
| `01M1XPQPN6HXHM1V5NY2SA3RFW` | EX 3.8KVA Transformer | Inmetro **OFF** |
| `01M1XPQJ63RZ780TM7Q83HZM3K` | EX Mains Distribution Unit | Inmetro **OFF** |
| `01M1XPQYGXGXJEH33SG8F0XAK9` | EX Splitter Unit | Inmetro **OFF** |
| (from JSON) | Anti-Static PU Flexible Duct System | Zone 21-22 stays **ON** (the website was correct). No change. |
| (from JSON) | EX HeatBox | ATEX but not IECEx is correct. No change. |
| `01M1XPQTR5A31K13F5W5PZ9BPS` | EX 400VA Transformer (SPTR400) | Logos **ON:** Ex logo, IECEx, UKCA, Zone 1-2, Zone 21-22. Inmetro **OFF**. Add **Hydrogen and Hazardous-Gas Ventilation**, so challenges are, in order: Temporary Power Distribution, Hydrogen and Hazardous-Gas Ventilation, Shutdown and Turnaround Packages. |

## 3. Products to hide (SA Equip says they shouldn't be on the site)

Set each to **HIDDEN** and remove all of its category links, as with the earlier duplicates. Don't delete yet.

| Duda ID | Product | Reason |
|---|---|---|
| `01M1XPSGR38B1RVS17TQQB1VTM` | SA LUMIN Tasklight Adjustable Floor Stand | Old product, delete. |
| `01M1XPWW6N9MSPJ9B809ZXSNNP` | Filters (SAFU/) | SA Equip don't sell filters as a separate product. They're options on the filtration units (see section 5). |
| `01M1XPRNYFEYJ21QM1CCR7AN7M` | Weekly Rental of SA CYCLONE Ducting 30cm | Rental will be handled differently (to be discussed). |
| `01M1XPRW2S2HRB8J6YPNC0MYKN` | Weekly Rental of SA POWERNET Adaptor Lead 110V Stahl-CEAG | Same reason. |
| `01M1XPRTB1CVYPKYX46N9MZHNN` | Weekly Rental of SA POWERNET Adaptor Lead 110V ATX-CEAG | Same reason. |
| (hidden already) | SA ENDURE LEV Accessories | Not a separate product. Sold with the LEV systems. Leave it hidden, and flag it for deletion. |

## 4. SKU

| Duda ID | Product | Change |
|---|---|---|
| `01M1XPSEZ4N8AVNXQT684ZZFAG` | SA LUMIN Tasklight Base Unit | SKU → `SATL/BU` |

## 5. Investigate only, don't build: filter options on filtration units

SA Equip want filter types shown as options on these products:

| Product | Filter types | Old SA Equip page |
|---|---|---|
| Filtration Unit | Dust, Breathable Dust, Vapour | https://saequip.com/product/filtration-unit/ |
| Compact Filtration Unit | Dust, Breathable Dust | https://saequip.com/product/compact-filtration-unit/ |
| Lightweight Filtration Unit | Dust, Breathable Dust | https://saequip.com/product/lightweight-filtration-unit-2/ |

1. Check the old pages to confirm which of our Duda products each one is. There's both a CYCLONE (SACFU) and an ENDURE (SAECFU) Compact Filtration Unit.
2. Propose the simplest way to show "Filter type" options on those product pages: Duda product options, a Hub field, or a spec line. Include how it works with the quote list.

Report back. Don't build yet.

## 6. Later (not now)

- The SA ENDURE LED Max Light images are at Gill's WeTransfer link (Josh will download them). Max Light stays hidden until the images are uploaded.
- How rental and hire are shown is being discussed with SA Equip.
- UKCA and Made in Britain per product are still outstanding.
