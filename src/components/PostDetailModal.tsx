import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Pencil, Copy, Trash2, ExternalLink, CheckCircle2, Clock, AlertTriangle, Image as ImageIcon,
  Video, Link as LinkIcon, Sparkles, Hash, ArrowLeft,
} from "lucide-react";
import Modal from "./Modal";
import ConfirmModal from "./ConfirmModal";
import { Api, Post } from "../lib/api";
import { useTheme } from "../lib/auth";
import { useCurrentAccount } from "../lib/store";
import { formatDate } from "../lib/utils";

type Props = {
  post: Post | null;
  onClose: () => void;
};

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  draft:     { label: "Brouillon", color: "#a1a1aa", bg: "rgba(161,161,170,0.12)", icon: Sparkles },
  scheduled: { label: "Programmé", color: "#fbbf24", bg: "rgba(245,158,11,0.12)",  icon: Clock },
  published: { label: "Publié",    color: "#34d399", bg: "rgba(16,185,129,0.12)",  icon: CheckCircle2 },
  failed:    { label: "Échec",     color: "#fb7185", bg: "rgba(244,63,94,0.12)",   icon: AlertTriangle },
  archived:  { label: "Archivé",   color: "#94a3b8", bg: "rgba(148,163,184,0.12)", icon: Sparkles },
};

