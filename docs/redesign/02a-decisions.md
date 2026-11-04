# Stage 2 open questions: answers (30 Oct)

These answer the open questions at the end of `02-design-system.md`. Where this file and 02 disagree, this file wins. Values that aren't given here come from 00-design-reference.md.

## Blocking stage 3
- **Q3 Warning colour:** APPROVED as proposed. Light is #8A4B00 on #FCEFD9; dark is #F5B54A on #2A1E08.
- **Q4 Hover states:**
  - **Primary button:** #F0C40F, i.e. keep `--accent-hover`.
  - **Ghost and small ghost buttons:** background `--surface-2`, border `--text`.
  - **Icon button:** background `--surface-2`, colour `--text`.
  - **Segments (not selected):** colour `--text`.
  - **Tabs (not active):** colour `--text`.
  - **Menu items and rows:** background `--surface-2`.
  - **Sidebar items (not active):** background #1A1A1A, text #FFFFFF.
  - **Links:** underline.
  - **Transitions:** 120ms on colour and background only, with no movement. Respect prefers-reduced-motion.
- **Q5 Sidebar focus colour:** `--sidebar-focus` = #FED217, with a 2px outline and -2px offset inside items.
- **Q12 Font weights:** YES. Barlow 400/500/600/700, Inter 400/500/600/700, JetBrains Mono 400/500.
- **Q13 Input border contrast:** DARKEN, inputs only.
  - Add a new token `--border-input`: light #8A8A85 (3.47:1 on white, 3.09:1 on --bg), dark #6B6B6B (3.52:1 on --input-bg).
  - Use it for inputs, selects, textareas, checkboxes and the toggle's off state.
  - Ghost buttons and other edges stay on `--border-strong`.

