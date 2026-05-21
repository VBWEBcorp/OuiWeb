import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, PenSquare, Calendar, User2, BarChart3, Settings, Plus, LogOut,
} from "lucide-react";
import AccountSwitcher from "./AccountSwitcher";
import NextPostHint from "./NextPostHint";
import NotificationToggle from "./NotificationToggle";
import { useAuth, useTenant, useTheme } from "../lib/auth";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/compose",   label: "Composer",  icon: PenSquare },
  { to: "/calendar",  label: "Calendrier", icon: Calendar },
  { to: "/persona",   label: "Persona",   icon: User2 },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings",  label: "Réglages",  icon: Settings },
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

      <nav className="px-3 mt-5 flex-1 space-y-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              "nav-item" + (isActive ? " active" : "")
            }
            style={({ isActive }) => isActive && theme ? {
              background: theme.primarySoft,
              color: "#fff",
            } : undefined}
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
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
