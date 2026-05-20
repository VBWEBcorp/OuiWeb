import { useEffect } from "react";
import { useTheme } from "../lib/auth";
import { useAuth } from "../lib/auth";

/**
 * Single source of truth for theme = (tenant brand color) × (light/dark mode).
 * Pushes CSS variables on :root so the whole app (sidebar, cards, inputs,
 * gradients, focus rings, ambient washes) tracks the mode + brand.
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  // Dark only — light mode disabled
  const mode = "dark" as const;
  const fontSize = useAuth((s) => s.fontSize);
  const reducedMotion = useAuth((s) => s.reducedMotion);
  const compact = useAuth((s) => s.compact);
  const highContrast = useAuth((s) => s.highContrast);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(mode);
    root.setAttribute("data-mode", mode);

    if (theme) {
      root.style.setProperty("--brand", theme.primary);
      root.style.setProperty("--brand-soft", theme.primarySoft);
      root.style.setProperty("--brand-accent", theme.accent);
      const tints = computeTints(theme.primary);
      Object.entries(tints).forEach(([k, v]) => root.style.setProperty(k, v));
    }
  }, [mode, theme?.primary]);

  // Accessibility preferences → CSS classes on <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("font-sm", "font-md", "font-lg", "compact", "reduce-motion", "high-contrast");
    root.classList.add(`font-${fontSize}`);
    if (compact) root.classList.add("compact");
    if (reducedMotion) root.classList.add("reduce-motion");
    if (highContrast) root.classList.add("high-contrast");
  }, [fontSize, reducedMotion, compact, highContrast]);

  return (
    <div className="relative isolate min-h-screen">
      {theme && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 transition-colors duration-700"
          style={{
            background: `
              radial-gradient(ellipse at 85% -10%, ${theme.primarySoft}, transparent 55%),
              radial-gradient(ellipse at -10% 110%, ${theme.primarySoft}, transparent 55%)
            `,
          }}
        />
      )}
      {children}
    </div>
  );
}

function computeTints(hex: string): Record<string, string> {
  const { r, g, b } = hexToRgb(hex);
  const stops: Record<string, number> = {
    "50": 0.95, "100": 0.85, "200": 0.7, "300": 0.5, "400": 0.25,
    "500": 0,  "600": -0.1, "700": -0.2, "800": -0.3, "900": -0.4,
  };
  const out: Record<string, string> = {};
  for (const [k, mix] of Object.entries(stops)) {
    const tinted = mix >= 0
      ? mixWithWhite(r, g, b, mix)
      : mixWithBlack(r, g, b, -mix);
    out[`--brand-${k}`] = rgbToHex(tinted.r, tinted.g, tinted.b);
  }
  return out;
}

function hexToRgb(hex: string) {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function mixWithWhite(r: number, g: number, b: number, t: number) {
  return { r: Math.round(r + (255 - r) * t), g: Math.round(g + (255 - g) * t), b: Math.round(b + (255 - b) * t) };
}
function mixWithBlack(r: number, g: number, b: number, t: number) {
  return { r: Math.round(r * (1 - t)), g: Math.round(g * (1 - t)), b: Math.round(b * (1 - t)) };
}
function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
}
