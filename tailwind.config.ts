import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        mint: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
        slate: {
          750: "#293548",
          850: "#172033",
        },
        // GHL destination accent. Mint stays the primary action color across
        // FlowMint; ghl-* is used only on surfaces that touch GoHighLevel
        // (Push to GHL chip, connection rows, embedded-destination cues) so
        // users get a subtle "this is going somewhere external" signal.
        // Hue chosen to read as confident indigo/blue near GHL's own UI tone.
        ghl: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          400: "#818cf8",
          600: "#4f46e5",
          700: "#4338ca",
        },
      },
      fontFamily: {
        sans: ["Inter", "Public Sans", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
