import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy:           "#0F1E3C",
        red:            "#C0392B",
        background:     "#F8F9FB",
        card:           "#FFFFFF",
        border:         "#E5E7EB",
        "text-primary": "#111827",
        "text-secondary":"#6B7280",
        success:        "#16A34A",
        warning:        "#D97706",
      },
      fontFamily: {
        inter: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
