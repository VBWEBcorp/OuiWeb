import { useState } from "react";
import { Link } from "react-router-dom";
import { Plug, ShieldCheck, Loader2, ArrowRight, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { useCurrentAccount, useStore } from "../lib/store";
import { useTenant, useTheme } from "../lib/auth";
import { Api } from "../lib/api";
import { initials } from "../lib/utils";

/**
 * Locks the page behind a LinkedIn connection: if the current account isn't
 * connected, render a full-page CTA instead of the children. Settings remains
 * accessible from the sidebar so the user can go connect.
 */
export default function RequireLinkedIn({ children }: { children: React.ReactNode }) {
  const account = useCurrentAccount();
  const tenant = useTenant();
  const theme = useTheme();
  const setAccounts = useStore((s) => s.setAccounts);
  const [busy, setBusy] = useState(false);

  if (!account) {
    return (
      <div className="grid place-items-center min-h-[60vh]">
        <Loader2 className="size-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (account.connected) return <>{children}</>;

  async function connect() {
    if (!account) return;
    setBusy(true);
    try {
      const { url, mock } = await Api.linkedinAuthUrl(account._id) as any;
      if (mock) toast("🧪 Mode démo — connexion simulée", { duration: 2500 });
      const w = window.open(url, "linkedin-oauth", "width=520,height=720");
      const interval = setInterval(async () => {
        if (!w || w.closed) {
          clearInterval(interval);
          const fresh = await Api.accounts();
          setAccounts(fresh);
          setBusy(false);
          toast.success("Statut LinkedIn actualisé");
        }
      }, 800);
    } catch (e: any) {
      toast.error(e.message); setBusy(false);
    }
  }

  return (
    <div className="grid place-items-center min-h-[70vh] py-10">
      <div className="w-full max-w-lg text-center animate-fade-in">
        {/* Logo + icon stack */}
        <div className="relative mx-auto w-fit">
          <div
            className="size-20 rounded-2xl grid place-items-center text-2xl font-bold text-white shadow-glow"
            style={{ background: account.avatarColor }}
          >
            {initials(account.displayName)}
          </div>
          <div
            className="absolute -bottom-2 -right-2 size-9 rounded-xl grid place-items-center border-4"
            style={{
              background: "var(--bg)",
              borderColor: "var(--bg)",
              color: theme?.primary,
            }}
          >
            <Plug className="size-4" />
          </div>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight mt-6">
          Connecte <span style={{ color: theme?.primary }}>{account.displayName}</span> à LinkedIn
        </h1>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
          Pour utiliser <strong className="text-zinc-200">{tenant?.name}</strong>, ce compte doit être lié à LinkedIn.
          Une fois connecté, tu pourras rédiger, programmer, publier et tracker tes posts.
        </p>

        {/* Big CTA */}
        <button
          onClick={connect}
          disabled={busy}
          className="btn-primary mt-7 mx-auto px-6 py-3 text-base"
          style={theme ? { background: theme.primary, boxShadow: `0 20px 50px -15px ${theme.primary}` } : undefined}
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Plug className="size-5" />}
          Connecter LinkedIn
          <ArrowRight className="size-5" />
        </button>

        <Link to="/settings" className="block mt-3 text-xs text-zinc-500 hover:text-white transition-colors">
          ou aller dans Réglages →
        </Link>

        {/* Trust badges */}
        <div className="mt-10 grid grid-cols-3 gap-2 text-[10px]">
          <Trust icon={<ShieldCheck className="size-3.5" />} label="OAuth 2.0" />
          <Trust icon={<ShieldCheck className="size-3.5" />} label="AES-256-GCM" />
          <Trust icon={<ShieldCheck className="size-3.5" />} label="Tokens jamais exposés" />
        </div>

        {/* Helper */}
        <div className="mt-8 card p-3 flex items-start gap-2 text-left text-[11px] text-zinc-400">
          <AlertTriangle className="size-3.5 text-amber-300 mt-0.5 shrink-0" />
          <div>
            Tant que ce compte n'est pas connecté, la rédaction, la programmation et la publication sont désactivées.
            Tu peux toujours basculer sur l'autre tenant depuis le bouton de déconnexion en bas de la sidebar.
          </div>
        </div>
      </div>
    </div>
  );
}

function Trust({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-bg-border bg-bg-soft text-zinc-400">
      <span className="text-emerald-400">{icon}</span>
      <span>{label}</span>
    </div>
  );
}
