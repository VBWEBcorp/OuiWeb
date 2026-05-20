import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Linkedin, CircleDot, Loader2, Plug, PlugZap, Unplug, AlertTriangle,
  Accessibility, Type, MousePointerClick, Eye, Minimize2,
} from "lucide-react";
import { Api } from "../lib/api";
import { useStore } from "../lib/store";
import { useTheme, useTenant, useAuth } from "../lib/auth";
import { initials, formatDate } from "../lib/utils";
import ConfirmModal from "../components/ConfirmModal";

export default function Settings() {
  const tenant = useTenant();
  const theme = useTheme();

  const { data: accounts = [], refetch } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => Api.accounts(),
  });
  const { data: mockStatus } = useQuery({
    queryKey: ["linkedin-status"],
    queryFn: () => Api.linkedinStatus(),
  });
  const { data: storage } = useQuery({
    queryKey: ["storage-status"],
    queryFn: () => Api.storageStatus(),
  });
  const setAccounts = useStore((s) => s.setAccounts);
  const qc = useQueryClient();

  const [busy, setBusy] = useState<string | null>(null);
  const [askDisconnect, setAskDisconnect] = useState<string | null>(null);

  async function connect(accountId: string) {
    setBusy(accountId);
    try {
      const { url, mock } = await Api.linkedinAuthUrl(accountId) as any;
      if (mock) toast("🧪 Mode démo — connexion simulée", { duration: 2500 });
      const w = window.open(url, "linkedin-oauth", "width=520,height=720");
      const interval = setInterval(async () => {
        if (!w || w.closed) {
          clearInterval(interval);
          const fresh = await Api.accounts();
          setAccounts(fresh);
          await refetch();
          setBusy(null);
          toast.success("Statut LinkedIn actualisé");
        }
      }, 800);
    } catch (e: any) {
      toast.error(e.message); setBusy(null);
    }
  }

  async function disconnect(accountId: string) {
    setBusy(accountId);
    try {
      await Api.linkedinDisconnect(accountId);
      toast.success("Compte déconnecté");
      const fresh = await Api.accounts();
      setAccounts(fresh);
      await refetch();
      qc.invalidateQueries({ queryKey: ["accounts"] });
    } catch (e: any) { toast.error(e.message); throw e; }
    finally { setBusy(null); }
  }

  const total = accounts.length;
  const connected = accounts.filter((a) => a.connected).length;

  return (
    <div className="space-y-5">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 -mx-6 lg:-mx-10 px-6 lg:px-10 py-3 backdrop-blur-xl border-b border-bg-border"
           style={{ background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="size-9 rounded-lg grid place-items-center"
               style={{ background: theme?.primarySoft }}>
            <Linkedin className="size-4" style={{ color: theme?.primary }} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold tracking-tight">Comptes LinkedIn</h1>
            <p className="text-[11px] text-zinc-500">
              {tenant?.name} · {connected} / {total} compte{total > 1 ? "s" : ""} connecté{connected > 1 ? "s" : ""}
            </p>
          </div>
          {storage && <StorageBadge provider={storage.provider} bucket={storage.bucket} />}
        </div>
      </div>

      <div className="max-w-5xl mx-auto space-y-4">
        {/* Mock mode banner */}
        {mockStatus?.mock && (
          <div className="card p-4 flex items-start gap-3"
               style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.3)" }}>
            <div className="size-9 rounded-lg grid place-items-center shrink-0"
                 style={{ background: "rgba(245,158,11,0.15)" }}>
              <AlertTriangle className="size-4 text-amber-300" />
            </div>
            <div className="text-[12px] leading-relaxed text-amber-100">
              <div className="font-semibold mb-0.5">Mode démo LinkedIn actif</div>
              <div className="text-amber-200/80">
                <code className="text-amber-100">LINKEDIN_CLIENT_ID</code> est vide → connexion et publication simulées côté serveur.
                Renseigne tes clés dans <code className="text-amber-100">.env</code> pour activer la publication réelle.
              </div>
            </div>
          </div>
        )}

        {/* Account cards */}
        <div className="space-y-3">
          {accounts.map((a) => (
            <AccountCard
              key={a._id}
              account={a}
              busy={busy === a._id}
              onConnect={() => connect(a._id)}
              onDisconnect={() => setAskDisconnect(a._id)}
            />
          ))}
        </div>

        {/* Accessibility */}
        <AccessibilityPanel />
      </div>

      <ConfirmModal
        open={!!askDisconnect}
        onClose={() => setAskDisconnect(null)}
        onConfirm={async () => {
          if (askDisconnect) await disconnect(askDisconnect);
        }}
        title="Déconnecter ce compte LinkedIn ?"
        message={
          <>
            <span className="block">Le token chiffré sera supprimé.</span>
            <span className="block mt-1 text-zinc-500">
              Tu pourras le reconnecter à tout moment. Les posts déjà publiés sur LinkedIn ne sont pas affectés.
            </span>
          </>
        }
        confirmLabel="Déconnecter"
        variant="danger"
        icon={<Unplug className="size-6" />}
      />
    </div>
  );
}

