/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    // Three IBM Plex Sans weights are loaded: 400 (Regular, body/paragraph text),
    // 500 (Medium, input/list/table item content), 600 (Semibold, headings/
    // labels/buttons/table-headers/emphasis). Map every Tailwind weight name
    // onto one of the three so stray classes can never request an unloaded
    // weight.
    fontWeight: {
      thin: "400",
      extralight: "400",
      light: "400",
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "600",
      extrabold: "600",
      black: "600",
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
        // IBM Plex Sans everywhere — this is already the <body> default (see
        // index.css); the "font-sans" utility exists for explicit opt-in.
        sans: [
          '"IBM Plex Sans"',
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
      // shadcn-style scale: UI text is 14px, secondary 12px, and headings are
      // far tighter than the previous airy scale. `body`/`small` keep their
      // names (used on every page) but each drops a step.
      fontSize: {
        display: ["2.25rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        h1: ["1.5rem", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        h2: ["1.25rem", { lineHeight: "1.25", letterSpacing: "-0.015em" }],
        h3: ["1rem", { lineHeight: "1.3", letterSpacing: "-0.01em" }],
        body: ["0.875rem", { lineHeight: "1.4285714" }],
        small: ["0.75rem", { lineHeight: "1.3333333" }],
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
