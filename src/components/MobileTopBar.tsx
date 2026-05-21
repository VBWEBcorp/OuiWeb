import { useNavigate } from "react-router-dom";
import { Menu, Plus } from "lucide-react";
import { useTenant, useTheme } from "../lib/auth";

type Props = { onMenu: () => void };

/** Sticky mobile top bar — visible only below md. Shown when sidebar is hidden. */
export default function MobileTopBar({ onMenu }: Props) {
  const tenant = useTenant();
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <header
      className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-3 py-2.5 border-b border-bg-border backdrop-blur-xl"
      style={{ background: "color-mix(in srgb, var(--bg) 85%, transparent)" }}
    >
      <button
        onClick={onMenu}
        className="size-9 grid place-items-center rounded-lg hover:bg-white/5"
        aria-label="Menu"
      >
        <Menu className="size-5" />
      </button>

      {tenant && (
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="size-7 rounded-lg bg-white/5 grid place-items-center p-0.5 border border-white/10">
            <img src={tenant.logo} alt={tenant.name} className="max-h-full max-w-full object-contain" />
          </div>
          <div className="text-sm font-semibold truncate">{tenant.name}</div>
        </div>
      )}

      <button
        onClick={() => navigate("/compose")}
        className="size-9 rounded-lg grid place-items-center text-white"
        style={theme ? { background: theme.primary, boxShadow: `0 8px 22px -8px ${theme.primary}` } : undefined}
        aria-label="Nouveau post"
      >
        <Plus className="size-5" />
      </button>
    </header>
  );
}
