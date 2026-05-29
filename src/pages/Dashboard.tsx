import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Api, PostStatus } from "../lib/api";
import { useStore, useCurrentAccount } from "../lib/store";
import PostCard from "../components/PostCard";
import { LayoutGrid, List, Search, Sparkles, PlugZap } from "lucide-react";
import { Link } from "react-router-dom";

const TABS: { id: PostStatus | "all"; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "draft", label: "Brouillons" },
  { id: "scheduled", label: "Programmés" },
  { id: "published", label: "Publiés" },
  { id: "archived", label: "Archivés" },
];

export default function Dashboard() {
  const accountId = useStore((s) => s.currentAccountId);
  const account = useCurrentAccount();
  const [tab, setTab] = useState<PostStatus | "all">("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [q, setQ] = useState("");

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["posts", accountId, tab],
    queryFn: () => Api.listPosts(accountId!, tab),
    enabled: !!accountId,
    refetchInterval: 10_000,
  });

  const filtered = useMemo(
    () => posts.filter((p) => p.content?.toLowerCase().includes(q.toLowerCase())),
    [posts, q]
  );

  const counters = useMemo(() => {
    const c = { all: posts.length, draft: 0, scheduled: 0, published: 0, archived: 0 };
    posts.forEach((p) => { (c as any)[p.status]++; });
    return c;
  }, [posts]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mes posts</h1>
          <p className="text-sm text-zinc-500">Filtre par statut ci-dessous : brouillons, programmés, publiés ou archivés.</p>
        </div>
        <Link to="/compose" className="btn-primary">
          <Sparkles className="size-4" /> Composer un post
        </Link>
      </div>

      {/* Disconnected banner */}
      {account && !account.connected && (
        <div
          className="card p-4 flex items-center gap-3"
          style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.3)" }}
        >
          <div className="size-9 rounded-lg grid place-items-center shrink-0"
               style={{ background: "rgba(245,158,11,0.15)" }}>
            <PlugZap className="size-4 text-amber-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-amber-100">Compte LinkedIn non connecté</div>
            <div className="text-[12px] text-amber-200/80 mt-0.5">
              Tu vois ton historique local mais aucune nouvelle publication ne sera possible tant que <strong>{account.displayName}</strong> n'est pas reconnecté.
              Les posts programmés à venir échoueront silencieusement.
            </div>
          </div>
          <Link to="/settings" className="btn-outline shrink-0" style={{ borderColor: "rgba(245,158,11,0.4)", color: "#fbbf24" }}>
            Reconnecter
          </Link>
        </div>
      )}

      <div className="card p-1 flex items-center gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              "px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors " +
              (tab === t.id ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white hover:bg-white/5")
            }
          >
            {t.label}
            <span className="ml-2 text-[11px] text-zinc-500">{(counters as any)[t.id] ?? 0}</span>
          </button>
        ))}
        <div className="flex-1" />
        <div className="hidden md:flex items-center gap-2 px-2">
          <div className="relative">
            <Search className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher…"
              className="input pl-8 w-56"
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setView("grid")}
              className={"btn-ghost px-2 " + (view === "grid" ? "bg-white/5" : "")}
              title="Vue cartes"
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              onClick={() => setView("list")}
              className={"btn-ghost px-2 " + (view === "list" ? "bg-white/5" : "")}
              title="Vue liste"
            >
              <List className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-zinc-500">Chargement…</div>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => <PostCard key={p._id} post={p} />)}
        </div>
      ) : (
        <div className="card divide-y divide-bg-border">
          {filtered.map((p) => (
            <Link key={p._id} to={`/compose/${p._id}`} className="block p-4 hover:bg-white/5">
              <div className="text-sm text-zinc-200 line-clamp-2">{p.content || "(vide)"}</div>
              <div className="mt-2 text-xs text-zinc-500 flex gap-3">
                <span>{p.status}</span>
                <span>{p.type}</span>
                <span>{p.tone}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card p-10 text-center">
      <div className="text-5xl mb-3">✨</div>
      <h3 className="text-lg font-medium">Aucun post pour ce filtre</h3>
      <p className="text-sm text-zinc-500 mt-1">
        Commence par composer un post manuellement ou laisse l'IA t'aider.
      </p>
      <Link to="/compose" className="btn-primary mt-4 inline-flex">Composer un post</Link>
    </div>
  );
}