/* ─── Account card ─── */
function AccountCard({
  account, busy, onConnect, onDisconnect,
}: {
  account: any;
  busy: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const theme = useTheme();
  const isMock = account.linkedinUrn?.startsWith("urn:li:mock:");
  const expiresAt = account.tokenExpiresAt ? new Date(account.tokenExpiresAt) : null;
  const daysLeft = expiresAt ? Math.round((expiresAt.getTime() - Date.now()) / 86_400_000) : null;
  const tokenSoonExpired = typeof daysLeft === "number" && daysLeft < 7 && daysLeft > 0;
  const tokenExpired = typeof daysLeft === "number" && daysLeft <= 0;

  return (
    <div
      className="card p-5 relative overflow-hidden transition-all hover:border-white/20"
      style={account.connected && theme ? { boxShadow: `inset 0 0 0 1px ${theme.primarySoft}` } : undefined}
    >
      {/* Glow when connected */}
      {account.connected && (
        <div className="absolute -top-12 -right-12 size-32 rounded-full blur-3xl opacity-30 pointer-events-none"
             style={{ background: account.avatarColor }} />
      )}

      <div className="relative flex items-start gap-4">
        <div
          className="size-14 rounded-xl grid place-items-center text-base font-bold text-white shrink-0"
          style={{ background: account.avatarColor }}
        >
          {initials(account.displayName)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold tracking-tight">{account.displayName}</h3>
            {account.connected ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                <CircleDot className="size-2.5 fill-current" /> Connecté
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                <CircleDot className="size-2.5" /> Déconnecté
              </span>
            )}
            {isMock && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">
                🧪 Mode démo
              </span>
            )}
            {tokenExpired && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/20">
                Token expiré
              </span>
            )}
            {tokenSoonExpired && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">
                Token expire dans {daysLeft} j
              </span>
            )}
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 mt-3 text-[12px]">
            <Row label="URN">
              <code className="text-zinc-300 truncate inline-block max-w-[200px] align-bottom">
                {account.linkedinUrn || "—"}
              </code>
            </Row>
            <Row label="Token expire">
              <span className="text-zinc-300">
                {expiresAt ? formatDate(expiresAt) : "—"}
              </span>
            </Row>
            <Row label="Slug">
              <code className="text-zinc-300">{account.slug}</code>
            </Row>
            <Row label="Tenant">
              <code className="text-zinc-300">{account.tenantId}</code>
            </Row>
          </div>
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          {account.connected ? (
            <>
              <button
                onClick={onConnect}
                disabled={busy}
                className="btn-outline whitespace-nowrap"
                title="Rafraîchir la connexion"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
                Reconnecter
              </button>
              <button
                onClick={onDisconnect}
                disabled={busy}
                className="btn-ghost text-rose-300 hover:bg-rose-500/10 whitespace-nowrap"
              >
                <Unplug className="size-4" /> Déconnecter
              </button>
            </>
          ) : (
            <button
              onClick={onConnect}
              disabled={busy}
              className="btn-primary whitespace-nowrap"
              style={theme ? { background: theme.primary, boxShadow: `0 14px 36px -14px ${theme.primary}` } : undefined}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
              Connecter
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ─── */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500 shrink-0 w-[70px]">{label}</span>
      <span className="truncate">{children}</span>
    </div>
  );
}