## Later batches
1. **ENDURE guard:** it was misread from the design. It is NOT a feature. Drop it from the editor, and leave the phase5b script as it is.
2. **Danger styles:** accept the suggestion.
   - **Fault chip:** `--danger` text on `--chip-bg` with a 1px `--danger` border.
   - **Alert:** `--surface`, a 3px left bar in the tone colour, with the icon and title in that tone. Tones are info (`--text`), ok, warning and danger.
   - Add `--danger-bg` (light #FDECEA, dark #2A1311) for the danger button hover and failed pills only.
6. **Sidebar:**
   - **Group labels:** Barlow 600, 11px, uppercase, letter-spacing .14em, colour #6B6B6B, padding 20px 12px 6px.
   - **Items:** 40px high, padding 0 12px, gap 12px, 18px lucide icons (kept), Inter 14px, 500 (600 when active).
   - **Lockup:** a 40×40 yellow block with Barlow 700 "SA" 18px in black, then "SA Equip" (white, Barlow 600, 15px) over "Product Hub" (#A3A3A0, 12px).
   - **Width:** 272px.
   - **Badges:** Products shows the live product count; Quote requests and Resource requests show the count NOT handled (after the batch 6 migration). Nothing else gets a badge.
7. **Type roles** (line-height in brackets):

   | Role | Font and size | Notes |
   |---|---|---|
   | Modal title | Barlow 700, 22px (1.15) | |
   | Editor header product name | Barlow 700, 28px (1.1) | |
   | Split-view detail heading | Barlow 700, 24px (1.15) | |
   | Empty-state title | Inter 600, 16px (1.4) | |
   | Auth page title | Barlow 700, 32px (1.1) | |
   | Card heading | Barlow 600, 14px (1.2) | |
   | Overline | 12px (1.2) | |
   | Label | 12px (1.3) | |
   | Help | 13px (1.5) | |
   | Table head | 12px (1.3) | |

   Codes: 13px in table cells and inline values (SKU, slug, page numbers); 12px for secondary or under-text slugs, counts in badges, segments and kbd.
8. **Tab dots:** an 8px square dot. Unsaved is `--text` with a 1.5px `--surface` ring (it reads on yellow and white); error is `--danger`.
9. **Retired yellow chip:** Unsaved becomes the neutral chip with the dot from Q8. Image "Primary" becomes the solid chip. Users "Duda editor: Yes" becomes the solid chip. Translations "Missing" becomes the neutral chip (per the FLAG suggestion).
10. **Elevation:**
    - Menus and popovers: `0 8px 24px rgb(0 0 0 / .12)` (light) and `rgb(0 0 0 / .5)` (dark).
    - Modals: the same shadow, plus a 1px `--border`.
    - Toasts: the same as menus.
    - Backdrop: `rgb(0 0 0 / .5)` (light), `rgb(0 0 0 / .7)` (dark).
11. **Buttons and controls:**
    - **Danger button:** transparent, 1px `--danger` border, `--danger` text; hover `--danger-bg`. The confirm-delete primary inside a modal is a solid `--danger` background with white text.
    - **Small ghost:** padding 0 12.
    - **Chip remove button:** 20px square inside 26px chips.
    - **Dense-toolbar inputs:** 34px allowed (as Translations already does).
    - **Toggle off-state border:** `--border-input`.
14. **Yellow-only indicators:** ACCEPT, with the second cue (row fill or 600 weight text).
15. **Auth pages:** a centred 400px card on `--bg`, light theme only. The SA lockup sits above it, built in HTML/CSS (yellow "SA" block plus text), replacing the SVG with the white rectangle.
16. **Status route:** keep it reachable by URL, like /widgets, but out of the nav.
17. **Enquiries:**
    - **Migration:** APPROVED in batch 6. Add a nullable `handledAt DateTime?` (and a nullable `handledBy String?`) to QuoteRequest and Lead. It is additive only.
      - Run it with a prior DB backup and get Josh's go-ahead in chat before applying it to production.
      - New means handledAt is null.
      - "Mark as handled" / "Mark as new" toggles it via a small PATCH endpoint (with auth, the same as the other routes).
    - **Reply by email:** a `mailto:` link to the requester, with subject "Your SA Equip quote request" or "Your SA Equip resource request".
    - **Total row:** total quantity only, e.g. "5 items · 6 units". There are no prices.
18. **Products rows:**
    - REMOVE the checkboxes.
    - Replace the more-actions menu with two plain icon buttons: Edit (the row link) and "View on website" (external link, disabled if there's no live URL).
    - Add the slug to `GET /api/products`. This is an approved one-line backend change; it's read-only.
19. **Users:** no name field. Show the email as the main line, with initials taken from the part of the email before @ (e.g. "JO"). "Date added" is createdAt. The invite card must state exactly the domains the backend actually allows; if there is no domain restriction, drop the card.
20. **Top-bar search:** products only, client-side over the already-loaded list, opening a results menu (keyboard navigable). ⌘K/Ctrl K focuses it. Below lg it collapses to an icon button that opens a full-width search row.
21. **Website editor status grid:** build it only from data the Hub can already read. If a source needs a new Duda API read, show that cell as "—" and note it; do not add new Duda calls in the restyle.
22. **Categories share bar:** DROP it. Show the plain product count.
23. **SplitView and TopBar below lg:** accept the suggestion. Show the list only; selecting an item shows the detail full-width with "Back to list", still driven by `?id=`.
24. **3D preview background:** `--paper`.
25. **Marker FLAGs:** accept ALL 14 suggested decisions in §6 as written. For near-limit warnings (the variation meter above 80%, "≤3 options left", "approaching the limit"), use the `--warning` tone.
26. **Pagination ellipsis:** accept `text-muted` mono "…". Show first, last, current ±1.
27. **Checkbox:** keep the custom `appearance-none` box: square, 16px, `--border-input` border; checked is a yellow fill with a black tick.
28. **Editor save:** the bottom save bar stays the single save control (it's tied to the save logic). The header card shows the name, SKU, a status chip and "View on website", but no Save button. Live toggle in the right panel: CONFIRMED, it replaces the Status select (same field, same save key).

## After 3b: answers to the dark-mode breakage list
- **Solid confirm-delete button (inside modals):** background #B42318 in BOTH themes, white text (6.57:1), with a 1px `--danger` border so its edge shows in dark (#F97066). Hover: #9B1C13. The everyday danger button is the outline style from Q11.
- **Toggle:**
  - Off: track `--surface-2`, 1px `--border-input` border, knob `--muted` (6.67:1 on the dark track).
  - On: yellow track and border, knob #0B0B0B.
  - Square knob, 16px. LogoActivationPanel's hand-built switch is replaced by `ui/Toggle`.
- **Disabled buttons (all variants):** no opacity. Background `--surface-2`, text `--muted`, border `--border`, cursor not-allowed. Disabled icon-only controls (e.g. editor toolbar glyphs) use colour `--border-input`. Disabled controls are exempt from contrast rules, but must still look clearly inactive.
- **Focus:** replace every interim `ring-[3px]` with the global outline (2px `--focus`, 2px offset; `--sidebar-focus` inside the sidebar). No box-shadow rings.
- **Links:** "underline on hover" belongs on text-link components and inline links only. Not on nav items, row links or links styled as buttons.
- **CSP hash guard:** YES. Add a check to the pre-push `npm run check` that recomputes the sha256 of the inline script in frontend/index.html and fails if vercel.json doesn't list it.

## After 4a
- **Selected row, light theme:** stronger marker.
  - Light: a 3px left bar in `--text` (#0B0B0B), background `--selected-bg` = #FFF7D1 (a pale yellow wash), and the row's primary text at 600 weight.
  - Dark: unchanged, i.e. a 3px yellow bar, `--surface-2` background and 600 text.
  - Add `--selected-bg` as a token: light #FFF7D1, dark = the `--surface-2` value.
  - Applies to Table selected rows, SplitView list items and the Media selected tile (where the tile outline becomes 2px `--text` in light, yellow in dark).
- **Native "Choose file" buttons:** hide the native input visually and trigger it from a real `Button` (ghost style), so it gets the disabled state and focus outline.
- **Light-theme yellow edges** (primary button, checked checkbox, toggle on, New chip at about 1.3:1 against the page): accepted. The black text, tick or knob carries the state.

## After 4b
- **Disabled segments** at about 2.9:1: accepted, since disabled controls are exempt.
- **Sidebar badges, until the batch 6 migration:**
  - Products shows the live product count.
  - Quote requests and Resource requests show NO badge until `handledAt` exists. After batch 6 they show the count of requests not yet handled.
  - Never show a badge of 0.
- **Theme toggle writes:** toggling saves through `useUserPreference`, which writes the signed-in user's own Supabase `user_metadata`. That is allowed, because it's the user's preference, not catalogue data. In the fixtures harness the write is blocked; verify it by calling the function with the network stubbed.
- **Top-bar search data:** a GET of `/api/products`, cached for the session and shared with the Products page if it's already loaded. No new endpoints.

## After stage 5
- **Sidebar group labels:** change `--sidebar-label` to #8A8A85 (about 5.7:1), so they pass AA.
- **Page titles:** sentence case everywhere, matching the sidebar and breadcrumb. For example "Quote requests", "Product options", "Media" (not "Media Centre"), "Resource requests". Sweep page titles, modal titles and empty-state titles as each page's batch lands. Batch 5 also sweeps all page titles at once, since they're one-line changes.
- **Products band:** the store headroom line ("91 / 1000 products used") becomes the band's description. It uses the warning tone when 10 or fewer remain.
- **Duplicate back links and breadcrumbs:** remove page-level breadcrumbs and "← Back to …" links once the top-bar breadcrumb covers them. That's CategoryDetail in batch 7 and the product editor in batch 8.
- **Users table at narrow widths:** below lg it becomes stacked cards (one per user), not a horizontally scrolling table.
- **Approved shell deviations:** black focus ring on the current yellow nav item; menu highlights get the 3px selected bar; the breadcrumb group is hidden between 1024 and 1280.

## After 6a
- **Approved 6a deviations:**
  - Users switch to cards below 1280
  - Security's password card links to Forgot password
  - the 2FA steps act as a guide and expand on setup
  - ButtonLink, Lockup and AuthShell components
  - the SVG logo is deleted
- **Website editor status cells:** APPROVED as a small read-only backend change in 6b. `/api/website/sites` passes through `site_seo.no_index` and the site's `lang` and `additionalLanguages` from the Duda site read it already makes. No new Duda calls and no writes.

## Batch 6: the handledAt migration
- **Background:** CLAUDE.md "Prisma migrations" records a production wipe and no backups on this Supabase tier. Nothing runs migrations at deploy, and the guard hook blocks destructive commands.
- **Schema (additive only):** add `handledAt DateTime?` and `handledBy String?` to `QuoteRequest` and `Lead`.
- **Migration:** write `migration.sql` BY HAND (`ALTER TABLE ... ADD COLUMN ... NULL`; no defaults that rewrite rows, no indexes needed) in a new `prisma/migrations/<timestamp>_enquiry_handled/` folder.
  - Do NOT run `migrate dev`, `db push`, `migrate reset`, or `migrate diff` with a shadow database.
  - Do NOT run `migrate deploy`.
- **Who applies it:** Josh applies it to production himself, following a runbook (`docs/redesign/06b-migration-runbook.md`):
  1. Back up the two tables, or the whole database, first.
  2. Check that `_prisma_migrations` exists.
  3. Run `migrate deploy`.
  4. Verify the columns.
  5. Roll back by dropping the four columns.
- **API:**
  - `PATCH /api/quotes/:id/handled` and `PATCH /api/leads/:id/handled` (match the existing route naming), with the same auth as the other admin routes.
  - Body `{ handled: boolean }`; it sets `handledAt = now()` / `handledBy = user email`, or clears both.
  - The list endpoints return `handledAt`. Add a single-item GET for resource requests only if SplitView genuinely needs it; otherwise derive from the list.
- **Order:** the branch must not be merged to main until the migration has been applied. Before the migration is applied, a preview of the backend against production will error on the enquiry pages, which is expected.

## After 6b
- **Approved 6b deviations:**
  - the `/api/resource-requests/:id/handled` naming
  - the `GET /api/enquiries/counts` endpoint
  - a scratch test instead of a repo test, until backend/package.json is free
  - the "Status" field in both details
  - "Since removed" as a fault chip
  - the CSV left unchanged
  - badges refresh when the lists load
  - detail header buttons that wrap
- **Website editor, Languages cell:** Duda lists languages that are set up even when they're paused, so don't claim they're live.
  - Value: "English + 6 set up" (or "English only").
  - Second line: the language names.
  - Help line: "Languages switched off in Duda still count here. Check the language menu in the Duda editor."
  - Do not try to detect paused languages.
- **New chip on a selected row (light theme, 1.35:1):** accepted. The chip's text carries the meaning.
- **Remote branch:** keep `origin/redesign/ui`; don't delete it. Push only when Josh says so. That will be after he has applied the migration, so the preview's enquiry pages work.

## After 6c
- **Approved 6c deviations:**
  - `LIVE_SITE_ORIGIN` in lib/site.ts, plus the launch-checklist line
  - the category slug from the mirror (read-only)
  - Media with no Replace and read-only alt text
  - both the inline "New value…" field and the dialog
  - the Products tab order All / Live / Hidden, with All as the default
  - Table `relative`, the Input `chip` size, PageHeader `actionsBeside`, the UsagePill `verb` prop
  - Logos as rows
  - Category titles as real links
  - the Media selection as page state, shown as a dialog below 1280
  - the Translations help line
- **Logo and thumbnail tile frame (1.29:1):** accepted as decorative. The image is the content, and WCAG 1.4.11 doesn't require a visible boundary on an image container.
- **Backlog after the redesign (not in batches 8 or 9):**
  - Media Replace and alt-text editing, which need new backend routes.
  - An `isLogo` flag on the media list, so a logo-only file's Delete is disabled up front.

## Batch 8: the product editor to tabs (binding)
- **Layout:**
  - Header card: product name (`t-editor-title`), SKU in mono, Live/Hidden chip, "No longer in Duda" fault chip when it applies, and "View on website" via `productPageUrl()`. No Save button and no "← Back to products" link.
  - Below it, the tabs (left) and a persistent right panel.
  - Right panel, from 1280px: Visibility (the Live toggle, i.e. the existing Status field) and Categories (the existing section). Below 1280 the right panel stacks under the tabs as an "Overview" extra, so its controls are still reachable.
- **Tab mapping:**

  | Tab | Sections |
  |---|---|
  | Overview | Details (name, SKU, the commerce fields when shown), Accessory toggle, Delete product (danger card at the foot) |
  | Content | Description, Technical specs, Key benefits, Applications, Compatible products |
  | Compliance | SA logos, Certification logos |
  | Options | Options, Variations (keep the lock while options are dirty) |
  | Files & media | Images, 3D model, Downloads |
  | SEO | the SEO fieldset (Title, Product URL slug, Meta description). Meta description becomes a Textarea. Add live counters (55 / 160) in the `--warning` tone when over, and a Google-style result preview (title, the site URL with the slug, description). Keep "Changing it breaks existing links." |

- **Tab counts (mono, optional where cheap):** Content (specs + benefits + applications items), Options (attached options), Files & media (images + downloads + model).
- **Per-tab state:**
  - **Dirty dot:** for keys that live on one tab, use `dirty[key]`.
    - The `details` key spans Overview, Content (description), SEO and the Visibility panel. Work out which tab is dirty by diffing that tab's fields against the saved values, not from the whole key.
  - **Error dot:** shown when any key or field on that tab has `saveErrors[key] ?? validationErrors[key]`.
  - Server save errors for `details` also show as an Alert at the top of Overview.
  - Logo and description errors get a home: an Alert at the top of their tab's panel.
- **Mounting:** mount a panel on its first visit, then keep it mounted and hidden. That preserves tiptap, dnd and form state. `aria-controls` must point at a panel element that always exists (render empty panel shells up front).
- **URL:**
  - The active tab lives in `?tab=` (values: overview, content, compliance, options, files, seo; the default is overview), set with replace.
  - **Changing the tab must NOT trigger the unsaved-changes blocker.** The blocker ignores navigations that keep the same pathname.
- **Save bar:**
  - It stays the only Save.
  - Failed-section pills switch to the tab that holds the section, then scroll and focus it (the 80px scroll padding still applies).
  - Remove the duplicated Unsaved badges and counts inside panels; the tab dots and the save bar carry it.
- **Chrome:** keep the AccordionBody context (or its replacement) around tab panels, so sections don't draw their own Card, title or Unsaved badge twice. Section titles inside a panel use the card heading role.
- **Must not change:**
  - translate-on-save `begin()` stays click-synchronous
  - `hideCommerce` validation
  - the variations lock
  - the pending-upload URL test
  - Model3DPreview's imperative ref
  - the 12px paragraph spacing
- **Yellow tints left in the editor:**
  - variation meter: reuse the Product options meter tones
  - option chips: neutral chip, selected chip = solid
  - dropzone drag-over: `--selected-bg` plus a `--selected-bar` border
- **Fix:** the Downloads rows at 390, and the stale copy "Shown on the product page in Duda." (the widget's Overview tab renders it).
- **ProductNew:** a single-column form on the same cards and tokens (no tabs), plus an unsaved-changes guard like the editor's.

## After batch 8
- **Approved batch 8 deviations:**
  - 7.4 and 7.5 folded into 7.3
  - the 7.9 tab padding and the 18rem side panel
  - "Loaded … · Refresh" kept in the header
  - the stock/type chips and "Hide pricing & stock fields" in the Details header
  - the side panel and Delete product hidden with CSS below 1280 unless Overview is open
  - the error-dot rules
  - `dirty` props removed
  - theme colours in the search preview
  - New product's guard with Stay/Discard only
  - Hidden / Live wording on New product
- **Save-bar labels:** switch to sentence case in batch 9 ("Logos failed" is already fine; check the rest).
- **Details validation:** in batch 9, route validation errors to tabs by FIELD, not by message text. Have the validator return a field key alongside each message (frontend only, in normalize.ts or its caller; same messages, same blocking behaviour), and map field → tab in editorTabs.ts.
- **Tab row at 390:** scrolling inside its own row is accepted.
- **AccordionCard:** delete it in batch 9, along with its kit section, once nothing else imports it.

## Batch 9: tidy, accessibility, QA and release prep (binding)
- **Tidy:**
  - remove leftover `rounded*` classes and dead code
  - remove stale comments (01 §7 batch 9: the `ui/index.ts` header, the AssignPickList "Tags" note)
  - delete AccordionCard
  - update the /ui kit with every new piece (EditorSection, tab dots and names, the Input `chip` size, PageHeader `actionsBeside`, SplitView items, FileInput)
- **Widgets page:** wrap the previews in `.saeh-root` so they render as on the live site, on paper in both themes. Don't touch `WIDGET_CSS`.
- **Translations:** fix the Names tab table at 390 (cards or stacked rows, not an inner sideways scroll).
- **Accessibility:**
  - an automated axe pass on every page, both themes, in the fixtures harness. Load axe in the harness only; don't add it to package.json.
  - a manual keyboard and screen-reader-name pass
  - a reduced-motion check
  - zoom to 200% at 1440 with no loss of content
  - fix everything serious or critical, and list the rest with reasons
- **Enquiry route tests:** only if they can be added without editing backend/package.json, which has Josh's uncommitted edits. Otherwise leave them for after the merge and note it.
- **QA sweep:** all pages at 1440 / 1280 / 1024 / 390, both themes, with no console errors and no sideways scroll. Re-run payload comparisons against main for: a product save across every save key, New product create, Categories reorder, Logos reorder, mark handled.
- **Release checklist:** write `docs/redesign/09-release-checklist.md` for Josh:
  1. Apply the migration (runbook).
  2. Push `redesign/ui`.
  3. On the Vercel preview, with Josh's real login:
     - check the theme toggle saves to his account
     - check the 2FA QR on paper (start setup, then Cancel)
     - one real save on a throwaway product ZZ-AUDIT-DELETE-ME (create, edit each tab, save, delete)
     - mark one enquiry handled and back
     - look at every page in both themes
  4. Merge to main (a fast-forward or merge commit, Josh's choice) and watch the production deploy.
  5. Post-merge checks.
  6. Rollback plan (revert the merge; the migration can stay, since it's harmless to old code).
  7. Launch-day items: `LIVE_SITE_ORIGIN` to the custom domain, plus the existing launch checklist in CLAUDE.md.
