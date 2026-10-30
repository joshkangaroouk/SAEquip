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
