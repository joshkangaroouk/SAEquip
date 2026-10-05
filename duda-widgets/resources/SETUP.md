# SAEquip - Resources (Duda Widget Builder)

One widget for the three resource pages: **Datasheets**, **User Manuals** and
**Certificates**. The content panel picks which list a page shows.

## 1. Create the widget

Duda → Widget Builder → New widget, named **SAEquip - Resources**.

- **HTML**: leave empty (or a single `<div></div>`). The widget draws into its own element.
- **CSS**: leave empty. The styles come with the script.
- **JavaScript**: paste the whole of `resources.js` from this folder.

## 2. Content panel

Add two inputs. The **variable names must be exactly these**: the script reads them by name.

| Input | Variable name | Settings |
|---|---|---|
| Dropdown | `resourceType` | Static options — label **Datasheets** / value `datasheet`, label **User Manuals** / value `manual`, label **Certificates** / value `certificate`. |
| Text | `heading` | Optional. Shown above the list (e.g. "Certificates"). Leave blank if the page already has its own title. |

## 3. Place it

On each resource page, drop the widget in and pick its list in the content panel:

| Page | `resourceType` |
|---|---|
| Datasheets | Datasheets |
| User Manuals | User Manuals |
| Certificates | Certificates |

Set the element's own padding to zero if the section already has spacing. When the
widget has nothing to show it hides itself on the live site. In the editor it shows a
grey placeholder saying what to choose.

## What it shows

Every public product with a file of that type, grouped by SA range (in the Logos
page's order), A–Z within a range, with a search box top right. The search runs when
the visitor presses Enter and matches the product name, the range and the certificate
names. Each row shows the picture, range logo, name, a
View Product link and one yellow button per file. On Certificates there is one button
per scheme: INMETRO, UKEX, IECEX, EX, Compliance. Buttons open the PDF in a new tab.

Which page a file appears on is set **per file in the product editor's Downloads
section** (Type, and for a certificate, which certificate). Hidden products never
appear.

## If it shows nothing

In the browser console on the page:

```js
__saequipHub.lastInit                         // mode should be "resources"
__saequipHub.lastInit.resourceType            // null ⇒ the dropdown value was not recognised
__saequipHub.lastInit.resourceTypeRaw         // exactly what Duda sent
Object.keys(__saehData['resources'].config)   // should include resourceType
```
