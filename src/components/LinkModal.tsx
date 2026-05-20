import { useEffect, useMemo, useState } from "react";
import { Link2, Globe, ArrowRight, AlertCircle } from "lucide-react";
import Modal from "./Modal";
import { useTheme } from "../lib/auth";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { url: string; title?: string }) => void;
};

export default function LinkModal({ open, onClose, onSubmit }: Props) {
  const theme = useTheme();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (open) { setUrl(""); setTitle(""); }
  }, [open]);

  const parsed = useMemo(() => {
    const trimmed = url.trim();
    if (!trimmed) return null;
    try {
      const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : "https://" + trimmed;
      const u = new URL(withProto);
      return { full: withProto, host: u.hostname.replace(/^www\./, "") };
    } catch { return null; }
  }, [url]);

  const error = url && !parsed ? "URL invalide" : null;

  function submit() {
    if (!parsed) return;
    onSubmit({ url: parsed.full, title: title.trim() || undefined });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajouter un lien"
      subtitle="Le lien sera attaché à ton post et affiché dans l'aperçu LinkedIn."
      icon={<Link2 className="size-4" style={{ color: theme?.primary }} />}
    >
      <div className="space-y-4">
        <div>
          <label className="label">URL</label>
          <div className="relative mt-1.5">
            <Globe className="size-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              autoFocus
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && parsed) submit(); }}
              placeholder="vbweb.fr  ou  https://exemple.com/article"
              className="input pl-9"
            />
          </div>
          {error && (
            <div className="mt-1.5 text-[11px] text-rose-300 flex items-center gap-1">
              <AlertCircle className="size-3" /> {error}
            </div>
          )}
        </div>

        <div>
          <label className="label">Titre (optionnel)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && parsed) submit(); }}
            placeholder="Ex: Notre nouveau case study"
            className="input mt-1.5"
          />
        </div>

        {/* Live preview */}
        {parsed && (
          <div
            className="rounded-xl p-3 flex items-center gap-3 animate-fade-in"
            style={{ background: "var(--bg-soft)", border: `1px solid ${theme?.primarySoft || "var(--bg-border)"}` }}
          >
            <img
              src={`https://www.google.com/s2/favicons?domain=${parsed.host}&sz=64`}
              alt=""
              className="size-10 rounded-md bg-white/5 shrink-0 border border-bg-border"
              onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0")}
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate" style={{ color: "var(--fg)" }}>
                {title || parsed.host}
              </div>
              <div className="text-[11px] text-zinc-500 truncate">{parsed.full}</div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost">Annuler</button>
          <button
            onClick={submit}
            disabled={!parsed}
            className="btn-primary"
            style={theme && parsed ? { background: theme.primary, boxShadow: `0 14px 36px -14px ${theme.primary}` } : undefined}
          >
            Ajouter le lien <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </Modal>
  );
}
