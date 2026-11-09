# Proposal: listing-page filters and an "Industrial use only" label

**Date:** 14 October 2026. **Status:** proposal only. Nothing is built or deployed. The mock-ups were made with a throwaway copy of the widget on a local copy of the live Lighting and Power page.

## Mock-ups

| | File |
|---|---|
| The sidebar | `proposal-filters-mock-sidebar.png` |
| The sidebar with "Industrial" ticked (the page narrows to 4 of 46) | `proposal-filters-mock-sidebar-industrial.png` |
| Product cards with the label | `proposal-filters-mock-cards.png` |
| The product page callout | `proposal-filters-mock-product-page.png` |

## How each filter is worked out

Measured on the 88 visible products, 14 October 2026.

| Filter | Worked out from | Options (whole catalogue) | Notes |
|---|---|---|---|
| **Hide accessories** (switch, off by default) | The sheet's Accessory column, stored as a new Hub field | 32 accessories, 55 not; SA ENDURE LED Max Light has no flag (treated as not) | Needs a new Hub field and a switch in the product editor, so new products can be marked. |
| **Use**: Hazardous area (ATEX) / Industrial | The SA range logo. **SA ENDURE = Industrial**; every other range (CYCLONE, LUMIN, POWERNET, FLEXIHEAT) = Hazardous area | 71 / 17 | Every visible product has exactly one range logo, so nothing is unclassified. |
| **Range**: SA CYCLONE / ENDURE / LUMIN / POWERNET / FLEXIHEAT | The SA range logo (SA Rental is not a range and is left out) | LUMIN 35, CYCLONE 22, ENDURE 17, POWERNET 7, FLEXIHEAT 7 | Uses the same rule as the resources pages' range logo. |
| **ATEX zone**: Zone 0 / 1-2 / 20 / 21-22 | The zone logos | Zone 1-2 45, Zone 21-22 39, Zone 0 3, Zone 20 1 | 43 products have no zone logo: the 17 SA ENDURE products and 26 hazardous-area accessories (brackets, films, chargers, trolleys). Ticking a zone hides them, which is right. |

**How the groups combine:** the same rules as the Site Challenges list today.
- Ticks **within** a group widen the results (OR); ticks **across** groups narrow them (AND).
- Each count shows how many products would appear if that box were ticked.
- A group shows only the options that occur in the page's own category.
- "Clear filters" resets everything, the accessories switch included.

**The label** appears on every product with the SA Endure logo (17 today):
- **Card:** a dark strip under the picture, reading "Industrial use only – not for hazardous areas", with a crossed-out "Ex" icon.
- **Product page:** a callout under the range logos, reading "Industrial use only. SA ENDURE equipment is for industrial sites such as construction. It is not certified for hazardous areas (ATEX/IECEx zones): never use it in a refinery, offshore or any explosive atmosphere."

## What building it would take

- **Hub:** a new `isAccessory` field (one small database change), set from the sheet for the products it covers, plus a switch in the product editor.
- **Public catalogue:** each product gains `use`, `range`, `zones` and `accessory`, worked out on the server. They come from the logo FILES, not the logo labels, which staff can rename.
- **Widget:**
  - the switch and three filter groups, using the counting the Site Challenges list already does;
  - the card strip;
  - the product page callout, added to the SA logos section;
  - the label text in all 7 languages;
  - tests in `widget:test`.
- The dashboard's copy of the widget styles needs regenerating.
- No change to Duda or the menus, and no shim changes.

## Decisions needed

1. **Wording of "Hazardous area (ATEX)".** The 26 accessories in ATEX ranges carry no certification of their own: a bracket isn't ATEX-certified. "**ATEX range**" / "**Industrial range**" would avoid implying it is. SA Equip should approve whichever wording is used, because it's a compliance statement.
2. **Use counts.** Hazardous area and Industrial exclude each other, so the usual "how many if added" count reads oddly: with Industrial ticked, Hazardous area shows 46 (4 + 42). I recommend showing each option's own count in this group.
3. **Zones when only Industrial is ticked.** Every zone shows 0. I recommend hiding the ATEX zone group until a hazardous-area product is in view.
4. **Accessories data.** The Accessory column is one of the brief's "internal reference" fields ("do not show on the site"). The filter would use it rather than display it, but SA Equip should confirm the 32 flagged products are right before a visitor can hide them.
5. **Label wording and translations.** These are safety statements. SA Equip should approve the English, and the six translations need native review before launch, like the consent text.
