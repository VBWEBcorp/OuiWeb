import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Api, Post } from "../lib/api";
import { formatDate, truncate } from "../lib/utils";
import StatusBadge from "./StatusBadge";
import { Calendar, ImageIcon, Link as LinkIcon, Video, Copy, Trash2, Check } from "lucide-react";
import { useState } from "react";
import ConfirmModal from "./ConfirmModal";

export default function PostCard({ post }: { post: Post }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [askDelete, setAskDelete] = useState(false);

  const hasImg  = post.media.some((m) => m.kind === "image");
  const hasVid  = post.media.some((m) => m.kind === "video");
  const hasLink = post.media.some((m) => m.kind === "link");

  async function copy(e: React.MouseEvent) {
    e.stopPropagation(); e.preventDefault();
    try {
      await navigator.clipboard.writeText(post.content || "");
      setCopied(true);
      toast.success("Contenu copié");
      setTimeout(() => setCopied(false), 1500);
    } catch (err: any) {
      toast.error("Copie impossible : " + err.message);
    }
  }

  function remove(e: React.MouseEvent) {
    e.stopPropagation(); e.preventDefault();
    setAskDelete(true);
  }
  async function confirmDelete() {
    setBusy(true);
    try {
      await Api.deletePost(post._id);
      toast.success("Post supprimé");
      qc.invalidateQueries({ queryKey: ["posts"] });
    } catch (err: any) {
      toast.error(err.message);
      throw err;
    } finally { setBusy(false); }
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => navigate(`/compose/${post._id}`)}
      onKeyDown={(e) => { if (e.key === "Enter") navigate(`/compose/${post._id}`); }}
      className="group card p-4 hover:border-brand-500/40 transition-colors block animate-slide-up cursor-pointer overflow-hidden min-w-0"
    >
      <div className="flex items-center justify-between mb-2">
        <StatusBadge status={post.status} />
        <div className="flex items-center gap-1">
          <div className="text-xs text-zinc-500 mr-1">{formatDate(post.updatedAt)}</div>
          <button
            onClick={copy}
            title="Copier le contenu"
            className="opacity-0 group-hover:opacity-100 transition-opacity size-7 grid place-items-center rounded-md hover:bg-white/10 text-zinc-400 hover:text-white"
          >
            {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
          </button>
          <button
            onClick={remove}
            disabled={busy}
            title="Supprimer"
            className="opacity-0 group-hover:opacity-100 transition-opacity size-7 grid place-items-center rounded-md hover:bg-rose-500/10 text-zinc-400 hover:text-rose-300"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed break-words line-clamp-4"
         style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>
        {truncate(post.content || "(post vide)", 220)}
      </p>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-zinc-500">
          {hasImg && <ImageIcon className="size-3.5" />}
          {hasVid && <Video className="size-3.5" />}
          {hasLink && <LinkIcon className="size-3.5" />}
          <span className="tag">{post.type}</span>
          <span className="tag">{post.tone}</span>
        </div>
        {post.scheduledAt && (
          <div className="text-xs text-amber-300 flex items-center gap-1">
            <Calendar className="size-3.5" />
            {formatDate(post.scheduledAt, true)}
          </div>
        )}
      </div>

      <ConfirmModal
        open={askDelete}
        onClose={() => setAskDelete(false)}
        onConfirm={confirmDelete}
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
    </div>
  );
}
