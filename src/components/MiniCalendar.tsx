import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, format, isSameMonth, isSameDay, isBefore, startOfDay,
} from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Api, Post } from "../lib/api";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/auth";

type Props = {
  /** Currently-selected datetime in "YYYY-MM-DDTHH:mm" local form */
  value?: string;
  /** Called when user picks a date (datetime string in same local format) */
  onChange?: (value: string) => void;
  /** Hide post dots overlay (default: false) */
  hideDots?: boolean;
};

const TIME_SLOTS = ["08:00", "09:00", "10:00", "12:00", "14:00", "17:00", "18:00", "20:00"];

export default function MiniCalendar({ value, onChange, hideDots }: Props) {
  const accountId = useStore((s) => s.currentAccountId);
  const theme = useTheme();
  const [cursor, setCursor] = useState(value ? new Date(value) : new Date());
  const selectedDay = value ? new Date(value) : null;
  const selectedTime = value ? value.slice(11, 16) : "";

  const { data: posts = [] } = useQuery({
    queryKey: ["posts", accountId, "all"],
    queryFn: () => Api.listPosts(accountId!, "all"),
    enabled: !!accountId,
  });

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    const out: Date[] = [];
    let d = start;
    while (d <= end) { out.push(d); d = addDays(d, 1); }
    return out;
  }, [cursor]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    posts.forEach((p) => {
      const key = p.scheduledAt || p.publishedAt;
      if (!key) return;
      const k = format(new Date(key), "yyyy-MM-dd");
      const arr = map.get(k) || [];
      arr.push(p);
      map.set(k, arr);
    });
    return map;
  }, [posts]);

  function pickDay(d: Date) {
    if (isBefore(startOfDay(d), startOfDay(new Date()))) return;
    const time = selectedTime || "10:00";
    const dt = `${format(d, "yyyy-MM-dd")}T${time}`;
    onChange?.(dt);
  }

  function pickTime(t: string) {
    // Ignore incomplete/invalid input (browsers fire onChange with "" during typing)
    if (!/^\d{2}:\d{2}$/.test(t)) return;

    if (selectedDay) {
      const dt = `${format(selectedDay, "yyyy-MM-dd")}T${t}`;
      onChange?.(dt);
      return;
    }
    // No day picked yet → use today if time still ahead, else tomorrow
    const [hh, mm] = t.split(":").map(Number);
    const candidate = new Date();
    candidate.setHours(hh, mm, 0, 0);
    const target = candidate.getTime() > Date.now() + 60_000
      ? candidate
      : addDays(candidate, 1);
    const dt = `${format(target, "yyyy-MM-dd")}T${t}`;
    onChange?.(dt);
  }

  const today = new Date();

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium tracking-tight capitalize">
          {format(cursor, "MMMM yyyy", { locale: fr })}
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => setCursor(addMonths(cursor, -1))} className="size-7 rounded-md hover:bg-white/5 grid place-items-center text-zinc-400 hover:text-white">
            <ChevronLeft className="size-3.5" />
          </button>
          <button onClick={() => setCursor(new Date())} className="text-[10px] uppercase tracking-wider text-zinc-500 hover:text-white px-1.5">
            now
          </button>
          <button onClick={() => setCursor(addMonths(cursor, 1))} className="size-7 rounded-md hover:bg-white/5 grid place-items-center text-zinc-400 hover:text-white">
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-0.5">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <div key={i} className="text-[10px] text-zinc-500 text-center h-6 grid place-items-center">{d}</div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d) => {
          const inMonth = isSameMonth(d, cursor);
          const isToday = isSameDay(d, today);
          const isSelected = selectedDay && isSameDay(d, selectedDay);
          const past = isBefore(startOfDay(d), startOfDay(today));
          const key = format(d, "yyyy-MM-dd");
          const dotCount = (postsByDay.get(key) || []).length;
          return (
            <button
              key={key}
              onClick={() => pickDay(d)}
              disabled={past}
              className={
                "relative aspect-square rounded-lg text-xs transition-colors grid place-items-center " +
                (past ? "text-zinc-700 cursor-not-allowed " :
                  isSelected ? "text-white font-semibold " :
                  inMonth ? "text-zinc-300 hover:bg-white/5 " :
                            "text-zinc-600 hover:bg-white/5 ")
              }
              style={
                isSelected && theme
                  ? { background: theme.primary, boxShadow: `0 6px 18px -6px ${theme.primary}` }
                  : isToday
                  ? { boxShadow: theme ? `inset 0 0 0 1px ${theme.primary}` : "inset 0 0 0 1px #fff" }
                  : undefined
              }
            >
              {format(d, "d")}
              {!hideDots && dotCount > 0 && !isSelected && (
                <span
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full"
                  style={{ background: theme?.primary || "#fff" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Time input + quick slots */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Clock className="size-3" />
            <span className="text-[10px] uppercase tracking-wider">Heure</span>
          </div>
          {selectedTime && (
            <span className="text-[11px] font-medium" style={{ color: theme?.primary }}>
              {selectedTime}
            </span>
          )}
        </div>
        <input
          type="time"
          value={selectedTime}
          onChange={(e) => pickTime(e.target.value)}
          step="60"
          className="input h-10 text-sm font-medium"
          style={{ colorScheme: "dark" }}
        />
        <div className="grid grid-cols-4 gap-1 mt-2">
          {TIME_SLOTS.map((t) => {
            const active = selectedTime === t;
            return (
              <button
                key={t}
                onClick={() => pickTime(t)}
                className={
                  "text-[11px] py-1 rounded-md border transition-colors " +
                  (active ? "text-white" : "border-bg-border text-zinc-400 hover:text-white hover:bg-white/5")
                }
                style={active && theme ? { background: theme.primary, borderColor: theme.primary } : undefined}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
