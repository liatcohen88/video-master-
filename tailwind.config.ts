import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0a0a0f",
          panel: "#15151f",
          card: "#1c1c2a",
          input: "#252535",
        },
        brand: {
          DEFAULT: "#7c3aed",
          light: "#a78bfa",
          dark: "#5b21b6",
        },
        accent: {
          pink: "#ec4899",
          cyan: "#06b6d4",
          yellow: "#facc15",
        },
      },
      fontFamily: {
        sans: ["var(--font-heebo)", "system-ui", "sans-serif"],
        display: ["var(--font-rubik)", "system-ui", "sans-serif"],
        assistant: ["var(--font-assistant)"],
        varela: ["var(--font-varela)"],
        secular: ["var(--font-secular)"],
        suez: ["var(--font-suez)"],
        frank: ["var(--font-frank)"],
        bellefair: ["var(--font-bellefair)"],
      },
    },
  },
  plugins: [],
};

export default config;
