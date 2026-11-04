# SA Equip Hub — UI review (redesign stage 1)

A read-only map of how the dashboard UI is built today, so stage 2 can write a design-system spec to replace it. Nothing here proposes the new look except where the brief asks for it (the tab grouping in §5.1 and the stage order in §7).

**Scope:** `frontend/` only.
- All paths are relative to `frontend/` unless they start with `backend/`.
- Line numbers are as of 2026-10-30, working tree on `main` at `1426d8b`.

**How to read the evidence marks.**
- **Unmarked claims** were read directly from the file and line cited.
- **[inference]** means a conclusion drawn from reading the code, but not seen in a browser.
- **[unverified]** means I could not confirm it.
- **Counts** come from a script run over `src/` that skips comment lines and leaves out the generated widget CSS in `pages/Widgets.tsx:9-325`.

**Target look (from the brief, for context only):**
- square corners (radius 0)
- black / white / `#FED217`
- Barlow headings, Inter body, JetBrains Mono for codes and counts
- sidebar always dark
- main panel with light and dark modes via CSS variables
- tabs on the product editor
- split view for Quote and Resource requests

---

## 1. Theme foundations

### 1.1 CSS variables (`src/index.css:36-78`, all on `:root`)

⚠️ **Format.** Every colour variable is a set of **space-separated RGB channels**, not a hex value (`index.css:30-35`). Tailwind consumes them as `rgb(var(--x) / <alpha-value>)`, which is what makes opacity modifiers like `bg-danger/10` work. Any direct CSS use must wrap the variable, as in `rgb(var(--accent))`.

