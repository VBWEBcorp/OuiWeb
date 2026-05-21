import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Save, User, Briefcase, PenTool, Megaphone, Hash, Sparkles, Check, X, Plus,
  Eye, EyeOff, RotateCcw, Loader2,
} from "lucide-react";
import { Api, Persona as P } from "../lib/api";
import { useStore, useCurrentAccount } from "../lib/store";
import { useTheme } from "../lib/auth";
import { TONES } from "../lib/constants";
import ConfirmModal from "../components/ConfirmModal";

const EMPTY: P = {
  accountId: "",
  persona: "", audience: "", tone: "professional",
  businessContext: "", goals: "", writingStyle: "",
  favoriteCTAs: [], topics: [],
};

export default function PersonaPage() {
  const accountId = useStore((s) => s.currentAccountId)!;
  const account = useCurrentAccount();
  const theme = useTheme();
  const qc = useQueryClient();
  const [showPreview, setShowPreview] = useState(true);
  const [askReset, setAskReset] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["persona", accountId],
    queryFn: () => Api.persona(accountId),
    enabled: !!accountId,
  });

  const [state, setState] = useState<P>(EMPTY);
  const [pristine, setPristine] = useState<P>(EMPTY);

  useEffect(() => {
    if (data) {
      const d = { ...EMPTY, ...data, accountId };
      setState(d);
      setPristine(d);
    }
  }, [data, accountId]);

  const dirty = useMemo(() => JSON.stringify(state) !== JSON.stringify(pristine), [state, pristine]);

  const completion = useMemo(() => {
    const fields = ["persona", "audience", "tone", "businessContext", "goals", "writingStyle"] as const;
    let done = fields.filter((k) => String(state[k] || "").trim().length > 10).length;
    if (state.favoriteCTAs?.length) done++;
    if (state.topics?.length) done++;
    return Math.round((done / 8) * 100);
  }, [state]);

  const save = useMutation({
    mutationFn: (p: Partial<P>) => Api.updatePersona(accountId, p),
    onSuccess: () => {
      toast.success("Persona enregistré");
      setPristine(state);
      qc.invalidateQueries({ queryKey: ["persona", accountId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function update<K extends keyof P>(k: K, v: P[K]) {
    setState((s) => ({ ...s, [k]: v }));
  }
  function addChip(field: "favoriteCTAs" | "topics", val: string) {
    const t = val.trim();
    if (!t) return;
    const list = (state[field] || []) as string[];
    if (list.includes(t)) return;
    update(field, [...list, t] as any);
  }
  function removeChip(field: "favoriteCTAs" | "topics", idx: number) {
    const list = [...(state[field] || []) as string[]];
    list.splice(idx, 1);
    update(field, list as any);
  }
  function reset() {
    if (!dirty) return;
    setAskReset(true);
  }

  if (isLoading) return <div className="text-sm text-zinc-500">Chargement…</div>;

  return (
    <div className="space-y-5">
      {/* ─── Sticky header ─── */}
      <div className="sticky top-[52px] md:top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10 py-3 backdrop-blur-xl border-b border-bg-border"
           style={{ background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}>
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold tracking-tight">Persona & contexte</h1>
            <p className="text-[11px] text-zinc-500">
              Injecté automatiquement dans tous les prompts IA pour <span className="text-zinc-300 font-medium">{account?.displayName}</span>.
            </p>
          </div>

          <CompletionRing value={completion} color={theme?.primary || "#3463ff"} />

          <button
            onClick={() => setShowPreview((v) => !v)}
            className="btn-ghost hidden md:inline-flex"
            title="Aperçu du prompt"
          >
            {showPreview ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            <span className="hidden lg:inline">Prompt</span>
          </button>

          {dirty && (
            <button onClick={reset} className="btn-ghost text-zinc-400 hover:text-rose-300">
              <RotateCcw className="size-4" /> Annuler
            </button>
          )}

          <button
            onClick={() => save.mutate(state)}
            disabled={!dirty || save.isPending}
            className="btn-primary"
            style={theme ? { background: theme.primary, boxShadow: `0 14px 36px -14px ${theme.primary}` } : undefined}
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Enregistrer
          </button>
        </div>
      </div>

      {/* ─── Body : 2-col ─── */}
      <div className={"grid grid-cols-1 gap-5 " + (showPreview ? "lg:grid-cols-[1fr_360px]" : "")}>
        <div className="space-y-4 min-w-0">

          {/* IDENTITÉ */}
          <Section icon={<User className="size-4" />} title="Identité" subtitle="Qui es-tu ? À qui tu parles ?" theme={theme}>
            <div className="space-y-3">
              <Field label="Persona" value={state.persona} onChange={(v) => update("persona", v)} multiline
                placeholder="Ex: fondateur de SaaS B2B, transparent, opinionated…" />
              <Field label="Audience cible" value={state.audience} onChange={(v) => update("audience", v)} multiline
                placeholder="Ex: founders early-stage, head of growth, agences digitales…" />
            </div>
          </Section>

          {/* BUSINESS */}
          <Section icon={<Briefcase className="size-4" />} title="Business" subtitle="Le contexte qui guide les exemples" theme={theme}>
            <div className="space-y-3">
              <Field label="Contexte business" value={state.businessContext} onChange={(v) => update("businessContext", v)} multiline
                placeholder="Ex: agence de design @VBweb, 8 personnes, MRR 80k…" />
              <Field label="Objectifs" value={state.goals} onChange={(v) => update("goals", v)} multiline
                placeholder="Ex: 5k abonnés en 3 mois, 10 demandes inbound/mois" />
            </div>
          </Section>

          {/* STYLE */}
          <Section icon={<PenTool className="size-4" />} title="Style rédactionnel" subtitle="Ton, voix, format préférés" theme={theme}>
            <div className="space-y-4">
              <div>
                <label className="label">Ton préféré</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                  {TONES.map((t) => {
                    const active = state.tone === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => update("tone", t.id)}
                        className={
                          "flex items-center gap-1.5 px-2 py-2 rounded-lg border text-xs transition-all " +
                          (active ? "scale-[1.02]" : "hover:bg-white/5")
                        }
                        style={
                          active && theme
                            ? { borderColor: theme.primary, background: theme.primarySoft, color: theme.primary }
                            : { borderColor: "var(--bg-border)" }
                        }
                      >
                        <span className="text-base leading-none">{t.emoji}</span>
                        <span className="truncate">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <Field label="Style rédactionnel" value={state.writingStyle} onChange={(v) => update("writingStyle", v)}
                placeholder="Ex: phrases courtes, hooks forts, listes, exemples concrets" />
            </div>
          </Section>

          {/* CTA */}
          <Section icon={<Megaphone className="size-4" />} title="CTA favoris" subtitle="Tes call-to-action récurrents" theme={theme}>
            <ChipEditor
              items={state.favoriteCTAs || []}
              onAdd={(v) => addChip("favoriteCTAs", v)}
              onRemove={(i) => removeChip("favoriteCTAs", i)}
              placeholder="Ex: MP-moi 'GROWTH' et je t'envoie le doc"
              theme={theme}
            />
          </Section>

          {/* TOPICS */}
          <Section icon={<Hash className="size-4" />} title="Sujets principaux" subtitle="Les thèmes qui reviennent souvent" theme={theme}>
            <ChipEditor
              items={state.topics || []}
              onAdd={(v) => addChip("topics", v)}
              onRemove={(i) => removeChip("topics", i)}
              placeholder="Ex: Growth, SaaS B2B, Design système…"
              theme={theme}
            />
          </Section>
        </div>

        {/* ─── PREVIEW ─── */}
        {showPreview && (
          <aside>
            <div className="card p-4 lg:sticky lg:top-[88px]">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="size-4" style={{ color: theme?.primary }} />
                <div className="label">Prompt IA · ce que voit DeepSeek</div>
              </div>
              <pre
                className="text-[11px] leading-relaxed font-mono p-3 rounded-lg whitespace-pre-wrap"
                style={{ background: "var(--bg-soft)", border: "1px solid var(--bg-border)", color: "var(--fg-dim)", maxHeight: 480, overflow: "auto" }}
              >{buildSystemPreview(state)}</pre>
              <div className="mt-3 text-[10px] text-zinc-500 leading-relaxed">
                Ce contexte est combiné avec le sujet, le ton et le type de post pour générer du contenu sur mesure.
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */
function Section({
  icon, title, subtitle, theme, children,
}: { icon: React.ReactNode; title: string; subtitle?: string; theme: any; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="flex items-start gap-3 mb-4">
        <div
          className="size-9 rounded-lg grid place-items-center shrink-0"
          style={{ background: theme?.primarySoft, color: theme?.primary }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold tracking-tight">{title}</h3>
          {subtitle && <p className="text-[11px] text-zinc-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, multiline,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  return (
    <div>
      <label className="label">{label}</label>
      {multiline ? (
        <textarea
          className="textarea mt-1.5 min-h-[80px]"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          className="input mt-1.5"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

function ChipEditor({
  items, onAdd, onRemove, placeholder, theme,
}: {
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (i: number) => void;
  placeholder?: string;
  theme: any;
}) {
  const [input, setInput] = useState("");

  function submit() {
    if (!input.trim()) return;
    onAdd(input);
    setInput("");
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {items.length === 0 && (
          <div className="text-[11px] text-zinc-500 italic">Rien pour le moment — ajoute via le champ ci-dessous.</div>
        )}
        {items.map((s, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border animate-fade-in"
            style={{
              background: theme?.primarySoft || "var(--overlay-white)",
              color: theme?.primary,
              borderColor: theme?.primarySoft || "var(--bg-border)",
            }}
          >
            <Check className="size-3 opacity-70" />
            {s}
            <button
              onClick={() => onRemove(i)}
              className="ml-0.5 -mr-1 size-4 rounded-full grid place-items-center hover:bg-rose-500/20 hover:text-rose-300"
              title="Retirer"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder={placeholder}
          className="input flex-1"
        />
        <button onClick={submit} className="btn-outline px-3" title="Ajouter (Entrée)">
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

function CompletionRing({ value, color }: { value: number; color: string }) {
  const R = 14;
  const C = 2 * Math.PI * R;
  const offset = C - (value / 100) * C;
  return (
    <div className="hidden md:flex items-center gap-2 mr-1" title={`${value}% complété`}>
      <svg width="34" height="34" viewBox="0 0 34 34" className="-rotate-90">
        <circle cx="17" cy="17" r={R} stroke="var(--bg-border)" strokeWidth="3" fill="none" />
        <circle
          cx="17" cy="17" r={R}
          stroke={color} strokeWidth="3" fill="none"
          strokeDasharray={C} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset .6s ease" }}
        />
      </svg>
      <div className="leading-tight">
        <div className="text-xs font-semibold">{value}%</div>
        <div className="text-[9px] text-zinc-500 uppercase tracking-wider">Profil</div>
      </div>
    </div>
  );
}

function buildSystemPreview(p: P): string {
  if (!p.persona && !p.businessContext) {
    return "// Persona vide.\n// Remplis au moins ton persona + contexte business pour générer un prompt utile.";
  }
  return [
    "Tu es un copywriter LinkedIn premium. Tu rédiges des posts pour :",
    p.persona       ? `- Persona : ${p.persona}` : null,
    p.audience      ? `- Audience cible : ${p.audience}` : null,
    p.businessContext ? `- Contexte business : ${p.businessContext}` : null,
    p.goals         ? `- Objectifs : ${p.goals}` : null,
    p.writingStyle  ? `- Style rédactionnel : ${p.writingStyle}` : null,
    p.topics?.length ? `- Sujets favoris : ${p.topics.join(", ")}` : null,
    p.favoriteCTAs?.length ? `- CTA possibles : ${p.favoriteCTAs.join(" | ")}` : null,
    "",
    "Règles :",
    "- Hook puissant dans les 2 premières lignes.",
    "- Phrases courtes. Aération. Pas de jargon corporate.",
    "- Pas de hashtags dans le corps (max 5 en fin).",
    "- Pas de Markdown : ce sont des posts LinkedIn natifs.",
  ].filter(Boolean).join("\n");
}
