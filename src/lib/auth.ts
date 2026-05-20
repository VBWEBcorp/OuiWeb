import { create } from "zustand";
import { persist } from "zustand/middleware";
import { TENANTS, TenantId } from "./tenants";

export type Mode = "light" | "dark";
export type FontSize = "sm" | "md" | "lg";

type Session = {
  tenantId: TenantId | null;
  email: string | null;
  mode: Mode;
  /** Accessibility preferences (global, shared across tenants) */
  fontSize: FontSize;
  reducedMotion: boolean;
  compact: boolean;
  highContrast: boolean;
  setSession: (s: { tenantId: TenantId; email: string }) => void;
  setMode: (m: Mode) => void;
  toggleMode: () => void;
  setFontSize: (f: FontSize) => void;
  setReducedMotion: (v: boolean) => void;
  setCompact: (v: boolean) => void;
  setHighContrast: (v: boolean) => void;
  logout: () => void;
};

export const useAuth = create<Session>()(
  persist(
    (set) => ({
      tenantId: null,
      email: null,
      mode: "dark",
      fontSize: "md",
      reducedMotion: false,
      compact: false,
      highContrast: false,
      setSession: ({ tenantId, email }) => set({ tenantId, email }),
      setMode: (m) => set({ mode: m }),
      toggleMode: () => set((s) => ({ mode: s.mode === "dark" ? "light" : "dark" })),
      setFontSize: (f) => set({ fontSize: f }),
      setReducedMotion: (v) => set({ reducedMotion: v }),
      setCompact: (v) => set({ compact: v }),
      setHighContrast: (v) => set({ highContrast: v }),
      logout: () => set({ tenantId: null, email: null }),
    }),
    { name: "ouiweb.session" }
  )
);

export function useTenant() {
  const id = useAuth((s) => s.tenantId);
  return id ? TENANTS[id] : null;
}

/** Active theme = tenant brand + current light/dark mode */
export function useTheme() {
  const t = useTenant();
  const mode = useAuth((s) => s.mode);
  if (!t) return null;
  return {
    id: `${t.id}-${mode}`,
    mode,
    primary: t.primary,
    primarySoft: t.primarySoft,
    accent: t.accent,
  };
}

/** Email → tenant resolution (UX helper for the Login page). Authoritative resolution is server-side. */
export function resolveTenant(email: string): TenantId | null {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  if (e.endsWith("@vbweb.fr") || e.includes("victor")) return "vbweb";
  if (e.endsWith("@ouibo.fr") || e.includes("yannick") || e.includes("ouibo")) return "ouibo";
  return null;
}

/** Sends credentials to the backend, returns the resolved tenant on success. */
export async function loginRequest(
  email: string,
  password: string,
): Promise<{ ok: boolean; tenantId?: TenantId; reason?: string }> {
  try {
    const { api } = await import("./api");
    const r = await api.post("/auth/login", { email, password });
    return { ok: true, tenantId: r.data.tenantId };
  } catch (e: any) {
    return { ok: false, reason: e?.message || "Échec de la connexion" };
  }
}
