import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths,
  format, isSameMonth, isSameDay, isBefore, startOfDay, isAfter,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, Plus, CalendarDays, Filter, Sparkles, Clock, CheckCircle2,
} from "lucide-react";
import toast from "react-hot-toast";
import { Api, Post, PostStatus } from "../lib/api";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/auth";
import { truncate } from "../lib/utils";
import PostDetailModal from "../components/PostDetailModal";

const STATUS_COLORS: Record<string, string> = {
  draft:     "bg-zinc-400/15 text-zinc-300 border-zinc-400/30",
  scheduled: "bg-amber-400/15 text-amber-300 border-amber-400/40",
  published: "bg-emerald-400/15 text-emerald-300 border-emerald-400/40",
  failed:    "bg-rose-400/15 text-rose-300 border-rose-400/40",
  archived:  "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
};

type FilterId = "all" | "scheduled" | "published" | "draft";
const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all",       label: "Tous" },
  { id: "scheduled", label: "Programmés" },
  { id: "published", label: "Publiés" },
  { id: "draft",     label: "Brouillons" },
];

export default function CalendarPage() {
  const accountId = useStore((s) => s.currentAccountId)!;
  const theme = useTheme();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(new Date());
  const [view, setView] = useState<"month" | "week">("month");
  const [filter, setFilter] = useState<FilterId>("all");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const { data: posts = [] } = useQuery({
    queryKey: ["posts", accountId, "all"],
    queryFn: () => Api.listPosts(accountId, "all"),
    enabled: !!accountId,
    refetchInterval: 10_000,
  });

  const filteredPosts = useMemo(() =>
    filter === "all" ? posts : posts.filter((p) => p.status === filter),
    [posts, filter]
  );

  const reschedule = useMutation({
    mutationFn: ({ id, dt }: { id: string; dt: Date }) => Api.schedulePost(id, dt.toISOString()),
    onSuccess: () => {
      toast.success("Reprogrammé");
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const days = useMemo(() => {
    if (view === "month") {
      const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
      const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
      const out: Date[] = [];
      let d = start;
      while (d <= end) { out.push(d); d = addDays(d, 1); }
      return out;
    } else {
      const start = startOfWeek(cursor, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
  }, [cursor, view]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    filteredPosts.forEach((p) => {
      const key = p.scheduledAt || p.publishedAt;
      if (!key) return;
      const d = format(new Date(key), "yyyy-MM-dd");
      const arr = map.get(d) || [];
      arr.push(p);
      map.set(d, arr);
    });
    // Sort each day by time
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const ta = a.scheduledAt || a.publishedAt || "";
        const tb = b.scheduledAt || b.publishedAt || "";
        return ta.localeCompare(tb);
      });
    }
    return map;
  }, [filteredPosts]);

  // Stats
  const stats = useMemo(() => {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    const thisWeek = posts.filter((p) => {
      const t = p.publishedAt || p.scheduledAt;
      if (!t) return false;
      const d = new Date(t);
      return !isBefore(d, weekStart) && !isAfter(d, weekEnd);
    }).length;
    const nextScheduled = posts
      .filter((p) => p.status === "scheduled" && p.scheduledAt && isAfter(new Date(p.scheduledAt), today))
      .sort((a, b) => (a.scheduledAt || "").localeCompare(b.scheduledAt || ""))[0];
    const totalScheduled = posts.filter((p) => p.status === "scheduled").length;
    return { thisWeek, nextScheduled, totalScheduled };
  }, [posts]);

  function onDrop(e: React.DragEvent, day: Date) {
    e.preventDefault();
    const id = e.dataTransfer.getData("postId");
    if (!id) return;
    if (isBefore(startOfDay(day), startOfDay(new Date()))) {
      toast.error("Impossible de programmer dans le passé");
      return;
    }
    const dt = new Date(day);
    dt.setHours(10, 0, 0, 0);
    reschedule.mutate({ id, dt });
  }

  function createOnDay(day: Date) {
    if (isBefore(startOfDay(day), startOfDay(new Date()))) {
      toast.error("Impossible de programmer dans le passé");
      return;
    }
    // We can't pass scheduledAt to /compose without query param — but Compose accepts it via its MiniCalendar.
    // For now: navigate to /compose and store the intent in sessionStorage.
    sessionStorage.setItem("compose:initialDate", format(day, "yyyy-MM-dd") + "T10:00");
    navigate("/compose");
  }

  return (
    <div className="space-y-5">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 -mx-6 lg:-mx-10 px-6 lg:px-10 py-3 backdrop-blur-xl border-b border-bg-border"
           style={{ background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}>
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <CalendarDays className="size-5" style={{ color: theme?.primary }} />
              Calendrier
            </h1>
            <p className="text-[11px] text-zinc-500">Glisse · clique · programme.</p>
          </div>

          {/* View toggle */}
          <div className="card p-1 flex">
            <button onClick={() => setView("month")}
                    className={"px-3 py-1 text-xs rounded-md transition-colors " + (view === "month" ? "text-white" : "text-zinc-400 hover:text-white")}
                    style={view === "month" && theme ? { background: theme.primary } : undefined}>Mois</button>
            <button onClick={() => setView("week")}
                    className={"px-3 py-1 text-xs rounded-md transition-colors " + (view === "week" ? "text-white" : "text-zinc-400 hover:text-white")}
                    style={view === "week" && theme ? { background: theme.primary } : undefined}>Semaine</button>
          </div>

          {/* Navigation */}
          <div className="card p-1 flex items-center">
            <button className="btn-ghost px-2" onClick={() => setCursor(view === "month" ? addMonths(cursor, -1) : addDays(cursor, -7))}>
              <ChevronLeft className="size-4" />
            </button>
            <div className="px-3 text-sm font-medium min-w-[140px] text-center capitalize">
              {format(cursor, view === "month" ? "MMMM yyyy" : "'Sem.' II — yyyy", { locale: fr })}
            </div>
            <button className="btn-ghost px-2" onClick={() => setCursor(view === "month" ? addMonths(cursor, 1) : addDays(cursor, 7))}>
              <ChevronRight className="size-4" />
            </button>
          </div>
          <button className="btn-outline" onClick={() => setCursor(new Date())}>Aujourd'hui</button>
          <button className="btn-primary"
                  onClick={() => createOnDay(new Date())}
                  style={theme ? { background: theme.primary, boxShadow: `0 14px 36px -14px ${theme.primary}` } : undefined}>
            <Plus className="size-4" /> Nouveau
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl grid place-items-center" style={{ background: theme?.primarySoft }}>
            <CalendarDays className="size-5" style={{ color: theme?.primary }} />
          </div>
          <div>
            <div className="text-2xl font-semibold tracking-tight">{stats.thisWeek}</div>
            <div className="text-[11px] text-zinc-500">Posts cette semaine</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl grid place-items-center" style={{ background: theme?.primarySoft }}>
            <Clock className="size-5" style={{ color: theme?.primary }} />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-semibold tracking-tight">{stats.totalScheduled}</div>
            <div className="text-[11px] text-zinc-500 truncate">
              {stats.nextScheduled
                ? `Prochain : ${format(new Date(stats.nextScheduled.scheduledAt!), "dd MMM HH:mm", { locale: fr })}`
                : "Aucune programmation à venir"}
            </div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl grid place-items-center" style={{ background: theme?.primarySoft }}>
            <CheckCircle2 className="size-5" style={{ color: theme?.primary }} />
          </div>
          <div>
            <div className="text-2xl font-semibold tracking-tight">{posts.filter((p) => p.status === "published").length}</div>
            <div className="text-[11px] text-zinc-500">Posts publiés au total</div>
          </div>
        </div>
      </div>

      {/* Status filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="size-3.5 text-zinc-500" />
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const count = f.id === "all" ? posts.length : posts.filter((p) => p.status === f.id).length;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={
                "px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 " +
                (active ? "text-white" : "text-zinc-400 hover:text-white bg-bg-soft border border-bg-border")
              }
              style={active && theme ? { background: theme.primary, borderColor: theme.primary } : undefined}
            >
              {f.label}
              <span className={"text-[10px] " + (active ? "text-white/70" : "text-zinc-500")}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-2">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
          <div key={d} className="text-[11px] text-zinc-500 px-2">{d}</div>
        ))}
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const dayPosts = postsByDay.get(key) || [];
          const dim = view === "month" && !isSameMonth(d, cursor);
          const isToday = isSameDay(d, new Date());
          const past = isBefore(startOfDay(d), startOfDay(new Date()));
          return (
            <div
              key={key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, d)}
              className={
                "group relative card p-2 transition-all min-h-[" + (view === "week" ? "240" : "130") + "px] " +
                (dim ? "opacity-40 " : "") +
                (past ? "opacity-70 " : "")
              }
              style={isToday && theme ? { borderColor: theme.primary, boxShadow: `inset 0 0 0 1px ${theme.primarySoft}` } : undefined}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={"text-xs font-medium " + (dim ? "text-zinc-600" : "text-zinc-300")}
                  style={isToday && theme ? { color: theme.primary, fontWeight: 700 } : undefined}
                >
                  {format(d, "d")}{isToday && <span className="ml-1 text-[9px] uppercase">aujourd'hui</span>}
                </span>
                <div className="flex items-center gap-1">
                  {dayPosts.length > 0 && (
                    <span className="text-[10px] text-zinc-500">{dayPosts.length}</span>
                  )}
                  {!past && (
                    <button
                      onClick={() => createOnDay(d)}
                      className="size-5 rounded-md grid place-items-center text-zinc-500 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Créer un post à cette date"
                    >
                      <Plus className="size-3" />
                    </button>
                  )}
                </div>
              </div>

              {dayPosts.length === 0 && !past && view === "week" && (
                <button
                  onClick={() => createOnDay(d)}
                  className="w-full h-full min-h-[180px] rounded-md border border-dashed border-bg-border opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-zinc-500 hover:text-white hover:bg-white/5"
                >
                  + Programmer
                </button>
              )}

              <div className="space-y-1">
                {dayPosts.map((p) => {
                  const time = p.scheduledAt || p.publishedAt;
                  return (
                    <button
                      key={p._id}
                      draggable={p.status === "scheduled" || p.status === "draft"}
                      onDragStart={(e) => e.dataTransfer.setData("postId", p._id)}
                      onClick={() => setSelectedPost(p)}
                      className={
                        "w-full text-left p-1.5 rounded-md text-[11px] cursor-pointer border transition-all hover:scale-[1.01] hover:shadow-lg " +
                        STATUS_COLORS[p.status]
                      }
                      title={p.content}
                    >
                      {time && (
                        <div className="text-[9px] opacity-70 font-medium">
                          {format(new Date(time), "HH:mm")}
                        </div>
                      )}
                      <div className="line-clamp-2 leading-tight">
                        {truncate(p.content, view === "week" ? 80 : 50)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {posts.length === 0 && (
        <div className="card p-10 text-center">
          <Sparkles className="size-6 mx-auto opacity-50" />
          <p className="text-sm text-zinc-400 mt-2">Aucun post pour le moment</p>
          <button onClick={() => navigate("/compose")} className="btn-primary mt-4 inline-flex"
                  style={theme ? { background: theme.primary } : undefined}>
            <Plus className="size-4" /> Créer ton premier post
          </button>
        </div>
      )}

      <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} />
    </div>
  );
}
