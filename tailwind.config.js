/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "var(--bg, #0a0a0b)",
          soft: "var(--bg-soft, #111114)",
          card: "var(--bg-card, #16161a)",
          border: "var(--bg-border, #222228)",
        },
        brand: {
          50:  "var(--brand-50, #eef4ff)",
          100: "var(--brand-100, #dbe7ff)",
          200: "var(--brand-200, #b8d0ff)",
          300: "var(--brand-300, #8db0ff)",
          400: "var(--brand-400, #5b88ff)",
          500: "var(--brand-500, #3463ff)",
          600: "var(--brand-600, #1f47ed)",
          700: "var(--brand-700, #1937c2)",
          800: "var(--brand-800, #162f9a)",
          900: "var(--brand-900, #142a78)",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.05), 0 20px 60px -20px rgba(52,99,255,0.35)",
      },
      animation: {
        "fade-in": "fadeIn .25s ease-out both",
        "slide-up": "slideUp .35s cubic-bezier(.2,.8,.2,1) both",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        slideUp: { "0%": { opacity: 0, transform: "translateY(8px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};
