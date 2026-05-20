import { Sun, Moon } from "lucide-react";
import { useAuth, useTheme } from "../lib/auth";

export default function ThemePicker() {
  const mode = useAuth((s) => s.mode);
  const setMode = useAuth((s) => s.setMode);
  const theme = useTheme();

  return (
    <div className="flex items-center gap-1 p-1 rounded-xl border border-bg-border bg-bg-soft">
      <button
        onClick={() => setMode("light")}
        className={
          "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors " +
          (mode === "light" ? "text-white" : "text-zinc-400 hover:text-white")
        }
        style={mode === "light" && theme ? { background: theme.primary, boxShadow: `0 8px 20px -10px ${theme.primary}` } : undefined}
      >
        <Sun className="size-3.5" /> Clair
      </button>
      <button
        onClick={() => setMode("dark")}
        className={
          "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors " +
          (mode === "dark" ? "text-white" : "text-zinc-400 hover:text-white")
        }
        style={mode === "dark" && theme ? { background: theme.primary, boxShadow: `0 8px 20px -10px ${theme.primary}` } : undefined}
      >
        <Moon className="size-3.5" /> Sombre
      </button>
    </div>
  );
}
