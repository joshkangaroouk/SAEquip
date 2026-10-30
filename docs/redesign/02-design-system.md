# SA Equip Hub — design-system spec (redesign stage 2)

The spec that stage 3 onward builds from.

**Sources and evidence:**
- **Target values** come from `docs/redesign/00-design-reference.md` (written **00** below). It is the source of truth, and its decisions are not reopened here.
- **Current code** is cited as `file:line` (paths under `frontend/` unless shown otherwise). The evidence comes from `docs/redesign/01-ui-review.md` (**01**), re-checked on 2026-10-30 at `1426d8b`.
- **Gaps in 00** are marked **TBD (Qn)** and collected under [Open questions](#open-questions). None of them is guessed. The one exception is the **warning colour**, which the brief asked to be proposed; it is marked PROPOSED.

**Contents**
1. [Token spec](#1-token-spec)
2. [Type scale](#2-type-scale)
3. [Theme mechanism](#3-theme-mechanism)
4. [Component spec](#4-component-spec)
5. [Duplicate → component mapping](#5-duplicate--component-mapping)
6. [Marker policy applied](#6-marker-policy-applied)
7. [cn() change](#7-cn-change)
8. [Build plan](#8-build-plan-for-stage-3-onward)
9. [Open questions](#open-questions)

---

## 1. Token spec

### 1.1 Format (unchanged)

Colour variables stay **space-separated RGB channels**, not hex. Tailwind consumes them as `rgb(var(--x) / <alpha-value>)`, which is what keeps opacity modifiers such as `bg-danger/10` working (`src/index.css:30-35`, `tailwind.config.js:28-31`). Each hex value from 00 is given beside its channels.

### 1.2 Final variables

**Main panel — switches with the theme.**
- Light values sit on `:root, [data-theme="light"]`; dark values on `[data-theme="dark"]`.
- Each block also sets `color-scheme`, so native scrollbars and form controls follow the theme.

| Variable | Light | Dark | Role (00) |
|---|---|---|---|
| `--bg` | `242 242 240` (#F2F2F0) | `15 15 15` (#0F0F0F) | page |
| `--surface` | `255 255 255` (#FFFFFF) | `23 23 23` (#171717) | cards, header, top bar |
| `--surface-2` | `247 247 245` (#F7F7F5) | `29 29 29` (#1D1D1D) | table heads, footers, wells, row hover/selected |
| `--input-bg` | `255 255 255` (#FFFFFF) | `18 18 18` (#121212) | input and select background |
| `--border` | `227 227 223` (#E3E3DF) | `42 42 42` (#2A2A2A) | hairlines |
| `--border-strong` | `203 203 198` (#CBCBC6) | `59 59 59` (#3B3B3B) | inputs, ghost buttons |
| `--text` | `11 11 11` (#0B0B0B) | `242 242 240` (#F2F2F0) | text |
| `--muted` | `92 92 88` (#5C5C58) | `163 163 160` (#A3A3A0) | secondary text, labels, help |
| `--track` | `236 236 234` (#ECECEA) | `35 35 35` (#232323) | segmented-control background |
| `--chip-bg` | `242 242 240` (#F2F2F0) | `34 34 34` (#222222) | neutral chip |
| `--ok` | `30 122 60` (#1E7A3C) | `95 208 138` (#5FD08A) | Live / success |
| `--ok-bg` | `230 242 233` (#E6F2E9) | `16 38 26` (#10261A) | ok chip background |
| `--danger` | `180 35 24` (#B42318) | `249 112 102` (#F97066) | errors, faults, destructive |
| `--warning` **PROPOSED** | `138 75 0` (#8A4B00) | `245 181 74` (#F5B54A) | warnings (not in 00; see §1.4) |
| `--warning-bg` **PROPOSED** | `252 239 217` (#FCEFD9) | `42 30 8` (#2A1E08) | warning background |
| `--focus` | `var(--text)` channels: `11 11 11` | `242 242 240` | focus outline. 00: "a 2px outline in --text" |

**Fixed — the same in both themes**, declared once on `:root` and never redefined by the dark block.

| Variable | Value | Role (00) |
|---|---|---|
| `--accent` | `254 210 23` (#FED217) | yellow: active or primary only |
| `--accent-ink` | `11 11 11` (#0B0B0B) | text on yellow |
| `--accent-hover` | `240 196 15` (#F0C40F), **kept from current** `index.css:54` | hover is **TBD (Q4)**; kept so nothing breaks meanwhile |
| `--paper` | `255 255 255` (#FFFFFF) | always-white tile for images, logos, PDF previews, the QR code and widget previews |
| `--sidebar` | `11 11 11` (#0B0B0B) | sidebar background |
| `--sidebar-border` | `31 31 31` (#1F1F1F) | sidebar border |
| `--sidebar-fg` | `255 255 255` (#FFFFFF) | "SA Equip / Product Hub" lockup text ("in white") |
| `--sidebar-text` | `201 201 197` (#C9C9C5) | item text |
| `--sidebar-active` | `254 210 23` (#FED217) | active item background |
| `--sidebar-active-ink` | `11 11 11` (#0B0B0B) | active item text |
| `--sidebar-badge` | `31 31 31` (#1F1F1F) | badge background (on the active item it swaps: `--sidebar-active-ink` background, `--accent` text) |
| `--sidebar-badge-ink` | `229 229 226` (#E5E5E2) | badge text |
| `--sidebar-label` | **TBD (Q6)**. Interim: current `--sidebar-subtle` `107 107 107` (`index.css:73`) | group labels ("Catalogue", "Enquiries"…) |
| `--sidebar-focus` | **TBD (Q5)** | focus outline inside the sidebar |

**Deleted:** `--radius` (every radius is 0, §1.6) and the five tokens in §1.3 that have no use.

### 1.3 Old → new mapping

Every variable currently in `src/index.css:36-78`, so stage 3 can apply them mechanically.

| Old variable (line) | Action | New | Class rewrite (count from 01 / grep) |
|---|---|---|---|
| `--bg` (`:38`) | keep, new values | `--bg` | none (`bg-bg`) |
| `--surface` (`:39`) | keep | `--surface` | none |
| `--surface-2` (`:40`) | keep | `--surface-2` | none |
| `--border` (`:43`) | keep | `--border` | none (`border-border`) |
| `--input` (`:44`) | **delete**: it was the field BORDER | `--border-strong` | `border-input` → `border-border-strong` (4) |
| `--ring` (`:45`) | **delete** | `--focus` | interim: Tailwind `ring` colour key repointed at `--focus`. The `ring-*` focus classes are replaced by outlines in batch 2 (§8) |
| `--text` (`:48`) | keep | `--text` | none |
| `--muted` (`:49`) | keep | `--muted` | none |
| `--subtle` (`:50`) | **delete**: 00 has no third text grey | `--muted` | `text-subtle` → `text-muted` (67); `placeholder:text-subtle` → `placeholder:text-muted` (6); `hover:border-subtle` → `hover:border-border-strong` (4); `bg-subtle` → `bg-muted` (1, `pages/Status.tsx`) |
| `--accent` (`:53`) | keep (fixed) | `--accent` | none |
| `--accent-hover` (`:54`) | keep (fixed) pending Q4 | `--accent-hover` | none |
| `--accent-foreground` (`:55`) | **rename** | `--accent-ink` | `*-accent-foreground` → `*-accent-ink` (17 text + 2 `file:` + 1 bg) |
| `--primary` (`:58`) | **delete**, 0 uses | — | none |
| `--primary-foreground` (`:59`) | **delete**, 0 uses | — | none |
| `--secondary` (`:60`) | **delete**, 0 uses | — | none |
| `--secondary-foreground` (`:61`) | **delete**, 0 uses | — | none |
| `--danger` (`:64`) | keep, new values | `--danger` | none |
| `--success` (`:65`) | **rename** | `--ok` | `*-success*` → `*-ok*` (`text-success` 7, `bg-success/10` 1, `border-success/25` 1, `bg-success` 1, plus `ui/Badge.tsx:12`). The tints become `bg-ok-bg` when Badge is rebuilt (§4) |
| `--sidebar` (`:70`) | keep, new value | `--sidebar` | none |
| `--sidebar-foreground` (`:71`) | **rename** | `--sidebar-fg` | `text-sidebar-foreground` → `text-sidebar-fg` |
| `--sidebar-muted` (`:72`) | **rename** | `--sidebar-text` | `text-sidebar-muted` → `text-sidebar-text` |
| `--sidebar-subtle` (`:73`) | **rename** | `--sidebar-label` | `text-sidebar-subtle` → `text-sidebar-label` (5) |
| `--sidebar-border` (`:74`) | keep, new value | `--sidebar-border` | none |
| `--radius` (`:77`) | **delete** | — | §1.6 |
| — | **new** | `--input-bg`, `--border-strong`, `--track`, `--chip-bg`, `--ok-bg`, `--paper`, `--warning`, `--warning-bg`, `--focus`, `--sidebar-active`, `--sidebar-active-ink`, `--sidebar-badge`, `--sidebar-badge-ink`, `--sidebar-focus` | — |

### 1.4 Contrast

Computed with the WCAG 2.x relative-luminance formula. AA requires **4.5:1** for normal text and **3:1** for UI-component edges (SC 1.4.11).

**Text (all 00 values):**

| Pair | Light | Dark | AA text |
|---|---|---|---|
| `--text` on `--bg` / `--surface` / `--surface-2` | 17.56 / 19.68 / 18.35 | 17.10 / 15.99 / 15.04 | pass |
| `--muted` on `--bg` / `--surface` / `--surface-2` | 5.99 / 6.72 / 6.26 | 7.58 / 7.09 / 6.67 | pass |
| `--muted` on `--chip-bg` / `--track` | 5.99 / 5.68 | 6.29 / 6.21 | pass |
| `--ok` on `--ok-bg` | **4.67** (narrow) | 8.28 | pass |
| `--danger` on `--surface` / `--bg` / `--surface-2` / `--chip-bg` | 6.57 / 5.87 / 6.13 / 5.87 | 6.43 / 6.88 / 6.05 / 5.71 | pass |
| `--accent-ink` on `--accent` | 13.54 | 13.54 | pass |
| sidebar item `#C9C9C5` on `#0B0B0B` | 11.85 | (fixed) | pass |
| sidebar badge `#E5E5E2` on `#1F1F1F` | 13.06 | (fixed) | pass |
| active badge `#FED217` on `#0B0B0B` | 13.54 | (fixed) | pass |

**Warning (PROPOSED).** Amber-brown in light and amber in dark, so it never reads as the brand yellow, which 00 reserves for "active / primary".

| Pair | Light `#8A4B00` | Dark `#F5B54A` | AA text |
|---|---|---|---|
| on `--warning-bg` | 5.99 (on #FCEFD9) | 9.00 (on #2A1E08) | pass |
| on `--surface` | 6.80 | 9.90 | pass |
| on `--bg` | 6.07 | 10.58 | pass |
| on `--surface-2` | 6.34 | 9.30 | pass |

**Non-text, against SC 1.4.11 (3:1). These are flags, not changes:**

| Pair | Light | Dark | Result |
|---|---|---|---|
| `--border-strong` (input edge) on `--surface` / `--input-bg` | **1.63** | **1.60 / 1.67** | **fails 3:1** → Q13 |
| `--accent` indicator (selected-row bar, active-tab underline) on `--surface` | **1.45** | 12.33 | fails in light. A second cue (a fill, or the 600-weight text) carries the state, so the yellow is not the only signal → Q14 |
| `--focus` on `--surface` | 19.68 | 15.99 | pass |

### 1.5 `tailwind.config.js` changes

Exact replacement. Lines cited are the current file. Tailwind is 3.4.17 (`frontend/package.json`), so the `selector` dark-mode strategy is available (it needs 3.4.1 or later).

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  // `dark:` matches when <html data-theme="dark">. Used sparingly: almost
  // everything themes through the variables below.
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    // REPLACES the theme (not extend): Barlow/Inter/JetBrains Mono ship 400–700,
    // so the DIN mapping of medium→400 (old :16-26) is gone.
    fontWeight: {
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
    // REPLACES the theme: square everywhere, and this is what neutralises
    // `rounded-full` (21 uses), which never followed --radius.
    borderRadius: {
      none: "0", sm: "0", DEFAULT: "0", md: "0", lg: "0",
      xl: "0", "2xl": "0", "3xl": "0", full: "0",
    },
    // REPLACES the theme: no elevation on cards or panels. Every existing
    // shadow-xs/sm/md/xl/2xl now generates nothing. One shadow for menus and
    // popovers. Its value is TBD (Q10); interim = the current `md`
    // (old :111) so menus look as they do today.
    boxShadow: {
      none: "none",
      menu: "0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)",
    },
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        field: "rgb(var(--input-bg) / <alpha-value>)",        // bg-field
        border: {
          DEFAULT: "rgb(var(--border) / <alpha-value>)",       // border-border
          strong: "rgb(var(--border-strong) / <alpha-value>)", // border-border-strong
        },
        text: "rgb(var(--text) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        track: "rgb(var(--track) / <alpha-value>)",
        chip: "rgb(var(--chip-bg) / <alpha-value>)",
        ok: {
          DEFAULT: "rgb(var(--ok) / <alpha-value>)",
          bg: "rgb(var(--ok-bg) / <alpha-value>)",
        },
        danger: "rgb(var(--danger) / <alpha-value>)",
        warning: {
          DEFAULT: "rgb(var(--warning) / <alpha-value>)",
          bg: "rgb(var(--warning-bg) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          ink: "rgb(var(--accent-ink) / <alpha-value>)",
          hover: "rgb(var(--accent-hover) / <alpha-value>)",
        },
        paper: "rgb(var(--paper) / <alpha-value>)",
        focus: "rgb(var(--focus) / <alpha-value>)",
        // Interim alias so the 17 `ring-ring/50` focus classes keep compiling
        // until batch 2 replaces them with outlines. Delete in batch 2.
        ring: "rgb(var(--focus) / <alpha-value>)",
        sidebar: {
          DEFAULT: "rgb(var(--sidebar) / <alpha-value>)",
          border: "rgb(var(--sidebar-border) / <alpha-value>)",
          fg: "rgb(var(--sidebar-fg) / <alpha-value>)",
          text: "rgb(var(--sidebar-text) / <alpha-value>)",
          label: "rgb(var(--sidebar-label) / <alpha-value>)",
          active: "rgb(var(--sidebar-active) / <alpha-value>)",
          "active-ink": "rgb(var(--sidebar-active-ink) / <alpha-value>)",
          badge: "rgb(var(--sidebar-badge) / <alpha-value>)",
          "badge-ink": "rgb(var(--sidebar-badge-ink) / <alpha-value>)",
        },
      },
      fontFamily: {
        heading: ['"Barlow"', "ui-sans-serif", "system-ui", "sans-serif"],
        body: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"], // = body; keeps `font-sans` meaningful
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: { /* §2.2 */ },
      // The px sizes 00 specifies that the default 4px grid lacks (16px root, §2.3).
      spacing: {
        4.5: "1.125rem",  // 18 — primary button horizontal padding
        6.5: "1.625rem",  // 26 — chip height
        8.5: "2.125rem",  // 34 — small ghost button, icon button, pagination squares
        10.5: "2.625rem", // 42 — toggle width
        70: "17.5rem",    // 280 — top-bar search
        95: "23.75rem",   // 380 — split-view list pane
      },
    },
  },
  plugins: [],
};
```

**What changes against the current file:**
- **Colours (`:32-66`):** removes `input`, `subtle`, `primary`, `secondary`, `success` and `accent.foreground`; adds the new keys above.
- **`ringColor` / `ringOffsetColor` (`:114-120`):** deleted, along with the other ring utilities.
- **`fontFamily` (`:71-81`):** DIN 2014 is gone.

**Radius:**
- **Arbitrary radii** that `borderRadius` cannot neutralise must be edited:
  - `ui/Highlight.tsx:25` (`rounded-[2px]`)
  - `ui/Toast.tsx:17` (`borderRadius: "0.75rem"`)
  - `ui/Toast.tsx:26-27` (`!rounded-md`): neutralised by the theme, but delete it anyway
- **Focus-ring exception.** 00 says the ring "follows the element". `outline` follows `border-radius`, so with every radius at 0 the ring is square too. Nothing is needed beyond using `outline`, not `box-shadow` rings.
- **Native checkboxes** keep a small UA-drawn radius under `accent-color` → Q27.

**Shadows:** the selected-row and active-nav bars are drawn with a `before:` pseudo-element (as `components/Layout.tsx:82-83` already does), not a shadow, so the `boxShadow` override does not affect them.

### 1.6 `index.css` token blocks

Exact replacement for `src/index.css:36-78`.

```css
:root,
[data-theme="light"] {
  --bg: 242 242 240;
  --surface: 255 255 255;
  --surface-2: 247 247 245;
  --input-bg: 255 255 255;
  --border: 227 227 223;
  --border-strong: 203 203 198;
  --text: 11 11 11;
  --muted: 92 92 88;
  --track: 236 236 234;
  --chip-bg: 242 242 240;
  --ok: 30 122 60;
  --ok-bg: 230 242 233;
  --danger: 180 35 24;
  --warning: 138 75 0;      /* PROPOSED — see §1.4 */
  --warning-bg: 252 239 217; /* PROPOSED */
  --focus: 11 11 11;
  color-scheme: light;
}

[data-theme="dark"] {
  --bg: 15 15 15;
  --surface: 23 23 23;
  --surface-2: 29 29 29;
  --input-bg: 18 18 18;
  --border: 42 42 42;
  --border-strong: 59 59 59;
  --text: 242 242 240;
  --muted: 163 163 160;
  --track: 35 35 35;
  --chip-bg: 34 34 34;
  --ok: 95 208 138;
  --ok-bg: 16 38 26;
  --danger: 249 112 102;
  --warning: 245 181 74;    /* PROPOSED */
  --warning-bg: 42 30 8;     /* PROPOSED */
  --focus: 242 242 240;
  color-scheme: dark;
}

/* Fixed in both themes. The dark block above must NEVER redefine these. */
:root {
  --accent: 254 210 23;
  --accent-ink: 11 11 11;
  --accent-hover: 240 196 15; /* kept from current, pending Q4 */
  --paper: 255 255 255;
  --sidebar: 11 11 11;
  --sidebar-border: 31 31 31;
  --sidebar-fg: 255 255 255;
  --sidebar-text: 201 201 197;
  --sidebar-label: 107 107 107; /* interim, TBD (Q6) */
  --sidebar-active: 254 210 23;
  --sidebar-active-ink: 11 11 11;
  --sidebar-badge: 31 31 31;
  --sidebar-badge-ink: 229 229 226;
  /* --sidebar-focus: TBD (Q5) */
}
```

---

## 2. Type scale

### 2.1 Root size: move from 110% to **100%** (recommended)

**Recommendation:** drop `html { font-size: 110% }` (`src/index.css:94`) and leave the root at the browser default (100%). It stays a percentage, so it still respects the visitor's own browser setting, which was the original reason for using a percentage (`:87-89`).

**Reasons:**
1. **00 specifies everything in px**: 40px buttons, 34px squares, 64px top bar, padding "32 40 28". At 100%, Tailwind's 4px grid **is** those numbers: `h-10` = 40, `h-16` = 64, `p-5` = 20, `pt-8 px-10 pb-7` = 32/40/28. At 110% every one of them comes out ×1.1 (44, 70.4, 22…), so matching the design would need `px` literals everywhere.
2. The 110% was a judgement made for DIN 2014 at a 16px body (`:82-93`). 00 sets a new body size (14px) for a new face (Inter), so that judgement no longer applies.
3. It removes the `0.909rem` "16px at a 17.6px root" workaround (`src/index.css:113`, `tailwind.config.js:94`), along with the class of bug it caused (CLAUDE.md: `mt-3` = 13.2px).

**Knock-on:**

| What | Today (110%) | After (100%) | Action |
|---|---|---|---|
| 1rem | 17.6px | 16px | everything rem-based shrinks by about 9%, as intended |
| `body` font size | `0.909rem` = 16px | `0.875rem` = 14px (00: body 14px) | rewrite `index.css:113` and the `body` token |
| **12px paragraph contract** (`ui/RichTextEditor.tsx:116`, `components/RichHtml.tsx`, the widget's `.saeh-prose p + p`) | `mt-[12px]` = 12px | **`mt-[12px]` = 12px, unchanged** | keep the px literal. `mt-3` would now also be 12px, but a literal does not depend on the root, so leave it. The widget is not affected (it has its own CSS) |
| Description editor content headings `[&_h2]:text-base`, `[&_h3/h4]:text-sm` (`ui/RichTextEditor.tsx:117-119`) | 17.6 / 15.4px | 16 / 14px | content preview, not interface chrome. Leave on Tailwind's defaults (§2.4) |
| Sidebar width `w-[17rem]` (`Layout.tsx:37-38`, `ProductSaveBar.tsx:48`) | 299px | 272px | 00 gives no width: **TBD (Q6)**. Keep the rem value until then |
| Product thumbnail `h-[100px] w-[100px]` (`Products.tsx:349, 426, 429`) | 100px | 100px | becomes 56px with Thumb (§4) |
| Compatible spacer `h-[38px]` vs Input `h-9` (`CompatibleProductsSection.tsx:202`) | 38 vs 39.6 | 38 vs 36 | becomes 40 when Input is 40px. Tie the spacer to the Input height |
| Fixed px values (lucide `size=`, `WebsiteEditor.tsx:46` 200×160, `Model3DPreview.tsx:61` 220px) | unchanged | unchanged | none |
| `scroll-mt-20 lg:scroll-mt-4` (`pages/Media.tsx:211`) | 88 / 17.6px | 80 / 16px | re-check against the 64px top bar in batch 4 |
| CLAUDE.md "Type/layout scale" paragraph | describes 110% | — | replaced (§2.6) |

### 2.2 One scale

There are five size tokens, and those are the only sizes 00 uses (11, 12, 13, 14, 36). Roles are **recipes**: a family, size, weight, tracking, case and colour, defined once in `@layer components`. This means:
- A size never comes with an ad-hoc letter-spacing or uppercase.
- tailwind-merge only has to know five font-size names (§7).

```js
// tailwind.config.js → theme.extend.fontSize (rem at a 16px root)
fontSize: {
  title: ["2.25rem", { lineHeight: "1.05", letterSpacing: "-0.01em" }], // 36 — H1
  body:  ["0.875rem", { lineHeight: "1.5" }],                          // 14
  help:  "0.8125rem",                                                  // 13 — help, chips, codes
  label: "0.75rem",                                                    // 12 — labels, overlines, table heads, codes
  micro: "0.6875rem",                                                  // 11 — segment counts, "New" chip
},
```

**Line height.** 00 gives line height only for the H1 (1.05) and body (1.5). The other tokens therefore set **no** line height and inherit body's 1.5 → **TBD (Q7)**.

```css
/* src/index.css → @layer components. One class per 00 type role. */
.t-h1       { @apply font-heading text-title font-bold; }                                        /* 36/700, lh 1.05, -0.01em */
.t-section  { @apply font-heading text-body font-semibold uppercase tracking-[0.09em]; }         /* 14/600 caps .09em */
.t-overline { @apply font-heading text-label font-semibold uppercase tracking-[0.14em] text-muted; } /* 12/600 caps .14em */
.t-body     { @apply font-body text-body; }                                                      /* 14/400 (500 = font-medium) */
.t-label    { @apply font-body text-label font-semibold tracking-[0.02em] text-muted; }          /* 12/600 .02em */
.t-help     { @apply font-body text-help text-muted; }                                           /* 13 */
.t-th       { @apply font-body text-label font-semibold text-muted; }                            /* 12/600, on surface-2 */
.t-code     { @apply font-mono text-help; }                                                      /* 13 — SKU, slug in rows */
.t-code-sm  { @apply font-mono text-label; }                                                     /* 12 — counts, kbd, page numbers */
```

00 gives codes as "12–13px". Which contexts take 12 and which 13 is **TBD (Q7)**. The split above is the interim.

### 2.3 Body defaults

`src/index.css` `body` rule (`:103-115`) becomes:

```css
body {
  background-color: rgb(var(--bg));
  color: rgb(var(--text));
  font-family: "Inter", ui-sans-serif, system-ui, sans-serif;
  font-weight: 400;
  font-size: 0.875rem; /* 14px — matches the `body` token */
  line-height: 1.5;
}
h1, h2, h3, h4, h5, h6 { font-family: "Barlow", ui-sans-serif, system-ui, sans-serif; }
```

**Global focus rule** (replaces `:130-133`):

```css
:focus-visible { outline: 2px solid rgb(var(--focus)); outline-offset: 2px; }
```

`html { font-synthesis: none }` (`:97`) **stays**. A weight that is not loaded renders at the nearest loaded weight instead of being faked.

### 2.4 Mapping every current size to the new roles

Counts are `.tsx` uses, from 01 §1.2 / 01 §2.

| Current | px today | Uses | → New | Notes |
|---|---|---|---|---|
| `text-display` | 39.6 | 1 (`UIShowcase.tsx:64`) | `.t-h1` | showcase only |
| `text-h1` | 26.4 | 4 (`ui/PageHeader.tsx:23`, `Products.tsx:210`, `CategoryDetail.tsx:240`, `UIShowcase.tsx:65`) | `.t-h1` | through PageHeader (§4) |
| `text-xl` | 22 | 8: page h1s (`Quotes.tsx:170`, `ResourceRequests.tsx:170`, `Translations.tsx:547`, `Users.tsx:67`, `Security.tsx:119`, `Media.tsx:172`, `Logos.tsx:250`, `Widgets.tsx:605`) | `.t-h1` | through PageHeader |
| `text-lg` | 19.8 | 3: `Status.tsx:51` h1, `ui/Spinner.tsx:36`, `ui/Button.tsx:110` | `.t-h1` (Status) / **icon size** (the other two) | the glyph sizes become lucide `size` |
| `text-2xl` | 26.4 | 2: `ProductDetail.tsx:96` h1, `ui/EmptyState.tsx:25` icon | editor header name **TBD (Q7)** / icon size | |
| `text-h2` | 22 | 17: auth card titles (`Login.tsx:131, 178`, `ForgotPassword.tsx:43`, `ResetPassword.tsx:118`), `RouteError.tsx:32`, 12× `UIShowcase` | auth **TBD (Q15)**; RouteError and showcase → `.t-section` | |
| `text-h3` | 19.8 | 6: `ui/Card.tsx:90` (CardHeader), `ui/Modal.tsx:152`, `ui/EmptyState.tsx:26`, `Layout.tsx:314` (brand), `WebsiteEditor.tsx:160`, `UIShowcase.tsx:67` | CardHeader → `.t-section`; Modal title and EmptyState title **TBD (Q7)**; brand → lockup (§4 Sidebar); WebsiteEditor → `.t-section` | |
| `text-base` | 17.6 | 3: `RichTextEditor.tsx:117` (content), `Button.tsx:110` and `Products.tsx:293` (× glyphs) | content: keep / glyphs: icon size | |
| `text-body` | 16 | 55 | `text-body` (14) | same name, new value. A mechanical no-op |
| `text-sm` | 15.4 | 53 | `text-body` (14) | mechanical |
| `text-small` | 14 | 107 | `text-help` (13) | mechanical. Then review sites where it is primary content (`SelectMenu` items and trigger, xs `Input`) → `text-body` |
| `text-xs` | 13.2 | 49 | `text-label` (12) | mechanical. `ui/Badge.tsx:31` → chip 13 (`text-help`). The `uppercase tracking-wide` label pairs (Quotes `:60, 95`, ResourceRequests `:55, 90`, Translations `:150, 167`, AssignPickList `:213`) → `.t-overline` or `.t-label` |
| `text-[10px]` | 10 | 1 (CompatibleProducts `Thumb`) | `text-micro` (11) | |
| `uppercase` + `tracking-*` | — | 23 + 12 | through `.t-section`, `.t-overline` or `.t-label` only | no free-standing tracking |
| `font-medium` | **400** (DIN map) | 32 | **500** | ⚠️ visibly heavier. Review each use in batch 2 |
| `font-semibold` | 600 | 121 | 600 | none |
| `font-bold` | 700 | 2 | 700 | Inter is loaded at 400/500/600 only, so Inter bold renders at 600 (`font-synthesis: none`). Barlow has 700 |
| `font-normal` | 400 | 1 | 400 | none |
| `font-mono` (Tailwind default stack) | — | 3 (`DescriptionSection.tsx:75`, `Translations.tsx:179`, `CategoryDetail.tsx:286`) | JetBrains Mono | automatic through `fontFamily.mono` |

### 2.5 Font loading (`index.html`)

**Remove** the Typekit block (`index.html:20-26`) and the widget-only Google Fonts block (`:28-40`). **Replace** them with:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Barlow:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
/>
```

⚠️ **The `/widgets` previews also use Barlow 400 and Inter 700.** The generated `WIDGET_CSS` has 2 Barlow-400 and about 2 Inter-700 rules (`pages/Widgets.tsx:9-325`). With the link above they render at the nearest loaded weight, so the previews drift from the live widget. Google Fonts downloads a weight's file only when text uses it, so adding `Barlow:wght@400;…` and `Inter:wght@…;700` costs nothing on dashboard pages → **Q12**.

**Also in this step:**
- **CSP** (`vercel.json:50`, report-only today): remove `https://use.typekit.net` from `style-src` and `font-src`. Google Fonts is already allowed.
- `ui/Toast.tsx:20`: change the font family to `"Inter", sans-serif`, or drop it and inherit.
- The file-type icon label (`ui/FilePreview.tsx:62`, `system-ui`): leave it. It is SVG artwork.

### 2.6 CLAUDE.md typography paragraph (replacement text)

This replaces the `Font:` sentence in **Tech stack → Frontend**, the "⚠️ The Adobe Fonts link…" paragraph, and the "**Type/layout scale**" paragraph:

> - **Fonts** (redesign, 2026-10): **Barlow** for headings (500/600/700), **Inter** for body (400/500/600) and **JetBrains Mono** for codes, SKUs, slugs, counts and page numbers (400/500). All three load from **Google Fonts** through the single `<link>` in `frontend/index.html` (`display=swap`). DIN 2014 and the Adobe Fonts/Typekit link are gone, along with that subscription dependency. `tailwind.config.js` maps `font-heading`/`font-body`/`font-mono`, and `fontWeight` is the standard 400/500/600/700, so `font-medium` is a real 500 again. `font-synthesis: none` stays: a weight that is not loaded renders at the nearest loaded one rather than a fake bold. The dashboard went through IBM Plex Sans, Montserrat, a dark/sharp/ClashGrotesk pass and DIN 2014 before this. Check `index.css`, `tailwind.config.js` and `index.html` before assuming any of them.
>
> **Type/layout scale:** the root is the browser default (**100%**, no `font-size` on `html`). The redesign specifies sizes in px, and at 16px Tailwind's 4px grid is those px values (`h-10` = 40, `h-16` = 64). Body text is **14px** (`text-body`, `0.875rem`). There is **one** type scale: `text-title` 36, `text-body` 14, `text-help` 13, `text-label` 12, `text-micro` 11. The roles (`.t-h1`, `.t-section`, `.t-overline`, `.t-label`, `.t-help`, `.t-th`, `.t-code`) are defined once in `index.css`. Use a role, never a raw size with a free-standing `tracking-*` or `uppercase`. Tailwind's own sizes (`text-xs`…`text-2xl`) are not used in interface chrome. ⚠️ **The 12px paragraph spacing stays a px literal (`mt-[12px]`)**, in `RichTextEditor`, `RichHtml` and the widget's `.saeh-prose`. ⚠️ `lib/cn.ts`'s tailwind-merge config must list every custom `fontSize` key, or it mistakes a size for a colour (see the redesign spec §7).

---

## 3. Theme mechanism

### 3.1 Where the theme lives

- **`data-theme="light" | "dark"` on `<html>`.** Modals (`ui/Modal.tsx:130`), menus (`ui/DropdownMenu.tsx:125`, `ui/SelectMenu.tsx:226`) and sonner all portal to `<body>`, which is inside `<html>`, so they theme with no extra work.
- **Static default:** `<html lang="en" data-theme="light">` in `index.html:2`. If the script below is blocked, the page is still light.

### 3.2 Pre-paint script (`index.html`)

Placed in `<head>` **before** any stylesheet `<link>`. It is one line, so its CSP hash is stable:

```html
<script>try{document.documentElement.dataset.theme=localStorage.getItem("hub-theme")==="dark"?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}</script>
```

- **Fallback:** anything other than `"dark"`, an error, or blocked storage → light (00).
- **CSP.** `vercel.json:50` is `Content-Security-Policy-Report-Only` with `script-src 'self' https://cdn.jsdelivr.net`. That **reports** this inline script, and would **block** it once the policy is enforced. Add its hash to `script-src`. Computed over the exact bytes between the tags:

  ```
  'sha256-VvALtx+apqPU5SeMipzS/pi4pDQcvi3opnTb5j+KBVA='
  ```

  Any edit to the script, whitespace included, changes the hash. Recompute with `printf '%s' '<script body>' | openssl dgst -sha256 -binary | openssl base64 -A`.
- **Alternative:** the same code as a same-origin blocking file (`frontend/public/theme-init.js`, loaded with `<script src="/theme-init.js"></script>` and no `async`). This needs no hash, but costs one extra request before first paint.

### 3.3 Code (new `frontend/src/lib/theme.ts`)

```ts
import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
/** Pre-paint copy, read by the inline script in index.html. Keep the two in step. */
export const THEME_STORAGE_KEY = "hub-theme";
/** Account copy, in Supabase user_metadata through useUserPreference. */
export const THEME_PREFERENCE_KEY = "theme";

export function readTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** Apply now and refresh the pre-paint copy. Storage can throw (private mode, blocked site data). */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* the attribute is set; only the next first paint is affected */
  }
}

function subscribe(onChange: () => void) {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

/** The theme as rendered. Follows any change to <html data-theme>. */
export function useDocumentTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => "light");
}
```

And in `hooks/useUserPreference.ts`, alongside `useHideCommerceFields` (`:65-67`):

```ts
/**
 * The account's theme. `null` means never chosen, which keeps whatever the
 * pre-paint copy applied. A value from the account wins once the session
 * resolves, so a choice made on one computer reaches the others.
 */
export function useThemePreference() {
  const pref = useUserPreference<Theme | null>(THEME_PREFERENCE_KEY, null);
  useEffect(() => {
    if (pref.value === "light" || pref.value === "dark") applyTheme(pref.value);
  }, [pref.value]);
  const setTheme = (t: Theme) => {
    applyTheme(t); // instant, and refreshes the pre-paint copy
    void pref.setValue(t); // optimistic account write. On failure it reverts with a toast (:41-46), and the effect re-applies the old theme
  };
  return { theme: useDocumentTheme(), setTheme, saving: pref.saving };
}
```

### 3.4 How it syncs

| Moment | What happens |
|---|---|
| First paint, any page (login included) | the inline script applies `localStorage["hub-theme"]`, otherwise light |
| After sign-in (session resolves) | `useThemePreference()`, **called once in `Layout`** so it runs on every authenticated page, sees the account's `theme` and applies it if set. A different choice made on another computer causes one flip on the first load. That is accepted |
| Toggle in the top bar | `setTheme(t)`: the attribute, `localStorage` and the account write, in that order |
| Sign-out | `localStorage` is kept, so the login page stays in the user's theme |
| Account never chose | `null`; nothing is written until the user toggles |

⚠️ **The toggle writes to the live Supabase auth record** of the signed-in user (`supabase.auth.updateUser`, `useUserPreference.ts:41`). It is harmless, but it is a real write. See §8 on live data.

### 3.5 Sonner

`ui/Toast.tsx:11` `theme="light"` becomes `theme={useDocumentTheme()}`. The `Toaster` mounts in `main.tsx:16`, outside the router, which is fine because `useDocumentTheme` needs no context.

Its inline `style` (`:14-22`) already uses the variables for background, border and text, so those follow the theme. Change these:
- `borderRadius` → `"0"`
- `boxShadow` → `"none"`. Toasts are cards; whether they count as popovers is **Q10**.
- `fontFamily` → Inter or inherit

Add `warning` and `info` to `classNames` (`:23-31`), so `toast.warning` (used by translate-on-save) is not left on sonner's defaults.

### 3.6 The sidebar stays dark

- The sidebar uses **only** `--sidebar-*`, `--accent` and literal white/black overlays (`Layout.tsx:34-35, 84-86`). None of these is in the dark block (§1.6), so a theme switch cannot reach it.
- Add `color-scheme: dark` on the `<aside>` and the mobile drawer (`Layout.tsx:372-381, 408`), so the sidebar's own scrollbar is dark in light theme. The global `scrollbar-color: rgb(var(--subtle))` (`index.css:140-142`) becomes `--muted` and would otherwise follow the main theme.
- **Focus inside the sidebar.** `--focus` follows `--text`, which is `#0B0B0B` in light theme: **invisible** on the `#0B0B0B` sidebar. The sidebar overrides it with `--sidebar-focus` → **TBD (Q5)**.

### 3.7 `--paper` surfaces

These become `bg-paper`. They stay white in dark mode (00):

| Surface | Today | Change |
|---|---|---|
| File preview box | `ui/FilePreview.tsx:99` `bg-white` | `bg-paper` |
| Product thumb tile | `components/ProductThumb.tsx:12` `bg-white` | replaced by `Thumb` (§4) on paper |
| Usage dialog product thumb | `components/UsagePill.tsx:166` `bg-white` | `Thumb` |
| 2FA QR | `pages/Security.tsx:179` `bg-white` | `bg-paper`. Must stay white or scanning may fail |
| Widget preview box | `pages/Widgets.tsx:642` `bg-white` | `bg-paper` |
| Logos tile, replace-confirm tiles | `pages/Logos.tsx:61`, `:182-190` `bg-surface-2` | `ImageWell` on paper |
| Media tiles | `pages/Media.tsx:315-322` | `ImageWell` |
| Logo toggle cards | `components/LogoActivationPanel.tsx:75` | `ImageWell` |
| Product gallery card | `components/product/ImageCard.tsx:28` | `ImageWell` |
| Category thumbnails, image tile | `pages/Categories.tsx:418-424`, `pages/CategoryDetail.tsx:327-357` | `Thumb` / `ImageWell` |
| Pick-list thumbs | `components/product/AssignPickList.tsx:242` | `Thumb` |
| Compatible thumbs | `components/product/CompatibleProductsSection.tsx:35-47` | `Thumb` |
| Media picker tiles (no box today) | `components/MediaPicker.tsx:169-174` | `ImageWell` |
| Products list thumbnail | `pages/Products.tsx:416-430` | `Thumb` 56px (00) |
| 3D model preview | `components/product/Model3DPreview.tsx:76` `bg-surface-2` | **TBD (Q24)** (00 lists image, logo, PDF, QR and widget previews only) |

The SA logo SVG has its own `#fff` rectangle (`src/assets/saequip-logo.svg`). It is replaced in the sidebar by the 00 lockup. The auth pages are **Q15**.

---

## 4. Component spec

**Conventions for every component:**
- **Sizes** are px from 00, followed by the Tailwind class at a 16px root (§2.1).
- **Focus** is always the global outline (§2.3). Components stop using `outline-none` with `ring-[3px] ring-ring/50` (`Button.tsx:27-28`, `Input.tsx:10` and 15 other places).
- **Corners and shadows:** radius 0 everywhere (§1.5). There are no shadows except `shadow-menu` on menus.
- **Hover states:** 00 gives a hover only for rows (`--surface-2`). Every other hover is **TBD (Q4)**. The interim is the current hover classes, re-pointed to the new tokens.
- **APIs** stay as they are unless a reason is given.

### 4.1 Existing components (`components/ui/*`)

**Button** (`Button.tsx:61-76`)
- **Purpose:** the button.
- **API:** unchanged (`variant`, `size`, `loading`, plus native button props).
- **Variants:**

  | Variant | Spec |
  |---|---|
  | `primary` | 00 primary: `bg-accent text-accent-ink border border-accent font-semibold`, Inter 14/600 |
  | `secondary` | **renamed in docs as "ghost"**, but the prop value stays `secondary` (30 files use it). Transparent, `border border-border-strong text-text` |
  | `ghost` | the current text-only ghost (`:37`): transparent, no border, `text-muted` |
  | `danger` | **TBD (Q11)**. Not in 00 |

- **Sizes:**

  | Size | Spec |
  |---|---|
  | `md` | h40 (`h-10`), padding 0 18 (`px-4.5`) |
  | `sm` | h34 (`h-8.5`) "small ghost". Horizontal padding **TBD (Q11)** |
  | `xs` | kept as an alias of `sm`. 00 has no third size |

- **New prop:** `icon` (boolean) gives a 34×34 square (`h-8.5 w-8.5 p-0`), the 00 icon button.
- **States:**
  - hover TBD (Q4)
  - focus-visible: the outline
  - disabled: `opacity-50 pointer-events-none` (unchanged, `:29`)
  - loading: Spinner plus `disabled` (`:68-72`)
- **Dark:** the primary is identical; ghost uses the tokens.
- **a11y:** an `icon` button **requires** `aria-label`. Enforce it in dev with a `console.warn`.

**RemoveButton** (`Button.tsx:87-119`)
- **Becomes:** an `icon` ghost button with an `X` icon (lucide).
- **Sizes:** `md` 34 (`h-8.5 w-8.5`); `sm` 24, kept for use inside chips. 00 does not give 24 → TBD (Q11).
- **Hover:** `text-danger`.
- **a11y:** callers should pass a specific `title`, such as "Remove EX Heater", not the default "Remove" (01 §3.1).

**Input / Field / Textarea / Select** (`Input.tsx`, `Textarea.tsx`, `Select.tsx`)
- **Field box:**
  - h40 (`h-10`), padding 0 12 (`px-3`)
  - `bg-field border border-border-strong text-text placeholder:text-muted`
  - no shadow
  - focus: the outline (00: "2px outline in --text with a 2px offset")
- **Sizes:** today `xs`, `sm` and `md` are all 32–36px (`Input.tsx:29-33`). 00 gives one height, 40.
  - Keep the `size` prop so the API holds: `md` = 40.
  - `sm` and `xs` = 34 (`h-8.5`), for dense toolbars. Is 34 acceptable for inputs? **Q11**.
- **Error:** `aria-invalid="true"` → `border-danger` (keep the `aria-[invalid=true]` selector, `:11`).
- **`Field`** (`:50-80`):
  - label → `.t-label`; hint → `.t-help`; error → `.t-help text-danger`
  - **New:** Field gives its child `aria-invalid` and `aria-describedby` (hint or error id) through `cloneElement`, or exposes `{ id, describedBy, invalid }` for the caller to spread. Today an error is not tied to its input (01 §3.1).
- **Textarea:** the same box, `min-h-16`, padding 8 12.
- **Select:** a native select plus the chevron (`Select.tsx:35-47`), unchanged in principle.

**Checkbox** (`Checkbox.tsx`)
- 16×16. 00: "accent-color #FED217".
- ⚠️ A native checkbox with `accent-color` keeps the browser's own corner radius and tick, which conflicts with "square… including checkboxes" → **Q27**.
- **Interim:** keep the current custom `appearance-none` box (`:35`), squared: checked → `bg-accent border-accent`, tick in `text-accent-ink`.
- **a11y:** unchanged (a real input inside a label).

**Toggle** (`Toggle.tsx`)
- 42×24 (`w-10.5 h-6`), square, with a square knob.
- **On:** `bg-accent`, with a border that is `border-accent-ink` in light and `dark:border-accent` in dark.
- **Off:** `bg-surface-2 border-border-strong`. 00 gives the off background only, so the border is TBD (Q11).
- **a11y:** `role="switch"` (`:27`) stays. **Require** `label` or `aria-label`: an unlabelled toggle is unnamed today (01 §3.1).

**Badge / StatusBadge → Chip** (`Badge.tsx`)
- **Box:** h26 (`h-6.5`), padding 0 10 (`px-2.5`), 13px (`text-help`).
- **API:** keep `<Badge tone>` (23 files). `tone` maps to the 00 chips:

  | Tone | 00 chip |
  |---|---|
  | `success` → `ok` | `text-ok bg-ok-bg`, plus a 7px square dot `before:` (`before:h-[7px] before:w-[7px] before:bg-ok`) |
  | `neutral` | `text-muted bg-chip border border-border` |
  | `solid` (new) | `bg-text text-surface` |
  | `new` (new) | `bg-accent text-accent-ink`, Barlow 11 uppercase (`font-heading text-micro uppercase`) |
  | `danger` | **TBD (Q2)**. Needed for the KEEP fault chips (§6) |
  | `accent` | **retired**: yellow is only for active/primary/New. Its uses (Unsaved, Primary, "Yes", "Missing") are re-toned in **Q9** |

- **`StatusBadge`:** ACTIVE → `ok` "Live", HIDDEN → `neutral` "Hidden". The label text changes too, because 00 calls them Live/Hidden.
- **a11y:** the dot is decorative. State is in the text.

**Card / CardHeader / SectionError / AccordionBodyProvider** (`Card.tsx`)
- **Card:** `bg-surface border border-border`, no shadow, no radius.
- **`padded`:** padding TBD → the current `p-5` is 20px at 100%, matching the 00 header's horizontal 20.
- **CardHeader:**
  - its own row: padding 16 20 (`py-4 px-5`), `border-b border-border`, title `.t-section`
  - **footer** (new `CardFooter`): `bg-surface-2 border-t border-border`, padding as the header
  - Because the header is now a bordered row, **Card's padding moves to a `CardBody`** (`p-5`). `padded={false}` keeps its meaning.
- **AccordionBodyProvider context:** keep it unchanged (`:14-18`). The product-editor tabs need the same "bare" behaviour (§4.2 Tabs).
- **SectionError:** becomes `<Alert tone="danger">`. It still renders nothing inside the provider.

**AccordionCard** (`AccordionCard.tsx`)
- **Kept for the transition only.** The product editor moves to Tabs in batch 8. Its last users then are `CategoriesSection` and `AccessorySection`, which 00 turns into right-panel cards (Visibility, Categories).
- **Delete it after batch 8.**
- Until then: square, no shadow, header `.t-section`, Unsaved/Error chips per Q9/Q2. Behaviour (`:42-49`, `:91-99`) is untouched.

**Table / THead / TBody / TR / TH / TD** (`Table.tsx`)
- **Table:** wrapper `border border-border bg-surface`. Removes `rounded-lg` (`:16`).
- **THead:** `bg-surface-2`, cells `.t-th`. `sticky` works only if the wrapper is not the scroll container; see the note below.
- **TR:**
  - rows: padding 10–14 20 → `py-2.5 px-5` (default) or `py-3.5` (`comfortable` prop)
  - **1px top border** (`border-t border-border`) replaces `border-b … last:border-0` (`:73`)
  - hover → `bg-surface-2`
  - **New `selected` prop:** `bg-surface-2` plus a 3px yellow left bar (`relative before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-accent`) plus `aria-selected="true"` (the caller decides the role).
  - Keep the "ignore clicks starting on a control" rule (`:80`).
- **TH/TD:** `px-5`. TD text is `text-body`.
- **Sticky header fix.** `THead sticky` sits inside `overflow-x-auto` (`:16`), which makes the wrapper the scroll container, so it never sticks (01). Add `Table` prop `scroll="x" | "none"` (default `x`); sticky is supported only with `none`.
- **a11y:** a clickable row still needs a real control in a cell (`:57-61`).

**Modal / ConfirmProvider / useConfirm** (`Modal.tsx`)
- **Panel:** `bg-surface border border-border`, square. Shadow **TBD (Q10)**. Backdrop `bg-black/40` (`:133`) kept → Q10 for dark mode.
- **Header:**
  - title role **TBD (Q7)**
  - **a close button is added**: icon button 34, `aria-label="Close"`, top right. Today there is none (01 §3.1).
- **Footer:** `bg-surface-2 border-t` (the 00 card footer).
- **a11y:**
  - **`title` becomes required**, or `aria-label` is passed instead. The untitled Quotes/ResourceRequests modals go away with SplitView anyway.
  - Focus trap, stack, restore and scroll lock (`:41`, `:78-126`) are kept exactly.
- **ConfirmProvider:** unchanged API. The confirm button uses the Q11 danger style.

**Toaster** (`Toast.tsx`)
- §3.5: theme-aware, square, the shadow per Q10, and `warning`/`info` classNames added.

**FileDropzone** (`FileDropzone.tsx`)
- **Box:** square, dashed `border-border-strong`, `bg-surface`. While dragging: `border-accent bg-accent/10`, which is "active", so yellow is allowed.
- **Progress bar:** square, `bg-accent`; danger on error.
- **a11y:** wrap the per-file status list in `aria-live="polite"`.

**SortableList / DragHandle** (`SortableList.tsx`)
- **Unchanged behaviour:** the per-list `DndContext` (`:138`) and the inline dnd-kit styles (`:84-90`).
- **DragHandle:** the 34 icon button (`h-8.5 w-8.5`), `text-muted`, square.
- **New prop:** `itemLabel(item)`, so each handle is named "Drag EX Heater to reorder", not the generic "Drag to reorder" (`:50`).

**EmptyState** (`EmptyState.tsx`)
- `border border-dashed border-border bg-surface`, square.
- The title role is **TBD (Q7)**. The heading level becomes a prop, `as="h2" | "h3"` (default `h3`).

**Highlight** (`Highlight.tsx`)
- `bg-accent text-accent-ink`, square. Remove `rounded-[2px]` (`:25`).

**FilePreview / FileTypeIcon** (`FilePreview.tsx`)
- The box becomes `bg-paper` (`:99`). The `FileTypeIcon` artwork is unchanged (it sits on paper).

**Spinner / Loader** (`Spinner.tsx`)
- Unchanged; `currentColor`.
- **Loader** gains `role="status" aria-live="polite"`.

**Skeleton** (`Skeleton.tsx`)
- `bg-surface-2`, square. Keep `animate-pulse`. Add `motion-reduce:animate-none`.

**PageHeader** (`PageHeader.tsx`)
- `bg-surface border-b border-border`, padding 32 40 28 (`pt-8 px-10 pb-7`).
- H1 `.t-h1`, with a one-line description `.t-help`. 00 says "muted description", and the size is TBD (Q7).
- **Actions** on the right, primary last.
- **Layout:** the header is **full-bleed** across the content column, so it moves out of Layout's padded container (§4.2 Layout).
- **API:** unchanged (`title`, `description`, `actions`). New optional `overline` (breadcrumb group).

**Pagination** — rebuilt; see §4.2.

**DropdownMenu** (`DropdownMenu.tsx`)
- **Visual:** trigger is a 34 icon button; panel `bg-surface border border-border shadow-menu`, square.
- **a11y:** fix the keyboard model, modelled on SelectMenu (`SelectMenu.tsx:35-40, 86-142`):
  - on open, focus moves to the first enabled `menuitem`
  - ArrowUp/Down/Home/End move between items
  - Escape closes and returns focus to the trigger
  - Tab closes
  - type-ahead jumps by label

  Today focus stays on the trigger and the items sit at the end of `<body>` (01 §3.1).
- **New prop:** `label` should be passed per row, for example "Actions for EX Heater".

**SelectMenu** (`SelectMenu.tsx`)
- **Trigger:** the field box (h40 / 34 by `size`, new prop).
- **List:** `shadow-menu`, square.
- Its combobox keyboard model (`:86-142`) is the reference implementation. **Keep it exactly.**

**RichTextEditor** (`RichTextEditor.tsx`)
- **Container:** the field box.
- **Toolbar buttons:** 34 squares. Active → `bg-accent text-accent-ink` (an active state, so yellow is allowed).
- **Focus:** add a focus indicator on the editing surface. `focus:outline-none` (`:95`) removes it today. Put the 2px `--focus` outline on the container with `focus-within`.
- **Link input** (`:275-288`): becomes `<Input aria-label="Link URL">`.
- **The `[&_p+p]:mt-[12px]` contract stays byte-identical** (`:116`).

### 4.2 New components

**SegmentedControl** (`ui/SegmentedControl.tsx`)
- **Purpose:** the theme toggle, the Products status tabs, rows per page, the Media file-type tabs, and the Quotes/Resources All/New/Handled tabs (00).
- **API:**

  ```ts
  <SegmentedControl<T extends string>
    value: T; onChange(v: T): void;
    options: { value: T; label: ReactNode; count?: number; disabled?: boolean }[];
    ariaLabel: string;
    size?: "md"; />
  ```

- **Visual:**
  - container `bg-track p-1 gap-1 inline-flex`
  - segments h32 (`h-8`), `px-3`
  - selected: `bg-accent text-accent-ink font-semibold`
  - others: `bg-transparent text-muted`
  - `count` inside the segment, `.t-code` at 11px (`font-mono text-micro`)
- **States:** hover on unselected segments TBD (Q4); focus via the outline on the focused segment; disabled `opacity-50`.
- **a11y:**
  - `role="radiogroup"` with `aria-label`; segments `role="radio" aria-checked`
  - roving `tabIndex`: only the checked segment is tabbable
  - ArrowLeft/Right and Up/Down move **and select**; Home/End
  - The count is part of the accessible name ("Live, 88").

**Tabs** (`ui/Tabs.tsx`)
- **Purpose:** product-editor tabs (00: underline style). Also replaces the hand-built tabs in Translations (`Translations.tsx:596-615`).
- **API:**

  ```ts
  <Tabs value?: string defaultValue?: string onValueChange?(v: string): void
        keepMounted?: boolean | "visited">     // default "visited"
    <TabList aria-label: string>
      <Tab value="overview" count?: number indicator?: "dirty" | "error" | null>Overview</Tab>
    </TabList>
    <TabPanel value="overview">…</TabPanel>
  </Tabs>
  ```

  - **Controlled** (`value` with `onValueChange`, for example synced to `?tab=`), or **uncontrolled** (`defaultValue`).
  - **`keepMounted="visited"`** mounts a panel the first time it is shown, then keeps it mounted and hidden (the `hidden` attribute). This fixes the side effects of AccordionCard unmounting, while avoiding mounting all 16 sections up front (01 §5.1):
    - `CompatibleProductsSection` refetching on each mount (`:83-91`)
    - the model-viewer being rebuilt
    - lost search state
  - `true` mounts all panels; `false` mounts the active panel only.
- **Visual:**
  - full-width row with a `border-b border-border`
  - tab: `.t-body` in `text-muted`
  - active: `text-text font-semibold`, with a 3px yellow bottom bar (`after:` pseudo, `after:h-[3px] after:bg-accent`)
  - `count` in mono (`.t-code-sm`)
  - **indicator dot:** error → `bg-danger`; dirty → **TBD (Q8)**. Dot size TBD (Q8); 00 shows a "dot" only
- **a11y:**
  - `role="tablist"`; `role="tab"` with `aria-selected`, `aria-controls` and roving `tabIndex`
  - ArrowLeft/Right, Home/End; **automatic activation**
  - panel: `role="tabpanel"`, `aria-labelledby`, `tabIndex={0}`
  - **The indicator is in the accessible name**: visually hidden "(unsaved changes)" or "(error)". A dot alone is colour-only
- **Product-editor wiring (batch 8):**
  - a tab's indicator is the **aggregate** of its sections' `dirty[key]` and `saveErrors[key] ?? validationErrors[key]`, including the shared keys `details` and `logos` (01 §5.1)
  - each `TabPanel` wraps its sections in `AccordionBodyProvider` (renamed `BareSectionProvider`), so the section Cards drop their chrome as they do now
  - save-bar anchors (`ProductSaveBar.tsx:82-90`) **switch to the owning tab first**, then scroll to `#section-*`

**Alert / Callout** (`ui/Alert.tsx`)
- **Purpose:** the one box for errors, notices and warnings. It replaces 22+ hand-rolled boxes (§5).
- **API:**

  ```ts
  <Alert tone: "danger" | "warning" | "info" | "ok" title?: ReactNode
         action?: ReactNode live?: "assertive" | "polite" | "off">children</Alert>
  ```

- **Visual:** **TBD (Q2)**. 00 defines no alert. Only token-based options are allowed; the warning tokens are PROPOSED (§1.4).
- **a11y:**
  - `tone="danger"` defaults to `role="alert"`; the others to `role="status"`; `live="off"` gives a static notice
  - Today most error boxes have neither (01 §5).
- **Inside a bare section** it renders nothing for the section-error use. This keeps `SectionError`'s behaviour (`Card.tsx:108-111`) through a `section` prop.

**Thumb / ImageWell** (`ui/Thumb.tsx`)
- **Purpose:** every product, category and logo thumbnail and image tile. It replaces 7 variants (§5).
- **API:**

  ```ts
  <Thumb src?: string | null alt?: string size: 24 | 36 | 48 | 56 | number
         fit?: "contain" | "cover"  // default "contain"
         fallback?: "box" | "image" | ReactNode />
  <ImageWell src … aspect?: "square" | "4/3" className />  // larger tiles; same internals
  ```

- **Visual:**
  - `bg-paper border border-border`, square; the image is `object-contain` by default
  - **Products uses 56** (00), with a lucide `Package` "box icon" fallback
  - **`onError` → fallback** (00: "with an onError fallback"). `Products.tsx:416-430` has none today
  - `loading="lazy" decoding="async"`
- **a11y:** decorative by default (`alt=""`). Pass `alt` when the image is the only content of a control: `CategoryDetail.tsx:351-358` has an unnamed image button (01 §5.6).

**SplitView / ListDetail** (`ui/SplitView.tsx`)
- **Purpose:** Quote requests and Resource requests (00).
- **API:**

  ```ts
  <SplitView
    list: ReactNode            // the left pane's content (toolbar + rows)
    detail: ReactNode | null   // null → empty state
    emptyDetail?: ReactNode
    listLabel: string />
  useSelection(param = "id"): { selectedId: string | null; select(id: string | null): void }
  ```

  `useSelection` reads and writes `?id=` with `useSearchParams` and `{ replace: true }`, following `Translations.tsx:361-373`. A selection is deep-linkable and survives reload and Back.
- **Layout:**
  - the left pane is about 380px (`w-95`, fixed); the right pane takes the rest
  - **both panes scroll independently** (`overflow-y-auto min-h-0`). The SplitView fills the viewport height below the top bar and page header (`h-[calc(100dvh-…)]`, or a flex column from Layout, preferred)
  - **Layout opt-out from `max-w-6xl`** (`Layout.tsx:423`): a route `handle: { layout: "full" }` in `App.tsx`. Layout reads it with `useMatches()` (the data router is already required, `App.tsx:29-35`)
- **Rows:**
  - each row is a `<Link to="?id=…">` (or a button) styled as a `TR selected` row
  - the selected row has `aria-current="true"`
- **Focus:** on select, focus moves to the detail heading (`<h2 tabIndex={-1}>`, then `focus({ preventScroll: true })`). The heading role is TBD (Q7).
- **Responsive below lg:** **TBD (Q23)**. 00 does not say.
- **States:**
  - the list keeps the current skeleton, error and empty patterns (`Quotes.tsx:194-241`)
  - detail with no selection → `emptyDetail`
  - an `id` not in the list → "Not found" in the detail pane, with the list untouched
- **a11y:**
  - list pane `<nav aria-label={listLabel}>`, or a section with a heading
  - detail `<section aria-labelledby>`
  - no focus trap: it is not a dialog

**Pagination (rebuilt)** (`ui/Pagination.tsx`)
- **API:**

  ```ts
  <Pagination
    page: number; total: number;
    pageSize: 20 | 50 | "all" | number;     // number keeps server-paged callers (Media 24, MediaPicker 12)
    onPageChange(p: number): void;
    onPageSizeChange?(s: 20 | 50 | "all"): void;  // absent → no rows-per-page control
    pageSizeOptions?: (20 | 50 | "all")[];        // default [20, 50, "all"]
    label?: string;                               // "products"
  />
  usePagedList<T>(items: T[], { defaultPageSize = 20, resetKeys: unknown[] })
    → { pageItems, page, setPage, pageSize, setPageSize, total, pageCount }
  ```

  - **Backward compatibility:** the old props (`pageCount`, `onChange`) are accepted for one batch through a shim, so Media, MediaPicker and Translations keep working (01 §5a.3).
- **Visual (00):**
  - **left:** "Showing 1–20 of 91 products"
  - **middle:** "Rows per page" SegmentedControl 20 / 50 / All
  - **right:** prev/next arrow buttons (34 square, bordered) and numbered pages (mono, 34 square; the current page is yellow `bg-accent text-accent-ink`)
  - **many pages:** first, last and neighbours, with `…` in `text-muted`. Media has about 20 pages. The style is not in 00 (minor, Q26)
- **Behaviour:**
  - **changing the page size resets to page 1**
  - `usePagedList` also resets on any `resetKeys` change (search, tab, filters, sort) and clamps the page when `total` shrinks (`Translations.tsx:405, 428-429` is the precedent)
  - **renders when `total > 0`**. The old `pageCount <= 1 → null` (`:23`) would hide the size picker on "All", so it goes
- **a11y:**
  - `<nav aria-label="Pagination">`
  - current page `aria-current="page"`
  - arrows `aria-label="Previous page"` / `"Next page"`, with no "←"/"→" glyphs read aloud
  - the "Showing…" line is `aria-live="polite"`
- **Client-side:** this is everything Products needs for about 91 rows. Keep the CSV export on the **filtered** set, not `pageItems` (01 §5a.3).

**TopBar** (`components/TopBar.tsx`, rendered by Layout)
- **Visual:** h64 (`h-16`), `bg-surface border-b border-border`.
- **Left:** breadcrumb "Group / Page", from the route `handle: { group, title }`. The page is `.t-body font-semibold`; the group is `text-muted`, with a link if the group has a page.
- **Centre/right:** search field, 280 wide (`w-70`, field box), with a `⌘K` hint (`.t-code-sm` in a bordered 20px box; size TBD). What it searches is **TBD (Q20)**.
- **Right:** Light/Dark `SegmentedControl` bound to `useThemePreference()` (§3.3).
- **Below lg:** a menu button for the sidebar drawer, plus the breadcrumb page only. Search collapses (TBD Q20/Q23).
- **a11y:**
  - `<header>` landmark; breadcrumb `<nav aria-label="Breadcrumb">` with `aria-current="page"`
  - search: `role="search"` with a labelled input
  - ⌘K focuses the search; Escape blurs it

**Sidebar** (`components/Layout.tsx`, restyled; not a ui/ primitive)
- **Visual:**
  - `bg-sidebar border-r border-sidebar-border`, `color-scheme: dark`
  - items: `text-sidebar-text`; active `bg-sidebar-active text-sidebar-active-ink`
  - this **replaces** today's yellow tint, edge bar and accent icon (`Layout.tsx:79-86`)
  - square
- **Lockup:** a yellow block with black "SA", then "SA Equip / Product Hub" in `text-sidebar-fg`. Sizes are TBD (Q6).
- **Groups (00):**
  - Website editor
  - **Catalogue:** Products, Categories, Product options, Media, Logos, Translations
  - **Enquiries:** Quote requests, Resource requests
  - **Admin:** Users, Security

  Group labels use the `.t-overline` shape in `text-sidebar-label` (colour TBD, Q6).
- **What goes:**
  - the collapsible Products group and its animation (`:130-266`): 00 groups are headings, not disclosures
  - **Status** from the nav. The route stays reachable by URL, like `/widgets` (Q16)
- **Badges:** `bg-sidebar-badge text-sidebar-badge-ink`; on the active item `bg-sidebar-active-ink text-accent`. Which items and which counts is **TBD (Q6/Q17)**.
- **Account row:** kept (`:328-355`). Square initials avatar.
- **a11y:**
  - `nav aria-label="Main"`
  - active link `aria-current="page"` (NavLink does this)
  - the mobile drawer gains Escape, a focus trap and a scroll lock: use `Modal`'s mechanics, or the shared `useDialog` extracted from `Modal.tsx:78-126`

**Layout container**
- **Main column:**
  - `max-w-6xl` (`Layout.tsx:423`) goes for pages that opt out (`handle.layout === "full"`)
  - otherwise, content padding is 32 40 56 (`pt-8 px-10 pb-14`), cards stacked with `gap-5` (00)
- **Order:** TopBar, then the page's `PageHeader` (full-bleed), then content.
- **Sidebar width:** one source. Export `SIDEBAR_W` / `MAIN_OFFSET` and use them in `ProductSaveBar.tsx:48` instead of the third copy (01 §4).

---

## 5. Duplicate → component mapping

Each line of 01 §3.2, mapped to its replacement.

| Duplicate | Where (file:line) | Replaced by |
|---|---|---|
| **Error / alert boxes** | `Quotes.tsx:231`, `ResourceRequests.tsx:209`, `Translations.tsx:161, 193, 302, 659`, `Users.tsx:74`, `Security.tsx:125`, `WebsiteEditor.tsx:136`, `Products.tsx:372`, `Categories.tsx:265`, `CategoryDetail.tsx:221`, `ProductOptions.tsx:277`, `Media.tsx:286`, `Logos.tsx:291`, `ProductDetail.tsx:84-88`, `Login.tsx:154, 219`, `RouteError.tsx:37-39`, `product/ProductDetailsSection.tsx:41-45`, `product/CompatibleProductsSection.tsx:128-132`, `product/AssignPickList.tsx:158`; also the notice boxes `OptionsSection.tsx:139`, `VariationsSection.tsx:61`, `DescriptionSection.tsx:57`, `TranslationProgressModal.tsx:91` | `Alert` (danger / warning / info) |
| **Page headers** | `Quotes.tsx:169-190`, `ResourceRequests.tsx:169-177`, `Translations.tsx:546-579`, `Users.tsx:67-70`, `Status.tsx:51`, `Security.tsx:119-122`, `Products.tsx:209-240`, `CategoryDetail.tsx:239-250`, `Media.tsx:172-175`, `Logos.tsx:249-255`, `Widgets.tsx:605-608` | `PageHeader` |
| Product editor header | `ProductDetail.tsx:93-136` (a Card) | 00 "header card": a Card with the name, status chip and Save. Not PageHeader (Q28) |
| **Tabs / segmented** | `Translations.tsx:596-615` (tablist) | `Tabs` |
| | `Translations.tsx:581-594` (language pills) | `SegmentedControl` (00: "language buttons (counts)") |
| | `Media.tsx:212-226`, `Logos.tsx:258-270` (kind pills) | `SegmentedControl` (Media file-type tabs) / `Tabs` (Logos "SA range / Certification" tabs, 00) |
| | `product/DescriptionSection.tsx:36-51` (Rich/HTML) | `SegmentedControl` |
| **Modal** | `components/MediaPicker.tsx:55-201` (hand-built overlay) | `Modal size="lg"` |
| **Inputs** | `SpecTableEditor.tsx:83-84` (`inputCls`), `TextItemListEditor.tsx:58-65`, `Logos.tsx:57`, `OptionsSection.tsx:196-206`, `Media.tsx:193-198`, `RichTextEditor.tsx:275-288` | `Input` (with `aria-label` where there is no visible label) |
| | file inputs `Media.tsx:184-189`, `MediaPicker.tsx:72-78` | `FileDropzone`, or a `Button` triggering a visually hidden labelled `<input type=file>` |
| **Primary buttons** | `Media.tsx:200-206`, `Logos.tsx:93, 251`, `MediaPicker.tsx:79-85` | `Button variant="primary"` |
| **Text buttons** (Preview / Delete / Remove / Clear) | `Media.tsx:359-366, 375-380`, `DownloadsSection.tsx:188-208`, `CompatibleProductsSection.tsx:161-184, 225-232`, `AssignPickList.tsx:163-169, 272-278`, `Products.tsx:288-296, 382-391` | `Button variant="ghost" size="sm"` / `RemoveButton` |
| **Cards** | `Media.tsx:180, 277, 314`, `Logos.tsx:60`, `product/ImageCard.tsx:21`, `Login.tsx:129, 176`, `ForgotPassword.tsx:42`, `ResetPassword.tsx:117`, `Security.tsx:168` (card in a Card), `ResourceRequests.tsx:91` | `Card` (the auth pages per Q15) |
| | `WebsiteEditor.tsx:144-149` (EmptyState inside a Card) | `EmptyState` alone |
| **Badges / pills** | `UsagePill.tsx:7`, `ProductOptions.tsx:316-337` (value chips), `ProductOptions.tsx:455-467` (Badge in a button), `Products.tsx:457` ("no longer in Duda") | `Badge` (chip tones). A clickable chip is a `Button size="sm"` containing the count |
| | `VariationCountMeter.tsx:24-32` | `Badge` with a `t-code` count (00: "2 of 20") |
| | `ProductSaveBar.tsx:82-90` (failed pills) | `Badge tone="danger"` as a link (Q2) |
| | `Status.tsx:56` (dot) | — (the page leaves the nav; restyle with the `Badge` ok/danger dot if kept) |
| | `OptionsSection.tsx:177-190` (choice chips) | `Toggle`-like chip: `Badge` inside a `button` with `aria-pressed` |
| **Thumbnails** | `ProductThumb.tsx`, `Products.tsx:416-430`, `CompatibleProductsSection.tsx:35-47`, `UsagePill.tsx:166`, `AssignPickList.tsx:242`, `Categories.tsx:418-424`, `CategoryDetail.tsx:327-333` | `Thumb` |
| **Label / value "Detail"** | `Quotes.tsx:56-64`, `ResourceRequests.tsx:51-59` (identical); `formatDate` `:10-18` in both | a shared `DefinitionGrid` inside `SplitView` detail (00 "two-column definition grid"), plus `lib/format.ts` |
| **Switch** | `LogoActivationPanel.tsx:86-92` | `Toggle` |
| **Loading text** | `ProtectedRoute.tsx:14-18`, `Users.tsx:79` | `Loader` / `Skeleton` |

---

## 6. Marker policy applied

**Codes:**
- **REMOVE** — a readiness or completeness nag, per the 00 policy.
- **KEEP-S** — save-flow state.
- **KEEP-C** — a confirmation (with its usage counts).
- **KEEP-V** — field validation.
- **KEEP-F** — a real fault.
- **CONTENT** — information that is not a marker (a status, count, empty state or hint). Kept and restyled.
- **FLAG** — does not fit cleanly; see the note and Q25.

Restyling still applies to everything kept: chips per §4, `Alert` instead of hand boxes, and no yellow except active/primary.

### Shell, ProductDetail and the editor sections (01 §5.1)

| Marker | Where | Decision |
|---|---|---|
| Load-error box | `ProductDetail.tsx:84-88` | KEEP-F (`Alert`) |
| "loaded HH:MM", stale tooltip, disabled "refresh" | `ProductDetail.tsx:99-117` | CONTENT. It is the concurrency guard (CLAUDE.md, no optimistic locking) |
| Status, stock and type badges | `ProductDetail.tsx:124-126` | CONTENT → Live/Hidden chip |
| Accordion summary counts | `ProductDetail.tsx:170…339` | CONTENT → tab counts (mono) |
| Error / Unsaved badges; body SectionError | `AccordionCard.tsx:88, 95` | KEEP-S → tab indicator and section `Alert` |
| Save bar: "Saving…", "N unsaved sections", "All changes saved", failed pills | `ProductSaveBar.tsx:55-92` | KEEP-S |
| Save-bar validation line | `ProductSaveBar.tsx:73-77` | KEEP-V |
| Duplicate Unsaved badges in section headers | `ImagesSection.tsx:70`, `OptionsSection.tsx:123`, `VariationsSection.tsx:52`, `LogoActivationPanel.tsx:47`, `Model3DSection.tsx:37`, `DownloadsSection.tsx:94`, `CompatibleProductsSection.tsx:124`, `SpecTableEditor.tsx:100`, `TextItemListEditor.tsx:37`, `ProductDetailsSection.tsx:38`, `DescriptionSection.tsx:35` | **REMOVE the duplicates**. The tab indicator and save bar carry the state (KEEP-S); these are second copies |
| Duplicate counts | `VariationsSection.tsx:53`, `LogoActivationPanel.tsx:48`, `SpecTableEditor.tsx:94-99` | REMOVE (duplicates of the tab counts) |
| Details error box | `ProductDetailsSection.tsx:41-45` | KEEP-S (`Alert`) |
| Field hints (status, compare-at, quantity, slug "changes the live URL") | `ProductDetailsSection.tsx:68, 106, 119-123, 167` | CONTENT (`.t-help`) |
| "Written elsewhere… will tidy the HTML" | `DescriptionSection.tsx:56-62` | FLAG: a data-safety notice, not a nag. Suggest KEEP as an `Alert tone="info"` |
| "No images yet" / "No 3D model uploaded yet." / "No downloads on this product yet." / "No specs. Add one below." / "No items. Add one below." / "No options on this product" / "No variations" | `ImagesSection.tsx:81-84`, `Model3DSection.tsx:62`, `DownloadsSection.tsx:106`, `SpecTableEditor.tsx:108`, `TextItemListEditor.tsx:43`, `OptionsSection.tsx:145-149`, `VariationsSection.tsx:67-75` | FLAG: neutral empty states, not warnings. Suggest CONTENT (neutral `EmptyState`) |
| "…has no usable URL" toast | `ImagesSection.tsx:56`, `CategoryDetail.tsx:424` | KEEP-V |
| "Primary" badge | `ImageCard.tsx:37-41` | CONTENT. Chip tone per Q9 |
| **"Pending upload"** | `ImageCard.tsx:42-46` | KEEP-F (named in 00) |
| "Couldn't load the 3D preview." | `Model3DPreview.tsx:68` | KEEP-F |
| "Saving this regenerates the variation list…" | `OptionsSection.tsx:138-143` | KEEP-S (consequence of a pending save) |
| "shared with N other products", "x of y values" | `OptionsSection.tsx:160-168` | CONTENT |
| "Select at least one value, or remove this option." | `OptionsSection.tsx:243-247` | KEEP-V |
| Detach confirm (lost SKUs) | `OptionsSection.tsx:59-73` | KEEP-C |
| VariationCountMeter "(limit N)", **"— over the limit"** | `VariationCountMeter.tsx:38-39` | KEEP-V (blocks save) |
| VariationCountMeter **yellow above 80%** | `VariationCountMeter.tsx:19-32` | FLAG: a near-limit warning. Yellow is not allowed here. Suggest the `--warning` tone, or remove it |
| Variations lock notice | `VariationsSection.tsx:60-65` | KEEP-S |
| Invalid Price Δ border | `VariationsSection.tsx:152-156` | KEEP-V (via `aria-invalid`) |
| AttachOptionModal "N / M options used" (danger at the cap, accent ≤3) | `AttachOptionModal.tsx:85-87` | KEEP-V at the cap. FLAG the accent "≤3 left" (yellow not allowed): suggest warning or neutral |
| "used by N products", disabled "Attached", cap `title`, "adds to the shared catalog" | `AttachOptionModal.tsx:120-160` | CONTENT. The cap reason moves out of `title` into visible help |
| "…already on this product." | `DownloadsSection.tsx:59, 103` | KEEP-V |
| `aria-invalid` on download fields, "Choose type…" | `DownloadsSection.tsx:135-168` | KEEP-V |
| **"File missing"** | `DownloadsSection.tsx:196-199`, `Media.tsx:367-373` | KEEP-F (named in 00) |
| Compatible load error | `CompatibleProductsSection.tsx:128-132` | KEEP-F |
| "N available", "Every other product has been added.", "Nothing added yet" | `CompatibleProductsSection.tsx:139-208` | CONTENT |
| "N selected (max)" | `CompatibleProductsSection.tsx:196` | KEEP-V (limit) |
| **"N selected items no longer exist (deleted in Duda)… Remove"** | `AssignPickList.tsx:157-171` | KEEP-F (named in 00) |
| "Only show selected", "N selected", "Clear all (N)" | `AssignPickList.tsx:172-279` | CONTENT |
| Danger zone card and "Will be deleted / kept", "Checking…" | `DangerZoneSection.tsx:81-141` | KEEP-C |
| "Doesn't match" | `DangerZoneSection.tsx:147` | KEEP-V |
| Empty spec/item borders | `SpecTableEditor.tsx:125, 142`, `TextItemListEditor.tsx:59-61` | KEEP-V |
| "Sub-heading — no value beside it." | `SpecTableEditor.tsx:130-134` | CONTENT (explains a row kind) |
| "No SA/Cert logos in the catalog yet — add some." | `LogoActivationPanel.tsx:53-60` | CONTENT (empty state) |
| MediaPicker upload and library errors | `MediaPicker.tsx:86, 139` | KEEP-F |
| UnsavedChangesModal | `UnsavedChangesModal.tsx:49-54` | KEEP-S |
| TranslationProgressModal statuses, "kept in English", needs-click | `TranslationProgressModal.tsx:5-102` | KEEP-S (save-flow progress) and KEEP-V ("kept in English" = validator refusal) |
| Toasts: "Fix the highlighted fields", partial or failed saves, variation drops | `useProductEditor.ts:313, 424-485, 706-715` | KEEP-S / KEEP-V |
| Toast "N translations kept in English" | `useTranslateOnSave.ts:66-71` | KEEP-V |
| **Readiness box** | — | Nothing to remove: **no readiness box exists** in the current code (grep for "readiness" finds nothing). 00's "No Readiness box" is already satisfied |

### ProductNew

| Marker | Where | Decision |
|---|---|---|
| "N created this session" | `ProductNew.tsx:109-113` | CONTENT |
| Field errors | `ProductNew.tsx:127, 146, 160` | KEEP-V (now with `aria-invalid` through Field) |
| "Added after it exists" panel | `ProductNew.tsx:261-291` | CONTENT |

### Quotes and Resource Requests

| Marker | Where | Decision |
|---|---|---|
| Error box | `Quotes.tsx:230-234`, `ResourceRequests.tsx:208-210` | KEEP-F |
| "—" placeholders | `Quotes.tsx:61, 88, 127, 128, 265`, `ResourceRequests.tsx:56, 103, 106, 233` | CONTENT |
| "Language: English" for a null locale (Resources) vs "—" (Quotes) | `ResourceRequests.tsx:75`, `Quotes.tsx:86-88` | FLAG: an inconsistency, not a marker. Suggest "—" for both |
| **"Since removed"** | `ResourceRequests.tsx:113-117` | FLAG: a historical fact (the download was deleted). Suggest KEEP-F |
| Marketing "Yes - opted in / No"; conditional English consent | `ResourceRequests.tsx:73, 82-86` | CONTENT |

### Products

| Marker | Where | Decision |
|---|---|---|
| Store headroom line "n / max products used · remaining" | `Products.tsx:248-253` | KEEP-F ("store product limit", 00 Products "Keep") |
| "— approaching the limit" (danger at ≤10 remaining) | `Products.tsx:93, 252` | FLAG: a near-limit warning. Suggest KEEP with the `--warning` tone, since danger implies a fault |
| "+ New product" disabled at the limit | `Products.tsx:226-238` | KEEP-F (named in 00) |
| **"N no longer in Duda"** | `Products.tsx:119-123, 456-460` | KEEP-F (named in 00) |
| "N categories" | `Products.tsx:450-453` | CONTENT (00 keeps it) |
| Empty and no-match states | `Products.tsx:376-393` | CONTENT |

### Categories and CategoryDetail

| Marker | Where | Decision |
|---|---|---|
| **Duda-count dot** ("Duda has N. Run duda:sync-categories…") | `Categories.tsx:445-450` | FLAG: real Hub/Duda divergence, but only a developer CLI can act on it, and it is hover-only. Suggest REMOVE from the staff UI (CLAUDE.md treats the sync as Kangaroo's job), or KEEP-F as visible text |
| `ImageOff` placeholder | `Categories.tsx:422`, `CategoryDetail.tsx:331, 359-362` | CONTENT (`Thumb` fallback) |
| Error, EmptyState, create-modal note | `Categories.tsx:264-282, 350-353` | KEEP-F / CONTENT |
| Delete confirm with subcategory count | `Categories.tsx:180-200` | KEEP-C |
| "Unsaved changes" | `CategoryDetail.tsx:242` | KEEP-S |
| Slug validation | `CategoryDetail.tsx:132-133, 385` | KEEP-V |
| "Stored in the Hub. Run duda:sync-categories…" | `CategoryDetail.tsx:296` | FLAG: same as the dot (a developer action in staff copy). Suggest REMOVE |
| "No subcategories yet.", "N products", image note, URL hint, hints | `CategoryDetail.tsx:265, 280, 317, 340, 365-375, 384` | CONTENT |

### ProductOptions

| Marker | Where | Decision |
|---|---|---|
| "{count} of {max} options used", "+ Add Option" disabled at the cap | `ProductOptions.tsx:256-273` | KEEP-F (a store limit, like products) |
| **Red danger "0 products"** | `ProductOptions.tsx:447-449` | REMOVE the danger tone: an unused option is not a fault (a nag). Keep the count as CONTENT ("product count", 00) |
| Chip tooltips "Offered by N / Not used by any product" | `ProductOptions.tsx:323` | CONTENT |
| Last-value guard tooltip and toast | `ProductOptions.tsx:163-165, 329-330` | KEEP-V |
| Delete value/option confirms, rename count | `ProductOptions.tsx:170-226, 366-370` | KEEP-C |
| Lost-variation toasts | `ProductOptions.tsx:49-61` | KEEP-S (save outcome) |
| Error, EmptyState | `ProductOptions.tsx:276-294` | KEEP-F / CONTENT |

### Media and Logos

| Marker | Where | Decision |
|---|---|---|
| "Used N×" / "Used by N" | `Media.tsx:43-51`, `Logos.tsx:82-87` | CONTENT (00: "Used by" list / count) |
| **"· Unused"** with its tooltip | `Media.tsx:53-64` | FLAG: a usage fact, but the tooltip explains a tracking gap. Suggest CONTENT as plain "Unused", and drop the `cursor-help` emphasis |
| Per-tile delete errors "Can't delete: used on N…" | `Media.tsx:161-167, 382` | KEEP-C (00: "Delete is disabled while the file is in use", which replaces the error with a disabled button and the reason) |
| Upload and library errors | `Media.tsx:207, 285-289` | KEEP-F |
| "alt: …" line | `Media.tsx:352` | CONTENT |
| Delete confirm "may be used on the live website" | `Media.tsx:132-138` | KEEP-C |
| "Save label/alt" (dirty) | `Logos.tsx:92-96` | KEEP-S |
| Replace confirm (before/after, count), delete confirm | `Logos.tsx:177-204, 224-235` | KEEP-C |

### Translations

| Marker | Where | Decision |
|---|---|---|
| Status chips: Missing / Machine / Edited / **Kept in English** | `Translations.tsx:56-59, 720` | 00 rows show a "Machine/Edited chip". FLAG: **"Missing"** is a completeness state but is the page's purpose (the filter). Suggest CONTENT as a neutral chip with no yellow. **"Kept in English"** = validator refusal → KEEP-V |
| Status-filter counts; "Translate missing (N)" | `Translations.tsx:570-572, 649-653` | CONTENT (the page's function) |
| "Shown in English" placeholder | `Translations.tsx:716` | CONTENT |
| "The machine translation was kept in English: {lastError}." | `Translations.tsx:160-164` | KEEP-V |
| Numbers/marks safety note; "Not saved: {problem}." | `Translations.tsx:188-196` | KEEP-V |
| Names tab "Nothing copied… / N still in English in Duda" | `Translations.tsx:310-316` | FLAG: a completeness notice about Duda's state. Suggest CONTENT (info `Alert`), since it explains why names show in English |
| **"English changed since"** | `Translations.tsx:333-337` | FLAG: a staleness fault. Suggest KEEP-F |
| Error boxes, toasts | `Translations.tsx:302, 659`; `:265-281, 436-528, 751` | KEEP-F / KEEP-S |

### Users, Security, Website editor, Status, auth

| Marker | Where | Decision |
|---|---|---|
| **"Unconfirmed"** (danger) | `Users.tsx:101-105` | FLAG: an account state that blocks sign-in. Suggest KEEP-F |
| Two-factor On/Off; Duda editor Yes/— | `Users.tsx:108-116` | CONTENT (00: two-factor chip, Duda editor chip) |
| "never" last sign-in | `Users.tsx:16` | CONTENT |
| Security On/Off badge; turn-off confirm | `Security.tsx:100-106, 138` | CONTENT / KEEP-C |
| Website "Published / Not published / Unknown" | `WebsiteEditor.tsx:22-29, 161-163` | CONTENT (00: Published chip) |
| "No editor access yet…" | `WebsiteEditor.tsx:145-148` | CONTENT |
| Status page dot and labels | `Status.tsx:38-68` | moot: the page leaves the nav (Q16) |
| Auth error alerts | `Login.tsx:154-159, 219-224` etc. | KEEP-V / KEEP-F |

---

## 7. `cn()` change

### 7.1 Implementation

- **Dependency:** `tailwind-merge@^2.6` in `frontend/package.json`. ⚠️ **It must be major version 2.** Version 3 targets Tailwind v4, and this project is on Tailwind **3.4.17**. The npm registry lists 2.6.1 as the latest v2.

```ts
// frontend/src/lib/cn.ts
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge resolves conflicts (the later class wins), so a className
 * passed to a ui/ component can override its base class deterministically.
 * Before, cn() was a plain join and the winner was stylesheet order.
 *
 * ⚠️ FONT_SIZES must list every custom key in tailwind.config.js `fontSize`.
 * tailwind-merge cannot tell `text-body` (a size) from `text-muted` (a colour)
 * on its own. It would class both as text colours and silently DROP one of
 * them whenever they meet.
 */
const FONT_SIZES = ["display", "h1", "h2", "h3", "body", "small"]; // stage 3 PR 0.2
// After the type-scale PR (§2.2): ["title", "body", "help", "label", "micro"]

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: FONT_SIZES }],
      // Added with the boxShadow change (§1.5). Without it `shadow-menu` is
      // read as a shadow COLOUR and would not replace `shadow-none`.
      shadow: [{ shadow: ["menu"] }],
    },
  },
});

/** Join conditional class names, resolving Tailwind conflicts. Falsy values are dropped. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return twMerge(...parts);
}
```

**What needs no config:**
- **Colours** (`bg-surface-2`, `border-border-strong`, `text-accent-ink`, `bg-ok-bg`): tailwind-merge v2's default `colors` theme accepts any value, so they group as colours.
- **Custom spacing** (`h-8.5`, `w-70`, `w-95`): they pass its number validator.
- **`font-heading`, `font-body`, `font-mono`:** they fall into `font-family`, because `font-weight` is an explicit list.
- **Radius:** all 0, so nothing.

**Acceptance check:**
- Write a script (in stage 3, kept under `frontend/scripts/`). It imports the configured `cn`, runs it over every static `className` passed to a `ui/` component and every literal `cn(...)` call in `src/`, and prints each class that tailwind-merge **removed**.
- The PR is accepted when every removed class is in the table below or explained.
- **Assert** that `FONT_SIZES` equals `Object.keys(tailwind.config.theme.extend.fontSize)`.

### 7.2 Overrides whose behaviour changes

"Today" is an inference from Tailwind's generated CSS order, where the later rule wins; it was not verified in a browser.

| Site | Classes | Today | After tailwind-merge |
|---|---|---|---|
| `product/VariationsSection.tsx:87` | `<Input className="w-28">` vs base `w-full` (`Input.tsx:8`) | `w-full` is emitted after `w-28`, so the bulk "Price Δ" input is **full width** | **`w-28` applies**: 112px, as written. Check the bulk bar layout |
| `product/VariationsSection.tsx:152-156` | `border-danger focus:border-danger` vs base `border-input`, `focus-visible:border-ring` | `border-danger` probably already wins (`danger` follows `input` in the colour order) | `border-input` is removed, so `border-danger` wins deterministically. `focus:` and `focus-visible:` are different variants and both stay. **Replace with `aria-invalid`** in batch 8 |
| `product/DangerZoneSection.tsx:81` | `<Card className="border-danger/40">` vs base `border-border` (`Card.tsx:42`) | uncertain (01): depends on the order opacity-modified colours are emitted | **`border-danger/40` applies** deterministically |
| `pages/Products.tsx:285` | `<Input className="pl-8 pr-7">` vs xs `px-2.5` | `pl`/`pr` are emitted after `px`, so they win | **No change.** tailwind-merge keeps `px-2.5` (a later `pl`/`pr` does not cancel an earlier `px`), and CSS order still favours `pl`/`pr`. Now intentional rather than lucky |
| `pages/Login.tsx:203` | `<Input className="pr-10">` | as above | **No change** |
| `pages/Translations.tsx:700, 706, 712, 719` | `<TD className="align-top …">` vs base `align-middle` (`Table.tsx:101`) | `align-middle` is emitted after `align-top`, so **the cells are middle-aligned despite `align-top`** | **`align-top` applies**: rows with multi-line English and translation top-align. A visible change, and the one the code meant |
| `product/AssignPickList.tsx:241` | `<Checkbox className="flex min-w-0 items-center gap-2">` vs base `inline-flex … gap-2.5` (`Checkbox.tsx:21`) | `inline-flex` and `gap-2.5` win (emitted later) | **`flex` and `gap-2` apply**: the label becomes a full-width row (needed for `min-w-0` truncation) with a 2px tighter gap. Check the category picker rows |
| `pages/Translations.tsx:179` | `<Textarea className="font-mono text-small">` vs base `text-body` | `small` follows `body` in `fontSize`, so `text-small` wins | **No change, but only with `FONT_SIZES` configured.** Without it, `text-small`, `text-body` and `text-text` all count as text colours and only the last survives, so the textarea loses its colour |
| TD colour overrides: `Products.tsx:439` (`text-muted`), `Quotes.tsx:128` (`text-subtle`), `Quotes.tsx:258`, `ResourceRequests.tsx:226`, `Users.tsx:114-115`, `VariationsSection.tsx:132, 134`, `ProductOptions.tsx:309`, `Translations.tsx:329` | colour vs TD base `text-body` | both apply | **No change with the config.** Without it, every such cell **loses `text-body`** (its font size) |
| Inside `ui/`: `Input`, `Select`, `Textarea` | `fieldBase` `text-text` + size `text-small` / `text-body` (`Input.tsx:8, 30-32`) | both apply | **No change with the config.** Without it, every Input loses `text-text` |
| Inside `ui/`: `Button` | base `gap-2` + size `gap-1` (xs) / `gap-1.5` (sm) (`Button.tsx:26, 55-56`) | `gap-2` is emitted after `gap-1` / `gap-1.5`, so **every button has an 8px gap** | **The size gap applies**: xs 4px, sm 6px between icon and label. Minor, and what the sizes intended. Moot once the Button is rebuilt (§4) |
| `pages/Logos.tsx:283`, `pages/Media.tsx:278` | `<Skeleton className="… rounded-lg">` vs base `rounded-md` | `lg` wins | `lg` wins. Moot at radius 0 |
| `pages/ResourceRequests.tsx:114` | `<Badge className="ml-auto shrink-0">` (duplicate `shrink-0`) | — | de-duplicated, no visual change |

**Not overrides.** These appeared in the scan but are classes on `footer=` or `actions=` children, not on the component, so tailwind-merge does not touch them:
- `Modal` at `TranslationProgressModal.tsx:60`, `UnsavedChangesModal.tsx:59`, `AttachOptionModal.tsx:84`, `DangerZoneSection.tsx:101`, `Categories.tsx:310`, `ProductOptions.tsx:372`, `Translations.tsx:126`, `UsagePill.tsx:102`
- `CardHeader` at `LogoActivationPanel.tsx:39`, `OptionsSection.tsx:114`, `SpecTableEditor.tsx:93`, `DownloadsSection.tsx:93`, `DescriptionSection.tsx:36`

`SortableList` uses its `className` instead of the default, not through `cn()` (`SortableList.tsx:148`), so it is unaffected.

---

## 8. Build plan for stage 3 onward

**Every step:**
- is one PR
- leaves the app shippable
- passes `npm run check` (pre-push: bundle check, `tsc` for both workspaces, doc refs, `widget:test`, `i18n:test`, `duda-ids:test`, `script-guards:test`, quote and distributor widget tests)
- passes the frontend build, which runs `assert-no-secrets`

**Checking both themes before the top bar exists** (batch 4): in the console, run `localStorage.setItem("hub-theme","dark"); location.reload()`, then the same with `"light"`.

> ⚠️ **Live data.** `npm run dev` runs the backend against the real `backend/.env`: the **live** Supabase database and the **live** Duda site `8a8f03b5`. **Any** save, upload, reorder, delete, translation edit or "Turn off two-factor" during a browser check is a production write.
> - Vercel Preview deployments share the production environment (CLAUDE.md), so the same applies there.
> - **Test writes only on a hidden product named `ZZ-AUDIT-DELETE-ME`.** Create it, test, then delete it, and check its Hub rows are gone.
> - **Never** reorder real categories or logos (a reorder is a write), run an option cascade, edit real translations, or press Save on a real product.
> - Steps marked **[LIVE-WRITE RISK]** below exercise write paths.

### Stage 3 — batches 0 and 1 (foundations; nothing page-specific)

**3.0 — Resolve the stage-3 blockers (decision, no code).** Answer the open questions that block foundations:
- Q3 (warning colour)
- Q4 (hovers, or at least the primary hover)
- Q5 (sidebar focus colour)
- Q12 (font weights)
- Q13 (input border contrast)

Everything else can wait until its batch.

**3.1 — `cn()` → tailwind-merge** (§7)
- **Files:** `frontend/package.json`, the lockfile, `src/lib/cn.ts`, new `frontend/scripts/cn-audit.mjs`.
- **Acceptance:**
  - the audit's removals match §7.2
  - the `FONT_SIZES` assertion passes
  - `tsc` and the build pass
- **Browser (light only; dark does not exist yet):** check each site in §7.2:
  - Variations bulk bar (open a product **read-only**)
  - Translations rows top-aligned (`/translations`)
  - category picker rows (product editor, read-only)
  - Danger zone border
  - buttons with icons
  - Login password eye
  - Products search icon and clear button

  Open pages only; press no Save.

**3.2 — Fonts** (§2.5, §2.6)
- **Files:** `frontend/index.html`, `tailwind.config.js` (`fontFamily`, `fontWeight`), `src/index.css` (body and heading families), `ui/Toast.tsx:20`, `vercel.json` (CSP: drop Typekit), `CLAUDE.md`.
- **Acceptance:** the Network panel shows no `use.typekit.net`; Barlow, Inter and JetBrains Mono load; the CSP report shows no new violations; `/widgets` previews are reviewed for weight drift (Q12).
- **Browser:** every page renders in Inter, with headings in Barlow.
- `font-medium` now renders at 500. Skim the 32 uses (01 §1.2) for anything that now reads as a heading.

**3.3 — Root 100% and the one type scale, part a: tokens and aliases**
- **Files:** `src/index.css` (`html` font-size deleted, body 14px, `.t-*` roles), `tailwind.config.js` (`fontSize`).
- **Temporary aliases**, removed in 3.4, so nothing is unmapped mid-way:

  | Old token | Alias to |
  |---|---|
  | `small` | `help` |
  | `h1` | `title` |
  | `h2`, `h3` | `body` |
  | `display` | `title` |

- **`lib/cn.ts`:** `FONT_SIZES` lists old and new.
- **Acceptance:** sizes match §2.4 in DevTools (body 14, `text-help` 13); the `mt-[12px]` editor spacing is unchanged; the `cn-audit` assertion passes.
- **Browser:** product editor description spacing, read-only.

**3.4 — Type scale, part b: the mechanical sweep**
- **Rewrite:**
  - `text-sm` → `text-body`
  - `text-xs` → `text-label`
  - `text-small` → `text-help`
  - `text-[10px]` → `text-micro`
  - page-title `text-xl`/`h1` → `.t-h1`
  - uppercase label pairs → `.t-overline` / `.t-label`
  - glyph sizes → lucide `size`
- Then delete the aliases and the old `FONT_SIZES` keys.
- **Files:** about 45 `.tsx` files (01 §2.7). Review the primary-content `text-small` sites (§2.4).
- **Acceptance:** `grep -rE "text-(xs|sm|lg|xl|2xl|small|h1|h2|h3|display)\b" src` returns only the editor-content exceptions (`RichTextEditor.tsx:117-119`).
- **Browser:** every page, light.

**3.5 — Colour tokens and the dark block** (§1.2–1.6)
- **Files:** `src/index.css` (the three blocks, global `:focus-visible`, `scrollbar-color` → `--muted`), `tailwind.config.js` (colours, `darkMode`), and the class renames from §1.3 (`border-input`, `*-subtle`, `*-accent-foreground`, `*-success*`, `*-sidebar-*`).
- **Interim:** the `ring` key aliases to `--focus`.
- **Acceptance:** no `text-subtle`, `accent-foreground` or `success` classes remain; the build passes.
- **Browser, both themes** via `localStorage`:
  - **light:** looks right everywhere
  - **dark:** the main panel switches and the **sidebar does not**. Known dark breakages are allowed until 3.7 (white tiles) and batch 2 (component internals), but **list them in the PR**.

**3.6 — Radius 0 and shadows** (§1.5)
- **Files:** `tailwind.config.js` (`borderRadius`, `boxShadow`), `ui/Highlight.tsx:25`, `ui/Toast.tsx:17, 26-27` (radius 0), `ui/DropdownMenu.tsx:142` and `ui/SelectMenu.tsx:246` (`shadow-md` → `shadow-menu`), `lib/cn.ts` (`shadow` group).
- **Acceptance:** `grep -r "rounded-\[" src` is empty; no `shadow-(xs|sm|md|lg|xl|2xl)` remains in the source; the `cn-audit` check passes.
- **Browser, both themes:** every corner is square, avatars and toggles included; menus keep a shadow; cards have none.

**3.7 — Theme mechanism and paper** (§3)
- **Files:** `index.html` (`data-theme` default and the pre-paint script), `vercel.json` (script hash), new `src/lib/theme.ts`, `hooks/useUserPreference.ts` (`useThemePreference`), `components/Layout.tsx` (call it; `color-scheme: dark` on the sidebar), `ui/Toast.tsx` (`theme`), plus the `bg-white` / well → `bg-paper` changes in §3.7.
- **No visible toggle yet.**
- **Acceptance:**
  - reload with `hub-theme=dark` shows **no light flash**, and the login page is dark too
  - a toast in dark is dark
  - a Modal, DropdownMenu and SelectMenu opened in dark are dark (portals)
  - the QR code, file previews and logo tiles stay white
  - the CSP report shows no inline-script violation (hash correct)
- **[LIVE-WRITE RISK, minor]:** none in this step, because nothing calls `setTheme` until the toggle exists (batch 4).

### Stage 4 onward (from 01 §7)

Each item is a PR. **Files** are the components listed. **Check:** both themes, the keyboard (Tab, arrows, Escape) and a screen-reader spot check, plus the step-specific checks below.

**Batch 2 — primitives.** Replace `ring` focus with the outline, delete the `ring` alias, and square up each component.
1. Button, RemoveButton (with the Q11 answers).
2. Input, Field (`aria-invalid` and `aria-describedby` wiring), Textarea, Select.
3. Checkbox, Toggle.
4. Badge → chip tones (Q2, Q9).
5. Card (Header, Body, Footer), SectionError → Alert (needs 6.2), EmptyState, Skeleton, Loader, PageHeader.
6. Table (`selected`, `scroll`, row borders).
7. Modal (close button, required title), ConfirmProvider. **[LIVE-WRITE RISK]:** check confirms only on the ZZ product.
8. DropdownMenu keyboard model; SelectMenu sizes.
9. Toast, FileDropzone, FilePreview, SortableList/DragHandle (item labels), Highlight.
10. RichTextEditor (focus-within outline, toolbar, link `Input`). Check that the 12px spacing is unchanged.

**Batch 3 — new primitives.**
1. SegmentedControl.
2. Alert, then sweep the 22+ boxes (§5).
3. Thumb / ImageWell, then sweep the 7 thumbnail variants.
4. Tabs (with `keepMounted="visited"` and indicators).
5. Pagination rebuild, `usePagedList` and the compatibility shim. Check Media, MediaPicker and Translations still page.
6. SplitView, `useSelection` and the route `handle.layout`.
7. MediaPicker → `Modal`. **[LIVE-WRITE RISK]:** it uploads. Pick only; do not upload, or upload a throwaway and delete it.

**Batch 4 — shell.**
1. Sidebar restyle and groups; drop Status from the nav (Q16).
2. TopBar with breadcrumb, search (Q20) and the **theme toggle**. **[LIVE-WRITE RISK, benign]:** toggling writes the signed-in user's Supabase `user_metadata`.
3. Layout container (`handle.layout`, content padding, a single sidebar width shared with `ProductSaveBar`); drawer Escape and focus trap.
4. ProtectedRoute and RouteError.

**Batch 5 — low-risk pages.** These are header, alert, chip and paper swaps.
1. Users (Q19).
2. Security. **[LIVE-WRITE RISK]:** never turn two-factor off on a real account.
3. Website editor (Q21).
4. Login, Forgot password and Reset password (Q15). Fix `text-accent-strong`. **[LIVE-WRITE RISK]:** a reset sends a real email.

**Batch 6 — split views** (Q17).
1. Quotes on SplitView with `?id=`.
2. Resource requests likewise, with detail derived from the list.

The New/Handled state needs a backend column and migration. **That is a production schema change: follow CLAUDE.md's migration rules exactly, and never use a shadow-database URL.**

**Batch 7 — catalogue pages.**
1. Products: status SegmentedControl, rows per page, numbered pages, 56px Thumb, chips (01 §5a, Q18).
2. Product options: value modal replaces `window.prompt`. **[LIVE-WRITE RISK]:** options are store-wide; **never delete an option or value on real data**, and never run a cascade.
3. Media: grid, detail panel, disabled delete. **[LIVE-WRITE RISK]**
4. Logos tabs and rows. **[LIVE-WRITE RISK]:** reorder and replace are writes.
5. Categories: grid, border bug, skeleton, share bar (Q22). **[LIVE-WRITE RISK]:** drag-reorder writes `CategoryOrder`; use a throwaway `ZZ-AUDIT-` category.
6. Category detail. **[LIVE-WRITE RISK]**
7. Translations. **[LIVE-WRITE RISK]:** an edit creates STAFF rows; do not save real translations.

**Batch 8 — product editor.** **[LIVE-WRITE RISK]:** the whole batch. **ZZ-AUDIT-DELETE-ME only.**
1. Tabs shell with indicator aggregation, an error home for logos and description, save-bar tab switching, `BareSectionProvider`, and the right panel (Visibility and Categories) (Q28). Remove the duplicate badges and counts (§6).
2. Restyle the sections: SpecTableEditor and TextItemListEditor `Input`s, OptionsSection chips, LogoActivationPanel `Toggle`, Compatible panes, SEO tab counters and Google preview.
3. ProductNew, including the missing unsaved-changes guard if wanted.
4. Delete `AccordionCard` and `ProductThumb`.
5. **ENDURE guard (Q1).**

**Batch 9 — tidy.**
1. Widgets page chrome. Leave `WIDGET_CSS` alone; the previews stay on paper.
2. UIShowcase: update it or delete it. ⚠️ Its dropzone uploads for real.
3. Stale comments: the `ui/index.ts` header, the DescriptionSection copy, the AssignPickList "Tags" note.

---

## Open questions

Each is marked with the step it blocks. **Bold** marks the ones that block stage 3 (§8, 3.0).

1. **ENDURE conflict guard** (batch 8). 00 says it "still blocks Save", but **no such guard exists**: there is nothing in `frontend/src` or in the backend routes. The SA ENDURE rule is enforced only after the fact by the `catalogue:phase5b` script (CLAUDE.md). Is it a new feature to build (client, server or both), or a misread?
2. **Danger background / fault chip / Alert style** (batch 2). 00 gives `--danger` but no `--danger-bg`, no danger chip variant and no alert/callout design. The KEEP fault chips need one: "No longer in Duda", "File missing", "Pending upload", "Unconfirmed", failed save pills. *Suggested:* `--danger` text on `--chip-bg` with a 1px `--danger` border for chips. For alerts: `--surface`, a 3px tone-coloured left bar, and the tone colour for icon and title.
3. **Warning colour sign-off** (stage 3). PROPOSED values in §1.4: light #8A4B00 on #FCEFD9, dark #F5B54A on #2A1E08. All pass AA.
4. **Hover states** (stage 3 for the primary button; batch 2 for the rest). 00 gives a hover only for rows (`--surface-2`). The primary button (current hover #F0C40F kept meanwhile), ghost button, segments, sidebar items, tabs and menu items need one.
5. **Focus colour inside the sidebar** (stage 3). `--focus` = `--text` is #0B0B0B in light theme, which is invisible on the #0B0B0B sidebar. *Suggested:* `--accent` (13.5:1 on #0B0B0B).
6. **Sidebar details** (batch 4):
   - group-label colour and style
   - item height, padding, hover and icons (kept?)
   - the size of the "SA" lockup block
   - sidebar width (17rem = 272px at the new root)
   - **which items carry badges, and what the counts are**
7. **Missing type roles** (batch 2):
   - modal title, empty-state title, product-editor header name, split-view detail heading, auth page titles
   - line heights for every role except H1 (1.05) and body (1.5)
   - which code contexts are 12px and which 13px
8. **Tab indicator** (batch 3): the colour of the **unsaved** dot (error is presumably `--danger`) and the dot size.
9. **Uses of the retired yellow "accent" chip** (batch 2): Unsaved, image "Primary", Users "Duda editor: Yes", translation "Missing". Which chip tone does each take, given that yellow is only for active, primary and "New"?
10. **Modal and toast elevation** (batch 2):
    - Do modals and toasts get the menu shadow or none?
    - The menu shadow's value is interim (the current `md`).
    - The backdrop colour in dark mode.
11. **Button and control details** (batch 2):
    - `danger` button style
    - small ghost (34) horizontal padding
    - a 24px remove button inside chips
    - whether 34px inputs are allowed in dense toolbars
    - the Toggle's off-state border
12. **Font weights for the widget previews** (stage 3). Add Barlow 400 and Inter 700 to the Google Fonts link? `WIDGET_CSS` uses both. There is no download cost unless they are used.
13. **Input border contrast** (stage 3). `--border-strong` is 1.6:1 against its background in both themes, below the 3:1 of WCAG 1.4.11 for the edges of form fields. Accept it as designed, or darken it?
14. **Yellow-only indicators on white** (batch 2). The selected-row bar and active-tab underline are 1.45:1 on white. The spec adds a second cue (row fill, 600 text). Confirm that is acceptable.
15. **Login, Forgot password and Reset password** (batch 5). They are not in 00. Should they use the new tokens on a centred card, or get a dedicated design (the current dark brand panel at `Login.tsx:110-118`)? Also, what replaces the SA logo SVG, which has its own white rectangle?
16. **Status page** (batch 4). It leaves the nav. Should the route stay reachable by URL (like `/widgets`), or go?
17. **Enquiries state** (batch 6):
    - "New / Handled" tabs, "Mark as handled", sidebar counts. **There is no handled or status column** on `QuoteRequest` or `Lead` (`backend/prisma/schema.prisma`), so this needs a migration on the live database.
    - What does "Reply by email" open (a `mailto:` link)?
    - The quote "total row": there are no prices (CLAUDE.md, quotes have no price). A total of what, quantity?
18. **Products rows** (batch 7):
    - What does the row checkbox do (bulk actions? which)?
    - Which "more-actions" are on a row?
    - The slug needs adding to `GET /api/products` (a one-line backend change, 01 §5a.2).
19. **Users** (batch 5). 00 shows a user "name" and "date added". The API has `createdAt` but **no name** (`backend/src/routes/users.ts:34, 62`). Where does a name come from? What content goes in the "invite domains" info card?
20. **Top-bar search** (batch 4). What does it search: products only, client-side over the list, or everything? Its behaviour below lg?
21. **Website editor status grid** (batch 5). The data sources for "Search engines", "Languages" and "Address". Duda's `site_seo.no_index`, `getSiteLanguages()` and the domain are likely, but that needs confirming. They may need new API reads.
22. **Categories "share bar"** (batch 7). A share of what? Products per group?
23. **SplitView and TopBar below lg** (batch 3/4). 00 does not say. *Suggested:* the list only; selecting shows the detail full-width with a "Back to list" link, still driven by `?id=`.
24. **3D model preview background** (batch 8). Paper or surface? 00's paper list does not mention it.
25. **Marker FLAGs** (batch 5–8). §6 has 14 rows marked FLAG, each with a suggested decision. They need a yes or no.
26. **Pagination ellipsis** (batch 3). For many pages (Media has about 20), the "…" style. The spec uses `text-muted` mono.
27. **Checkbox** (batch 2). "16px with accent-color #FED217" means a native checkbox, whose corner radius and tick the browser draws. That conflicts with "square, including checkboxes". Keep the custom `appearance-none` box (square, yellow fill, black tick), or accept the native one?
28. **Product editor header and save** (batch 8). 00's header card has "Save". The save bar is also KEEP. Are both kept (header Save plus the bottom bar for status and errors), or does the header replace the bar? Also, "Visibility (Live toggle)" replaces the Status select in Details: confirm.
