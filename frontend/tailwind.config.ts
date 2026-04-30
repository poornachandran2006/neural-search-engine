import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        "bg-base":     "#0a0b0e",
        "bg-surface":  "#111318",
        "bg-elevated": "#181c24",
        "bg-hover":    "#1e2330",
        // Borders
        "border-subtle":  "#1f2433",
        "border-default": "#2a3147",
        "border-strong":  "#3d4d6b",
        // Text
        "text-primary":   "#e8eaf0",
        "text-secondary": "#8892a4",
        "text-muted":     "#4a5568",
        // Accents
        "accent-cyan":     "#00d4ff",
        "accent-cyan-dim": "#0099bb",
        "accent-green":    "#00ff9d",
        "accent-amber":    "#ffb347",
        "accent-red":      "#ff4d6d",
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        mono: ["DM Mono", "Fira Code", "monospace"],
      },
      fontSize: {
        "2xs": "9px",
        xs:    "10px",
        sm:    "11px",
        base:  "12px",
        md:    "13px",
        lg:    "14px",
        xl:    "16px",
        "2xl": "22px",
        "3xl": "28px",
        "4xl": "36px",
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "8px",
        xl: "10px",
        "2xl": "12px",
      },
      keyframes: {
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%":       { opacity: "0" },
        },
        "dot-pulse": {
          "0%, 80%, 100%": { transform: "scale(0.6)", opacity: "0.3" },
          "40%":           { transform: "scale(1)",   opacity: "1"   },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to:   { opacity: "1", transform: "translateY(0)"   },
        },
        "score-fill": {
          from: { width: "0%" },
        },
      },
      animation: {
        blink:      "blink 0.8s step-end infinite",
        "dot-1":    "dot-pulse 1.2s ease-in-out infinite",
        "dot-2":    "dot-pulse 1.2s ease-in-out 0.15s infinite",
        "dot-3":    "dot-pulse 1.2s ease-in-out 0.30s infinite",
        "fade-in":  "fade-in 0.25s ease forwards",
        "score-fill": "score-fill 0.8s cubic-bezier(0.4,0,0.2,1) forwards",
      },
    },
  },
  plugins: [],
};

export default config;