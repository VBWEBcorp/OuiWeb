import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Sparkles, Image as ImageIcon, Video, Link2, Calendar, Send, Save, Hash, Wand2, RefreshCcw, X, Loader2, Copy, Trash2, ArrowLeft, Check, CheckCircle2,
} from "lucide-react";
import { Api, Post } from "../lib/api";
import { useStore, useCurrentAccount } from "../lib/store";
import { useTheme } from "../lib/auth";
import { POST_TYPES, TONES } from "../lib/constants";
import { formatDate } from "../lib/utils";
import MiniCalendar from "../components/MiniCalendar";
import LinkModal from "../components/LinkModal";
import ConfirmModal from "../components/ConfirmModal";

function MediaGrid({ items }: { items: { url: string; alt?: string }[] }) {
  if (items.length === 1) {
    return <img src={items[0].url} alt={items[0].alt} className="w-full max-h-[460px] object-cover" />;
  }
  if (items.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-px bg-zinc-100">
        {items.map((m, i) => (
          <img key={i} src={m.url} alt={m.alt} className="w-full aspect-square object-cover" />
        ))}
      </div>
    );
  }
  if (items.length === 3) {
    return (
      <div className="grid grid-cols-2 gap-px bg-zinc-100">
        <img src={items[0].url} alt={items[0].alt} className="row-span-2 w-full h-full object-cover" />
        <img src={items[1].url} alt={items[1].alt} className="w-full aspect-square object-cover" />
        <img src={items[2].url} alt={items[2].alt} className="w-full aspect-square object-cover" />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-px bg-zinc-100">
      {items.slice(0, 4).map((m, i) => (
        <div key={i} className="relative">
          <img src={m.url} alt={m.alt} className="w-full aspect-square object-cover" />
          {i === 3 && items.length > 4 && (
            <div className="absolute inset-0 bg-black/55 grid place-items-center text-white font-medium">
              +{items.length - 4}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Compose() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const accountId = useStore((s) => s.currentAccountId)!;
  const account = useCurrentAccount();
  const theme = useTheme();

  const { data: existing } = useQuery({
    queryKey: ["post", id],
    queryFn: () => Api.getPost(id!),
    enabled: !!id,
  });

  const [content, setContent] = useState("");
  const [type, setType] = useState<string>("storytelling");
  const [tone, setTone] = useState<string>("professional");
  const [media, setMedia] = useState<Post["media"]>([]);
  const [postId, setPostId] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState<string>(() => {
    const seed = sessionStorage.getItem("compose:initialDate");
    if (seed) { sessionStorage.removeItem("compose:initialDate"); return seed; }
    return "";
  });
  const [variants, setVariants] = useState<string[]>([]);
  const [variantIdx, setVariantIdx] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [askPastPublish, setAskPastPublish] = useState<null | (() => void)>(null);
  const [showAI, setShowAI] = useState(false);
  const [aiTopic, setAITopic] = useState("");
  const [aiExtra, setAIExtra] = useState("");
  const [aiCount, setAICount] = useState(3);
  const [generating, setGenerating] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (existing) {
      setContent(existing.content);
      setType(existing.type);
      setTone(existing.tone);
      setMedia(existing.media);
      setPostId(existing._id);
      setScheduledAt(existing.scheduledAt ? existing.scheduledAt.slice(0, 16) : "");
    }
  }, [existing]);

  /* ─── Autosave ─── */
  const dirtyRef = useRef(false);
  const latestRef = useRef({ postId, content, type, tone, media, accountId, status: existing?.status });
  useEffect(() => {
    latestRef.current = { postId, content, type, tone, media, accountId, status: existing?.status };
    dirtyRef.current = true;
  }, [content, type, tone, media, postId, accountId, existing?.status]);

  useEffect(() => {
    const t = setInterval(async () => {
      if (!dirtyRef.current) return;
      if (latestRef.current.status === "published") return;
      if (!latestRef.current.content.trim()) return;
      dirtyRef.current = false;
      try {
        const cur = latestRef.current;
        if (cur.postId) {
          await Api.updatePost(cur.postId, { content: cur.content, type: cur.type, tone: cur.tone, media: cur.media });
        } else {
          const p = await Api.createPost({
            accountId: cur.accountId, content: cur.content, type: cur.type, tone: cur.tone, media: cur.media, status: "draft",
          });
          setPostId(p._id);
          qc.invalidateQueries({ queryKey: ["posts"] });
        }
      } catch (e: any) {
        toast.error("Autosave: " + e.message);
      }
    }, 3000);
    return () => clearInterval(t);
  }, [qc]);

  /* ─── Save-on-leave : tout post non vide est conservé en brouillon ─── */
  useEffect(() => {
    return () => {
      const cur = latestRef.current;
      if (!cur.content.trim()) return;
      if (!dirtyRef.current && cur.postId) return; // déjà à jour
      // Brouillon par défaut pour les nouveaux posts ; ne casse pas un post programmé/publié existant.
      if (cur.postId) {
        Api.updatePost(cur.postId, { content: cur.content, type: cur.type, tone: cur.tone, media: cur.media }).catch(() => {});
      } else {
        Api.createPost({
          accountId: cur.accountId, content: cur.content, type: cur.type, tone: cur.tone, media: cur.media, status: "draft",
        }).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── beforeunload : protège contre fermeture d'onglet sans autosave ─── */
  useEffect(() => {
    const onUnload = () => {
      const cur = latestRef.current;
      if (!cur.content.trim() || !dirtyRef.current) return;
      const url = "/api" + (cur.postId ? `/posts/${cur.postId}` : "/posts");
      const payload = JSON.stringify(
        cur.postId
          ? { content: cur.content, type: cur.type, tone: cur.tone, media: cur.media }
          : { accountId: cur.accountId, content: cur.content, type: cur.type, tone: cur.tone, media: cur.media, status: "draft" }
      );
      // sendBeacon est POST-only ; pour PUT on tente fetch keepalive en fallback.
      if (!cur.postId && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        const tenantId = JSON.parse(localStorage.getItem("ouiweb.session") || "{}")?.state?.tenantId;
        const u = tenantId ? `${url}?tenantId=${tenantId}` : url;
        navigator.sendBeacon(u, blob);
      } else {
        try {
          fetch(url, {
            method: cur.postId ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
          });
        } catch {}
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  /* ─── Drag & drop ─── */
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      el.classList.remove("ring-2", "ring-brand-500/40");
      const files = Array.from(e.dataTransfer?.files || []);
      for (const f of files) await uploadFile(f);
    };
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      el.classList.add("ring-2", "ring-brand-500/40");
    };
    const onDragLeave = () => el.classList.remove("ring-2", "ring-brand-500/40");
    el.addEventListener("drop", onDrop);
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("dragleave", onDragLeave);
    return () => {
      el.removeEventListener("drop", onDrop);
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("dragleave", onDragLeave);
    };
  }, []);

  const IMAGE_MIMES = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
  const VIDEO_MIMES = ["video/mp4", "video/quicktime", "video/x-m4v", "video/webm"];

  async function uploadFile(f: File, expected?: "image" | "video") {
    const isImage = f.type.startsWith("image/");
    const isVideo = f.type.startsWith("video/");
    if (!isImage && !isVideo) {
      toast.error(`${f.name} : format non supporté (image ou vidéo uniquement)`);
      return;
    }
    if (expected === "image" && !isImage) {
      toast.error(`${f.name} n'est pas une image. Utilise le bouton Vidéo.`);
      return;
    }
    if (expected === "video" && !isVideo) {
      toast.error(`${f.name} n'est pas une vidéo. Utilise le bouton Image.`);
      return;
    }
    if (isImage && !IMAGE_MIMES.includes(f.type)) {
      toast.error(`Format image non supporté par LinkedIn : ${f.type}. Formats : JPG, PNG, GIF.`);
      return;
    }
    if (isVideo && !VIDEO_MIMES.includes(f.type)) {
      toast.error(`Format vidéo non supporté par LinkedIn : ${f.type}. Formats : MP4, MOV, WEBM.`);
      return;
    }
    const tId = toast.loading(`Upload ${f.name}…`);
    try {
      const r = await Api.uploadMedia(f);
      setMedia((m) => [...m, { kind: r.kind, url: r.url, alt: f.name }]);
      toast.success("Média ajouté", { id: tId });
    } catch (e: any) {
      toast.error(e.message, { id: tId });
    }
  }

  function addLink() {
    setLinkOpen(true);
  }

  const generate = useMutation({
    mutationFn: () =>
      Api.aiGenerate({ accountId, topic: aiTopic || content.slice(0, 200), tone, type, variants: aiCount, extra: aiExtra }),
    onMutate: () => setGenerating(true),
    onSettled: () => setGenerating(false),
    onSuccess: (r) => {
      setVariants(r.variants);
      setVariantIdx(0);
      if (r.usedFallback) toast("Pas de clé DeepSeek — variante mock utilisée.", { icon: "🧪" });
      else toast.success("Variantes générées");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const improve = async (mode: "rewrite" | "punchier" | "shorter" | "longer") => {
    if (!content.trim()) return;
    const tId = toast.loading("IA en réflexion…");
    try {
      const r = await Api.aiImprove(content, accountId, mode);
      setContent(r.text);
      toast.success("Texte mis à jour", { id: tId });
    } catch (e: any) { toast.error(e.message, { id: tId }); }
  };

  const addHashtags = async () => {
    if (!content.trim()) return;
    const tId = toast.loading("Hashtags…");
    try {
      const r = await Api.aiHashtags(content);
      setContent((c) => c.trimEnd() + "\n\n" + r.hashtags.map(h => `#${h.replace(/^#/, "")}`).join(" "));
      toast.success("Hashtags ajoutés", { id: tId });
    } catch (e: any) { toast.error(e.message, { id: tId }); }
  };

  async function ensureSaved(): Promise<string> {
    if (postId) {
      await Api.updatePost(postId, { content, type, tone, media });
      return postId;
    }
    const p = await Api.createPost({ accountId, content, type, tone, media });
    setPostId(p._id);
    return p._id;
  }

  function ensureConnected(): boolean {
    if (!account?.connected) {
      toast.error(
        "Compte LinkedIn non connecté · va dans Réglages pour le connecter",
        { duration: 4000 }
      );
      return false;
    }
    return true;
  }

  async function onSchedule() {
    if (!scheduledAt) { toast.error("Choisis une date/heure"); return; }
    if (!ensureConnected()) return;
    const tId = toast.loading("Programmation…");
    try {
      const id = await ensureSaved();
      await Api.schedulePost(id, new Date(scheduledAt).toISOString());
      toast.success("Programmé !", { id: tId });
      qc.invalidateQueries({ queryKey: ["posts"] });
    } catch (e: any) { toast.error(e.message, { id: tId }); }
  }

  async function onPublishNow() {
    if (!ensureConnected()) return;
    const tId = toast.loading("Publication LinkedIn…");
    try {
      const id = await ensureSaved();
      await Api.publishNow(id);
      toast.success("Publié sur LinkedIn !", { id: tId });
      qc.invalidateQueries({ queryKey: ["posts"] });
      navigate("/dashboard");
    } catch (e: any) { toast.error(e.message, { id: tId }); }
  }

  /** Smart action: publishes immediately if no date, otherwise schedules */
  async function onSmartPublish() {
    if (scheduledAt) {
      const target = new Date(scheduledAt);
      if (target.getTime() <= Date.now() + 60_000) {
        // Ask via the nice modal
        setAskPastPublish(() => async () => { await onPublishNow(); });
      } else {
        await onSchedule();
      }
    } else {
      await onPublishNow();
    }
  }

  const charCount = content.length;
  const overLimit = charCount > 3000;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const readingTime = Math.max(1, Math.round(wordCount / 220));
  const FOLD = 210;
  const SWEET = 1300;
  const status = existing?.status || (postId ? "draft" : "draft");
  const isPublished = status === "published";
  const readOnly = isPublished;

  async function duplicateAsDraft() {
    if (!content.trim()) { toast.error("Rien à dupliquer"); return; }
    const tId = toast.loading("Duplication…");
    try {
      const p = await Api.createPost({
        accountId, content, type, tone,
        media: media.filter((m) => m.kind === "link"), // don't carry over uploaded files (paths only)
        status: "draft",
      });
      toast.success("Brouillon créé à partir de ce post", { id: tId });
      qc.invalidateQueries({ queryKey: ["posts"] });
      navigate(`/compose/${p._id}`);
    } catch (e: any) {
      toast.error(e.message, { id: tId });
    }
  }
  const statusColor: Record<string, string> = {
    draft: "bg-zinc-400/20 text-zinc-300 border-zinc-400/30",
    scheduled: "bg-amber-400/20 text-amber-300 border-amber-400/30",
    published: "bg-emerald-400/20 text-emerald-300 border-emerald-400/30",
    failed: "bg-rose-400/20 text-rose-300 border-rose-400/30",
    archived: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  };
  const statusLabel: Record<string, string> = {
    draft: "Brouillon", scheduled: "Programmé", published: "Publié", failed: "Échec", archived: "Archivé",
  };

  return (
    <div className="space-y-5 -mt-2">
      {/* ─── STICKY TOP BAR ─── */}
      <div className="sticky top-[52px] md:top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10 py-3 backdrop-blur-xl border-b border-bg-border"
           style={{ background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}>
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="btn-ghost px-2 shrink-0" title="Retour">
            <ArrowLeft className="size-4" />
          </button>
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight truncate">Composer</h1>
            <span className={`tag border ${statusColor[status] || statusColor.draft}`}>
              <span className="size-1.5 rounded-full bg-current opacity-80" />
              {statusLabel[status] || "Brouillon"}
            </span>
            <span className="text-[11px] text-zinc-500 hidden md:inline">
              · {wordCount} mots · ~{readingTime} min
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={async () => {
                if (!content.trim()) { toast.error("Rien à copier"); return; }
                try { await navigator.clipboard.writeText(content); toast.success("Contenu copié"); }
                catch (e: any) { toast.error("Copie impossible : " + e.message); }
              }}
              className="btn-ghost px-2" title="Copier le contenu"
            >
              <Copy className="size-4" />
            </button>
            <button
              onClick={() => {
                if (!postId) { setContent(""); setMedia([]); setScheduledAt(""); toast.success("Vidé"); return; }
                setAskDelete(true);
              }}
              className="btn-ghost px-2 text-rose-300 hover:bg-rose-500/10"
              title="Supprimer"
            >
              <Trash2 className="size-4" />
            </button>
            <div className="w-px h-6 bg-bg-border mx-1" />
            {isPublished ? (
              <button
                onClick={duplicateAsDraft}
                className="btn-primary"
                style={theme ? { background: theme.primary, boxShadow: `0 14px 36px -14px ${theme.primary}` } : undefined}
                title="Créer un nouveau brouillon à partir de ce post"
              >
                <Copy className="size-4" /> Dupliquer en brouillon
              </button>
            ) : (
              <>
                <button
                  onClick={() => ensureSaved().then(() => toast.success("Brouillon sauvegardé"))}
                  className="btn-ghost"
                >
                  <Save className="size-4" /> Brouillon
                </button>
                <button
                  onClick={onSmartPublish}
                  disabled={!account?.connected}
                  className="btn-primary"
                  style={
                    account?.connected && theme
                      ? { background: theme.primary, boxShadow: `0 14px 36px -14px ${theme.primary}` }
                      : !account?.connected
                      ? { opacity: 0.5, cursor: "not-allowed", background: "#52525b" }
                      : undefined
                  }
                  title={
                    !account?.connected
                      ? "Connecte ton compte LinkedIn dans Réglages pour publier ou programmer"
                      : scheduledAt
                      ? "Programmer pour la date choisie"
                      : "Publier immédiatement"
                  }
                >
                  {scheduledAt ? <Calendar className="size-4" /> : <Send className="size-4" />}
                  {scheduledAt
                    ? `Programmer · ${new Date(scheduledAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
                    : "Publier maintenant"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── 3-COLUMN BODY ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_360px] gap-5">
        {/* LEFT — calendrier sticky (caché si déjà publié) */}
        <aside className="order-2 lg:order-1">
          {isPublished ? (
            <div className="card p-4 lg:sticky lg:top-[80px]">
              <div className="label flex items-center gap-1.5 mb-3">
                <CheckCircle2 className="size-3.5 text-emerald-400" /> Publié
              </div>
              <div className="text-xs text-zinc-400 leading-relaxed">
                Ce post est en ligne sur LinkedIn depuis le {existing?.publishedAt && formatDate(existing.publishedAt, true)}.
                Tu peux le <strong className="text-zinc-200">copier</strong> ou le <strong className="text-zinc-200">dupliquer en brouillon</strong> pour le réutiliser.
              </div>
              {existing?.linkedinPostId && (
                <div className="mt-3 text-[10px] text-zinc-500 break-all">
                  ID : <code className="text-zinc-400">{existing.linkedinPostId}</code>
                </div>
              )}
            </div>
          ) : (
            <div className="card p-4 lg:sticky lg:top-[80px]">
              <div className="flex items-center justify-between mb-3">
                <div className="label flex items-center gap-1.5">
                  <Calendar className="size-3.5" /> Programmation
                </div>
                {scheduledAt && (
                  <button onClick={() => setScheduledAt("")} className="text-[10px] text-zinc-500 hover:text-rose-300">
                    Effacer
                  </button>
                )}
              </div>
              <MiniCalendar value={scheduledAt || undefined} onChange={(v) => setScheduledAt(v)} />
              {scheduledAt && (
                <div
                  className="mt-3 text-[11px] rounded-lg p-2 border"
                  style={{
                    background: theme?.primarySoft,
                    borderColor: theme?.primarySoft,
                    color: theme?.primary,
                  }}
                >
                  <Calendar className="size-3 inline mr-1" />
                  <span className="font-medium">{formatDate(scheduledAt, true)}</span>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* CENTER — éditeur */}
        <div className="order-1 lg:order-2 min-w-0 space-y-4">
          <div ref={dropRef} className="card overflow-hidden">
            {/* Toolbar inline */}
            <div className="px-4 py-2.5 border-b border-bg-border flex items-center gap-2 flex-wrap">
              <select className="input h-8 text-xs max-w-[150px]" value={type} disabled={readOnly} onChange={(e) => setType(e.target.value)}>
                {POST_TYPES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <select className="input h-8 text-xs max-w-[150px]" value={tone} disabled={readOnly} onChange={(e) => setTone(e.target.value)}>
                {TONES.map((t) => <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
              </select>
              {!readOnly && (
                <>
                  <div className="w-px h-5 bg-bg-border" />
                  <button onClick={() => setShowAI((v) => !v)} className="btn-ghost text-xs px-2 h-8">
                    <Wand2 className="size-3.5" /> Générer IA
                  </button>
                  <button onClick={addHashtags} className="btn-ghost text-xs px-2 h-8">
                    <Hash className="size-3.5" /> Hashtags
                  </button>
                  <button onClick={() => improve("punchier")} className="btn-ghost text-xs px-2 h-8">
                    <Sparkles className="size-3.5" /> Améliorer
                  </button>
                </>
              )}
              <div className="flex-1" />
              <span
                className={
                  "text-[11px] font-medium px-2 py-0.5 rounded-md " +
                  (overLimit ? "bg-rose-500/10 text-rose-300" :
                    charCount > SWEET ? "bg-amber-500/10 text-amber-300" :
                    charCount > FOLD ? "bg-emerald-500/10 text-emerald-300" :
                    "bg-white/5 text-zinc-400")
                }
              >
                {charCount} / 3000
              </span>
            </div>

            {/* Progress bar */}
            <div className="relative h-1 bg-white/5">
              <div
                className="absolute inset-y-0 left-0 transition-all"
                style={{
                  width: Math.min(100, (charCount / 3000) * 100) + "%",
                  background: theme
                    ? `linear-gradient(90deg, ${theme.primary}, ${theme.primary}99)`
                    : "linear-gradient(90deg, #3463ff, #3463ff99)",
                }}
              />
              <div className="absolute top-0 bottom-0 w-px bg-white/30" style={{ left: (FOLD / 3000) * 100 + "%" }} title='"Voir plus" ~210 chars' />
              <div className="absolute top-0 bottom-0 w-px bg-emerald-400/70" style={{ left: (SWEET / 3000) * 100 + "%" }} title="Optimal ~1300 chars" />
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              readOnly={readOnly}
              placeholder={`Écris ton post LinkedIn ici…\n\nTip : glisse-dépose une image, ou clique sur "Générer IA".`}
              className={"w-full bg-transparent placeholder:text-zinc-500 px-5 py-4 text-[15px] leading-relaxed resize-none focus:outline-none " + (readOnly ? "cursor-default" : "")}
              style={{ minHeight: 360, color: "var(--fg)" }}
            />

            {media.length > 0 && (
              <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-3 gap-2">
                {media.map((m, i) => (
                  <div key={i} className="relative card overflow-hidden group">
                    {!readOnly && (
                      <button
                        onClick={() => setMedia((arr) => arr.filter((_, j) => j !== i))}
                        className="absolute top-1.5 right-1.5 z-10 size-6 rounded-full bg-black/70 grid place-items-center hover:bg-black opacity-80 group-hover:opacity-100"
                      >
                        <X className="size-3.5 text-white" />
                      </button>
                    )}
                    {m.kind === "image" && <img src={m.url} alt={m.alt} className="w-full aspect-video object-cover" />}
                    {m.kind === "video" && <video src={m.url} className="w-full aspect-video object-cover" controls />}
                    {m.kind === "link" && (
                      <div className="p-3 text-xs">
                        <Link2 className="size-3.5 inline mr-1" />
                        <a className="text-brand-300 break-all" href={m.url} target="_blank" rel="noreferrer">{m.url}</a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Bottom toolbar (caché si publié) */}
            {!readOnly && <div className="px-4 py-2.5 border-t border-bg-border flex items-center gap-1 flex-wrap">
              <input
                ref={imageRef} type="file" accept="image/jpeg,image/png,image/gif" hidden multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  files.forEach((f) => uploadFile(f, "image"));
                  if (imageRef.current) imageRef.current.value = "";
                }}
              />
              <input
                ref={videoRef} type="file" accept="video/mp4,video/quicktime,video/webm" hidden
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  files.forEach((f) => uploadFile(f, "video"));
                  if (videoRef.current) videoRef.current.value = "";
                }}
              />
              <button onClick={() => imageRef.current?.click()} className="btn-ghost text-xs px-2 h-8" title="Ajouter une image">
                <ImageIcon className="size-3.5" /> Image
              </button>
              <button onClick={() => videoRef.current?.click()} className="btn-ghost text-xs px-2 h-8" title="Ajouter une vidéo">
                <Video className="size-3.5" /> Vidéo
              </button>
              <button onClick={addLink} className="btn-ghost text-xs px-2 h-8" title="Ajouter un lien">
                <Link2 className="size-3.5" /> Lien
              </button>
              <div className="flex-1" />
              <button onClick={() => improve("shorter")} className="btn-ghost text-xs px-2 h-8" title="Raccourcir">Raccourcir</button>
              <button onClick={() => improve("longer")}  className="btn-ghost text-xs px-2 h-8" title="Allonger">Allonger</button>
              <button onClick={() => improve("rewrite")} className="btn-ghost text-xs px-2 h-8" title="Reformuler">Reformuler</button>
            </div>}
          </div>

        {showAI && !readOnly && (
          <div className="card p-4 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Wand2 className="size-4 text-brand-400" />
                <h3 className="font-medium">Générateur IA · DeepSeek</h3>
              </div>
              <button onClick={() => setShowAI(false)} className="btn-ghost px-2"><X className="size-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Sujet</label>
                <input value={aiTopic} onChange={(e) => setAITopic(e.target.value)} className="input mt-1" placeholder="Ex: leçons d'un raté de levée de fonds" />
              </div>
              <div>
                <label className="label">Variantes</label>
                <input type="number" min={1} max={5} value={aiCount} onChange={(e) => setAICount(+e.target.value)} className="input mt-1" />
              </div>
              <div className="md:col-span-2">
                <label className="label">Contexte additionnel (optionnel)</label>
                <textarea value={aiExtra} onChange={(e) => setAIExtra(e.target.value)} className="textarea mt-1 min-h-[80px]" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => generate.mutate()}
                disabled={generating}
                className="btn-primary"
              >
                {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Générer {aiCount} variantes
              </button>
              <span className="text-xs text-zinc-500">Persona du compte appliqué automatiquement.</span>
            </div>

            {variants.length > 0 && (() => {
              const v = variants[variantIdx] || "";
              const chars = v.length;
              return (
                <div className="mt-5 animate-fade-in">
                  {/* Tabs */}
                  <div className="flex items-center justify-between mb-3 gap-3">
                    <div className="flex items-center gap-1 p-1 rounded-xl border border-bg-border bg-bg-soft">
                      {variants.map((_, i) => {
                        const active = i === variantIdx;
                        return (
                          <button
                            key={i}
                            onClick={() => setVariantIdx(i)}
                            className={
                              "px-3 h-7 rounded-lg text-xs font-medium transition-colors " +
                              (active ? "text-white" : "text-zinc-400 hover:text-white")
                            }
                            style={active && theme ? { background: theme.primary } : undefined}
                          >
                            Variante {i + 1}
                          </button>
                        );
                      })}
                    </div>
                    <span className="text-[11px] text-zinc-500">{chars} caractères</span>
                  </div>

                  {/* Big card with selected variant */}
                  <div
                    className="card p-5 transition-colors"
                    style={theme ? { borderColor: theme.primarySoft } : undefined}
                  >
                    <pre
                      className="text-sm whitespace-pre-wrap font-sans leading-relaxed"
                      style={{ color: "var(--fg)", overflowWrap: "anywhere", wordBreak: "break-word" }}
                    >{v}</pre>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      className="btn-primary"
                      onClick={() => { setContent(v); toast.success("Variante appliquée"); }}
                      style={theme ? { background: theme.primary, boxShadow: `0 14px 36px -14px ${theme.primary}` } : undefined}
                    >
                      <Check className="size-4" /> Utiliser cette variante
                    </button>
                    <button
                      className="btn-outline"
                      onClick={async () => {
                        try { await navigator.clipboard.writeText(v); toast.success("Copié"); }
                        catch (e: any) { toast.error("Copie impossible : " + e.message); }
                      }}
                    >
                      <Copy className="size-4" /> Copier
                    </button>
                    <div className="flex-1" />
                    <button
                      className="btn-ghost"
                      onClick={() => generate.mutate()}
                      disabled={generating}
                      title="Générer de nouvelles variantes"
                    >
                      {generating ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
                      Régénérer
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ─── RIGHT ─── */}
      <aside className="order-3">
        <div className="card p-4 lg:sticky lg:top-[80px]">
          <div className="flex items-center justify-between mb-2">
            <div className="label">Aperçu LinkedIn</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Mobile</div>
          </div>
          <div className="rounded-xl bg-white text-zinc-900 overflow-hidden">
            <div className="p-3 flex items-center gap-2">
              <div className="size-10 rounded-full shrink-0" style={{ background: account?.avatarColor || "#3463ff" }} />
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{account?.displayName}</div>
                <div className="text-[11px] text-zinc-500">
                  {scheduledAt ? formatDate(scheduledAt, true) : "Maintenant"} · 🌐
                </div>
              </div>
            </div>
            {content && (
              <pre className="px-3 pb-3 text-sm whitespace-pre-wrap font-sans leading-relaxed">{content}</pre>
            )}
            {!content && media.length === 0 && (
              <pre className="px-3 pb-3 text-sm text-zinc-400 font-sans">Ton aperçu LinkedIn apparaîtra ici…</pre>
            )}

            {/* Médias */}
            {media.length > 0 && (
              <div className="border-t border-zinc-100">
                {media.filter((m) => m.kind === "image").length > 0 && (
                  <MediaGrid items={media.filter((m) => m.kind === "image")} />
                )}
                {media.filter((m) => m.kind === "video").map((m, i) => (
                  <video key={"v" + i} src={m.url} controls className="w-full aspect-video object-cover bg-black" />
                ))}
                {media.filter((m) => m.kind === "link").map((m, i) => (
                  <a key={"l" + i} href={m.url} target="_blank" rel="noreferrer"
                     className="flex items-center gap-2 p-3 border-t border-zinc-100 hover:bg-zinc-50 text-xs">
                    <div className="size-10 rounded bg-zinc-100 shrink-0 grid place-items-center text-zinc-500">🔗</div>
                    <div className="min-w-0">
                      <div className="text-zinc-900 font-medium truncate">{m.alt || "Lien externe"}</div>
                      <div className="text-zinc-500 truncate">{m.url}</div>
                    </div>
                  </a>
                ))}
              </div>
            )}

            {/* Bar reactions LinkedIn */}
            <div className="border-t border-zinc-100 px-3 py-2 flex items-center justify-between text-[11px] text-zinc-500">
              <div className="flex items-center gap-1">
                <span className="inline-block size-4 rounded-full bg-blue-500" />
                <span className="inline-block size-4 rounded-full bg-red-500 -ml-1.5" />
                <span className="ml-1">128</span>
              </div>
              <div>14 commentaires · 6 reposts</div>
            </div>
          </div>
        </div>
      </aside>
      </div>

      {/* Modal d'ajout de lien */}
      <LinkModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        onSubmit={({ url, title }) => {
          setMedia((m) => [...m, { kind: "link", url, alt: title }]);
          toast.success("Lien ajouté");
        }}
      />

      {/* Modal de suppression */}
      <ConfirmModal
        open={askDelete}
        onClose={() => setAskDelete(false)}
        onConfirm={async () => {
          if (!postId) return;
          try {
            await Api.deletePost(postId);
            toast.success("Post supprimé");
            qc.invalidateQueries({ queryKey: ["posts"] });
            navigate("/dashboard");
          } catch (e: any) { toast.error(e.message); throw e; }
        }}
        title="Supprimer ce post ?"
        message={
          <>
            <span className="block">Action irréversible côté OUIWEB.</span>
            <span className="block mt-1 text-zinc-500">
              {isPublished
                ? "Le post reste publié sur LinkedIn — seul l'enregistrement local sera supprimé."
                : "Le brouillon ou la programmation sera définitivement perdu."}
            </span>
          </>
        }
        confirmLabel="Oui, supprimer"
        variant="danger"
      />

      {/* Modal de confirmation "date passée → publier maintenant" */}
      <ConfirmModal
        open={!!askPastPublish}
        onClose={() => setAskPastPublish(null)}
        onConfirm={async () => {
          const fn = askPastPublish;
          if (fn) await fn();
        }}
        title="Date passée ou trop proche"
        message={
          <>
            <span className="block">
              La date <strong className="text-zinc-200">{scheduledAt && new Date(scheduledAt).toLocaleString("fr-FR")}</strong> ne permet plus de programmer.
            </span>
            <span className="block mt-1 text-zinc-500">Veux-tu publier maintenant à la place ?</span>
          </>
        }
        confirmLabel="Publier maintenant"
        variant="info"
        icon={<Send className="size-6" />}
      />
    </div>
  );
}