| Variable | Value | Type | Role (comment in file) |
|---|---|---|---|
| `--bg` | `250 250 250` | colour | page base (neutral-50) `:38` |
| `--surface` | `255 255 255` | colour | cards, panels, fields `:39` |
| `--surface-2` | `245 245 245` | colour | table headers, hover, subtle fills `:40` |
| `--border` | `229 229 229` | colour | hairlines `:43` |
| `--input` | `229 229 229` | colour | field border `:44` |
| `--ring` | `254 210 23` | colour | focus ring, brand yellow `:45` |
| `--text` | `10 10 10` | colour | body text `:48` |
| `--muted` | `115 115 115` | colour | **secondary TEXT**, not shadcn's grey fill; the name collision is explained at `:20-25` |
| `--subtle` | `163 163 163` | colour | placeholders, tertiary `:50` |
| `--accent` | `254 210 23` | colour | brand yellow `:53` |
| `--accent-hover` | `240 196 15` | colour | `:54` |
| `--accent-foreground` | `10 10 10` | colour | `:55` |
| `--primary` | `23 23 23` | colour | neutral dark control `:58` |
| `--primary-foreground` | `250 250 250` | colour | `:59` |
| `--secondary` | `245 245 245` | colour | `:60` |
| `--secondary-foreground` | `23 23 23` | colour | `:61` |
| `--danger` | `220 38 38` | colour | `:64` |
| `--success` | `22 163 74` | colour | `:65` |
| `--sidebar` | `20 20 20` | colour | sidebar background (#141414) `:70` |
| `--sidebar-foreground` | `250 250 250` | colour | `:71` |
| `--sidebar-muted` | `161 161 161` | colour | idle nav labels `:72` |
| `--sidebar-subtle` | `107 107 107` | colour | section headings, icons `:73` |
| `--sidebar-border` | `38 38 38` | colour | `:74` |
| `--radius` | `0.625rem` | radius | shadcn base radius `:77` |

- **No other kinds of variable exist.** There are no shadow variables (shadows are literals in `tailwind.config.js`) and no font variables (the family is set literally).
- **No warning colour.** There is no `--warning` or amber token. Warnings are drawn in accent yellow or danger red (see §5).

**Base layer (`index.css:80-143`):**
- `html { font-size: 110% }` (`:94`). This is the single knob that scales the whole UI, because spacing, type and `--radius` are all in rem. At this root, 1rem = 17.6px.
- `font-synthesis: none` (`:97`), so the browser never synthesises a missing weight.
- `body`:
  - colours: `rgb(var(--bg))` / `rgb(var(--text))`
  - family: `"din-2014", ui-sans-serif, …` (`:106-107`)
  - size: `0.909rem` = 16px (`:113`)
  - line-height: 1.5
- `h1–h6`: weight 600, line-height 1.2, letter-spacing −0.01em (`:117-121`).
- `::selection`: accent background, accent-foreground text (`:123-126`).
- `:focus-visible { outline: 2px solid rgb(var(--ring)); outline-offset: 1px }` (`:130-133`). Most `ui/` controls replace this with their own `ring-[3px] ring-ring/50`.
- Form controls inherit font family and weight (`:135-138`).
- Global `scrollbar-color: rgb(var(--subtle)) transparent` (`:140-142`).

### 1.2 `tailwind.config.js` and how it maps to the variables

Tailwind is **3.4.17** (`package.json`). PostCSS runs `tailwindcss` and `autoprefixer` only (`postcss.config.js:1-6`). There are no plugins (`tailwind.config.js:123`).

**Colours (`:32-66`).** Each colour variable above becomes a utility through `rgb(var(--x) / <alpha-value>)`:
- `bg`, `surface`, `surface-2`, `border`, `input`, `ring`, `text`, `muted`, `subtle`
- `accent.{DEFAULT,hover,foreground}`
- `primary.{DEFAULT,foreground}`, `secondary.{DEFAULT,foreground}`
- `danger`, `success`
- `sidebar.{DEFAULT,foreground,muted,subtle,border}`

Tailwind's default palettes (`gray-*`, `red-*` and so on) are **not removed** (colours are under `extend`), so they remain available, but almost nothing uses them (§2).

**`fontWeight` (`:16-26`) replaces the theme, not extends it.**
- Every weight name maps onto a weight DIN 2014 ships: 200/300/400/600/700/800, with no 500.
- ⚠️ **`medium` resolves to 400**, the same as `normal` (`:21`; rationale `:11-15`).
- ⚠️ `Button` therefore uses `font-semibold` deliberately (`components/ui/Button.tsx:18-23`).

**`fontFamily.sans` (`:71-81`):** `"din-2014"`, then system fallbacks. **There is no `mono` family defined**, so `font-mono` is Tailwind's default `ui-monospace…` stack.

**`fontSize` (`:86-96`)** adds tokens, all in rem:

| Token | Size | ≈ px at 110% root | Line height / tracking |
|---|---|---|---|
| `display` | 2.25rem | 39.6 | lh 1.1, tracking −0.02em |
| `h1` | 1.5rem | 26.4 | lh 1.2 |
| `h2` | 1.25rem | 22 | lh 1.25 |
| `h3` | 1.125rem | 19.8 | lh 1.3 |
| `body` | 0.909rem | 16 | lh 1.5 |
| `small` | 0.795rem | 14 | lh 1.35 |

⚠️ **Tailwind's own sizes still exist and are used heavily.** At this root they resolve to: `text-xs` 13.2px, `text-sm` 15.4px, `text-base` 17.6px, `text-lg` 19.8px, `text-xl` 22px. Usage in `.tsx`:

| Class | Uses |
|---|---|
| `text-small` | 107 |
| `text-body` | 55 |
| `text-sm` | 53 |
| `text-xs` | 49 |
| `text-h2` | 17 |
| `text-xl` | 8 |
| `text-h3` | 6 |
| `text-h1` | 4 |
| `text-lg` | 3 |
| `text-base` | 3 |
| `text-2xl` | 2 |
| `text-display` | 1 |

So 14px, 15.4px and 16px body-ish sizes sit side by side.

**`borderRadius` (`:98-105`)** is derived from `--radius`:

| Token | Formula |
|---|---|
| `sm` | `calc(var(--radius) - 4px)` |
| `DEFAULT` / `md` | `− 2px` |
| `lg` | `var(--radius)` |
| `xl` | `+ 4px` |
| `2xl` | `+ 8px` |

⚠️ **`rounded-full` is NOT derived** (21 uses), so `--radius: 0` will not square it. The same applies to the arbitrary `rounded-[2px]` (`ui/Highlight.tsx:25`) and to the literal `borderRadius: "0.75rem"` in `ui/Toast.tsx:17`. At `--radius: 0`, `rounded-sm` evaluates to a negative value, which CSS clamps to 0.

**`boxShadow` (`:108-113`):** four literal `rgb(0 0 0 / .05–.08)` values, for `xs`, `sm`, `md` and `lg`. `xl` and `2xl` fall through to Tailwind's defaults; they are used once each (`components/MediaPicker.tsx:57`, `ui/Modal.tsx:144`).

**`ringColor.DEFAULT`** is `--ring` (`:114-116`). **`ringOffsetColor`** offers `bg` and `surface` (`:117-120`).

### 1.3 Fonts — where they load and every place a family is set

**Loading (`index.html`):**
- **DIN 2014**, via Adobe Fonts / Typekit: preconnect `:25`, stylesheet `https://use.typekit.net/mrd2ybk.css` `:26`.
  - Licence note at `:20-24`: not self-hostable, so the dashboard's domain must be listed in the Adobe web project.
  - CLAUDE.md records it as a live external dependency.
- **Barlow and Inter are ALREADY loaded**, from Google Fonts:
  - weights 400/500/600/700 (`index.html:36-40`)
  - but only for the `/widgets` previews, never for the dashboard's own UI (comment `:28-35`)
- **JetBrains Mono** is not loaded anywhere.

**Every place a family is set:**

| Where | Family | File |
|---|---|---|
| body | `"din-2014"`, then system stack | `src/index.css:106` |
| Tailwind `sans` | `"din-2014"`, then system stack | `tailwind.config.js:71-81` |
| form controls | `inherit` | `src/index.css:135-138` |
| toasts | inline `fontFamily: '"din-2014", sans-serif'` | `components/ui/Toast.tsx:20` |
| file-type icon label | SVG `fontFamily="system-ui, sans-serif"` | `components/ui/FilePreview.tsx:62` |
| widget previews | `--saeh-head:'Barlow'…` / `--saeh-body:'Inter'…` inside the generated `WIDGET_CSS` | `pages/Widgets.tsx:11` |
| `font-mono` (Tailwind default stack) | description HTML textarea | `components/product/DescriptionSection.tsx:75` |
| `font-mono` | translation HTML textarea | `pages/Translations.tsx:179` |
| `font-mono` | category description textarea | `pages/CategoryDetail.tsx:286` |

`src/main.tsx:7-9` says explicitly that there are no font imports.

### 1.4 Dark mode

**There is no mechanism at all:**
- no `darkMode` key in `tailwind.config.js` (Tailwind 3 would default the `dark:` variant to the `media` strategy)
- 0 `dark:` classes in `src`
- no `prefers-color-scheme`, `data-theme`, `color-scheme` or `.dark` anywhere in `src`, the config or `index.html`
- `ui/Toast.tsx:11` hard-codes `theme="light"`

Because every surface and text colour already goes through variables, adding a dark theme is mostly **additive**: a second variable block plus a selector. The exceptions are in §6.3.

**A ready-made place to store a theme preference already exists.** `hooks/useUserPreference.ts:19-54` persists UI preferences per account in Supabase `user_metadata`. It is used today only for "Hide pricing & stock fields" (`:65-67`).
- [inference] That value only arrives after the session loads. A theme applied from it alone would flash light first, so a pre-paint copy (for example in `localStorage`, read in `index.html`) would be needed alongside it.

---

## 2. Hard-coded styling debt

**Overall: low colour debt, moderate radius and type debt.** Colours go almost entirely through tokens. The debt that will matter for this redesign is radius classes, Tailwind-default type sizes, and many hand-rolled copies of primitives (§3.2).

### 2.1 Hard-coded hex and rgb colours (outside the generated widget CSS)

| Where | Values | What it is |
|---|---|---|
| `components/ui/FilePreview.tsx:10-14, 27` | `#D93025` PDF, `#2B579A` DOC, `#217346` XLS, `#B7791F` ZIP, `#6D28D9` 3D, `#6B7280` FILE | file-type band colours, deliberate conventions (`:5-7`) |
| `components/ui/FilePreview.tsx:53-54, 63` | `fill="#fff"`, `stroke="#D4D4D4"`, label `fill="#fff"` | document-shape icon |
| `pages/Login.tsx:110` | `bg-[#0A0A0A]` | brand panel. The comment says it matches the sidebar, but the sidebar token is #141414 |
| `pages/Login.tsx:113` | `bg-[#fed217]/20` | glow behind the logo |
| `pages/Widgets.tsx:329` | `#f4f4f5`, `#d4d4d8`, `#52525b` | placeholder-logo SVG data URI for the previews |
| `lib/pdfThumbnail.ts:43` | `#ffffff` | canvas fill when rendering PDF previews. Correct and unaffected by theme |
| `components/ui/Toast.tsx:18` | `rgba(0,0,0,0.10)` | toast shadow |

**Separate case — the generated widget CSS.** `pages/Widgets.tsx:9-325` (`WIDGET_CSS`) contains about 315 lines of literal colours.
- It is **generated** by `backend/scripts/widget-sync-css.mjs`, which finds the literal `const WIDGET_CSS = \``.
- `backend/scripts/widget-test.mjs:1570-1577` reads this file.
- It reproduces the **public widget** and must not be restyled; see §6.1.

### 2.2 Arbitrary Tailwind values

70 occurrences in total. Most are focus-ring and transition plumbing inside `ui/`.

| Value | Count | Examples |
|---|---|---|
| `focus-visible:ring-[3px]` | 17 | `ui/Button.tsx:28`, `ui/Input.tsx:10`, rows at `pages/Quotes.tsx:259`, `pages/Products.tsx:432` |
| `aria-[invalid=true]:…` | 6 | `ui/Input.tsx:11`, `ui/Select.tsx:27` |
| `h-[100px] w-[100px]` | 3 + 3 | product thumbnail, `pages/Products.tsx:349, 426, 429` |
| `w-[17rem]` / `lg:pl-[17rem]` / `lg:left-[17rem]` | 3 | sidebar width, declared **three times**: `components/Layout.tsx:37-38` and `components/product/ProductSaveBar.tsx:48` |
| `mt-[12px]` | 2 | ⚠️ the paragraph-spacing contract with the live widget: `ui/RichTextEditor.tsx:116`, `components/RichHtml.tsx` |
| `grid-cols-[2rem_1fr_7rem_5rem_3rem]` | 1 | category tree columns, `pages/Categories.tsx:361` |
| `bg-[#0A0A0A]`, `bg-[#fed217]`, `h-[32rem] w-[32rem]`, `blur-[110px]` | 1 each | Login brand panel, `pages/Login.tsx:110-113` |
| `h-[160px] w-[200px]` | 1 | site screenshot, `pages/WebsiteEditor.tsx:46` |
| `h-[22rem]`, `h-[38px]` | 1 each | compatible-products panes and spacer, `components/product/CompatibleProductsSection.tsx:117, 202` |
| `max-h-[85vh]`, `max-h-[60vh]` | 1 each | `components/MediaPicker.tsx:57`, `components/UsagePill.tsx:131` |
| `text-[10px]` | 1 | `components/product/CompatibleProductsSection.tsx` local `Thumb` |
| `mt-[7px]` | 1 | bullet dots, `pages/ProductNew.tsx:281` |
| `min-h-[10rem] max-h-[26rem]` | 1 | editor surface, `ui/RichTextEditor.tsx:95` |
| `h-[1.15rem]`, `translate-x-[0.875rem]` | 1 each | `ui/Toggle.tsx:33, 41` |
| `rounded-[2px]` | 1 | `ui/Highlight.tsx:25` |
| `ease-[cubic-bezier(0.32,0.72,0,1)]` | 3 | sidebar group animation, `components/Layout.tsx:204, 236, 251` |

### 2.3 Radius classes

165 occurrences.

| Variant | Count | Examples |
|---|---|---|
| `rounded-md` | 69 | `ui/Button.tsx:26`, `ui/Input.tsx:8`, `components/Layout.tsx:81` |
| `rounded-lg` | 33 | `ui/Table.tsx:16`, `ui/EmptyState.tsx:20`, `components/MediaPicker.tsx:132` |
| `rounded-full` | 21 | `components/Layout.tsx:332` avatar, Media/Logos tabs (`pages/Media.tsx:217`, `pages/Logos.tsx:263`), `components/UsagePill.tsx:7`, `components/product/OptionsSection.tsx` chips, `ui/Toggle.tsx:33` |
| `rounded` | 21 | `components/ProductThumb.tsx:12`, `components/SpecTableEditor.tsx:159`, `ui/RichTextEditor.tsx:32` |
| `rounded-xl` | 14 | `ui/Card.tsx:42`, `ui/AccordionCard.tsx:62`, `ui/Modal.tsx:144`, `components/MediaPicker.tsx:57`, `components/product/ImageCard.tsx:21` |
| `rounded-sm` | 5 | `ui/Checkbox.tsx:35`, row buttons `pages/Products.tsx:432`, `pages/Quotes.tsx:259` |
| `rounded-r-full` | 1 | active-nav bar, `components/Layout.tsx:83` |
| `rounded-[2px]` | 1 | `ui/Highlight.tsx:25` |

**Non-class radius:** `ui/Toast.tsx:17` (`0.75rem`), and `!rounded-md` on the toast buttons (`:26-27`).

### 2.4 Shadows

19 real uses. The script also matched `transition-[color,box-shadow]` and `transition-shadow` as `shadow`; those 5 were discounted by hand.

| Class | Count | Where |
|---|---|---|
| `shadow-xs` | 10 | `ui/Button.tsx:34, 36, 38`, `ui/Card.tsx:42`, `ui/AccordionCard.tsx:62`, `ui/Input.tsx:9`, `ui/Select.tsx:25`, `ui/SelectMenu.tsx:212`, `ui/Checkbox.tsx:35`, `ui/Toggle.tsx:40` |
| `shadow-sm` | 5 | auth cards `pages/Login.tsx:129, 176`, `pages/ForgotPassword.tsx:42`, `pages/ResetPassword.tsx:117`; logo switch knob `components/LogoActivationPanel.tsx:91` |
| `shadow-md` | 2 | `ui/DropdownMenu.tsx:142`, `ui/SelectMenu.tsx:246` |
| `shadow-xl` | 1 | `components/MediaPicker.tsx:57` |
| `shadow-2xl` | 1 | `ui/Modal.tsx:144` |

Also: `backdrop-blur-sm` on the Modal backdrop (`ui/Modal.tsx:133`), and `backdrop-blur` on the save bar (`components/product/ProductSaveBar.tsx:48`).

### 2.5 Inline `style={{…}}`

There are 10 inline styles. **None of them sets a colour or a radius.** All carry layout or animation state:

| Where | What it sets |
|---|---|
| `components/Layout.tsx:237, 252` | sidebar group slide: `gridTemplateRows`, `visibility`, opacity and stagger |
| `ui/DropdownMenu.tsx:129`, `ui/SelectMenu.tsx:232` | fixed positioning of portalled menus |
| `ui/SelectMenu.tsx:261` | tree indent, `paddingLeft: 10 + depth*14` |
| `ui/FileDropzone.tsx:134` | progress width |
| `components/TranslationProgressModal.tsx:103` | progress width |
| `components/product/AssignPickList.tsx:225` | tree indent |
| `pages/Categories.tsx:247, 404` | tree indent |

Inline styles that are **not** `style={{}}`:
- `ui/SortableList.tsx:84-90`: dnd-kit's transform, opacity, zIndex and `position:relative`, passed as an object.
- `components/product/Model3DPreview.tsx:61-64`: an imperative style string, `height:220px; background:transparent; --poster-color:transparent`.
- `ui/Toast.tsx:14-22`: a style object holding background, border, radius, shadow, colour and font.

### 2.6 Palette classes that bypass the variables

14 occurrences. **There is no `gray-*`, `slate-*`, `zinc-*`, `neutral-*`, `red-*`, `green-*`, `amber-*` or `blue-*` anywhere.** All 14 are white or black:

| Class | Where | Context |
|---|---|---|
| `bg-white/[0.04]`, `bg-white/[0.06]` ×3 | `components/Layout.tsx:86, 348, 398, 412` | sidebar hovers. Fine while the sidebar stays dark |
| `bg-black/60` | `components/Layout.tsx:407` | mobile-drawer backdrop |
| `bg-black/40` | `ui/Modal.tsx:133`, `components/MediaPicker.tsx:55` | dialog backdrops |
| `bg-white` | `components/ProductThumb.tsx:12`, `components/UsagePill.tsx:166`, `ui/FilePreview.tsx:99`, `pages/Security.tsx:179` (QR), `pages/Widgets.tsx:642` | image and paper surfaces (see §6.3) |
| `text-white` | `ui/Button.tsx:38` | danger button text |
| `border-white/10` | `pages/Login.tsx:110` | brand panel border |

**An undefined colour class:** `text-accent-strong` is used at `pages/ForgotPassword.tsx:51` and `components/product/CompatibleProductsSection.tsx:178`. No `accent.strong` exists (`tailwind.config.js:44-48`), so it generates no CSS and the text inherits its colour. [inference: Tailwind emits nothing for an unknown colour]

### 2.7 Files ranked by how much they'd need to change

**Mechanical debt score.** I computed a score per file from the counts above: radius + shadow + arbitrary + inline, with each palette class and each hex value counted twice.

| Score | File |
|---|---|
| 27 | `components/Layout.tsx` |
| 22 | `ui/FilePreview.tsx` |
| 18 | `pages/Login.tsx` |
| 13 | `pages/Media.tsx`, `pages/Products.tsx` |
| 11 | `components/MediaPicker.tsx`, `pages/Logos.tsx` |
| 10 | `pages/Translations.tsx` |
| 9 | `components/UsagePill.tsx`, `ui/Button.tsx`, `ui/Input.tsx`, `ui/Select.tsx`, `ui/SelectMenu.tsx`, `pages/Widgets.tsx` |
| 7–8 | `components/product/OptionsSection.tsx`, `CompatibleProductsSection.tsx`, `ui/Modal.tsx`, `pages/Categories.tsx`, `pages/Security.tsx` |
| ≤6 | everything else |

**Ranked by real effort.** This adds structural rework, mainly re-implemented primitives (§3.2) and layout changes (§4, §5). It is a judgement, not a count:

1. `pages/ProductDetail.tsx` with all of `components/product/*`: accordions become tabs, and the save-flow coupling must survive (§5.1).
2. `pages/Quotes.tsx` and `pages/ResourceRequests.tsx`: modal becomes split view, and the layout container changes (§5.2, §5.3).
3. `pages/Translations.tsx`: hand-rolled tabs, pills, error boxes, two modals and RTL handling.
4. `pages/Media.tsx`, `pages/Logos.tsx` and `components/MediaPicker.tsx`: hand-rolled cards, tabs, inputs, buttons and a non-`Modal` overlay.
5. `pages/Categories.tsx` and `pages/CategoryDetail.tsx`: the grid tree with nested drag-and-drop.
6. `components/Layout.tsx`: the shell and theme switch.
7. `pages/Products.tsx`.
8. Everything else, mostly header, error-box and radius swaps.

---

## 3. Component inventory (`components/ui/*`)

### 3.1 Per component

**What is common to every component:**
- They are styled entirely with Tailwind classes against the tokens.
- They combine classes with `cn()` (`lib/cn.ts:2-3`), which is a **plain string join, not tailwind-merge**. A `className` override therefore sits beside the base class and loses or wins on stylesheet order. This has bitten six times (CLAUDE.md), and the comments at `ui/Card.tsx:23-29`, `ui/Input.tsx:20-25` and `ui/Button.tsx:82-85` warn about it.
- "Used by" counts are files importing the component from `ui/`, outside `ui/` itself, from a script over the import lines.
- The barrel's header comment calls the kit "dark · sharp · yellow" (`ui/index.ts:1`). That is stale: it describes a reverted pass.

| Component | Purpose | Props and variants | Used by (files) | Radius / shadow / colour | a11y |
|---|---|---|---|---|---|
| **Button** (`Button.tsx:61-76`) | the button | `variant`: primary (yellow) / secondary (outline) / ghost / danger (`:32-39`). `size`: xs / sm / md, h-8 / h-8 / h-9, **all `text-body`** (`:54-58`). `loading` shows a Spinner | 30 | `rounded-md`, `shadow-xs`, `font-semibold` | focus is a 3px yellow ring at 50% (`:28`), faint on white [inference] |
| **RemoveButton** (`Button.tsx:87-119`) | "×" remove control | `size` sm (24px) / md (32px), `title` → `aria-label` | 8 | `rounded-md`, hover `text-danger` | name defaults to "Remove", so many share one label |
| **Input** + **Field** (`Input.tsx`) | text field; label / hint / error wrapper | Input `size` xs / sm / md (`:29-33`). Field: `label`, `hint`, `error`, `htmlFor` (`:50-80`) | Input 21, Field 11 | `fieldBase` (`:7-12`): `rounded-md`, `shadow-xs`, yellow ring, red ring on `aria-invalid` | Field does not set `aria-invalid` or `aria-describedby` on the child, so errors are not tied to inputs |
| **Textarea** (`Textarea.tsx`) | multiline | `size` sm / md, default `rows` 4 | 4 | reuses `fieldBase` | — |
| **Select** (`Select.tsx`) | native select plus a drawn chevron | `size` | 9 | as `fieldBase` | native, so accessible |
| **Checkbox** (`Checkbox.tsx`) | checkbox with a label | `checked`, `onChange`, `label`, `id` | 4 | `rounded-sm`, `shadow-xs`; accent when checked; SVG tick | real input inside a label: OK |
| **Toggle** (`Toggle.tsx`) | switch | `checked`, `onChange`, `label`, `id` | 4 | `rounded-full` track and knob, `shadow-xs` knob, accent when on | `role="switch"` button inside a label. Without `label` and `id` it has no name |
| **Badge** + **StatusBadge** (`Badge.tsx`) | metadata pill | `tone`: neutral / accent / success / danger (`:9-14`). StatusBadge: ACTIVE/IN_STOCK → success, else neutral (`:42-45`) | Badge 23, StatusBadge 3 | `rounded-md`, `text-xs` (Tailwind default, not a token) | — |
| **Card** + **CardHeader** + **SectionError** + **AccordionBodyProvider** (`Card.tsx`) | panel; header row; section error box | Card `padded` (`:30-53`). CardHeader `title` / `description` / `actions`. **Inside an accordion, Card drops its chrome, CardHeader keeps only `actions`, and SectionError renders nothing** (React context, `:14-18`, `:36-46`, `:78-85`, `:108-111`) | Card 23, CardHeader 15, SectionError 8 | `rounded-xl`, `border`, `shadow-xs`, `p-5`; SectionError is a danger tint | CardHeader is always an `h3` |
| **AccordionCard** (`AccordionCard.tsx`) | collapsible card | `title`, `description`, `summary`, `dirty`, `error`, `defaultOpen`, `id`. Auto-opens on the TRANSITION into dirty or error (`:42-49`). Body is **unmounted** when closed (`:91-99`) | 3 (ProductDetail, CategoriesSection, AccessorySection) | own chrome `rounded-xl shadow-xs` (`:62`); "Error" / "Unsaved" badges in the header (`:88`) | header `<button aria-expanded aria-controls>`: OK |
| **Table / THead / TBody / TR / TH / TD** (`Table.tsx`) | table primitives | THead `sticky`. TR `hover` plus `onClick`, which ignores clicks starting on a link or button (`:80`) | 9 | wrapper `rounded-lg border`, row hover `bg-surface-2/70` | a clickable TR is mouse-only by design, so rows need a real control in a cell (`:57-61`). ⚠️ The sticky THead sits inside the wrapper's `overflow-x-auto` (`:16`), which makes the wrapper the scroll container; [inference] it probably never sticks against page scroll. THead also has no background. **No "selected row" style** |
| **Modal** + **ConfirmProvider/useConfirm** (`Modal.tsx`) | dialog; promise-based confirm | `size` sm / md / lg, `title`, `description`, `footer`, `dismissable`. A stack so only the top modal answers Escape and Tab (`:41`). Focus moves in, is trapped and is restored; body scroll is locked (`:78-126`) | Modal 11, useConfirm 7 | `rounded-xl`, `shadow-2xl`, backdrop `bg-black/40 backdrop-blur-sm` | `role="dialog"`, `aria-modal`. **Named only when `title` is passed** (`:140`). **No close (×) button**: Escape or backdrop only |
| **Toaster / toast** (`Toast.tsx`) | sonner wrapper | — | 18 (toast) | inline styles from tokens; **radius `0.75rem` and shadow literal; `theme="light"` hard-coded** (`:11-22`); `classNames` cover success / error / loading only, so `toast.warning` gets sonner defaults | sonner manages its live region |
| **FileDropzone** (`FileDropzone.tsx`) | drag-and-drop uploader with per-file progress | `onUploaded`, `accept`, `multiple`, `label`, `hint` | 2 (ImagesSection, UIShowcase) | `rounded-lg border-2 border-dashed`; `rounded-full` progress bar | progress not in a live region; keyboard behaviour is react-dropzone's own [unverified] |
| **SortableList / DragHandle** (`SortableList.tsx`) | dnd-kit wrapper | `items`, `getId`, `onReorder`, `renderItem(item, handle)`, `as` div / tbody, `strategy`. **One `DndContext` per list** (`:138`) | 9 | handle `rounded-md`; drag feedback is opacity 0.6 only, with no overlay | keyboard sensor on (`:113`); every handle says "Drag to reorder" with no item name |
| **EmptyState** (`EmptyState.tsx`) | empty block | `title`, `description`, `icon`, `action` | 10 | `rounded-lg border-dashed bg-surface-2/40` | heading fixed as `h3` |
| **Highlight** (`Highlight.tsx`) | search-match `<mark>` | `text`, `query` | 1 (Products) | `rounded-[2px] bg-accent` | — |
| **FilePreview / FileTypeIcon** (`FilePreview.tsx`) | PDF first-page preview or file-type icon | `thumbnailUrl`, `filename`, `mimeType`, `className`, `iconClassName` | FilePreview 3, FileTypeIcon 0 directly | **`bg-white` box (`:99`)**; icon SVG with fixed fills (`:53-63`) | icon `role="img"` with a label |
| **Spinner / Loader** (`Spinner.tsx`) | spinner; centred loading row | Loader `label` | Spinner 2, Loader 5 | `currentColor` | Loader is not `aria-live` |
| **Skeleton** (`Skeleton.tsx`) | placeholder block | `className` | 9 | `rounded-md bg-surface-2 animate-pulse` | `aria-hidden`: OK |
| **PageHeader** (`PageHeader.tsx`) | h1, description and actions | `title`, `description`, `actions` | **only 5** (Categories, ProductNew, ProductOptions, WebsiteEditor, UIShowcase) | `text-h1`, bottom border, `mb-8` | — |
| **Pagination** (`Pagination.tsx`) | Prev / Next with "Page X of Y" | `page`, `pageCount`, `total`, `onChange`, `label` | 3 (Media, MediaPicker, Translations) | secondary buttons; `text-xs` readout | no `nav` landmark; the "←" / "→" glyphs are read aloud |
| **DropdownMenu** (`DropdownMenu.tsx`) | row "⋯" menu, portalled, flips above when needed | `actions[]` with `danger` / `disabled` / `title`, `label` | 2 (Categories, ProductOptions) | `rounded-md shadow-md` | `role="menu"`, but [inference] **no arrow-key handling, focus not moved into the menu, and the menu is appended at the end of `<body>`**, so Tab from the trigger does not reach the items. The same defect SelectMenu had until 2026-10-12. Default label "More actions" on every row |
| **SelectMenu** (`SelectMenu.tsx`) | styled single-select, portalled | `value`, `onChange`, `options[]` with `depth`, `ariaLabel`, `placeholder` | 2 (Products, Translations) | `rounded-md`, `shadow-xs` trigger, `shadow-md` list | full select-only combobox pattern (`:35-40`, `:86-142`): **the reference for keyboard handling** |
| **RichTextEditor** (`RichTextEditor.tsx`) | tiptap WYSIWYG with a custom toolbar | `value`, `onChange`, `onNormalisedDiffers`; emits only on real edits (`:9-18`) | 2 (DescriptionSection, ProductNew) | container `rounded-md border`; toolbar buttons `rounded` | **no visible focus on the editing surface** (`focus:outline-none`, `:95`); the link input has no label (`:275-288`); toolbar buttons use `aria-pressed`: OK |

### 3.2 Duplicates — places that re-implement a primitive

| Primitive | Re-implemented at |
|---|---|
| **Error / alert box** (there is no Alert component; `SectionError` exists only for editor sections) | `pages/Quotes.tsx:231`, `ResourceRequests.tsx:209`, `Translations.tsx:161, 193, 302, 659`, `Users.tsx:74`, `Security.tsx:125`, `WebsiteEditor.tsx:136`, `Products.tsx:372`, `Categories.tsx:265`, `CategoryDetail.tsx:221`, `ProductOptions.tsx:277`, `Media.tsx:286`, `Logos.tsx:291`, `ProductDetail.tsx:84-88`, `Login.tsx:154, 219`, `components/RouteError.tsx:37-39`, `components/product/ProductDetailsSection.tsx:41-45`, `CompatibleProductsSection.tsx:128-132`, `AssignPickList.tsx:158`. **At least 22.** Padding, type size and `role="alert"` vary between them |
| **Page header** (instead of `PageHeader`) | `Quotes.tsx:169-190`, `ResourceRequests.tsx:169-177`, `Translations.tsx:546-579`, `Users.tsx:67-70`, `Status.tsx:51`, `Security.tsx:119-122`, `Products.tsx:209-240`, `CategoryDetail.tsx:239-250`, `Media.tsx:172-175`, `Logos.tsx:249-255`, `Widgets.tsx:605-608`, `ProductDetail.tsx:93-136` (a Card) |
| **h1 size** (inconsistent as a result) | `text-xl` on 8 pages (Quotes `:170`, ResourceRequests `:170`, Translations `:547`, Users `:67`, Security `:119`, Media `:172`, Logos `:250`, Widgets `:605`); `text-lg` on Status (`:51`); `text-2xl` on ProductDetail (`:96`); `text-h1` on Products (`:210`), CategoryDetail (`:240`) and every PageHeader |
| **Tabs / segmented control** (no Tabs component) | Translations tablist `:596-615`; Translations language pills `:581-594`; Media kind pills `:212-226`; Logos kind pills `:258-270` (different padding); Description rich / HTML toggle `components/product/DescriptionSection.tsx:36-51` |
| **Modal** | `components/MediaPicker.tsx:55-201`: hand-built overlay. Not portalled; no `role="dialog"`, `aria-modal`, Escape handling, focus trap or scroll lock; bare "✕" close with no label (`:62-67`). Used by Logos, CategoryDetail, ImagesSection, Model3DSection and DownloadsSection |
| **Input** | raw `inputCls` inputs: `components/SpecTableEditor.tsx:83-84`, `TextItemListEditor.tsx:58-65`, `pages/Logos.tsx:57`; raw `fieldBase` copy `components/product/OptionsSection.tsx:196-206`; Media alt input `pages/Media.tsx:193-198`; editor link input `ui/RichTextEditor.tsx:275-288`; raw file inputs `pages/Media.tsx:184-189`, `components/MediaPicker.tsx:72-78`. These use different focus styles (`focus:ring-1 ring-accent` or `focus:border-text`) |
| **Primary button** | `pages/Media.tsx:200-206`, `pages/Logos.tsx:93, 251`, `components/MediaPicker.tsx:79-85`; plus raw text buttons (Preview / Delete / Remove / Clear) in Media, Downloads, Compatible, AssignPickList and Products |
| **Card** | Media upload form and tiles `pages/Media.tsx:180, 277, 314`; Logos tiles `pages/Logos.tsx:60`; `components/product/ImageCard.tsx:21`; auth cards `pages/Login.tsx:129, 176`, `ForgotPassword.tsx:42`, `ResetPassword.tsx:117`; Security enrolment panel `pages/Security.tsx:168` (a card inside a Card); ResourceRequests file box `:91`; WebsiteEditor **EmptyState inside Card** `:144-149` (a box inside a box) |
| **Badge / pill** | `components/UsagePill.tsx:7` (`rounded-full`, unlike Badge's `rounded-md`); `components/product/VariationCountMeter.tsx:24-32`; ProductSaveBar failed pills `:82-90`; Products "no longer in Duda" chip `:457`; ProductOptions value chips `:316-337` and a button-wrapped Badge `:455-467`; Status dot `:56`; OptionsSection choice chips `:177-190` |
| **Thumbnail** | `components/ProductThumb.tsx` (48px, `bg-white`, broken-image fallback); Products inline 100px with no fallback (`:416-430`); CompatibleProducts local `Thumb` (`:35-47`); UsagePill `ProductRow` (`:166`); AssignPickList (`:242`); Categories (`:418-424`); CategoryDetail (`:327-333`) |
| **Label / value "Detail"** | `pages/Quotes.tsx:56-64`, `ResourceRequests.tsx:51-59`, byte-identical. `formatDate` is also duplicated (`Quotes.tsx:10-18`, `ResourceRequests.tsx:10-18`) |
| **Switch** | `components/LogoActivationPanel.tsx:86-92`, hand-drawn inside a button, instead of Toggle |
| **Loading** | `components/ProtectedRoute.tsx:14-18` and `pages/Users.tsx:79`: plain "Loading…" text |

---

## 4. Layout shell (`components/Layout.tsx`)

### Structure

- **Root:** `min-h-screen bg-bg text-text` (`:370`).
- **Desktop sidebar** (`:372-381`):
  - `fixed inset-y-0 left-0 z-30 hidden lg:block`
  - width `w-[17rem]` (`SIDEBAR_W`, `:37`)
  - `bg-sidebar text-sidebar-foreground`, border `border-sidebar-border` (`:34-35`)
- **`SidebarBody`** (`:299-358`):
  - brand block: logo `<img>` `h-14` plus "SAEquip / Admin" in `text-h3` (`:311-320`)
  - scrollable nav `flex-1 overflow-y-auto` (`:323-325`)
  - account row: initials avatar `rounded-full bg-accent` (`:330-335`), email (`:336-341`), sign-out icon button (`:342-353`)
- **Nav** (`:268-284`):
  - "Main menu" heading in `text-small uppercase tracking-wider text-sidebar-subtle` (`:271-273`)
  - then `NAV` (`:49-77`)

**Nav items, in order** (lucide icons, 18px, stroke 2):

| # | Label | Route | Icon |
|---|---|---|---|
| 1 | Website Editor | `/website` | `Globe` |
| 2 | **Products** | `/` (`end`) | `Package` |
| | ↳ Categories | `/categories` | `FolderTree` |
| | ↳ Product Options | `/options` | `SlidersHorizontal` |
| | ↳ Media | `/media` | `Images` |
| | ↳ Logos | `/logos` | `ShieldCheck` |
| | ↳ Translations | `/translations` | `Languages` |
| 3 | Quote Requests | `/quotes` | `BarChart3` |
| 4 | Resource Requests | `/resource-requests` | `FileDown` |
| 5 | Users | `/users` | `Users` |
| 6 | Security | `/security` | `KeyRound` |
| 7 | Status | `/status` | `Sparkles` |

**Not in the nav:**
- `/widgets` is routed but deliberately left out (`:66-71`; `App.tsx:73`).
- `UIShowcase` is not routed at all (`App.tsx:16-18`).

**Badges and counts in the nav: none.** No nav item carries a badge or a count, and nothing in Layout fetches one.

**Active state.** Three cues at once (`:79-86`):
- `bg-accent/[0.12]` tint
- a 3px accent bar drawn as `::before`, pinned to the panel edge with `before:-left-3`
- an accent-coloured icon

**The Products group** (`NavGroup`, `:138-266`):
- The parent is a real link. A separate chevron button toggles the group (`:183-208`).
- The group opens automatically when a child route is active (`:142`, `:149-152`).
- The slide animation uses `grid-template-rows 0fr → 1fr` with `visibility` and a staggered fade, all in inline styles (`:234-263`).

**Mobile** (`< lg`):
- A sticky dark top bar with logo, "SAEquip Admin" and a menu button (`:384-402`).
- A drawer (`:405-419`): `fixed inset-0 z-40`, backdrop `bg-black/60`, panel `w-72`.
- [inference] The drawer has **no Escape handling, no focus trap and no scroll lock**. Only the backdrop and the X close it.

**Main content** (`:422-426`):
- `<main className="lg:pl-[17rem]">` (`MAIN_OFFSET`, `:38`)
- then `mx-auto max-w-6xl px-5 py-6 lg:px-8`
- then `children ?? <Outlet/>`

**There is no desktop top bar or header**, and **no per-page way to opt out of `max-w-6xl`**.

**Scrolling.**
- The **window** scrolls the content.
- The sidebar is fixed and scrolls its nav on its own (`:323`).
- These depend on window scroll:
  - the product save bar is `position: fixed` (`components/product/ProductSaveBar.tsx:48`)
  - Media's pager scrolls by measuring `scroll-margin-top` (`pages/Media.tsx:89-98, 211`)
  - portalled menus close on any capture-phase scroll (`ui/DropdownMenu.tsx:88-93`, `ui/SelectMenu.tsx:179-188`)

**Sidebar width is declared in three places:** `SIDEBAR_W` and `MAIN_OFFSET` (`Layout.tsx:37-38`), and `lg:left-[17rem]` in `components/product/ProductSaveBar.tsx:48`. The save bar's inner `max-w-6xl px-5 lg:px-8` (`:52`) also mirrors `Layout.tsx:423`.

### What it takes to keep the sidebar dark while the main panel switches theme

- **The sidebar already has its own token set** (`--sidebar*`, `index.css:67-74`), and every sidebar colour class uses it. So a dark block that redefines `--bg`, `--surface`, `--text` and the other main tokens leaves the sidebar's own colours untouched. The sidebar tokens must simply not be redefined, or must be redefined to the same values.
- **Shared tokens the sidebar does use:**
  - `accent` for the active tint, bar, icon and avatar (`:84`, `:120`, `:332`): stays yellow in both themes.
  - the global `:focus-visible` ring (`index.css:130-133`) and `ring/50` (`:349`): yellow, fine on dark.
  - global `scrollbar-color: rgb(var(--subtle))` (`index.css:141`): the sidebar scrollbar would follow the main theme. Minor.
- **Literal white and black** on the sidebar (`bg-white/[0.04]`, `bg-white/[0.06]`, `bg-black/60`) are correct for an always-dark panel.
- **The mobile top bar and drawer use the same sidebar classes** (`:386-389`, `:408`), so they stay dark too.
- **The logo** (`src/assets/saequip-logo.svg`) has fixed fills: `#fff` ×7, including a `#fff` background `Rectangle_1`; `#040506` ×3; `#ffc600`. On the sidebar it renders as a fixed white tile. That is unchanged by a main-panel theme, but note that `#ffc600` is not the brand `#FED217`.
- **Root wrapper:** `bg-bg text-text` (`:370`) wraps the sidebar, but the sidebar sets its own `bg-sidebar text-sidebar-foreground`, so it is unaffected. [inference]
- **Where the theme attribute lives:** on `<html>` or the root, plus a pre-paint script to avoid a flash (§1.4). A toggle control has no home today: there is no top bar, so the sidebar's account row (`:328-355`) is the only shell location.

---

## 5. Page by page

**Shared context:**
- Every authenticated page renders inside Layout's `max-w-6xl` container.
- Every one of them uses `cn()` with the override trap (§3).

**Which markers to remove.** The brief asks for every missing / incomplete / readiness marker to be listed for removal. Each list below is **complete**, but tagged:
- **(S)** = save-flow or edit state: unsaved, failed or saving.
- **(C)** = a destructive-action confirmation or its impact text.
- **(V)** = field validation.

Removing an (S), (C) or (V) item removes a safety cue, not a readiness nag. They are listed so stage 2 can decide deliberately; see §6.4.

### 5.1 Product editor — `pages/ProductDetail.tsx` (`/products/:id`, `App.tsx:67`)

**Shell:**
- `UnsavedChangesModal` (`:75`) and `TranslationProgressModal` (`:76`).
- Wrapper `pb-28` while the save bar shows, `pb-4` otherwise (`:71`, `:78`).
- "← Back to products" (`:79-81`), `Loader` (`:83`), load-error box (`:84-88`).
- **Header Card** (`:93-136`). It shows the saved product, not the draft (`:92`):
  - h1 `text-2xl` (`:96`), "SKU: …" (`:98`)
  - "loaded HH:MM" and a "refresh" text button, disabled while dirty or saving (`:99-117`)
  - StatusBadge for status (`:124`); StatusBadge for stock and a type Badge only when commerce fields are shown (`:125-126`)
  - **"Hide pricing & stock fields"** Checkbox (`:128-133`), a per-account preference that defaults to on (`hooks/useUserPreference.ts:65-67`)
- **Grid** `grid-cols-1 lg:grid-cols-10`: left column `col-span-7`, right `col-span-3` (`:145-376`).
- **ProductSaveBar**: fixed (`:379-388`).

**Every section, in render order.**
- Accordions in this file pass no `defaultOpen`, so they start **closed** (`ui/AccordionCard.tsx:27`). Only Categories and Accessory open by default (`components/product/CategoriesSection.tsx:57`, `AccessorySection.tsx:27`).
- The **Tab** column is a suggestion, as the brief asks.
- File paths are under `components/product/` unless shown otherwise.

| # | Section | Render | SectionKey | Fields and controls, in order | Suggested tab |
|---|---|---|---|---|---|
| 1 | **Details** (not collapsible) | `ProductDetailsSection` `:153-159` | `details` | Name; SKU; Type select *(hidden with commerce)*; Status ACTIVE/HIDDEN; *(hidden with commerce)* Stock status, Price, Compare-at price, Quantity (disabled unless managed inventory), Requires shipping, Managed inventory; **SEO fieldset**: Title, Product URL slug, Meta description (single-line Input) (`ProductDetailsSection.tsx:47-183`) | Overview; SEO fieldset → **SEO** ⚠️ |
| 2 | **Description** (not collapsible) | `DescriptionSection` `:161-165` | `details` (`dirty.details`, `:164`) | Rich text / HTML toggle (`:36-51`); reformat notice (`:56-62`); RichTextEditor or HTML Textarea (`:65-78`). **No `error` prop** | Content |
| 3 | **Images** | Accordion `:167-180` | `images` | "Add from Media Centre"; sortable grid of ImageCards (image, Primary badge, Pending-upload badge, drag, alt text, remove); FileDropzone PNG/JPEG/WebP (`ImagesSection.tsx:71-115`) | Files & media |
| 4 | **Options** | Accordion `:182-201` | `options` | VariationCountMeter; "Attach option"; dirty callout; per option: name, "shared with N", "x of y values", remove (with confirm), choice chips, inline "+ value", "Select at least one value…" (`OptionsSection.tsx:124-248`) | Options |
| 5 | **Variations** | Accordion `:203-220` | `variations` | count badge; lock notice while options are dirty; bulk bar (Price Δ *(commerce)*, All active, All hidden) when more than 2 rows; Table: #, one column per option, SKU, Price Δ *(commerce)*, Status (`VariationsSection.tsx:53-181`). **Locked by `dirty.options`** (`ProductDetail.tsx:213`) | Options |
| 6 | **SA Logos** | Accordion `:222-237` | `logos` | grid of toggle cards, "N active", link to `/logos` (`LogoActivationPanel.tsx:39-97`). **No `error` passed** | Compliance (brand ranges; Overview is defensible) |
| 7 | **Cert Logos** | Accordion `:239-254` | `logos` | same, certification kind. **No `error` passed** | Compliance |
| 8 | **3D Model** | Accordion `:256-269` | `model3d` | Model3DPreview, filename, Replace, Remove; or "No 3D model uploaded yet." plus "Upload GLB file" (`Model3DSection.tsx:42-67`) | Files & media |
| 9 | **Downloads** | Accordion `:271-284` | `downloads` | "+ Add download"; sortable rows: drag, FilePreview, Title, Type (Datasheet / User Manual / Certificate), Certificate scheme (when Certificate), "filename · size", Preview or "File missing", Remove (`DownloadsSection.tsx:95-209`) | Files & media (certificates could argue Compliance, but it is one list) |
| 10 | **Compatible Products** | Accordion `:286-300` | `compatible` | two-pane transfer: "All products" (search, rows with "Add →") and "Added to this product" (sortable, Remove, "Remove all") (`CompatibleProductsSection.tsx:136-246`) | Content |
| 11 | **Technical Specs** | Accordion `:302-315` | `specs` | "N specs · M rows"; per group: drag, label, sub-heading note, value lines (remove each), "+ Add line", delete; "+ Add Row" (`components/SpecTableEditor.tsx:94-177`) | Content |
| 12 | **Key Benefits** | Accordion `:317-334` | `benefits` | rows: drag, number, text, delete; "+ Add Row" (`components/TextItemListEditor.tsx:55-76`) | Content |
| 13 | **Applications** | Accordion `:336-353` | `applications` | same editor | Content |
| 14 | **Delete product** (not collapsible, not in the save flow) | `DangerZoneSection` `:355-359` | — | danger Card with "Delete…", which opens a typed-confirmation Modal (`DangerZoneSection.tsx:81-159`) | foot of Overview, or outside the tabs |
| 15 | **Categories** (right column, own accordion, open) | `CategoriesSection` `:364-369` | `categories` | "no longer exist" alert with Remove; search; "Only show selected" Toggle; indented checkbox tree; "Clear all (N)" (`AssignPickList.tsx:157-279`) | Overview, or a persistent side rail |
| 16 | **Accessory** (right column, own accordion, open) | `AccessorySection` `:370-375` | `accessory` | one Toggle, "This product is an accessory" | Overview |

**Shared keys a tab layout must aggregate:**
- `details` spans Details, the SEO fieldset and Description. If SEO becomes its own tab, one key's dirty and error state lives on two tabs. SEO is in the same PATCH (`normalize.ts:430-440`).
- `logos` spans SA and Cert. Toggling one logo marks **both** Unsaved and auto-opens both (`ProductDetail.tsx:226, 243`).
- Editing Name marks Description Unsaved (`:164`).
- The save bar's labels come from `SECTION_LABELS` (`productEditorTypes.ts:20-34`).

**How the accordion behaves, and what tabs must preserve:**
1. **Status must stay visible on non-active tabs.** Today the Error / Unsaved badges sit in each accordion header (`AccordionCard.tsx:88`) and are visible while collapsed. Tabs need an aggregated dirty and error indicator per tab label, from `dirty[key]` and `saveErrors[key] ?? validationErrors[key]`.
2. **Some errors have no in-panel home:**
   - The logo accordions get no `error`, and `LogoActivationPanel` has no error prop. A logos failure shows only in the save bar.
   - `DescriptionSection` has no error UI; the `details` error renders only in `ProductDetailsSection.tsx:41-45`.
3. **Chrome in the panels.** Without `AccordionBodyProvider` around the tab panels, every section would draw its full Card again, with title, description, its own Unsaved badge and its own SectionError (`ui/Card.tsx:14-18`).
4. **Duplicated badges today.** Most sections already show a **second** Unsaved badge in their `CardHeader` actions, which survive inside the accordion:
   - `ImagesSection.tsx:70`, `OptionsSection.tsx:123`, `VariationsSection.tsx:52`
   - `LogoActivationPanel.tsx:47`, `Model3DSection.tsx:37`, `DownloadsSection.tsx:94`
   - `CompatibleProductsSection.tsx:124`, `SpecTableEditor.tsx:100`, `TextItemListEditor.tsx:37`

   Counts are duplicated the same way (Variations `:53`, logos `:48`, specs `:94-99`, against the accordion summaries).
5. **Save-bar anchors.** Failed-section pills link to `#section-${key}` (`ProductSaveBar.tsx:82-90`). The ids live on the section Cards, or on the accordion root for categories and accessory. Inside a closed accordion they are unmounted, so the link goes nowhere. **Under tabs, the link must switch tab first.**
6. **Unmount on close has side effects:**
   - `CompatibleProductsSection` refetches `/api/products` on every mount (`:83-91`).
   - `Model3DPreview` rebuilds `<model-viewer>` (`:47-74`).
   - Local state is lost: searches, "Only show selected", bulk price, the Rich/HTML mode, and FileDropzone's progress list.
   - An in-flight upload still lands in the draft (`ui/FileDropzone.tsx:46-47`; `ImagesSection.tsx:41-47` uses functional updates). [inference]
   - **Tabs will have to choose between unmount and hide**, with the same trade-off.

**Data dependencies a restyle must NOT break** (`components/product/useProductEditor.ts` unless stated):
- **baseline and draft:** `structuredClone`d, loaded in one `Promise.all` (`:97-98`, `:126-133`, `:161-162`).
- **Dirty detection:** per key via `project()` (`normalize.ts:228-291`). A new slice needs a `project()` case.
- **Validation:** `validate(draft, maxVariations, {hideCommerce})` (`:220-224`). `hideCommerce` changes validation, not only visibility (`normalize.ts:325-357`).
- **Save tasks:**
  - only dirty keys, run sequentially (`:321-635`, `:664-688`)
  - variations before options (`:432-445`)
  - banking only into slices not edited during the save, compared **by reference** (`:650-678`)

  ⚠️ **No section may call `onChange` on mount or normalise its value.** `RichTextEditor` emits only real edits for this reason (`ui/RichTextEditor.tsx:9-18`).
- **`setSection`:** takes a value or a function. Images rely on the function form (`:186-199`).
- **Translate-on-save:** `translate.begin()` must run **synchronously inside the Save click, before any `await`** (`:637-643`; `useTranslateOnSave.ts:27-28`).
  - Nothing awaited may be inserted between the click and `save()`: today it is `onSave={() => void save()}`, `ProductDetail.tsx:386`.
  - `TranslationProgressModal`'s "Download {lang}" must reach `retry()` synchronously (`components/TranslationProgressModal.tsx:50, 95`).
- **Unsaved-changes guard:**
  - `useUnsavedChangesWarning({ when: isDirty && !guardSuppressed(), suppress })` (`ProductDetail.tsx:64`; `hooks/useUnsavedChangesWarning.ts:35-49`), plus `beforeunload`.
  - `disarmGuard` goes to DangerZone as `onBeforeNavigate` (`ProductDetail.tsx:358`).
  - `UnsavedChangesModal` needs `save()` to resolve to a boolean (`components/UnsavedChangesModal.tsx:27-38`).
  - The data router is required by `useBlocker` (`App.tsx:29-35`).
- **ProductSaveBar:**
  - props `dirtyLabels`, `isValid`, `saving`, `savingLabel`, `saveErrors`, `validationErrors`, `onSave`, `onReset` (`ProductSaveBar.tsx:11-29`)
  - renders nothing unless dirty or failed (`:36`)
  - `ProductDetail.tsx:71` mirrors that condition for `pb-28`
- **Other couplings:**
  - "refresh" is disabled while dirty (`:108`)
  - Reset relies on `RichTextEditor` pulling an external value back in (`ui/RichTextEditor.tsx:147-154`)
  - the `[&_p+p]:mt-[12px]` WYSIWYG contract (`ui/RichTextEditor.tsx:96-116`)

**Modals and overlays on this page:**

| Overlay | Trigger |
|---|---|
| `UnsavedChangesModal` | `blocker.state === "blocked"` |
| `beforeunload` | closing or reloading the tab while dirty |
| `TranslationProgressModal` | after saving description, specs, benefits or applications |
| `MediaPicker` (custom overlay) | "Add from Media Centre" (`ImagesSection.tsx:71`), "Replace" / "Upload GLB file" (`Model3DSection.tsx:50, 63`), "+ Add download" (`DownloadsSection.tsx:95`) |
| `AttachOptionModal` | "Attach option" (`OptionsSection.tsx:129`) |
| `useConfirm` | detach an option (`OptionsSection.tsx:59-73`) |
| Delete `Modal` | DangerZone "Delete…" (`DangerZoneSection.tsx:86`) |
| Inline link row | the "Link" button in RichTextEditor (`:273-300`) |

There are no drawers.

**Every warning, readiness or status marker:**
- **ProductDetail:**
  - load-error box `:84-88`
  - "loaded HH:MM" with a stale-data tooltip `:102-104`
  - disabled "refresh" with the reason in a `title` `:108-113`
  - StatusBadge ACTIVE/HIDDEN `:124`; stock and type badges `:125-126`
  - accordion summary counts `:170, 185, 206, 225, 242, 259, 274, 289, 305, 320, 339`
- **AccordionCard:** (S) Error / Unsaved badges `:88`; (S) body SectionError `:95`.
- **ProductSaveBar:**
  - (S) "Saving {label}…" `:55-57`
  - (S) "N unsaved sections: …" / "All changes saved" `:62-68`
  - (V) validation line `:73-77`
  - (S) "{Section} failed" pills, with the error only in `title` `:79-92`
- **ProductDetailsSection:**
  - (S) Unsaved `:38`; (S) error box `:41-45`
  - hints: status "Hidden products aren't shown…" `:68`, compare-at `:106`, quantity `:119-123`, slug "changing it changes the live URL" `:167`
- **DescriptionSection:** (S) Unsaved `:35`; the "written elsewhere… will tidy the underlying HTML" notice `:56-62`.
- **ImagesSection / ImageCard:**
  - (S) Unsaved `:70`; (S) SectionError `:78`
  - EmptyState "No images yet" `:81-84`
  - toast "…has no usable URL" `:56`
  - "Primary" badge `ImageCard:37-41`
  - **"Pending upload"** badge `ImageCard:42-46`, decided by `url.includes("cdn-website.com")` (`:5`)
- **Model3DSection / Preview:** (S) Unsaved `:37`; (S) SectionError `:40`; "No 3D model uploaded yet." `:62`; "Couldn't load the 3D preview." `Model3DPreview:68`.
- **OptionsSection:**
  - (S) Unsaved `:123`; (S) SectionError `:136`
  - "Saving this regenerates the variation list…" callout `:138-143`
  - EmptyState `:145-149`
  - "shared with N other products" `:160-165`; "x of y values" `:166-168`
  - (V) **"Select at least one value, or remove this option."** `:243-247`
  - (C) detach confirm about lost SKUs `:59-73`
  - toasts `:89, 97`
- **VariationCountMeter:** red over the limit, yellow above 80% (`:19-32`); "(limit N)" `:38`; **"— over the limit"** `:39`.
- **VariationsSection:**
  - (S) Unsaved `:52`; count `:53`; (S) SectionError `:58`
  - lock notice "Save your option changes first…" `:60-65`
  - EmptyState `:67-75`
  - (V) red border on an invalid Price Δ `:152-156`
- **AttachOptionModal:**
  - "N / M options used" badge, danger at the cap, accent when 3 or fewer remain `:85-87`
  - "used by N products" `:120-122`; disabled "Attached" `:128-135`
  - cap reason in a `title` `:147-152`
  - "This adds to the shared catalog…" `:158-160`; empty text `:102-107`
- **DownloadsSection:**
  - (S) Unsaved `:94`; (S) SectionError `:102`
  - "…is already on this product." `:59, 103`
  - "No downloads on this product yet." `:106`
  - (V) `aria-invalid` on title, type and scheme `:135, 145, 164`; "Choose type…" / "Which certificate…" `:147-168`
  - **"File missing"** (danger, with a `title`) `:196-199`
- **CompatibleProductsSection:**
  - (S) Unsaved `:124`; (S) SectionError `:127`
  - load-error box `:128-132`
  - "N available" / "loading…" `:139-141`; no-match / "Every other product has been added." `:155-158`
  - **"N selected (max)"** `:196`
  - "Nothing added yet…" `:205-208`
  - initial-letter thumbnail fallback `:40-44`
- **Categories / AssignPickList:**
  - "N selected" `CategoriesSection:54`; "Loading categories…" `:60`
  - **`role="alert"` "N selected items no longer exist (deleted in Duda)… Remove"** `AssignPickList:157-171`
  - "N selected" `:189`; empty and no-match `:194-203`; "Clear all (N)" `:271-279`
- **Accessory:** summary "Accessory" `:24`.
- **DangerZone:** (C) danger Card `:81`; (C) "Checking what this would remove…" / "Will be deleted" / "Will be kept" `:116-141`; (V) "Doesn't match" `:147`.
- **SpecTableEditor:**
  - "N specs · M rows" `:94-99`; (S) Unsaved `:100`; (S) SectionError `:105`
  - "No specs. Add one below." `:108`
  - (V) red border on an empty label or value `:125, 142`
  - "Sub-heading — no value beside it." `:130-134`
- **TextItemListEditor:** (S) Unsaved `:37`; (S) SectionError `:40`; "No items. Add one below." `:43`; (V) red border on an empty item `:59-61`.
- **LogoActivationPanel:** (S) Unsaved `:47`; "N active" `:48`; "No SA/Cert logos in the catalog yet — add some." `:53-60`.
- **MediaPicker:** upload error `:86`; library error `:139`; empty "No {kind}s in the library yet…" `:140-146`.
- **UnsavedChangesModal:** (S) "You have unsaved changes / Unsaved: … Leaving now discards these edits." `:49-54`.
- **TranslationProgressModal:**
  - status texts `:5-26`, including "Needs a one-off download…" and "{n} kept in English"
  - danger text `:78`; `TriangleAlert` / `Check` `:81-84`
  - "needs-click" box `:90-99`; danger-coloured bar `:102`
- **Toasts:**
  - `useProductEditor.ts:313` "Fix the highlighted fields…"
  - `:424-426, 452-454, 472-485` variation carry, drop and fail
  - `:706-715` saved and failed
  - `useTranslateOnSave.ts:43-71`: `toast.warning` with a "Translations" action. This is the "kept in English" toast.

**Other one-off styling and bugs in scope:**
- **SEO field grid.** Meta description has `sm:col-span-3` inside a `sm:grid-cols-2` grid (`ProductDetailsSection.tsx:156, 175`), which creates an implicit third column between `sm` and `lg`. Name uses `sm:col-span-2 lg:col-span-3` (`:48`).
- **Overrides that probably lose to the base class** ([inference], the `cn()` trap):
  - `Input className="w-28"` against the base `w-full` (`VariationsSection.tsx:87`)
  - `border-danger` against `border-input` (`:155`)
  - `Card className="border-danger/40"` against `border-border` (`DangerZoneSection.tsx:81`)
- **Redundant wrapper.** `overflow-x-auto` around a `Table` that already has its own (`VariationsSection.tsx:114`).
- **Spacer height mismatch.** The `h-[38px]` spacer sits against an `h-9` Input, which is 39.6px at the 110% root (`CompatibleProductsSection.tsx:202`). [inference]
- **Undefined colour.** `text-accent-strong` on "Add →" (`CompatibleProductsSection.tsx:178`).
- **Stale copy.** "Shown on the product page in Duda." (`DescriptionSection.tsx:32`): the description is rendered by the widget's Overview tab (CLAUDE.md).

**ProductNew** (`/products/new`, `App.tsx:66`):
- Layout: single column `mx-auto max-w-2xl` (`:103`); `PageHeader` with an "N created this session" badge (`:105-115`).
- Form Card (`:117-238`):
  - Name (autofocus), SKU, Price, Compare-at, Type, Status, Requires-shipping Toggle, Description RichTextEditor
  - buttons: Create and edit / Create and add another / Cancel
- `NextSteps` panel (`:261-291`).
- Translate-on-save: `begin()` before the first `await` (`:69`), then `finish` (`:85`), `cancel` on error (`:95`).
- ⚠️ **No unsaved-changes guard** on this page (0 imports of `useUnsavedChangesWarning`).
- **Field errors are not tied to inputs:** they show under the fields (`:127, 146, 160`), but no `aria-invalid` is set, so no red ring.
- The description field has no `htmlFor`.

### 5.2 Quote Requests — `pages/Quotes.tsx` (`/quotes`, `App.tsx:74`)

**Sections:**
- hand-built header: `text-xl` h1 plus "Export CSV" (`:169-179`)
- description (`:187-190`)
- skeleton (`:194-229`), error box (`:230-234`), EmptyState (`:235-241`)
- table (`:243-274`)
- detail Modal (`:276-278`)

**ui/ used:** Table set, Modal, Button, Skeleton, EmptyState. Also `ProductThumb`, `downloadCsv` (`lib/csv.ts`), `languageName`.

**How a row opens the detail** (split view replaces this):
- **State:** `const [selected, setSelected] = useState<QuoteRequest | null>(null)` (`:143`). It holds the row **object**.
- **Mouse:** `<TR hover onClick={() => setSelected(q)}>` (`:257`).
- **Keyboard:** a real `<button>` in the Name cell, with the visually hidden text "Open the quote from " (`:259-262`).
- **Modal:** `<Modal open={selected !== null} onClose={…} size="lg">` (`:276-278`).
  - **No `title`**, so the dialog has no accessible name.
  - No footer and no × button.
  - Closes on Escape or backdrop; focus returns to the opener.

**Detail content, in order** (`QuoteDetail`, `:66-137`). Every empty field shows "—" (`Detail`, `:56-64`).
1. `<h3>` with the name (`:75`).
2. Grid `grid-cols-1 sm:grid-cols-2` (`:77`):
   1. First name (`:78`)
   2. Last name (`:79`)
   3. Company (`:80`)
   4. Email: plain text, not `mailto:` (`:81`)
   5. Telephone: plain text, not `tel:` (`:82`)
   6. When needed (`:83`)
   7. Address, postcode and country, joined with newlines and shown with `whitespace-pre-line` (`:72, 84`)
   8. Submitted, via `formatDate` (`:85`)
   9. Language, via `languageName(locale)`, or "—" when null (`:86-88`)
   10. Message, full width (`:89-91`)
3. "Items (N)" (`:95-97`), then a nested Table: Item / SKU / Options / Qty (`:99-133`).
   - Item: `ProductThumb` (48px, white tile) plus a `Link` to `/products/{dudaProductId}` when matched, otherwise plain text (`:113-124`).
   - Options: `"k: v, k: v"` (`:48-53`, `:128`).
   - Deliberately **no price column** (`:98`).

**Fetched but not shown:** `emailSent` and `emailEnabled` (deliberate, `:180-186`), and `item.price`.

**List:**
- Columns: Name (the button), Email, Company, Items (count), Date (`:247-267`).
- Order: newest first, set by the server (`backend/src/routes/quotes.ts:58`).
- **No search, filter or pagination.**
- CSV columns `:25-28`, file name `quote-requests-YYYY-MM-DD.csv` (`:45`), formula-injection guard in `lib/csv.ts:16-20`.

**What complicates a split view:**
1. The detail comes **only from the list payload**. `GET /api/quotes/:id` exists (`backend/src/routes/quotes.ts:69`) but the frontend never calls it.
2. **No URL state.** Reload loses the selection, a quote cannot be deep-linked, and Back from the product link (`:115`) returns with nothing selected. `Translations.tsx:361-373` already uses `useSearchParams` and is a model to follow.
3. **Behaviour the pane must replace.** Modal supplies focus-in, trap, restore, Escape and scroll lock (`ui/Modal.tsx:78-126`). A pane needs its own focus handling, a selected-row style (`TR` has none) and `aria-current`/`aria-selected`.
4. **Responsive switch by viewport.** The detail grid uses `sm:` against the **viewport**, not the pane width (`:77`), so it goes two-column in a narrow pane. A nested Table with 48px thumbnails is wide for a side pane.
5. **Width.** Layout's `max-w-6xl` (`components/Layout.tsx:423`) limits the total width available for list and detail together.
6. **No paging.** The server returns all rows (`backend/src/routes/quotes.ts:57-60`).
7. **Heading levels skip** from h1 to h3 (`:75`).

**Markers:**
- description (`:187-190`)
- error box `HTTP nnn` / "Failed to load quote requests" (`:155, 230-234`), with no `role="alert"`
- "—" placeholders (`:61, 88, 127, 128, 265`)

### 5.3 Resource Requests — `pages/ResourceRequests.tsx` (`/resource-requests`, `App.tsx:75`)

The same structure as Quotes:
- header `:169-177`, skeleton `:180-207`, error `:208-210`, empty `:211-217`, table `:219-241`, Modal `:243-245`
- adds `Badge`
- one `head` element is shared by the skeleton and the table (`:155-165`)

**How a row opens the detail:**
- `selected` state (`:132`)
- `TR hover onClick` (`:225`)
- a cell button with hidden text "Open the request from " (`:227-230`)
- an untitled `Modal size="lg"` (`:243-245`)

**Detail content, in order** (`RequestDetail`, `:61-122`):
1. `<h3>` name (`:64`).
2. Grid `sm:grid-cols-2` (`:66`):
   - First name, Last name, Company, Email, Telephone, Mobile (`:67-72`)
   - Marketing emails: "Yes - opted in" / "No" (`:73`)
   - Submitted (`:74`)
   - Language (`:75`). ⚠️ A null locale shows **"English"**, not "—", because `languageName(null)` returns "English" (`lib/language.ts:3`).
   - an empty `aria-hidden` spacer (`:76`)
   - **Consent given** (`consentText`, full width, `whitespace-pre-line`) (`:79-81`)
   - *conditional* **Consent given (English)** when it differs (`:82-86`)
3. "File requested" box (`:90-118`):
   - ProductThumb
   - product `Link` to `/products/{dudaProductId}` (text falls back to "Product"), or plain text / "—"
   - "title · SKU" (`:105-108`)
   - filename, truncated with a `title` (`:109-111`)
   - **"Since removed"** neutral Badge when `!stillListed` (`:113-117`; `stillListed` is `downloadId !== null`, `backend/src/routes/resourceRequests.ts:48`)

**Fetched but not shown:** `privacyConsent`.

**List:**
- Columns: Name, Email, Company, File (`"Product - Title"`, `:22-24`), Date.
- Newest first, set by the server (`backend/src/routes/resourceRequests.ts:20`).
- No search, filter or paging.
- CSV `:27-47`.

**Split view.** Every complication in §5.2 applies, plus one more: **there is no single-item endpoint at all**. Only `GET /resource-requests` exists (`backend/src/routes/resourceRequests.ts:18`), so the detail must stay derived from the list unless a route is added.

**Markers:**
- "Since removed" (`:113-117`)
- conditional English consent (`:82-86`)
- "English" for pre-language rows (`:75`)
- error box (`:144, 208-210`)
- "—" placeholders (`:56, 103, 106, 233`)
- "Product" fallback (`:100`)

### 5.4 Products — `pages/Products.tsx` (`/`, `App.tsx:63`)

**Sections:**
- hand-built header with Export CSV and "+ New product" (`:209-240`)
- store-usage line (`:248-258`)
- toolbar (`:260-321`): a search box built by hand with an inline SVG and a raw "×" clear (`:267-298`); category and sort `SelectMenu`s (`:304-321`)
- skeleton (`:332-370`), error (`:371-375`), empty and no-match states (`:376-393`)
- table (`:396-470`): 100px thumbnail and name, SKU, Status, Categories count

**ui/ used:** Button, Highlight, Input, SelectMenu, Skeleton, StatusBadge, Table set, toast.

**One-off styling:**
- `h-[100px] w-[100px]` (`:349, 426, 429`), with **no `onError` fallback**, unlike `ProductThumb`
- the hand-built "no longer in Duda" chip (`:457`)
- the `Input className="pl-8 pr-7"` override, which only works by stylesheet order (`:285`)

**Modals:** none.

**Markers:**
- store headroom "{n} / {max} products used · {remaining} remaining", bold when 10 or fewer remain, with **"— approaching the limit"** in danger (`:93, 249-252`)
- "+ New product" disabled with "The store is at its limit…" (`:230-235`)
- **"N no longer in Duda"** chip (`:122-123, 456-460`)
- "N categories" with names in a hover-only `title` (`:450-453`)
- "—" for a missing SKU or no categories (`:440, 447`)
- StatusBadge ACTIVE/HIDDEN (`:443`)
- empty / no-match with "Clear filters" (`:377-392`)
- error (`:371-375`)

**Data:**
- `Promise.all` of `/api/store`, `/api/products` and `/api/categories`; categories is a soft dependency (`:64-79`)
- `query`, `categoryId` and `sort` state (`:50-55`); filter memo with the "a parent matches its children" rule (`:128-157`)
- export `POST /api/products/export`, reading `Content-Disposition` and `X-Export-Rows` (`:173-203`)
- rows navigate through `TR` plus a real `Link` (`:413, 432`)

**a11y:** the search has a placeholder only, with no label or `aria-label` (`:279-286`).

**More detail:** see §5a for the fetch, the response fields, whether Pagination and Table can support the target controls, and the state to preserve.

### 5.5 Categories — `pages/Categories.tsx` (`/categories`, `App.tsx:68`)

**Sections:**
- `PageHeader` with "+ Create New Category" (`:217-225`)
- skeleton, which is a **`<Table>`** (`:228-263`)
- error (`:264-268`)
- `Card padded={false}` holding the EmptyState or the `CategoryTree` (`:271-293`)
- create Modal (`:305-355`)

**ui/ used:** Button, Card, DropdownMenu, EmptyState, Field, Input, Modal, PageHeader, Select, Skeleton, SortableList/DragHandle, Table set, toast, useConfirm.

⚠️ **The tree is a grid, not a table, and this constrains the restyle.**
- **One column template** for the header row and every data row: `COLS = "grid grid-cols-[2rem_1fr_7rem_5rem_3rem] …"` (`:361`; header `:465-471`; rows `:402`).
- **Why not a table** (`:373-376`): a table allows one `<tbody>` per sortable context, and a tree needs parent and children in one visual sequence but in different drag contexts.
- **Two nested `SortableList`s**, each with its own `DndContext` (`ui/SortableList.tsx:138`):
  - outer list over the top level (`:473-492`)
  - inner list of children inside the expanded parent's item (`:481-489`)
  - so a child cannot be dropped at the top level. The rule is **structural** (`:366-371`).
  - each drop calls `PUT /api/categories/reorder`, optimistically (`:166-177`).
- **Wrapper and spacing details:**
  - `className=" "` (`:476, 485`) is a deliberate truthy value that suppresses SortableList's `space-y-2` (`ui/SortableList.tsx:148`)
  - indent is inline (`:404`), and faked in the skeleton (`:247`)
  - [inference] only two levels render; the inner list does not recurse (`:487`)
- **Probable border bug** [inference, not seen in a browser]. Each row carries `border-b … last:border-b-0` (`:402`), but sits inside its own dnd wrapper `div`. A collapsed row, and every child row, is therefore that wrapper's `:last-child`, so separators would vanish on most rows.
- **Layout shift on load.** The skeleton (a `Table`) and the loaded content (a `Card` with the grid) are different containers. The comment at `:227` says otherwise.

**Other details:**
- The category title is a `<button>` that calls `navigate` (`:427-433`), not a link, so middle-click and open-in-new-tab do not work.
- Expand/collapse buttons are raw (`:406-414`).

**Modals:**
- create Modal, from the header button, "Add subcategory" in the row menu, or `?create=<parentId>` (`:125-135`)
- (C) delete `useConfirm`, with the subcategory count and where the children go (`:180-200`)
- a row `DropdownMenu` (`:452-458`)

**Markers:**
- **the Duda-count dot**: tooltip "Duda has N. Run duda:sync-categories…"; hover-only, colour-only, not focusable (`:445-450`)
- `ImageOff` placeholder (`:422`)
- error (`:264-268`)
- EmptyState (`:274-282`)
- create-modal note (`:350-353`)

**Data:**
- `GET /api/categories` (`:79`)
- `POST /api/categories` (`:143-150`)
- `PUT /api/categories/reorder` (`:168`)
- `DELETE /api/categories/:id`, with `?confirm=true` (`:203-206`)

### 5.6 CategoryDetail — `pages/CategoryDetail.tsx` (`/categories/:id`, `App.tsx:69`)

**Sections:**
- `Loader` (`:218`), error (`:219-225`), `UnsavedChangesModal` (`:230`)
- hand-built breadcrumb (`:231-237`)
- header with h1, "Unsaved changes", Cancel and Save (`:239-250`)
- 70/30 grid (`:252`):
  - left: Category info (name, parent Select, description Textarea `font-mono`), Category products (`AssignPickList`), Subcategories (own SortableList) (`:253-346`)
  - right: Image tile and SEO (`:348-413`)
- `MediaPicker` (`:416-431`)

**ui/ used:** Button, Card, CardHeader, DragHandle, Field, Input, Loader, Select, SortableList, Textarea, toast. Also MediaPicker, UnsavedChangesModal, useUnsavedChangesWarning and AssignPickList.

**Markers:**
- (S) "Unsaved changes" (`:242`)
- (V) slug "Lowercase letters, numbers and hyphens only." (`:132-133, 385`)
- "Stored in the Hub. Run duda:sync-categories to push it to Duda's storefront." (`:296`)
- "No subcategories yet." (`:317`); "N products" per subcategory (`:340`)
- image placeholder (`:359-362`) and note "…can be replaced but not removed" (`:365-375`)
- SEO URL hint "Changing it breaks existing links." (`:384`)
- hints (`:265, 280`)
- toast "has no usable URL" (`:424`)
- AssignPickList's **"N selected items no longer exist"** alert (`components/product/AssignPickList.tsx:157-168`)

**Data:**
- four reads in one `Promise.all` (`:92-97`)
- draft and baseline compared with `project()`, which sorts the product ids (`:59, 126`)
- the image is sent only when it changed (`:86, 98, 165-167`)
- `seo` is sent whole (`:168-174`)
- `PATCH`, then `PUT …/products` only when the ids changed (`:175-184`)
- `save()` must return a boolean (`:153-154`)
- subcategory reorder reloads only the tree on failure (`:197-216`)

**a11y:**
- the breadcrumb has no `aria-label` and no `aria-current`
- **once an image is set, the image button has no accessible name**: its only content is `<img alt="">` (`:351-358`)

### 5.7 ProductOptions — `pages/ProductOptions.tsx` (`/options`, `App.tsx:70`)

**Sections:**
- `PageHeader` with "+ Add Option" (`:248-266`)
- capacity line (`:268-273`)
- Loader, error, empty Card (`:275-295`)
- Table (`:297-356`); each row has the name, value chips with remove, an `IncludedIn` badge-button and a DropdownMenu
- create/rename Modal (`:361-432`)

**Re-implementations:**
- value chips are hand-built spans (`:316-337`)
- a Badge wrapped in a button (`:455-467`); a second "usage pill" look that differs from `UsagePill`
- **`window.prompt`** for "Add value" (`:142`): a native dialog that cannot be styled

**Modals:**
- create/rename Modal
- `window.prompt`
- (C) "Delete value" confirm (`:170-185`) and (C) "Delete option" confirm (`:213-226`)
- `UsageDialog` (`:450-475`)

**Markers:**
- "{count} of {max} options used." (`:268-273`)
- "+ Add Option" disabled at the cap (`:256-261`)
- "No values yet" (`:312-314`)
- chip tooltip "Offered by N product(s)" / "Not used by any product" (`:323`)
- last-value guard tooltip and toast (`:163-165, 329-330`)
- **a red danger Badge "0 products"** for an unused option (`:447-449`)
- error (`:276-280`), EmptyState (`:286-294`)
- lost-variation report toasts (`:49-61`)

**Data:**
- `GET /api/options`; `PUT` keeps the current type; `POST`; `POST …/choices`; `DELETE …/choices/:cid`, with `?force=true`; `DELETE /api/options/:id`, with `?confirm=true` (`:80-232`)
- cap checks (`:92, 422-425`)

### 5.8 Media — `pages/Media.tsx` (`/media`, `App.tsx:71`)

**Sections:**
- hand-built `text-xl` h1 and intro (`:172-175`)
- upload `<form>`, a hand-built card with a raw file input, a raw alt input and a raw yellow submit (`:178-208`)
- toolbar (`:211-263`): pill tabs (`:212-226`), search Input, native sort Select
- skeleton grid (`:269-284`), error, empty
- asset grid, 2/3/4 columns (`:305-386`): FilePreview or image, name and size, raw "Preview" and "Delete", per-tile error
- Pagination (`:387-393`)

**Markers:**
- "Used N×" pill and "· Unused" with a `cursor-help` tooltip (`:42-65`)
- **"File missing"** chip with a `title` (`:367-373`)
- per-tile delete errors "Can't delete: used on N product(s)." / "…in the logo catalogue…" (`:161-167, 382`)
- upload error (`:207`); library error (`:285-289`)
- empty states (`:290-296`)
- "alt: …" line (`:352`)
- (C) delete confirm "may be used on the live website" (`:132-138`)

**Data:**
- `useMediaLibrary({kind, pageSize: 24})` (`:70`; `lib/useMediaLibrary.ts:117-142`), with a 250ms debounce
- **the grid must stay mounted while paging**, dimmed with `pointer-events-none opacity-50` (`:305-312`). Do not gate it on `loading`.
- `goToPage` measures `scroll-margin-top` and `getBoundingClientRect`, and respects reduced motion (`:89-98`). The toolbar's `scroll-mt-20 lg:scroll-mt-4` (`:211`) clears the mobile sticky header.
- upload: `uploadFile(file, {alt})` → upload URL → `POST /api/media` → PDF thumbnail (`lib/upload.ts:103, 116, 157`), then `setKind("")` and `showNewest()` (`:116-123`)
- `DELETE` handles 204, 409 and the generic case (`:147-167`)

**a11y:**
- the tabs have no selected state for assistive tech (`:213-225`)
- "Preview" and "Delete" repeat on every tile without the filename
- errors are not announced
- an image with a null `url` renders `<img src=undefined>` (`:318`)

### 5.9 Logos — `pages/Logos.tsx` (`/logos`, `App.tsx:72`)

**Sections:**
- `LogoCard` (`:20-99`):
  - image tile `h-24 bg-surface-2` (`:61`)
  - "Replace image" (`:64-66`)
  - raw Label and Alt inputs (`:68-77`, `inputCls` `:57`)
  - footer with drag handle, UsagePill and RemoveButton (`:79-90`)
  - a dirty-only raw yellow "Save label/alt" (`:92-96`)
- header with a raw "+ Add logo" (`:249-255`)
- SA / Cert pill tabs, a second copy (`:258-270`)
- skeleton, error, empty (`:274-295`)
- `SortableList` grid with `rectSortingStrategy`; the grid classes must stay on SortableList's own container (`:297-314`)
- two MediaPickers (`:317-318`)

**Bug:** the skeleton tile is **`h-32`** (`:283`), but the real tile is **`h-24`** (`:61`), so the page shifts on load, despite the comment at `:272-273`.

**Modals:**
- add MediaPicker
- replace MediaPicker, followed by an impact confirm with before/after tiles and the product count (`:177-204`)
- (C) delete confirm (`:224-235`)
- UsageDialog

**Markers:**
- "Used by N" pill (`:82-87`)
- (S) "Save label/alt" (`:92-96`)
- error (`:290-292`), empty (`:294`)
- toast "already this logo's image" (`:173`)

**Data:**
- `GET /api/logos?kind=` with a latest-request guard (`:113-126`)
- `POST` (`:135`)
- `PUT /api/logos/reorder`, optimistic (`:146-160`)
- `PATCH {label, alt}` (`:43-46`)
- `PATCH {mediaAssetId}`, skipped when the same image is picked (`:172-175, 207-210`)
- `DELETE` (`:238`)

### 5.10 Translations — `pages/Translations.tsx` (`/translations`, `App.tsx:76`)

**Sections:**
- `text-xl` h1 with an icon; on the content tab: Export CSV, Import CSV (hidden file input) and "Translate missing (N)" (`:546-574`)
- description (`:576-579`)
- **language pills** (`:581-594`, `aria-pressed`)
- **hand-built tablist** "Product content" / "Names from Duda" (`:596-615`): `role="tab"` and `aria-selected`, but no `aria-controls`, no tabpanel and no arrow keys
- **content tab:** search Input `xs`, two SelectMenus, error, skeleton, empty, Table and Pagination (`:622-728`)
- **Names tab:** `DudaNames` (`:213-348`)

**Modals:**
- **EditTranslation**:
  - `Modal` with a title and "Used on" links; footer Cancel / Save; not dismissable while saving (`:79-200`)
  - opened by a row `TR` or the English-cell button (`:699, 707`)
- **TranslationProgressModal**: never dismissable; "Download {lang}" buttons (`components/TranslationProgressModal.tsx:42-111`)

**Markers:**
- status-filter counts (`:649-653`)
- a local `StatusBadge` mapping Missing → accent, Machine → neutral, Edited → success, **Kept in English → danger** (`:56-59, 720`)
- "Shown in English" placeholder (`:716`)
- edit modal: **"The machine translation was kept in English: {lastError}."** (`:160-164`)
- the safety note about numbers and marks (`:188-191`)
- (V) `role="alert"` "Not saved: {problem}." (`:192-196`)
- Names tab:
  - missing notice "Nothing copied for {lang} yet…" / "{n} still in English in Duda…" (`:310-316`)
  - **"English changed since"** badge (`:333-337`)
  - error (`:302`)
- toasts (`:265-281, 436-528, 751`)
- TranslationProgressModal states (§5.1)

**Data that must not break:**
- **URL state:** `?lang=` (default `ar`) and `?tab=names`, written with `replace` (`:361-373`).
- **Loading:** `fetchSources` behind a latest-request guard (`:386-404`).
- **Filtering and paging:** client-side, `PAGE_SIZE = 50` (`:39, 415-429`).
- **Saving:** `saveBatch(locale, "STAFF", …)` (`:98-110, 514`).
- **CSV:** export of the filtered rows (`:455-467`); import reads only the Key and Translation columns (`:476-531`).
- **Duda names:** `GET /api/translations/duda` and the per-language `refreshAll` loop (`:220-286`).
- **RTL:** `lang` and `dir` are set on cells and textareas (`:176-182, 331, 712`).
- ⚠️ **Must stay synchronous:**
  - `translateNow()` must reach `startTranslators([locale])` with **no `await` and no confirm first** (`:432-434`).
  - `onDownload` must reach `retry()` the same way (`:758`).

### 5.11 Users — `pages/Users.tsx` (`/users`, `App.tsx:77`)

**Sections:** `text-xl` h1 and description (`:67-70`), error box (`:73-77`), plain "Loading users…" text (`:79`), Table (`:83-132`).

**Markers:**
- **"Unconfirmed"** danger badge (`:101-105`)
- two-factor On/Off badge (`:108-112`)
- Duda editor "Yes" / "—" (`:116`)
- "never" for no sign-in (`:16`)
- error, toasts (`:57-59`)

**Data:** `GET /api/users` (`:38`) and `POST /api/users/password-reset` (`:53-56`), with per-row `sending` state.

**a11y:** the action column header is empty (`:93`); loading and errors are not announced.

### 5.12 Security — `pages/Security.tsx` (`/security`, `App.tsx:78`)

**Sections:**
- `text-xl` h1 and email (`:119-122`), error (`:124-128`)
- Card "Authenticator app" (`:130-215`):
  - On/Off badge
  - factor rows with "Turn off"
  - enrol / "Add another device" button
  - an enrolment panel (a card inside the Card, `:168`) holding:
    - the **QR on hard-coded `bg-white`** (`:176-180`)
    - a "Can't scan it?" `<details>` with the secret (`:181-189`)
    - a 6-digit code input (`aria-label` only) with Confirm / Cancel (`:191-211`)

**Modals:** (C) `useConfirm` "Turn off two-factor?" (`:100-106`).

**Markers:** On/Off badge (`:138`), error, toasts (`:85, 110, 113`).

**Must not break:**
- `mfa.listFactors` / `enroll` / `challenge` / `verify` / `unenroll` (`:30-108`)
- digit-only code sanitising (`:197`)

### 5.13 Status — `pages/Status.tsx` (`/status`, `App.tsx:79`)

**Sections:** `max-w-md` column; h1 in **`text-lg`**, smaller than any other page (`:51`); two Cards, "Backend health" and "Authenticated API call" (`:53-70`).

**Markers:**
- coloured dot `bg-subtle` / `bg-success` / `bg-danger` with "Backend: checking… / ok / unreachable" (`:38-47, 56-57`)
- "Authenticated as {email}" / "/api/me failed" (`:64-68`)

**Data:** `/api/health` (`:15`) and `/api/me` (`:24`).

### 5.14 Website Editor — `pages/WebsiteEditor.tsx` (`/website`, `App.tsx:62`)

**Sections:**
- `PageHeader` (`:128-131`); Loader, error (`:133-139`)
- no-access **EmptyState inside a Card**, a box inside a box (`:143-149`)
- per-site Card (`:152-198`):
  - screenshot `h-[160px] w-[200px]` (`:46-58`)
  - name and publish Badge
  - domain link
  - meta
  - "Edit Website"
- footnote (`:200-203`)

**Markers:**
- publish Badge "Published" / "Not published" / "Unknown" (`:22-29, 161-163`)
- EmptyState "No editor access yet…" (`:145-148`)
- error, SSO toast (`:120`)

⚠️ **Must not break: `openEditor`** (`:102-124`). It calls `window.open("about:blank")` **synchronously inside the click, before** `POST /api/website/sso`, so popup blockers allow it. Nothing awaited may go first, and `noopener` must not be added (`:97-100`).

### 5.15 Widgets — `pages/Widgets.tsx` (`/widgets`, routed, not in nav)

**Sections:**
- `<style>{WIDGET_CSS}</style>` (`:603`)
- h1 (`:605-608`)
- "How it works" Card (`:610-628`)
- five widget Cards, each with a section Badge and a **preview box on hard-coded `bg-white`** (`:630-645`)
- **no code blocks**: no `<pre>` or `<code>`, and no snippets (`:614-615`)

**Embedded previews** (static JSX imitating the widget):
- `LogoPreview` (`:368-378`)
- `SpecsTablePreview` (`:386-407`)
- `CompatiblePreview` (`:414-452`)
- `ListPreview` (`:454-462`)
- `TabsPreview` (`:472-514`)
- `Model3DPreview` (`:521-552`), which loads an external chevron image (`:543`)

**Previews that are probably broken already** ([inference], read from the code, not run):
- **Tabs:** the CSS shows a panel only with `.saeh-open` (`:31, 129`), but the preview toggles `hidden` and never adds it (`:500-506`).
- **Compatible:** it uses `.saeh-cp-name/-body/-shot/-btn` classes that no longer exist in `WIDGET_CSS`, and its "2 on mobile" copy (`:587`) contradicts the 1-up CSS.
- **Fonts:** no preview is wrapped in `.saeh-root`, where `--saeh-head` and `--saeh-body` are defined (`:11`), so the fonts probably fall back to DIN.

**Markers:** none.

### 5.16 UIShowcase — `pages/UIShowcase.tsx` (unrouted)

Unrouted (`App.tsx:16-18`). Its copy is stale:
- the docstring still says `/ui` (`:32`)
- "dark, sharp, yellow" (`:56`)
- the typography sample describes DIN (`:69-72`)

It shows nearly every `ui/` component. ⚠️ **Its FileDropzone uploads for real** to the media library (`:258-268`), so it has side effects if it is ever routed.

### 5.17 Shared components not covered above

- **`components/UsagePill.tsx`:**
  - `PILL` `rounded-full` (`:7`)
  - `UsageDialog` Modal with a `max-h-[60vh]` list and skeleton rows (`:56-157`)
  - `ProductRow` thumbnail on **`bg-white`** (`:166`)
  - "Untitled product" / "No SKU"
- **`components/RouteError.tsx`:** the layout route's `errorElement`. A Card with a danger box, Reload / Back buttons and a `<details><pre>` stack trace.
- **`components/RichHtml.tsx`:**
  - DOMPurify plus `dangerouslySetInnerHTML`
  - the `[&_p+p]:mt-[12px]` contract
  - used by Translations only
  - [unverified] DOMPurify's defaults keep `style` attributes, so stored inline colours would survive in a dark theme
- **`components/ProtectedRoute.tsx`:** a plain "Loading…" screen (`:14-18`); redirects when there is no user or 2FA is pending (`:21-23`).

### 5.18 Login / ForgotPassword / ResetPassword (outside the shell)

**Login** (`/login`):
- **Brand panel** (`lg` and up): `bg-[#0A0A0A]`, `border-white/10`, and a `bg-[#fed217]/20` blur glow (`:110-118`), plus the logo `<img>`.
- **Form panel:** a hand-built card `rounded-xl … shadow-sm` (`:129, 176`) with **either** the code form (`:127-172`) **or** the email and password form (`:174-240`).
  - error boxes with `role="alert"` (`:154-159, 219-224`)
  - a raw show/hide button with inline SVGs in `currentColor` (`:7-41, 205-213`)
  - **`tabIndex={-1}` on the show-password button**, so keyboard users cannot reach it (`:208`)
- **Must not break:**
  - the redirect guard, suppressed while a code is outstanding (`:62`)
  - `showCode = needsCode || (!loading && !!user && mfaPending)` (`:64`)
  - `signIn` → `mfaRequired`; `verifyMfa`; `cancelCode` signs out (`:66-105`)
  - the code input: `inputMode="numeric" autoComplete="one-time-code"`, digits only (`:138-149`)

**ForgotPassword:**
- hand-built card (`:42`)
- "← Back to sign in" uses the **undefined `text-accent-strong`** (`:51`)
- the error has no `role="alert"` (`:73`)
- must not break: `resetPasswordForEmail(email, { redirectTo: origin + "/reset-password" })`, which always reports success (`:10-35`)

**ResetPassword:**
- hand-built card (`:117`)
- states: checking / invalid / form, with a conditional 2FA code (`:116-197`)
- errors are plain `text-danger` text
- must not break:
  - `onAuthStateChange` **plus** `getSession` with a 1500ms grace period (`:47-73`)
  - `needsSecondFactor` → `verifyTotpCode` before `updateUser`, with the `insufficient_aal` fallback (`:54-105`)
  - sign out, then navigate (`:109-110`)

---

## 5a. Products page: data, list and controls (add-on)

This section goes deeper than §5.4, for a redesign with:
- status tabs
- rows per page
- numbered pages
- search, a category filter and sort, all client-side

Paths are as in the rest of the document. The backend route is in `backend/src/routes/duda.ts`.

### 5a.1 How the list is fetched

**On mount** (`pages/Products.tsx:57-91`):
- **One `Promise.all` of three calls** (`:64-68`): `GET /api/store`, `GET /api/products` and `GET /api/categories`.
  - Store and products are required: a non-OK answer throws, and the page shows the error box (`:69-70`, `:80-81`).
  - Categories are a **soft** dependency, read only if OK (`:76-79`).
- It runs once, with a `cancelled` guard.
- No refetch, no polling, and no reload after an export.

**`GET /api/products`** (`backend/src/routes/duda.ts:288-339`):
- **It ignores the request entirely.** The handler signature is `async (_req, res, next)`, so **no query parameter is read: there is no server-side pagination, filtering or sorting.**
- It reads **Duda live on every page load**, through `duda.listAllProducts()` (`:304`).
  - That pages internally at Duda's 200-per-page cap, up to 20 pages (`backend/src/services/duda.ts:428-442`).
  - At today's catalogue size that is one Duda request. [inference: fewer than 200 products fit one page]
  - Unlike the public endpoints, this is **not** a read of the Hub mirror, so every visit to the page waits on a Duda round trip.
- It adds **one** Hub query for every product's category links and `createdAt` (`:305-311`).
- It returns **one JSON array containing every product in the store**, in Duda's list order.
  - HIDDEN products are included: nothing filters by status (`:316-335`).
  - Count: CLAUDE.md records 91 products in Duda (88 visible and 3 hidden rentals, 2026-10-14). **Not measured in this review**, because doing so needs an authenticated call to production.

**The other two calls:**
- `GET /api/store` → `{site_name, max_products, product_count, remaining, …}` (`lib/types.ts:3-8`). Feeds the headroom line and the "+ New product" limit.
- `GET /api/categories` → `{categories: [{id, title, depth, parent_id}]}` (`pages/Products.tsx:21-27`, `:79`). `parent_id` is the string `"ROOT"` for a top-level category.

### 5a.2 Fields in the response, and what a row renders

The response type is `ProductSummary` (`lib/types.ts:10-28`), built at `duda.ts:318-332`.

| Field | In response? | Source | Rendered today |
|---|---|---|---|
| `id` | yes | Duda id | row link `/products/:id` (`:413`, `:432`) |
| `name` | yes | Duda | link text with search `Highlight` (`:432-434`) |
| `sku` | yes, `string \| null` | Duda | SKU column with `Highlight`, or "—" (`:439-441`) |
| `status` | yes, `ACTIVE` / `HIDDEN` | Duda | `StatusBadge` (`:443`); ACTIVE is green, anything else neutral (`ui/Badge.tsx:42-45`) |
| `type` | yes | Duda | small grey line under the name (`:435`) |
| `thumbnail` | yes, `string \| null` | Duda `images[0].url`: the **full-size** CDN image, not resized | 100×100 `object-cover`, `loading="lazy"`; an empty grey box when null; **no `onError` fallback** (`:416-430`) |
| `category_ids` | yes | **Hub** `ProductCategory` links, never Duda's copy (`duda.ts:290-295`) | turned into "N categories" in the browser (`:106-125`, `:445-463`) |
| `created_at` | yes, ISO or null | decoded from Duda's ULID id, falling back to the Hub row (`duda.ts:252-282`, `:331`) | **sort only**, never shown (`:147-155`) |
| `stock_status` | yes | Duda | not rendered |
| `price` | yes | first price, formatted | not rendered |
| `variation_count` | yes | Duda | not rendered |
| **slug** | **no** | Duda has `seo.product_url`, and the Hub mirrors `HubProduct.slug` | **not in the payload.** Adding it is a one-line change in `duda.ts:318-332` |
| **category count** | **no field** | derived | computed from `category_ids` against `/api/categories` |

**How the category count is worked out:**
- It drops a category that is the parent of another selected one (`:111-116`).
- A category id that Duda no longer knows becomes one red **"N no longer in Duda"** chip (`:119-123`, `:456-460`). That chip is in the marker list in §5.4.
- If `/api/categories` failed, every row shows "—" rather than a false stale chip (`:107-109`).

**Each row** (`:408-465`) has:
- Product: thumbnail, the name as a link, and the type underneath
- SKU
- Status
- Categories

There are no row actions or menus. The row is clickable with the mouse (`TR hover onClick`, `:413`), and the name `Link` is the keyboard path (`:432`).

### 5a.3 Can `ui/Pagination.tsx` and `ui/Table.tsx` support the target controls?

**Volume.** About 91 rows held in memory is well within client-side range, and it matches today's model: the whole list is already in memory, and the export already sends the filtered ids.

| Target control | Supported today? | What would need to change |
|---|---|---|
| **Rows per page: 20 / 50 / All, default 20** | **No.** Pagination's props are only `page`, `pageCount`, `total`, `onChange` and `label` (`ui/Pagination.tsx:10-22`); there is no page-size control. The page has **no pagination at all**: every filtered row renders (`:408`) | Add `pageSize` state and a size control (`SelectMenu` or a segmented control). ⚠️ `Pagination` returns `null` when `pageCount <= 1` (`:23`). "All", or any result that fits one page, removes the whole bar, so a size picker placed inside it would vanish. Either put the picker outside it or change the early return |
| **Numbered pages with prev/next** | **Prev/next only.** "← Prev" / "Next →" are secondary `sm` Buttons (`:30-45`). Numbered pages are absent **by design**: "Deliberately not a numbered page list" (`:3-8`) | Add a numbered mode, for example a `numbered` prop or a new variant. Changing the default would also change its **three other consumers**: Media and MediaPicker (server-paged via `useMediaLibrary`) and Translations (client-side). It also lacks a `nav` landmark and `aria-current="page"`, and the "←"/"→" glyphs are read aloud. At 91 rows there are 5 pages at 20 or 2 at 50, so no ellipsis is needed yet |
| **Status tabs: All / Live / Hidden** | **The data supports it; the UI does not.** `status` is in every row (Live = `ACTIVE`, Hidden = `HIDDEN`). There is no Tabs primitive (§3.2) | A Tabs/segmented component (§7 Batch 3), with per-tab counts computed from `products`. Decide whether the counts follow the active search and category filter or stay as catalogue totals. "Live" should be `status === "ACTIVE"`, not `!== "HIDDEN"`, so an unexpected value does not count as live |
| **Search** | **Yes**, client-side (`:127-138`) | Keep the logic and replace the hand-built input (§5.4) |
| **Category filter** | **Yes**, client-side (`:139-144`, control `:304-313`) | Keep. See §5a.4 for the rule |
| **Sort** | **Yes**, a `SelectMenu` with 4 keys (`:29`, `:38-43`, `:315-321`) | Keep. `Table` has **no sortable-header affordance**: no header buttons, no `aria-sort`. Clickable column headers would be new work |
| **Rendering a page of rows** | **Yes.** `Table` is plain primitives and renders any slice (`ui/Table.tsx`) | Caveats below |

**`Table` caveats:**
- There is no selected or active row state.
- `THead sticky` is probably ineffective, because it sits inside the wrapper's `overflow-x-auto` (`:16`), and it has no background. [inference]
- `TR` ignores clicks that start on a link or button (`:80`). Keep that when adding per-row controls.
- With "All", 91 rows of 100px **full-size** images load. `loading="lazy"` is already set (`:424`), but the files are the originals.

**How the pipeline would need to be arranged:**
- Today's order: `products` → search → category → sort → render all (`:128-157`).
- Target order: `products` → **status tab** → search → category → sort → **slice to the page**.
- **Reset to page 1** whenever the tab, search, category, sort or page size changes. Translations already does this (`pages/Translations.tsx:405`).
- **Clamp** the page if the result shrinks.
- `Translations.tsx:428-429` is the in-repo model for a client-side `pageCount` and slice.

**Knock-on effects:**
- **Export.** It sends the ids of **every filtered, sorted row**, not a page (`:173-181`), and the button shows that count (`:224`).
  - Keep the page slice **out** of the export, or it silently shrinks to 20 rows.
  - Decide whether the status tab applies to it. It will if the tab filter goes in the same memo.
- **Skeleton.** It draws **8** rows (`:344`). At a default of 20 per page it should draw 20, or the page grows on load, which breaks the rule in `ui/Skeleton.tsx:6-14`.
- **Empty states.**
  - "No products in this store yet." (`:376-378`)
  - "No products match … Clear filters", where Clear resets search and category but **not sort** (`:379-393`)

  A status tab needs a third case, for example "No hidden products", and Clear should decide whether it resets the tab.

### 5a.4 Existing search and filter state a redesign must preserve

**Where the state lives today:**
- All of it is local `useState` (`:50-55`):
  - `query` (default `""`)
  - `categoryId` (`""` means all)
  - `sort` (default `"recent"`, labelled "Recently added")
- **There are no URL parameters.** The file has no `useSearchParams` or `useParams`.
- There is no `localStorage` and no account preference for this page. `useUserPreference` is used only for "Hide pricing & stock fields" on the editor.
- **Consequence:** opening a product and pressing Back remounts the page. That re-fetches, including the Duda call, and **resets search, category and sort**. [inference: the component unmounts on the route change and nothing persists the state]
- If the redesign moves this state into the URL so that Back and page numbers survive, `Translations.tsx:361-373` is the precedent: `useSearchParams` with `{replace: true}`, so typing does not add history entries.

**Behaviours to keep exactly:**
- **Search:**
  - trims, is case-insensitive and matches anywhere in the text
  - searches **name OR SKU**
  - is null-safe for both, because `sku` is null for SKU-less products and `name` is only guaranteed by Duda's create API (`:127-138`)
  - highlights matches in both columns (`:433`, `:440`)
- **Category filter:**
  - **a parent matches itself and its direct children** (`:139-144`)
  - one level only. That matches today's two-level tree, but it would miss grandchildren. [inference]
  - the options are indented by `depth` (`:311`)
- **Sort:**
  - by name: `localeCompare` with `sensitivity: "base"`
  - by date: `created_at`, **with nulls last** in both directions (`:145-156`)
- **Categories are a soft dependency:**
  - the table renders without them (`:76-79`)
  - the stale chip is suppressed when they are missing (`:107-109`)
  - the category filter then offers only "All categories" (`:309-312`)
- **Export:**
  - `POST /api/products/export` with the **filtered, sorted ids**
  - reads `Content-Disposition` and `X-Export-Rows`
  - fetches a blob because the request needs the bearer token (`:173-203`)
- **"+ New product"** is disabled when the store is full (`:159`, `:226-238`).
- **Row navigation** goes through `TR` plus `Link`, with no double navigation (`:413`, `:432`; `ui/Table.tsx:80`).

---

## 6. Risks and constraints

### 6.1 Things that must not be restyled

- **`WIDGET_CSS`** (`pages/Widgets.tsx:9-325`) is generated from the live widget by `backend/scripts/widget-sync-css.mjs`, keyed on the literal `const WIDGET_CSS = \``. `widget-test.mjs` pins part of this file. The previews reproduce the **public** site's Barlow/Inter look on white, so they must stay on a light "paper" surface in dark mode (`:642`).
- **The 12px paragraph spacing contract.** `[&_p+p]:mt-[12px]` appears in `ui/RichTextEditor.tsx:116` and `components/RichHtml.tsx`, and must equal `.saeh-prose p + p` in `backend/src/public-widget/widget.js`. Use px, never `mt-3`: at the 110% root, `mt-3` is 13.2px.
- **Click-synchronous calls** that a restyle must not put an `await`, confirm or animation in front of:
  - translate-on-save `begin()` (product editor, ProductNew)
  - `startTranslators` and `retry()` (Translations, TranslationProgressModal)
  - `window.open` in `openEditor` (WebsiteEditor)

### 6.2 Styling entangled with logic

- **`cn()` is a plain join.** Every new `className` override in a restyle can silently lose to a base class. Known live cases:
  - `VariationsSection.tsx:87, 155`
  - `DangerZoneSection.tsx:81`
  - `Products.tsx:285`, which works only by stylesheet order
- **The accordion context:** `AccordionBodyProvider` strips Card, CardHeader and SectionError chrome (`ui/Card.tsx`). Any replacement container must replicate it, or sections double up (§5.1).
- **Save bar:** the `#section-*` anchors, the `pb-28` reservation and the `lg:left-[17rem]` offset are all tied to other files (§4, §5.1).
- **Commerce fields:** `hideCommerce` changes validation as well as visibility (`components/product/normalize.ts:325-357`).
- **Variations lock:** the table is locked by `dirty.options` (`ProductDetail.tsx:213`).
- **"Pending upload"** is decided by a URL test (`ImageCard.tsx:5`).
- **Classes computed from state:**
  - option chips (`OptionsSection.tsx:182-186`)
  - logo cards and the switch (`LogoActivationPanel.tsx:71-73, 87-89`)
  - the meter (`VariationCountMeter.tsx:25-32`)
  - the description mode (`DescriptionSection.tsx:42-46`)
  - tab and pill actives (Media `:217-221`, Logos `:263-265`, Translations `:586-610`)
  - Status tones (`:38-47`)
  - publish tones (`WebsiteEditor.tsx:22-29`)
- **The Categories grid tree:** the shared `COLS` template, nested drag contexts, the `className=" "` hack, inline indent, and `last:` meeting dnd wrapper divs (§5.5).
- **dnd-kit** writes inline `transform`, `opacity`, `zIndex` and `position:relative` (`ui/SortableList.tsx:84-90`). Restyled rows must not fight them, for example with their own transforms or z-index.
- **Measurement:**
  - portalled menus measure and flip (`ui/DropdownMenu.tsx:56-75`, `ui/SelectMenu.tsx:144-167`)
  - Media's pager reads `scroll-margin-top` (`pages/Media.tsx:89-98, 211`)
  - CompatibleProducts' fixed pane height and spacer are sized against Input's height (`:117, 202`)
- **Skeletons are sized against real rows on purpose** (`ui/Skeleton.tsx:6-14`). A restyle that changes a row's height must change its skeleton too. Logos and Categories already disagree with their skeletons (§5.5, §5.9).
- **Model3DPreview** drives the DOM imperatively through a ref (`:45-76`).

### 6.3 Third-party UI

| Library | How it is styled today | How it could be themed |
|---|---|---|
| **tiptap 3.29** (`ui/RichTextEditor.tsx`) | no ProseMirror stylesheet imported; the surface is styled by `editorProps.attributes.class` with descendant variants (`:93-122`); custom text-glyph toolbar (`:172-271`) | entirely ours, so tokens apply directly. Needs a focus indicator, which is missing today (`:95`) |
| **@dnd-kit** (`ui/SortableList.tsx`) | inline transform and opacity; no `DragOverlay`, no drop indicator | the handle and rows are ours. Drag feedback could add an overlay |
| **react-dropzone 15** (`ui/FileDropzone.tsx`) | headless; our dashed box and progress bars | fully ours |
| **@google/model-viewer 4.3.1** (`components/product/Model3DPreview.tsx`) | CDN-loaded with SRI; inline transparent background, `--poster-color:transparent`, fixed 220px, `environment-image="neutral"` (`:60-64`) | the background comes from the wrapper (`bg-surface-2`). Its progress bar and default controls take CSS custom properties / `::part` [unverified for 4.3.1]. ⚠️ Change the version and the SRI hash together (CLAUDE.md) |
| **sonner 2** (`ui/Toast.tsx`) | `theme="light"` hard-coded; inline token styles plus a literal radius and shadow; `classNames` miss `warning` and `info` | pass `theme` from the app theme; move the radius and shadow to tokens; add `warning`/`info` classNames |
| **lucide-react** | `currentColor` throughout | inherits the text colour, so it themes for free |
| **DOMPurify** (`components/RichHtml.tsx`) | default config | [unverified] stored inline styles survive |
| **Native `window.prompt`** (`ProductOptions.tsx:142`) | OS chrome | cannot be themed; would need replacing with a Modal |

### 6.4 Dark-mode blockers

1. **Infrastructure:** none yet (§1.4). It is additive work, but a `darkMode` strategy, a second token block and a pre-paint script are all needed.
2. **Paper surfaces that are deliberately white:**
   - `ui/FilePreview.tsx:99` (rendered PDF first pages are white pages)
   - `components/ProductThumb.tsx:12`
   - `components/UsagePill.tsx:166`
   - the Security QR, which must stay white or scanning may fail (`pages/Security.tsx:179`)
   - the Widgets previews (`pages/Widgets.tsx:642`)

   These are decisions to make, not bugs: either keep a white "paper" token in dark mode, or accept white tiles.
3. **Images on `bg-surface-2` wells, which become dark:**
   - Logos tiles (`pages/Logos.tsx:61`) and the replace-confirm tiles (`:182-190`)
   - Media tiles (`pages/Media.tsx:315-322`)
   - LogoActivationPanel (`:75`)
   - ImageCard (`:28`)
   - category thumbnails (`Categories.tsx:418-424`, `CategoryDetail.tsx:327-357`)
   - AssignPickList (`:242`)
   - CompatibleProducts' `Thumb` (`:37`)
   - MediaPicker tiles, which have **no background box at all** (`:169-174`)

   [inference] Certification marks and SA range logos are probably dark artwork on transparency, so they would vanish on dark. **Unverified: I did not inspect the logo files.**
4. **Fixed-fill artwork:**
   - the FileTypeIcon SVG (`#fff` page, `#D4D4D4` stroke)
   - the SA logo SVG with its own `#fff` rectangle; it renders as a white tile on the light auth pages (`Login.tsx:124`, `ForgotPassword.tsx:41`, `ResetPassword.tsx:116`)
   - the Widgets placeholder SVG (`:329`)
   - the external chevron image (`Widgets.tsx:543`)
5. **Hard-coded black:**
   - backdrops `bg-black/40` (`ui/Modal.tsx:133`, `components/MediaPicker.tsx:55`) and `bg-black/60` (`Layout.tsx:407`)
   - shadow tokens are `rgb(0 0 0 / x)` (`tailwind.config.js:108-113`), plus Toast's `rgba(0,0,0,.10)`. They are near-invisible on dark, which matters less once shadows go.
6. **sonner** is forced to `theme="light"` (`ui/Toast.tsx:11`).
7. **model-viewer:** a transparent background over `bg-surface-2`, so dark materials lose contrast. The loading UI is not themed.
8. **iframes:** none anywhere. **Checkerboards:** none.

### 6.5 Removing the warning and readiness markers

§5 lists them all. The brief says they are going, but some are not readiness nags:
- **(S) save-flow state:** Unsaved / Error / Saving badges, the save bar, the failed pills, the unsaved-changes modal. These are the only cue that work is unsaved or failed. CLAUDE.md records why the collapsed accordion still shows them.
- **(C) destructive confirmations** with usage counts.
- **(V) field validation:** red borders, "Select at least one value…", "Doesn't match".
- **Some markers report real faults rather than readiness**, and their underlying states still happen:
  - "File missing" (a storage object is gone)
  - "N selected items no longer exist" (AssignPickList; the server refuses those ids, so saves fail with nothing on screen saying why: CLAUDE.md, fixed 2026-10-12)
  - "N no longer in Duda"
  - "Pending upload"

  Removing the marker hides the fault but not its consequence.

### 6.6 Fonts and type

- **The target fonts reverse a documented decision.** Barlow, Inter and JetBrains Mono replace DIN 2014, which CLAUDE.md describes as the dashboard font after three reverted passes (IBM Plex, Montserrat, dark/sharp/ClashGrotesk). The CLAUDE.md typography paragraph and the `index.css` and `tailwind.config.js` comments must change with it.
- Barlow and Inter are already on the page, via Google Fonts (`index.html:36-40`), so dropping Typekit would also remove the Adobe Fonts external dependency.
- **`fontWeight` maps `medium` to 400** because DIN has no 500 (`tailwind.config.js:16-26`). Inter and Barlow do ship 500, so this map, and `Button`'s deliberate `font-semibold` workaround, need revisiting.
- **The 110% root and rem scale.** The new fonts have different x-heights, so the "16px body = 0.909rem" calibration (`index.css:109-113`) may need re-judging.
- **Two parallel type scales.** The token scale and Tailwind's own (`text-sm`/`xs` 102 uses, against `small`/`body` 162) mean a token change alone will not reach about 40% of the text.

---

## 7. Recommended stage order

Effort is my estimate: **S** about half a day or less, **M** about 1–2 days, **L** 3 days or more. Each batch should leave the app shippable.

**Batch 0 — decisions to settle before any code.** These block everything else.
- [ ] Theme mechanism: `darkMode` selector, attribute location, persistence. Use `useUserPreference` plus a pre-paint copy (§1.4). **S**
- [ ] `cn()`: adopt tailwind-merge, or keep "props not classes". Adopting it changes the behaviour of existing overrides, so it needs a pass. **S** to decide, **M** to adopt
- [ ] Paper surfaces in dark mode: a white "paper" token for previews, QR, thumbnails and logos? (§6.4) **S**
- [ ] Marker removal: confirm which (S), (C) and (V) items stay (§6.5). **S**

**Batch 1 — foundations.** No visual change to page layouts.
- [ ] `index.css`: rename and extend the tokens, add the dark block, keep the `--sidebar*` set fixed, add a paper token, and decide on a warning colour. **S–M**
- [ ] `tailwind.config.js`:
  - radius → 0, and stop `rounded-full` and the arbitrary radii escaping (§1.2)
  - `fontFamily` heading / body / mono
  - `fontWeight` remap
  - shadows
  - `darkMode`

  **S–M**
- [ ] `index.html`: load Barlow, Inter and JetBrains Mono; drop Typekit. Update the CLAUDE.md typography section. **S**
- [ ] Sweep the Tailwind-default type sizes (`text-xs`/`sm`/`base`/`lg`/`xl`/`2xl`, ~118 uses) onto tokens, mechanically, before restyling. **M**

**Batch 2 — core `ui/` primitives.** Restyle in place; the API stays the same.
- [ ] Button, RemoveButton. **S**
- [ ] Input / Field / Textarea / Select; wire `Field` to `aria-invalid` and `aria-describedby`. **S–M**
- [ ] Checkbox, Toggle. **S**
- [ ] Badge, StatusBadge. **S**
- [ ] Card, CardHeader, SectionError, EmptyState, Skeleton, Spinner/Loader, PageHeader, Pagination. **S–M**
- [ ] Table: add a selected-row state for the split view; give the sticky header a background. **S**
- [ ] Modal: add a close button; require or derive an accessible name. **S**
- [ ] DropdownMenu: keyboard handling modelled on SelectMenu. **M**
- [ ] SelectMenu, Highlight. **S**
- [ ] Toast: theme prop, warning and info classNames. **S**
- [ ] FileDropzone, FilePreview, SortableList/DragHandle. **S**
- [ ] RichTextEditor toolbar and surface focus. **S–M**

**Batch 3 — new shared primitives** that replace the duplicates in §3.2.
- [ ] **Alert / Callout**: replaces the 22+ hand-rolled error and notice boxes. **S**, then the sweep is **M**
- [ ] **Tabs**: proper tablist with arrow keys; supports a dirty/error indicator per tab; replaces Translations, Media, Logos and DescriptionSection. **M**
- [ ] **Thumb / ImageWell**: one component for the 7 thumbnail variants, on a paper surface. **S–M**
- [ ] **ListDetail / SplitView** layout: needs a Layout opt-out from `max-w-6xl` and a pane scroll model. **M**
- [ ] **MediaPicker → `Modal`**: brings its a11y up to the rest. **M**

**Batch 4 — shell.**
- [ ] Layout: sidebar on fixed dark tokens, theme toggle (in the account row; there is no top bar), container opt-out for split views, one source for the sidebar width (with ProductSaveBar), and a drawer focus trap / Escape. **M**
- [ ] ProtectedRoute and RouteError loading/error states. **S**

**Batch 5 — low-risk pages.** Header, alert and radius swaps.
- [ ] Status, Users, Security (QR stays on paper), WebsiteEditor. **S each**
- [ ] Login, ForgotPassword (fix `text-accent-strong`), ResetPassword. **S each**

**Batch 6 — split views.**
- [ ] Quotes: list/detail, URL-addressable selection (`?id=`), detail from the list payload (or `GET /api/quotes/:id`). **M**
- [ ] ResourceRequests: the same; no single-item endpoint, so derive from the list. **M**

**Batch 7 — catalogue pages.**
- [ ] Products: status tabs, page size, numbered pages (§5a). Depends on Tabs and the Pagination change. **M**
- [ ] ProductOptions: replace `window.prompt` and the hand-built chips. **M**
- [ ] Media, Logos: tabs, inputs, buttons; fix the Logos skeleton height. **M each**
- [ ] Categories: grid tree, border bug, skeleton container; keep the nested DndContexts. **M**
- [ ] CategoryDetail: breadcrumb, image-button name. **M**
- [ ] Translations: tabs, pills, alerts; keep URL state and the synchronous translate path. **L**

**Batch 8 — product editor.** Last, because it depends on Tabs, Alert, Thumb and MediaPicker.
- [ ] ProductDetail → tabs:
  - per-tab dirty/error aggregation for the shared keys
  - an error home for logos and description
  - save-bar anchors that switch tab
  - an unmount-vs-hide decision
  - remove the duplicated Unsaved badges and counts

  **L**
- [ ] Restyle the 16 sections and their helpers (SpecTableEditor and TextItemListEditor raw inputs, OptionsSection chips, LogoActivationPanel switch, CompatibleProducts panes). **L**
- [ ] ProductNew: also add the missing unsaved-changes guard if wanted. **S**

**Batch 9 — tidy.**
- [ ] Widgets page chrome only; leave `WIDGET_CSS`. The broken previews (§5.15) are a separate fix. **S**
- [ ] UIShowcase: update it as the living kit, or delete it. **S**
- [ ] Stale comments: the `ui/index.ts` header, `DescriptionSection` copy, the AssignPickList "Tags" note. **S**
