import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Lock, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth, loginRequest } from "../lib/auth";
import { TENANTS, TENANT_LIST, TenantId } from "../lib/tenants";

export default function Login() {
  const navigate = useNavigate();
  const setSession = useAuth((s) => s.setSession);
  const [selected, setSelected] = useState<TenantId | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const blob = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!blob.current) return;
      blob.current.style.transform = `translate3d(${e.clientX - 300}px, ${e.clientY - 300}px, 0)`;
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!selected) { toast.error("Choisis d'abord un espace"); return; }
    setLoading(true);
    const email = selected === "vbweb" ? "contact@vbweb.fr" : "contact@ouibo.fr";
    const r = await loginRequest(email, password);
    setLoading(false);
    if (!r.ok || !r.tenantId) { toast.error(r.reason || "Mot de passe incorrect"); return; }
    setSession({ tenantId: r.tenantId, email });
    toast.success(`Bienvenue · ${TENANTS[r.tenantId].name}`);
    navigate("/dashboard");
  }

  const tenant = selected ? TENANTS[selected] : null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg flex items-center justify-center p-6">
      {/* Mouse-following blob */}
      <div
        aria-hidden
        ref={blob}
        className="pointer-events-none fixed top-0 left-0 size-[600px] rounded-full blur-3xl opacity-30 transition-all duration-300 -z-0"
        style={{
          background: tenant
            ? `radial-gradient(circle, ${tenant.primary} 0%, transparent 60%)`
            : "radial-gradient(circle, #3463ff 0%, transparent 60%)",
        }}
      />
      {/* Subtle grid */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />

      <div className="relative w-full max-w-xl">
        {/* Logos en haut */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {TENANT_LIST.map((t) => {
            const isSelected = selected === t.id;
            const isDimmed = selected && !isSelected;
            return (
              <button
                key={t.id}
                onClick={() => { setSelected(t.id); setPassword(""); }}
                className={
                  "group relative card aspect-[16/10] overflow-hidden transition-all duration-300 " +
                  (isSelected ? "scale-[1.02] " : "hover:scale-[1.02] ") +
                  (isDimmed ? "opacity-40 hover:opacity-70 " : "")
                }
                style={
                  isSelected
                    ? { borderColor: t.primary, boxShadow: `0 30px 80px -30px ${t.primary}, 0 0 0 2px ${t.primarySoft}` }
                    : undefined
                }
              >
                <div
                  className="absolute inset-0 transition-opacity duration-500"
                  style={{
                    background: `radial-gradient(ellipse at center, ${t.primarySoft}, transparent 70%)`,
                    opacity: isSelected ? 0.9 : 0.35,
                  }}
                />
                <div className="absolute inset-0 grid place-items-center p-6">
                  <img
                    src={t.logo}
                    alt={t.name}
                    className="max-h-[70%] max-w-[75%] object-contain transition-transform duration-500 group-hover:scale-105 drop-shadow-[0_15px_40px_rgba(0,0,0,0.5)]"
                  />
                </div>
                {isSelected && (
                  <div
                    className="absolute top-2 right-2 size-6 rounded-full grid place-items-center text-white text-[10px] font-bold animate-fade-in"
                    style={{ background: t.primary }}
                  >
                    ✓
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Mot de passe */}
        <form
          onSubmit={submit}
          className="card p-5 animate-fade-in"
          style={tenant ? { borderColor: tenant.primarySoft } : undefined}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="label">Mot de passe</div>
            {tenant && (
              <div className="text-[11px] text-zinc-500">
                Espace : <span className="text-zinc-300 font-medium">{tenant.name}</span>
              </div>
            )}
          </div>

          <div className="relative">
            <Lock className="size-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={selected ? "••••••••" : "Sélectionne un espace ci-dessus"}
              disabled={!selected}
              className="input pl-9 h-11"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !selected || !password}
            className="btn-primary w-full justify-center mt-3 h-11"
            style={
              tenant
                ? { background: tenant.primary, boxShadow: `0 20px 50px -20px ${tenant.primary}` }
                : undefined
            }
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
            Entrer dans l'espace
          </button>
        </form>

        <div className="mt-4 text-center text-[11px] text-zinc-600">
          Sécurisé · AES-256-GCM · MongoDB · Cloudflare
        </div>
      </div>
    </div>
  );
}
