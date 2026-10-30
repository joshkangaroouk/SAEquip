/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  // `dark:` applies under <html data-theme="dark">. Rarely needed: almost
  // everything themes through the CSS variables in index.css.
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    // REPLACES the theme: only the weights index.html loads. Barlow and Inter
    // ship 400/500/600/700, JetBrains Mono 400/500 — so `font-medium` is a
    // real 500 again (under DIN 2014 it had to be mapped down to 400). A
    // weight a family lacks renders at the nearest loaded one, never a fake
    // one: index.css sets `font-synthesis: none`.
    fontWeight: {
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
    // REPLACES the theme: square everywhere (00: "border-radius: 0 everywhere,
    // including chips, avatars, toggles, checkboxes"). This is also what
    // neutralises `rounded-full`, which never followed a --radius token.
    borderRadius: {
      none: "0",
      sm: "0",
      DEFAULT: "0",
      md: "0",
      lg: "0",
      xl: "0",
      "2xl": "0",
      "3xl": "0",
      full: "0",
    },
    // REPLACES the theme: no elevation on cards or panels, so every
    // shadow-xs…2xl generates nothing. One shadow for menus, popovers, modals
    // and toasts, whose strength depends on the theme (--shadow-menu, 02a Q10).
    boxShadow: {
      none: "none",
      menu: "var(--shadow-menu)",
    },
    extend: {
      // Colours are declared as `rgb(var(--token) / <alpha-value>)` so Tailwind
      // can inject an alpha channel — this is what makes `bg-danger/10`,
      // `border-accent/50` etc. actually render. See the FORMAT note in
      // index.css before changing the token values to hex.
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        field: "rgb(var(--input-bg) / <alpha-value>)", // bg-field — inputs and selects
        border: {
          DEFAULT: "rgb(var(--border) / <alpha-value>)", // border-border
          strong: "rgb(var(--border-strong) / <alpha-value>)", // border-border-strong — ghost buttons, edges
          input: "rgb(var(--border-input) / <alpha-value>)", // border-border-input — form controls (02a Q13)
        },
        text: "rgb(var(--text) / <alpha-value>)",
        // `muted` is secondary TEXT, not shadcn's grey fill.
        muted: "rgb(var(--muted) / <alpha-value>)",
        track: "rgb(var(--track) / <alpha-value>)",
        chip: "rgb(var(--chip-bg) / <alpha-value>)",
        ok: {
          DEFAULT: "rgb(var(--ok) / <alpha-value>)",
          bg: "rgb(var(--ok-bg) / <alpha-value>)",
        },
        danger: {
          DEFAULT: "rgb(var(--danger) / <alpha-value>)",
          bg: "rgb(var(--danger-bg) / <alpha-value>)",
          solid: "rgb(var(--danger-solid) / <alpha-value>)", // confirm-delete, fixed in both themes
          "solid-hover": "rgb(var(--danger-solid-hover) / <alpha-value>)",
        },
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
        // A full colour with its own alpha, set per theme (02a Q10): `bg-backdrop`.
        backdrop: "var(--backdrop)",
        focus: "rgb(var(--focus) / <alpha-value>)",
        sidebar: {
          DEFAULT: "rgb(var(--sidebar) / <alpha-value>)",
          border: "rgb(var(--sidebar-border) / <alpha-value>)",
          fg: "rgb(var(--sidebar-fg) / <alpha-value>)",
          text: "rgb(var(--sidebar-text) / <alpha-value>)",
          label: "rgb(var(--sidebar-label) / <alpha-value>)",
          hover: "rgb(var(--sidebar-hover) / <alpha-value>)",
          active: "rgb(var(--sidebar-active) / <alpha-value>)",
          "active-ink": "rgb(var(--sidebar-active-ink) / <alpha-value>)",
          badge: "rgb(var(--sidebar-badge) / <alpha-value>)",
          "badge-ink": "rgb(var(--sidebar-badge-ink) / <alpha-value>)",
          focus: "rgb(var(--sidebar-focus) / <alpha-value>)",
        },
      },
      // Loaded from Google Fonts by the <link> in index.html. Body text is
      // already Inter through the <body> rule in index.css, and h1–h6 are
      // Barlow there; these utilities are for setting a family explicitly.
      fontFamily: {
        heading: ['"Barlow"', "ui-sans-serif", "system-ui", "sans-serif"],
        body: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      // The design's px sizes that Tailwind's 4px grid lacks (16px root).
      // 4.5 → `px-4.5`, 8.5 → `h-8.5` and so on.
      spacing: {
        4.5: "1.125rem", // 18 — primary button horizontal padding
        6.5: "1.625rem", // 26 — chip height
        8.5: "2.125rem", // 34 — small ghost / icon button, dense inputs, pagination squares
        10.5: "2.625rem", // 42 — toggle width
        70: "17.5rem", // 280 — top-bar search
        95: "23.75rem", // 380 — split-view list pane
      },
      // ONE type scale (docs/redesign/02 §2.2), in rem at the default 16px
      // root. Most text uses a role class from index.css (`.t-h1`, `.t-label`…)
      // rather than these directly. Line heights for help and label are the
      // roles' (02a Q7). ⚠️ Every key here must also be in FONT_SIZES in
      // src/lib/cn.ts — `scripts/cn-audit.mjs` checks.
      fontSize: {
        title: ["2.25rem", { lineHeight: "1.05", letterSpacing: "-0.01em" }], // 36 — H1
        body: ["0.875rem", { lineHeight: "1.5" }], // 14
        help: ["0.8125rem", { lineHeight: "1.5" }], // 13 — help text, chips, codes
        label: ["0.75rem", { lineHeight: "1.3" }], // 12 — labels, overlines, table heads, codes
        micro: "0.6875rem", // 11 — segment counts, "New" chip
      },
    },
  },
  plugins: [],
};
