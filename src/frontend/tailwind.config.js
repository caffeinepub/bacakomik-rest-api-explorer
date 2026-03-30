/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["BricolageGrotesque", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["GeistMono", "ui-monospace", "monospace"],
      },
      colors: {
        background: "oklch(12% 0.02 240)",
        foreground: "oklch(88% 0.02 240)",
        card: "oklch(16% 0.025 240)",
        "card-foreground": "oklch(88% 0.02 240)",
        border: "oklch(22% 0.04 240)",
        input: "oklch(18% 0.03 240)",
        primary: "oklch(72% 0.18 195)",
        "primary-foreground": "oklch(12% 0.02 240)",
        muted: "oklch(20% 0.03 240)",
        "muted-foreground": "oklch(55% 0.04 240)",
        accent: "oklch(72% 0.18 195)",
        destructive: "oklch(60% 0.22 25)",
      },
    },
  },
  plugins: [],
};
