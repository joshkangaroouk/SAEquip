# SA Equip Hub: design reference (from the approved design canvas)

The source of truth for the target look. The canvas itself is private, so its values are written out here. Where this file and the canvas disagree, ask before guessing.

## Principles
- **Square corners.** `border-radius: 0` everywhere, including chips, avatars, toggles, checkboxes and the avatar initials. The one exception is the focus ring, which follows the element.
- **No shadows** on cards or panels. Use 1px borders. Menus and popovers can keep a single subtle shadow.
- **Palette:** black, white and #FED217. Yellow marks the active or primary thing only: the primary button, active nav item, active tab, selected segment, current page number and "New" chips. Never use yellow for body text on white.
- **Sidebar:** always dark, in both themes. Only the main panel switches theme.
- **Dense and calm.** No readiness or completeness nags (see Markers below).

## Theme tokens (main panel)

The accent is the same in both themes: `--accent: #FED217` and `--accent-ink: #0B0B0B`, the text colour used on yellow.

| Token | Light | Dark |
|---|---|---|
| --bg (page) | #F2F2F0 | #0F0F0F |
| --surface (cards, header) | #FFFFFF | #171717 |
| --surface-2 (table heads, footers, wells) | #F7F7F5 | #1D1D1D |
| --input-bg | #FFFFFF | #121212 |
| --border | #E3E3DF | #2A2A2A |
| --border-strong (inputs, ghost buttons) | #CBCBC6 | #3B3B3B |
| --text | #0B0B0B | #F2F2F0 |
| --muted | #5C5C58 | #A3A3A0 |
| --track (segmented-control background) | #ECECEA | #232323 |
| --chip-bg | #F2F2F0 | #222222 |
| --ok / --ok-bg | #1E7A3C / #E6F2E9 | #5FD08A / #10261A |
| --danger | #B42318 | #F97066 |
| --paper (always white: image, logo, PDF and QR tiles) | #FFFFFF | #FFFFFF |

**Sidebar (fixed):**
- background #0B0B0B, border #1F1F1F
- item text #C9C9C5
- active item: background #FED217, text #0B0B0B
- badge: background #1F1F1F, text #E5E5E2. On the active item the badge is #0B0B0B with #FED217 text.

## Type
| Role | Font | Size and weight | Notes |
|---|---|---|---|
| Page title (H1) | Barlow | 36px, 700, line-height 1.05, letter-spacing -0.01em | |
| Card or section heading | Barlow | 14px, 600 | uppercase, letter-spacing 0.09em |
| Overline or group label | Barlow | 12px, 600 | uppercase, letter-spacing 0.14em, muted |
| Body | Inter | 14px, 400 or 500, line-height 1.5 | |
| Field label | Inter | 12px, 600 | letter-spacing 0.02em, muted |
| Help text | Inter | 13px | muted |
| Table header | Inter | 12px, 600 | muted, on surface-2 |
| Codes (SKU, slug, counts, kbd, page numbers) | JetBrains Mono | 12–13px | |

## Components (sizes in px)
- **Primary button:** height 40, padding 0 18, Inter 14/600, yellow background, black text, 1px yellow border.
- **Ghost button:** height 40, transparent, 1px --border-strong, --text.
- **Small ghost button:** height 34.
- **Icon button:** 34×34.
- **Input and select:** height 40, padding 0 12, --input-bg, 1px --border-strong. Focus is a 2px outline in --text with a 2px offset.
- **Segmented control** (theme toggle, status tabs, rows per page, file-type tabs): a --track container with 4px padding and gap. Segments are 32 high. The selected segment is yellow with black 600 text; others are transparent and muted. Counts sit inside the segment in mono 11px.
- **Tabs** (product editor): a full-width underline style. The active tab has a 3px yellow bottom bar and --text 600; inactive tabs are muted. Counts are in mono. An unsaved or error dot can sit on any tab.
- **Chips** (height 26, padding 0 10, 13px):
  - ok (Live): --ok on --ok-bg, with a 7px square dot
  - neutral (Hidden, Off): --muted on --chip-bg, with a 1px border
  - solid: --surface on --text
  - "New": yellow, Barlow 11px uppercase
- **Card:** --surface with a 1px --border.
  - header row: padding 16 20, bottom border, Barlow section heading
  - footer: --surface-2 with a top border
- **Table / list rows:** a div grid or table. The head is on --surface-2. Rows are padding 10–14 20 with a 1px top border. The hover and selected rows are --surface-2, and the selected row also gets a 3px yellow left bar.
- **Toggle:** 42×24, square. On: yellow with a black border in light mode (yellow border in dark). Off: --surface-2.
- **Checkbox:** 16px with accent-color #FED217.
- **Pagination:**
  - "Showing 1–20 of 91 products" on the left
  - "Rows per page" segmented control in the middle: 20 / 50 / All, with 20 as the default
  - on the right: previous and next arrow buttons (34 square, bordered) and numbered pages (mono, 34 square; the current page is yellow)
  - wrapped in `<nav aria-label="Pagination">`, with aria-current on the current page
  - changing the page size resets to page 1

