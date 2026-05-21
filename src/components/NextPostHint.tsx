import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Calendar } from "lucide-react";
import { Api } from "../lib/api";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/auth";

/**
 * Small widget shown in the sidebar : "Prochain post : dans 2h · {extrait}"
 * Renders nothing if no scheduled post exists.
 */
export default function NextPostHint() {
  const navigate = useNavigate();
  const accountId = useStore((s) => s.currentAccountId);
  const theme = useTheme();

  const { data: posts = [] } = useQuery({
    queryKey: ["posts", accountId, "all"],
    queryFn: () => Api.listPosts(accountId!, "all"),
    enabled: !!accountId,
    refetchInterval: 10_000,
  });

  const next = useMemo(() => {
    const now = Date.now();
    return posts
      .filter((p) => p.status === "scheduled" && p.scheduledAt && new Date(p.scheduledAt).getTime() > now)
      .sort((a, b) => (a.scheduledAt || "").localeCompare(b.scheduledAt || ""))[0];
  }, [posts]);

  if (!next || !next.scheduledAt) return null;

  const when = new Date(next.scheduledAt);
  const diff = when.getTime() - Date.now();
  const relative = formatRelative(diff, when);

  return (
    <button
      onClick={() => navigate(`/compose/${next._id}`)}
      className="w-full text-left rounded-lg p-2.5 border transition-colors hover:scale-[1.01]"
      style={{
        background: theme?.primarySoft || "var(--overlay-white)",
        borderColor: theme?.primarySoft || "var(--bg-border)",
      }}
      title={next.content}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider mb-1"
           style={{ color: theme?.primary }}>
        <Calendar className="size-3" />
        Prochain · {relative}
      </div>
      <div className="text-[11px] text-zinc-300 line-clamp-2 leading-snug">
        {next.content.slice(0, 80) || "(post vide)"}
      </div>
    </button>
  );
}

function formatRelative(diffMs: number, date: Date): string {
  const min = Math.round(diffMs / 60_000);
  if (min < 1)  return "imminent";
  if (min < 60) return `dans ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `dans ${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) {
    const time = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    return d === 1 ? `demain ${time}` : `dans ${d}j`;
  }
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}
