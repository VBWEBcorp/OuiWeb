import { Bell, BellOff } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth, useTheme, useNotificationsEnabled } from "../lib/auth";

/**
 * Compact bell toggle for the sidebar. Same logic as the Settings panel
 * (permission request, denied-state handling) but in a single row layout.
 */
export default function NotificationToggle() {
  const theme = useTheme();
  const enabled = useNotificationsEnabled();
  const setEnabled = useAuth((s) => s.setNotifications);
  const supported = typeof Notification !== "undefined";
  const perm = supported ? Notification.permission : "default";

  async function toggle() {
    if (enabled) { setEnabled(false); toast.success("Notifications désactivées"); return; }
    if (!supported) { toast.error("Ton navigateur ne supporte pas les notifications"); return; }
    if (perm === "denied") {
      toast.error("Notifications bloquées dans le navigateur · va dans Réglages");
      return;
    }
    if (perm !== "granted") {
      const r = await Notification.requestPermission();
      if (r !== "granted") { toast.error("Permission refusée"); return; }
    }
    setEnabled(true);
    toast.success("Notifications activées");
    new Notification("🎉 OUIWEB · Notifications actives", {
      body: "Tu seras prévenu quand un post programmé sera publié.",
      icon: "/favicon.svg",
    });
  }

  return (
    <button
      onClick={toggle}
      className="nav-item w-full justify-between"
      title={enabled ? "Désactiver les notifications" : "Activer les notifications"}
    >
      <span className="flex items-center gap-3">
        {enabled
          ? <Bell className="size-4" style={{ color: theme?.primary }} />
          : <BellOff className="size-4" />}
        <span>Notifications</span>
      </span>
      <span
        className={"shrink-0 relative w-8 h-4 rounded-full transition-colors " + (enabled ? "" : "bg-zinc-700")}
        style={enabled && theme ? { background: theme.primary } : undefined}
      >
        <span
          className="absolute top-0.5 size-3 rounded-full bg-white transition-all"
          style={{ left: enabled ? "calc(100% - 14px)" : "2px" }}
        />
      </span>
    </button>
  );
}