export default function PostDetailModal({ post, onClose }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const theme = useTheme();
  const account = useCurrentAccount();
  const [askDelete, setAskDelete] = useState(false);

  if (!post) return null;
  const meta = STATUS_META[post.status] || STATUS_META.draft;
  const Icon = meta.icon;
  const linkedinUrl = post.linkedinPostId && !post.linkedinPostId.startsWith("urn:li:mock")
    ? `https://www.linkedin.com/feed/update/${encodeURIComponent(post.linkedinPostId)}/`
    : null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(post!.content || "");
      toast.success("Contenu copié");
    } catch (e: any) { toast.error("Copie impossible : " + e.message); }
  }

  async function duplicate() {
    try {
      const p = await Api.createPost({
        accountId: post!.accountId,
        content: post!.content,
        type: post!.type,
        tone: post!.tone,
        media: post!.media.filter((m) => m.kind === "link"),
        status: "draft",
      });
      toast.success("Brouillon créé");
      qc.invalidateQueries({ queryKey: ["posts"] });
      onClose();
      navigate(`/compose/${p._id}`);
    } catch (e: any) { toast.error(e.message); }
  }

  async function doDelete() {
    try {
      await Api.deletePost(post!._id);
      toast.success("Post supprimé");
      qc.invalidateQueries({ queryKey: ["posts"] });
      onClose();
    } catch (e: any) { toast.error(e.message); throw e; }
  }

  const charCount = post.content.length;
  const wordCount = post.content.trim() ? post.content.trim().split(/\s+/).length : 0;
  const readingTime = Math.max(1, Math.round(wordCount / 220));

  return (
    <>
      <Modal open={!!post} onClose={onClose} width={920}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 lg:gap-5 -mt-2">

          {/* ── LEFT : LinkedIn-style preview ── */}
          <div className="min-w-0">
            <div className="rounded-xl overflow-hidden bg-white text-zinc-900 max-h-[520px] overflow-y-auto">
              <div className="p-3 flex items-center gap-2 sticky top-0 bg-white z-10 border-b border-zinc-100">
                <div className="size-10 rounded-full shrink-0" style={{ background: account?.avatarColor || "#3463ff" }} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{account?.displayName}</div>
                  <div className="text-[11px] text-zinc-500">
                    {post.publishedAt ? formatDate(post.publishedAt, true) :
                     post.scheduledAt ? `Programmé · ${formatDate(post.scheduledAt, true)}` :
                     "Brouillon"} · 🌐
                  </div>
                </div>
              </div>
              <pre
                className="px-3 py-3 text-sm whitespace-pre-wrap font-sans leading-relaxed"
                style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
              >{post.content || "(post vide)"}</pre>

              {post.media.length > 0 && (
                <div className="border-t border-zinc-100">
                  {post.media.filter((m) => m.kind === "image").length > 0 && (
                    <ImageMosaic items={post.media.filter((m) => m.kind === "image")} />
                  )}
                  {post.media.filter((m) => m.kind === "video").map((m, i) => (
                    <video key={"v" + i} src={m.url} controls className="w-full aspect-video object-cover bg-black" />
                  ))}
                  {post.media.filter((m) => m.kind === "link").map((m, i) => (
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
            </div>
          </div>

          {/* ── RIGHT : meta + stats + actions ── */}
          <div className="space-y-3 flex flex-col">
            {/* Status block */}
            <div className="card p-3" style={{ background: meta.bg, borderColor: "transparent" }}>
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg grid place-items-center" style={{ background: "rgba(0,0,0,0.2)" }}>
                  <Icon className="size-4" style={{ color: meta.color }} />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: meta.color }}>{meta.label}</div>
                  <div className="text-xs text-zinc-200">
                    {post.status === "published" && post.publishedAt && formatDate(post.publishedAt, true)}
                    {post.status === "scheduled" && post.scheduledAt && formatDate(post.scheduledAt, true)}
                    {post.status === "draft" && `Modifié ${formatDate(post.updatedAt, true)}`}
                    {post.status === "failed" && (post.error?.slice(0, 40) || "Échec")}
                  </div>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="tag">{post.type}</span>
              <span className="tag">{post.tone}</span>
            </div>

            {/* Compact stats */}
            <div className="card p-3 space-y-2">
              <StatRow label="Caractères" value={charCount.toString()} />
              <StatRow label="Mots" value={wordCount.toString()} />
              <StatRow label="Temps de lecture" value={`~${readingTime} min`} />
              <StatRow label="Médias" value={
                <span className="flex items-center gap-1">
                  {post.media.length}
                  {post.media.some((m) => m.kind === "image") && <ImageIcon className="size-3 opacity-60" />}
                  {post.media.some((m) => m.kind === "video") && <Video className="size-3 opacity-60" />}
                  {post.media.some((m) => m.kind === "link") && <LinkIcon className="size-3 opacity-60" />}
                </span>
              } />
            </div>

            {/* Primary CTAs */}
            <div className="flex flex-col gap-2">
              {linkedinUrl && (
                <a
                  href={linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary justify-center"
                  style={theme ? { background: theme.primary, boxShadow: `0 14px 36px -14px ${theme.primary}` } : undefined}
                >
                  <ExternalLink className="size-4" /> Voir sur LinkedIn
                </a>
              )}
              <button
                onClick={() => { onClose(); navigate(`/compose/${post._id}`); }}
                className={linkedinUrl ? "btn-outline justify-center" : "btn-primary justify-center"}
                style={!linkedinUrl && theme ? { background: theme.primary, boxShadow: `0 14px 36px -14px ${theme.primary}` } : undefined}
              >
                <Pencil className="size-4" /> {post.status === "published" ? "Détails" : "Modifier"}
              </button>
            </div>

            {/* Secondary row */}
            <div className="flex items-center gap-1.5 pt-1">
              <button onClick={copy} className="btn-ghost flex-1 justify-center text-xs" title="Copier le contenu">
                <Copy className="size-3.5" /> Copier
              </button>
              <button onClick={duplicate} className="btn-ghost flex-1 justify-center text-xs" title="Dupliquer en brouillon">
                <Hash className="size-3.5" /> Dupliquer
              </button>
              <button
                onClick={() => setAskDelete(true)}
                className="btn-ghost text-rose-300 hover:bg-rose-500/10 px-2"
                title="Supprimer"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>

            <div className="flex-1" />

            {/* Back button */}
            <button onClick={onClose} className="btn-ghost justify-center text-xs text-zinc-400">
              <ArrowLeft className="size-3.5" /> Retour
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={askDelete}
        onClose={() => setAskDelete(false)}
        onConfirm={doDelete}
        title="Supprimer ce post ?"
        message={
          <>
            <span className="block">Action irréversible côté OUIWEB.</span>
            <span className="block mt-1 text-zinc-500">
              {post.status === "published"
                ? "Le post reste publié sur LinkedIn — seul l'enregistrement local sera supprimé."
                : "Le brouillon ou la programmation sera définitivement perdu."}
            </span>
          </>
        }
        confirmLabel="Oui, supprimer"
        variant="danger"
      />
    </>
  );
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-zinc-500">{label}</span>
      <span className="font-semibold text-zinc-100">{value}</span>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="card p-3">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="text-lg font-semibold mt-0.5 flex items-center gap-1.5">
        {value}
        {icon && <span className="text-zinc-400">{icon}</span>}
      </div>
    </div>
  );
}

function ImageMosaic({ items }: { items: { url: string; alt?: string }[] }) {
  if (items.length === 1) {
    return <img src={items[0].url} alt={items[0].alt} className="w-full max-h-[300px] object-cover" />;
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
