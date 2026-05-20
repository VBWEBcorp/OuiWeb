import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect } from "react";
import { Api, LinkedInAccount } from "./api";
import { useAuth } from "./auth";

type State = {
  accounts: LinkedInAccount[];
  currentAccountId: string | null;
  setCurrentAccountId: (id: string) => void;
  setAccounts: (a: LinkedInAccount[]) => void;
};

export const useStore = create<State>()(
  persist(
    (set) => ({
      accounts: [],
      currentAccountId: null,
      setCurrentAccountId: (id) => set({ currentAccountId: id }),
      setAccounts: (a) => set({ accounts: a }),
    }),
    { name: "ouiweb.store" }
  )
);

export function useAccountBootstrap() {
  const setAccounts = useStore((s) => s.setAccounts);
  const currentId = useStore((s) => s.currentAccountId);
  const setCurrentId = useStore((s) => s.setCurrentAccountId);
  const tenantId = useAuth((s) => s.tenantId);

  // Re-fetch accounts when the tenant changes, and reset currentAccountId
  // if it doesn't belong to the new tenant (prevents cross-tenant data leak).
  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      try {
        const a = await Api.accounts();
        setAccounts(a);
        const stillValid = currentId && a.some((acc) => acc._id === currentId);
        if (!stillValid) {
          setCurrentId(a[0]?._id || "");
        }
      } catch {
        /* ignore — API may still be booting */
      }
    })();
  }, [tenantId]);
}

export function useCurrentAccount() {
  const accounts = useStore((s) => s.accounts);
  const id = useStore((s) => s.currentAccountId);
  return accounts.find((a) => a._id === id) || null;
}
