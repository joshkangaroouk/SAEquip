/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    // SHARP CORNERS EVERYWHERE — override, don't extend, so `rounded`,
    // `rounded-md`, `rounded-full` etc. all resolve to 0. Nothing is round.
    borderRadius: {
      none: "0",
      DEFAULT: "0",
      sm: "0",
      md: "0",
      lg: "0",
      xl: "0",
      "2xl": "0",
      "3xl": "0",
      full: "0",
    },
    // Three weights exist: 300 (Light), 400 (Regular), 600 (Semibold). Map
    // every Tailwind weight name onto one of them so stray classes can never
    // trigger a faux weight. font-light -> 300, font-normal -> 400,
    // font-medium/semibold/bold -> 600.
    fontWeight: {
      thin: "300",
      extralight: "300",
      light: "300",
      normal: "400",
      medium: "600",
      semibold: "600",
      bold: "600",
      extrabold: "600",
      black: "600",
    },
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
        text: "var(--text)",
        muted: "var(--muted)",
        subtle: "var(--subtle)",
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          foreground: "var(--accent-foreground)",
        },
        danger: "var(--danger)",
        success: "var(--success)",
      },
      fontFamily: {
        sans: [
          '"Clash Grotesk"',
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
      // Generous, airy type scale. Body sizes are all >= 15px.
      fontSize: {
        display: ["3.5rem", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        h1: ["2.5rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        h2: ["1.875rem", { lineHeight: "1.15", letterSpacing: "-0.01em" }],
        h3: ["1.375rem", { lineHeight: "1.25", letterSpacing: "-0.01em" }],
        body: ["1rem", { lineHeight: "1.6" }],
        small: ["0.9375rem", { lineHeight: "1.5" }],
      },
      ringColor: {
        DEFAULT: "var(--accent)",
      },
      ringOffsetColor: {
        bg: "var(--bg)",
        surface: "var(--surface)",
      },
    },
  },
  plugins: [],
};