## Shell
- **Sidebar:**
  - SA lockup at the top: a yellow block with black "SA", "SA Equip / Product Hub" in white
  - grouped nav: Website editor; Catalogue (Products, Categories, Product options, Media, Logos, Translations); Enquiries (Quote requests, Resource requests); Admin (Users, Security)
  - the account row at the bottom
  - the Status page is no longer in the nav
- **Top bar (new):** height 64, --surface, bottom border.
  - breadcrumb "Group / Page" on the left
  - search field (280 wide, ⌘K hint)
  - Light/Dark segmented toggle on the right
- **Page header:** --surface with a bottom border, padding 32 40 28.
  - H1 with a one-line muted description underneath
  - page actions on the right: primary button last
- **Content:** padding 32 40 56. Cards are stacked with a gap of 20.

## Pages (what each one shows)
- **Products:**
  - Header actions: Export CSV and New product.
  - Toolbar:
    - status tabs All / Live / Hidden, with counts
    - search by name or SKU
    - category select
    - sort select, pushed to the right
  - Rows show:
    - a checkbox
    - a 56px thumbnail on a paper tile (box icon fallback, with an onError fallback)
    - the name as a link, with the slug in mono underneath
    - the SKU in mono
    - a Live or Hidden chip
    - Edit and more-actions buttons
  - Footer: the pagination component above.
  - Keep: the categories count column, the store headroom line ("n / max products used"), the disabled New product at the store limit, and the "No longer in Duda" fault chip.
- **Product editor:** a header card with the product name and status, plus Save. Below it, tabs (Overview, Content, Compliance, Options, Files & media, SEO) on the left, and a persistent right panel with Visibility (Live toggle) and Categories.
  - No Readiness box.
  - SEO: title and description fields with live character counters (55 / 160) and a Google result preview.
  - The ENDURE conflict guard still blocks Save.
- **Categories:** a flattened tree in three groups (Products, Site Challenges, Industries), each with an expand/collapse chevron, product count, slug, drag handle and actions. There's a share bar showing the share of products.
- **Product options:** a variation meter ("2 of 20") and option cards. Each card has values as chips (one can carry a "Pre-selected" tag), product count, and edit/delete actions. Values are added in a modal, not `window.prompt`.
- **Media:**
  - toolbar: file-type tabs, search, sort, grid/list toggle
  - a 4-column grid of tiles on paper; the selected tile has a yellow outline
  - a right-hand detail panel with preview, alt text, size and type, "Used by" list, and Replace and Delete. Delete is disabled while the file is in use.
  - footer: "Page X of Y · N files"
- **Logos:**
  - SA range / Certification tabs
  - rows show the lockup on paper, label and alt inputs, a "Used by N products" count, and Replace and delete
- **Translations:**
  - language buttons (counts)
  - a source/segment filter
  - rows show the type and product, the English text, the translated text (with lang and dir, so Arabic is right to left), a Machine/Edited chip and an edit button
  - pagination below
- **Quote requests and Resource requests:** a SPLIT VIEW with no modal.
  - **Left pane** (about 380px):
    - search and All / New / Handled tabs
    - rows show the name, company, date and a New chip
    - the selected row has the yellow left bar
  - **Right pane:**
    - header: name, company and actions (Reply by email as primary, Mark as handled, more menu)
    - a two-column definition grid of fields
    - for quotes, an items table (product, SKU, options, quantity) with a total row; for resources, the requested file
  - The selection lives in the URL as `?id=`.
- **Users:** a table with the user (initials avatar, name, email), two-factor chip, last sign-in, date added, Duda editor chip and actions. An info card below covers invite domains.
- **Security:**
  - a two-factor card with 3 numbered steps (yellow square numbers) and "Turn on two-factor"; the QR code always sits on paper
  - a password reset card
  - signed-in-as with Sign out
- **Website editor:** a preview of the homepage with a Published chip, buttons for Open in Duda editor and View live site, and a 3-cell site status grid (Search engines, Languages, Address).

## Markers (decided 30 Oct)
- **REMOVE:** readiness and completeness nags such as "missing", "incomplete", "x of y complete", and any warning shown only because optional content is empty.
- **KEEP:**
  - save-flow state: Unsaved, Saving, Error, failed pills, the save bar and the unsaved-changes modal
  - delete confirmations with usage counts
  - field validation
  - real fault flags: "File missing", "N selected items no longer exist", "No longer in Duda", "Pending upload", and the store product limit

## Other decisions (30 Oct)
- **Fonts:** switch to Barlow and Inter, add JetBrains Mono, and drop the DIN 2014 Typekit. Update the typography section of CLAUDE.md.
- **Dark-mode images:** a white --paper tile for images, logos, PDF previews, the QR code and widget previews.
- **Theme preference:** store it with `useUserPreference`, plus a pre-paint copy in localStorage read in index.html, so the page doesn't flash light first. Set `data-theme` on `<html>`, so portalled modals, menus and toasts are themed too. The sidebar stays dark because it uses its own fixed `--sidebar*` tokens, which the dark block does not change.
- **Merging classes:** adopt `tailwind-merge` inside `cn()`, and fix the three known override cases.
