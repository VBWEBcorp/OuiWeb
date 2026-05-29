import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, PenSquare, Calendar, User2, BarChart3, Settings, Plus, LogOut,
} from "lucide-react";
import AccountSwitcher from "./AccountSwitcher";
import NextPostHint from "./NextPostHint";
import NotificationToggle from "./NotificationToggle";
import { useAuth, useTenant, useTheme } from "../lib/auth";

type NavItem = { to: string; label: string; desc: string; icon: typeof LayoutDashboard };

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Publication",
    items: [
      { to: "/dashboard", label: "Mes posts",  desc: "Brouillons, programmés, publiés", icon: LayoutDashboard },
      { to: "/compose",   label: "Composer",   desc: "Rédiger un nouveau post",          icon: PenSquare },
      { to: "/calendar",  label: "Calendrier", desc: "Vue planning des programmations",  icon: Calendar },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { to: "/persona",   label: "Persona IA",   desc: "Ton style pour la génération", icon: User2 },
      { to: "/analytics", label: "Statistiques", desc: "Performance de tes posts",     icon: BarChart3 },
    ],
  },
  {
    title: "Configuration",
    items: [
      { to: "/settings",  label: "Réglages", desc: "Compte, thème, connexion LinkedIn", icon: Settings },
    ],
  },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const tenant = useTenant();
  const theme = useTheme();
  const email = useAuth((s) => s.email);
  const logout = useAuth((s) => s.logout);

  return (
    <aside
      className="w-[260px] shrink-0 h-screen border-r border-bg-border backdrop-blur-xl flex flex-col"
      style={{ background: "color-mix(in srgb, var(--bg-soft) 80%, transparent)" }}
    >
      {/* Tenant header */}
      <div className="px-4 pt-4 pb-3 border-b border-bg-border">
        <div
          className="rounded-xl p-3 relative overflow-hidden"
          style={{
            background: theme
              ? `linear-gradient(135deg, ${theme.primarySoft}, transparent 80%)`
              : "transparent",
          }}
        >
          {tenant && (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-white/5 grid place-items-center p-1 border border-white/10">
                <img src={tenant.logo} alt={tenant.name} className="max-h-full max-w-full object-contain" />
              </div>
              <div className="leading-tight min-w-0">
                <div className="font-semibold tracking-tight truncate">{tenant.name}</div>
                <div className="text-[11px] text-zinc-500 truncate">{tenant.tagline}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-3 mt-3">
        <AccountSwitcher />
      </div>

      <div className="px-3 mt-3">
        <button
          onClick={() => navigate("/compose")}
          className="btn-primary w-full justify-center"
          style={theme ? { background: theme.primary, boxShadow: `0 10px 30px -10px ${theme.primary}` } : undefined}
        >
          <Plus className="size-4" />
          Nouveau post
        </button>
      </div>

      <div className="px-3 mt-3">
        <NextPostHint />
      </div>

      <nav className="px-3 mt-4 flex-1 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mb-4">
            <div className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
              {group.title}
            </div>
            <div className="space-y-1">
              {group.items.map(({ to, label, desc, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    "group flex items-start gap-3 px-3 py-2 rounded-lg transition-colors " +
                    (isActive ? "" : "text-zinc-400 hover:bg-white/5 hover:text-white")
                  }
                  style={({ isActive }) => isActive && theme ? {
                    background: theme.primarySoft,
                    color: "#fff",
                  } : undefined}
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className="size-4 mt-0.5 shrink-0"
                        style={isActive && theme ? { color: theme.primary } : undefined}
                      />
                      <div className="min-w-0 leading-tight">
                        <div className="text-sm font-medium">{label}</div>
                        <div className={"text-[11px] truncate " + (isActive ? "text-white/60" : "text-zinc-600 group-hover:text-zinc-400")}>
                          {desc}
                        </div>
                      </div>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-2 border-t border-bg-border">
        <NotificationToggle />
      </div>

      <div className="p-3 border-t border-bg-border">
        <button onClick={() => { logout(); navigate("/login"); }} className="nav-item w-full text-zinc-400 hover:text-rose-300">
          <LogOut className="size-4" />
          Déconnexion
        </button>
        <div className="mt-2 px-3 text-[10px] text-zinc-600 truncate">
          {email}
        </div>
      </div>
    </aside>
  );
}
