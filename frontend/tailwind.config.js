/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
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
      // Loaded from Google Fonts by the <link> in index.html. Body text is
      // already Inter through the <body> rule in index.css, and h1–h6 are
      // Barlow there; these utilities are for setting a family explicitly.
      fontFamily: {
        heading: ['"Barlow"', "ui-sans-serif", "system-ui", "sans-serif"],
        body: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
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
