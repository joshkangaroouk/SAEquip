/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    // DIN 2014 (Adobe Fonts) ships 200/300/400/600/700/800 in this web
    // project — normal style only, and crucially NO 500. Every Tailwind weight
    // name is mapped onto a weight that actually exists so a stray class can
    // never request one the font can't serve (which would make the browser
    // synthesise a fake weight).
    //
    // `medium` deliberately resolves to 400, not 600: it's used ~23x for
    // input/list/table content as a subtle step above body, and 600 is the
    // heading weight — promoting it there would flatten the hierarchy far more
    // than dropping it to body weight does. This is also exactly how CSS would
    // resolve a missing 500 on its own.
    fontWeight: {
      thin: "200",
      extralight: "200",
      light: "300",
      normal: "400",
      medium: "400",
      semibold: "600",
      bold: "700",
      extrabold: "800",
      black: "800",
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
        border: "rgb(var(--border) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
        text: "rgb(var(--text) / <alpha-value>)",
        // NOTE: `muted` is secondary TEXT here, not shadcn's grey fill — see
        // the naming note in index.css before repurposing it.
        muted: "rgb(var(--muted) / <alpha-value>)",
        subtle: "rgb(var(--subtle) / <alpha-value>)",
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          hover: "rgb(var(--accent-hover) / <alpha-value>)",
          foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
          foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
        },
        danger: "rgb(var(--danger) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",
        sidebar: {
          DEFAULT: "rgb(var(--sidebar) / <alpha-value>)",
          foreground: "rgb(var(--sidebar-foreground) / <alpha-value>)",
          muted: "rgb(var(--sidebar-muted) / <alpha-value>)",
          subtle: "rgb(var(--sidebar-subtle) / <alpha-value>)",
          border: "rgb(var(--sidebar-border) / <alpha-value>)",
        },
      },
      fontFamily: {
        // DIN 2014 everywhere — this is already the <body> default (see
        // index.css); the "font-sans" utility exists for explicit opt-in.
        // Loaded from Adobe Fonts via the <link> in index.html.
        sans: [
          '"din-2014"',
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          '"Segoe UI"',
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      // Sizes are rem so the whole scale tracks the 110% root in index.css —
      // that root stays the single knob for scaling the UI. Values below are
      // annotated with what they resolve to at the current 17.6px root.
      fontSize: {
        display: ["2.25rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }], // ~39.6px
        h1: ["1.5rem", { lineHeight: "1.2", letterSpacing: "-0.02em" }], // ~26.4px
        h2: ["1.25rem", { lineHeight: "1.25", letterSpacing: "-0.015em" }], // ~22px
        h3: ["1.125rem", { lineHeight: "1.3", letterSpacing: "-0.01em" }], // ~19.8px
        // Paragraph/body text is 16px by design. 0.909rem is 16/17.6 — it
        // looks like a magic number but it's what keeps 16px expressed
        // relative to the root rather than hardcoded in px.
        body: ["0.909rem", { lineHeight: "1.5" }], // 16px
        small: ["0.795rem", { lineHeight: "1.35" }], // ~14px
      },
      // Derived from --radius exactly as shadcn does it.
      borderRadius: {
        sm: "calc(var(--radius) - 4px)",
        DEFAULT: "calc(var(--radius) - 2px)",
        md: "calc(var(--radius) - 2px)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      // shadcn leans on borders, not elevation. These are deliberately faint;
      // only overlays should reach for anything heavier.
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        sm: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        md: "0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)",
        lg: "0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.08)",
      },
      ringColor: {
        DEFAULT: "rgb(var(--ring) / <alpha-value>)",
      },
      ringOffsetColor: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};
