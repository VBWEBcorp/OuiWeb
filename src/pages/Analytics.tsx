import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, FileText, Clock, CheckCircle2, BarChart3, Flame, Calendar, Sparkles,
} from "lucide-react";
import { Api, Post } from "../lib/api";
import { useStore, useCurrentAccount } from "../lib/store";
import { useTheme } from "../lib/auth";
import { format, parseISO, subDays, eachDayOfInterval, getDay } from "date-fns";
import { fr } from "date-fns/locale";

export default function Analytics() {
  const accountId = useStore((s) => s.currentAccountId)!;
  const account = useCurrentAccount();
  const theme = useTheme();
  const [range, setRange] = useState<7 | 30 | 90>(30);

  const { data: agg } = useQuery({
    queryKey: ["analytics", accountId],
    queryFn: () => Api.analytics(accountId),
    enabled: !!accountId,
  });
  const { data: posts = [] } = useQuery({
    queryKey: ["posts", accountId, "all"],
    queryFn: () => Api.listPosts(accountId, "all"),
    enabled: !!accountId,
  });

  const series = useMemo(() => {
    const today = new Date();
    const from = subDays(today, range - 1);
    return eachDayOfInterval({ start: from, end: today }).map((d) => {
      const key = format(d, "yyyy-MM-dd");
      const count = posts.filter(
        (p) => (p.publishedAt || p.scheduledAt || "").slice(0, 10) === key,
      ).length;
      return { date: d, key, count };
    });
  }, [posts, range]);

  const streak = useMemo(() => computeStreak(posts), [posts]);
  const bestDay = useMemo(() => computeBestDay(posts), [posts]);
  const heatmap = useMemo(() => computeHeatmap(posts), [posts]);

  if (!agg) {
    return (
      <div className="card p-10 text-center">
        <Sparkles className="size-6 mx-auto opacity-50" />
        <div className="text-sm text-zinc-500 mt-2">Chargement des statistiques…</div>
      </div>
    );
  }

  const max = Math.max(1, ...series.map((d) => d.count));

  const kpis = [
    { key: "total",     label: "Total posts",  value: agg.total,     icon: FileText,      tint: "text-zinc-300" },
    { key: "drafts",    label: "Brouillons",   value: agg.drafts,    icon: Clock,         tint: "text-zinc-300" },
    { key: "scheduled", label: "Programmés",   value: agg.scheduled, icon: Calendar,      tint: "text-amber-300" },
    { key: "published", label: "Publiés",      value: agg.published, icon: CheckCircle2,  tint: "text-emerald-300" },
  ];

  return (
    <div className="space-y-5">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 -mx-6 lg:-mx-10 px-6 lg:px-10 py-3 backdrop-blur-xl border-b border-bg-border"
           style={{ background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}>
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <BarChart3 className="size-5" style={{ color: theme?.primary }} />
              Analytics
            </h1>
            <p className="text-[11px] text-zinc-500">
              Activité pour <span className="text-zinc-300 font-medium">{account?.displayName}</span>
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-xl border border-bg-border bg-bg-soft">
            {[7, 30, 90].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r as 7 | 30 | 90)}
                className={"px-2.5 py-1 text-xs rounded-lg transition-colors " + (range === r ? "text-white" : "text-zinc-400 hover:text-white")}
                style={range === r && theme ? { background: theme.primary } : undefined}
              >
                {r}j
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.key} className="card p-4 relative overflow-hidden">
              <div
                className="absolute -top-8 -right-8 size-24 rounded-full blur-2xl opacity-20"
                style={{ background: theme?.primary }}
              />
              <div className="relative flex items-start justify-between">
                <div>
                  <div className="text-xs text-zinc-500">{k.label}</div>
                  <div className="text-3xl font-semibold mt-1 tracking-tight">{k.value}</div>
                </div>
                <div className={"size-8 rounded-lg grid place-items-center " + k.tint}
                     style={{ background: theme?.primarySoft }}>
                  <Icon className="size-4" style={{ color: theme?.primary }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Streak + Best day + Health ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl grid place-items-center"
               style={{ background: theme?.primarySoft }}>
            <Flame className="size-5" style={{ color: theme?.primary }} />
          </div>
          <div>
            <div className="text-2xl font-semibold tracking-tight">{streak} <span className="text-xs text-zinc-500">jours</span></div>
            <div className="text-[11px] text-zinc-500">Série en cours · publier 1+/jour</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl grid place-items-center"
               style={{ background: theme?.primarySoft }}>
            <TrendingUp className="size-5" style={{ color: theme?.primary }} />
          </div>
          <div>
            <div className="text-2xl font-semibold tracking-tight">{bestDay.label}</div>
            <div className="text-[11px] text-zinc-500">Ton meilleur jour · {bestDay.count} posts</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className={"size-10 rounded-xl grid place-items-center " + (agg.published > 0 ? "" : "opacity-50")}
               style={{ background: theme?.primarySoft }}>
            <CheckCircle2 className="size-5" style={{ color: theme?.primary }} />
          </div>
          <div>
            <div className="text-2xl font-semibold tracking-tight">
              {agg.total === 0 ? 0 : Math.round((agg.published / agg.total) * 100)}<span className="text-base">%</span>
            </div>
            <div className="text-[11px] text-zinc-500">Taux de publication (publiés / total)</div>
          </div>
        </div>
      </div>

      {/* ── Chart ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="label">Activité · {range} derniers jours</div>
            <div className="text-xs text-zinc-500 mt-0.5">
              Total : <span className="text-zinc-300 font-medium">{series.reduce((s, d) => s + d.count, 0)} posts</span>
            </div>
          </div>
        </div>
        <ActivityChart series={series} max={max} primary={theme?.primary || "#3463ff"} />
      </div>

      {/* ── Heatmap ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="label">Heatmap · jour de la semaine × créneau horaire</div>
            <div className="text-xs text-zinc-500 mt-0.5">Repère tes meilleurs créneaux pour programmer</div>
          </div>
        </div>
        <Heatmap data={heatmap} primary={theme?.primary || "#3463ff"} />
      </div>

      {/* ── Recent activity ── */}
      <div className="card p-5">
        <div className="label mb-3">Dernière activité</div>
        {posts.length === 0 ? (
          <div className="text-sm text-zinc-500">Aucun post pour le moment.</div>
        ) : (
          <div className="divide-y divide-bg-border">
            {posts.slice(0, 8).map((p) => <ActivityRow key={p._id} post={p} primary={theme?.primary || "#3463ff"} />)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Chart ─── */
function ActivityChart({ series, max, primary }: { series: { date: Date; key: string; count: number }[]; max: number; primary: string }) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div>
      <div className="flex items-end gap-1 h-44">
        {series.map((d, i) => {
          const h = (d.count / max) * 100;
          const isHover = hover === i;
          return (
            <div
              key={d.key}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className="flex-1 min-w-[4px] h-full flex flex-col justify-end relative group cursor-pointer"
            >
              {isHover && (
                <div className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] bg-bg-card border border-bg-border rounded-md px-2 py-1 shadow-lg z-10">
                  <span className="text-zinc-300 font-medium">{d.count}</span>
                  <span className="text-zinc-500 ml-1">· {format(d.date, "dd MMM", { locale: fr })}</span>
                </div>
              )}
              <div
                className="w-full rounded-t transition-all"
                style={{
                  height: `${Math.max(2, h)}%`,
                  background: `linear-gradient(to top, ${primary}33, ${primary})`,
                  boxShadow: isHover ? `0 0 20px -2px ${primary}` : undefined,
                  opacity: d.count === 0 ? 0.25 : isHover ? 1 : 0.85,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-2">
        <span>{format(series[0]?.date || new Date(), "dd MMM", { locale: fr })}</span>
        <span>{format(series[Math.floor(series.length / 2)]?.date || new Date(), "dd MMM", { locale: fr })}</span>
        <span>Aujourd'hui</span>
      </div>
    </div>
  );
}

/* ─── Heatmap (7 days × 6 timeslots) ─── */
function Heatmap({ data, primary }: { data: number[][]; primary: string }) {
  const SLOTS = ["00-04", "04-08", "08-12", "12-16", "16-20", "20-24"];
  const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const max = Math.max(1, ...data.flat());
  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-1" style={{ gridTemplateColumns: "auto repeat(6, 1fr)" }}>
        <div />
        {SLOTS.map((s) => <div key={s} className="text-[9px] text-zinc-500 text-center px-1">{s}</div>)}
        {DAYS.map((day, di) => (
          <Fragment key={day}>
            <div className="text-[9px] text-zinc-500 pr-2 grid place-items-center">{day}</div>
            {SLOTS.map((_, si) => {
              const v = data[di]?.[si] || 0;
              const intensity = v / max;
              return (
                <div
                  key={`c${di}-${si}`}
                  title={`${day} ${SLOTS[si]} · ${v} post${v > 1 ? "s" : ""}`}
                  className="h-7 rounded-md border border-bg-border"
                  style={{
                    background: v === 0
                      ? "var(--overlay-white)"
                      : `${primary}${Math.round(intensity * 200 + 30).toString(16).padStart(2, "0")}`,
                  }}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/* ─── Activity row ─── */
function ActivityRow({ post, primary }: { post: Post; primary: string }) {
  const statusColor: Record<string, string> = {
    draft: "text-zinc-400",
    scheduled: "text-amber-300",
    published: "text-emerald-300",
    archived: "text-zinc-500",
    failed: "text-rose-300",
  };
  const statusLabel: Record<string, string> = {
    draft: "Brouillon", scheduled: "Programmé", published: "Publié", archived: "Archivé", failed: "Échec",
  };
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="size-2 rounded-full shrink-0" style={{ background: primary }} />
      <div className="text-sm text-zinc-200 line-clamp-1 flex-1 min-w-0">
        {post.content?.slice(0, 100) || "(post vide)"}
      </div>
      <div className={"text-[11px] " + (statusColor[post.status] || statusColor.draft)}>
        {statusLabel[post.status] || post.status}
      </div>
      <div className="text-[11px] text-zinc-500 w-24 text-right">
        {format(new Date(post.publishedAt || post.scheduledAt || post.updatedAt), "dd MMM HH:mm", { locale: fr })}
      </div>
    </div>
  );
}

/* ─── Computations ─── */
function computeStreak(posts: Post[]): number {
  const dates = new Set(
    posts
      .filter((p) => p.status === "published" && p.publishedAt)
      .map((p) => (p.publishedAt as string).slice(0, 10))
  );
  let streak = 0;
  let cursor = new Date();
  while (true) {
    const key = format(cursor, "yyyy-MM-dd");
    if (dates.has(key)) {
      streak++;
      cursor = subDays(cursor, 1);
    } else break;
  }
  return streak;
}

function computeBestDay(posts: Post[]): { label: string; count: number } {
  const counts = new Array(7).fill(0) as number[];
  const labels = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  posts.forEach((p) => {
    const t = p.publishedAt || p.scheduledAt;
    if (!t) return;
    counts[getDay(parseISO(t))]++;
  });
  let bestI = 1;
  let best = counts[1];
  counts.forEach((c, i) => { if (c > best) { best = c; bestI = i; } });
  return { label: labels[bestI], count: best };
}

function computeHeatmap(posts: Post[]): number[][] {
  // 7 days (Mon=0 to Sun=6) × 6 timeslots (4h each)
  const grid = Array.from({ length: 7 }, () => new Array(6).fill(0));
  posts.forEach((p) => {
    const t = p.publishedAt || p.scheduledAt;
    if (!t) return;
    const d = new Date(t);
    const day = (d.getDay() + 6) % 7; // Mon=0
    const slot = Math.floor(d.getHours() / 4);
    grid[day][slot]++;
  });
  return grid;
}
