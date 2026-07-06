/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    // Three Montserrat weights are loaded: 400 (Regular, body/paragraph text),
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
        // Montserrat everywhere — this is already the <body> default (see
        // index.css); the "font-sans" utility exists for explicit opt-in.
        sans: [
          '"Montserrat"',
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