/* ─── Storage badge (header) ─── */
function StorageBadge({ provider, bucket }: { provider: "r2" | "local"; bucket?: string }) {
  const isR2 = provider === "r2";
  return (
    <div
      className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] whitespace-nowrap"
      title={isR2 ? `Cloudflare R2 · ${bucket}` : "Stockage local (data/uploads/)"}
      style={{
        background: isR2 ? "rgba(16,185,129,0.10)" : "rgba(148,163,184,0.10)",
        borderColor: isR2 ? "rgba(16,185,129,0.30)" : "var(--bg-border)",
        color: isR2 ? "#34d399" : "#94a3b8",
      }}
    >
      <span className="size-1.5 rounded-full" style={{ background: isR2 ? "#34d399" : "#94a3b8" }} />
      <span>{isR2 ? "Stockage : R2" : "Stockage : Local"}</span>
    </div>
  );
}

/* ─── Accessibility ─── */
function AccessibilityPanel() {
  const theme = useTheme();
  const fontSize = useAuth((s) => s.fontSize);
  const setFontSize = useAuth((s) => s.setFontSize);
  const reducedMotion = useAuth((s) => s.reducedMotion);
  const setReducedMotion = useAuth((s) => s.setReducedMotion);
  const compact = useAuth((s) => s.compact);
  const setCompact = useAuth((s) => s.setCompact);
  const highContrast = useAuth((s) => s.highContrast);
  const setHighContrast = useAuth((s) => s.setHighContrast);

  return (
    <div className="card p-5 space-y-5">
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-lg grid place-items-center shrink-0"
             style={{ background: theme?.primarySoft }}>
          <Accessibility className="size-4" style={{ color: theme?.primary }} />
        </div>
        <div>
          <h3 className="font-semibold tracking-tight text-sm">Accessibilité</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">Personnalise l'affichage selon ton confort.</p>
        </div>
      </div>

      {/* Font size */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Type className="size-3.5 text-zinc-500" />
          <span className="text-xs font-medium">Taille du texte</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(["sm", "md", "lg"] as const).map((s) => {
            const active = fontSize === s;
            const labels: Record<typeof s, { name: string; size: string }> = {
              sm: { name: "Petit",  size: "14px" },
              md: { name: "Normal", size: "16px" },
              lg: { name: "Grand",  size: "18px" },
            } as any;
            return (
              <button
                key={s}
                onClick={() => setFontSize(s)}
                className={"py-2 px-3 rounded-lg border transition-colors text-left " +
                  (active ? "text-white" : "text-zinc-400 hover:text-white border-bg-border hover:bg-white/5")}
                style={active && theme ? { background: theme.primary, borderColor: theme.primary } : undefined}
              >
                <div className="text-sm font-medium">{labels[s].name}</div>
                <div className="text-[10px] opacity-70">{labels[s].size}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-2">
        <Toggle
          icon={<MousePointerClick className="size-4" />}
          title="Réduire les animations"
          subtitle="Désactive les fades, slides et transitions — utile pour les sensibilités visuelles ou pour gagner en perf."
          value={reducedMotion}
          onChange={setReducedMotion}
          theme={theme}
        />
        <Toggle
          icon={<Minimize2 className="size-4" />}
          title="Interface compacte"
          subtitle="Réduit le padding des cards, boutons et inputs pour afficher plus d'informations à l'écran."
          value={compact}
          onChange={setCompact}
          theme={theme}
        />
        <Toggle
          icon={<Eye className="size-4" />}
          title="Contraste élevé"
          subtitle="Bordures et texte plus marqués pour une meilleure lisibilité."
          value={highContrast}
          onChange={setHighContrast}
          theme={theme}
        />
      </div>
    </div>
  );
}

function Toggle({
  icon, title, subtitle, value, onChange, theme,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
  theme: any;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="w-full flex items-start gap-3 p-3 rounded-lg border border-bg-border hover:bg-white/5 transition-colors text-left"
    >
      <div className="size-8 rounded-lg grid place-items-center shrink-0 mt-0.5"
           style={{ background: value && theme ? theme.primarySoft : "var(--overlay-white)", color: value && theme ? theme.primary : "#a1a1aa" }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{subtitle}</div>
      </div>
      <div
        className={"shrink-0 mt-1 relative w-9 h-5 rounded-full transition-colors " + (value ? "" : "bg-zinc-700")}
        style={value && theme ? { background: theme.primary } : undefined}
      >
        <span
          className="absolute top-0.5 size-4 rounded-full bg-white transition-all"
          style={{ left: value ? "calc(100% - 18px)" : "2px" }}
        />
      </div>
    </button>
  );
}
