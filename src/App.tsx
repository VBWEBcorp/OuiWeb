import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import MobileTopBar from "./components/MobileTopBar";
import Dashboard from "./pages/Dashboard";
import Compose from "./pages/Compose";
import CalendarPage from "./pages/CalendarPage";
import Persona from "./pages/Persona";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import { useAccountBootstrap } from "./lib/store";
import { useAuth } from "./lib/auth";
import ThemeProvider from "./components/ThemeProvider";
import RequireLinkedIn from "./components/RequireLinkedIn";
import { useStatusNotifications } from "./hooks/useStatusNotifications";

function AppShell() {
  useAccountBootstrap();
  useStatusNotifications();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Auto-close drawer on route change (mobile)
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  return (
    <div className="flex md:h-screen md:overflow-hidden">
      {/* Mobile backdrop */}
      {drawerOpen && (
        <button
          aria-label="Fermer le menu"
          onClick={() => setDrawerOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in"
        />
      )}

      {/* Sidebar — fixed slide-in on mobile, static on desktop */}
      <div
        className={
          "fixed md:static z-50 h-full transition-transform duration-300 " +
          (drawerOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0")
        }
      >
        <Sidebar />
      </div>

      <main className="flex-1 md:overflow-y-auto min-w-0">
        <MobileTopBar onMenu={() => setDrawerOpen(true)} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-4 md:py-8">
          <Routes>
            <Route path="/dashboard" element={<RequireLinkedIn><Dashboard /></RequireLinkedIn>} />
            <Route path="/compose"   element={<RequireLinkedIn><Compose /></RequireLinkedIn>} />
            <Route path="/compose/:id" element={<RequireLinkedIn><Compose /></RequireLinkedIn>} />
            <Route path="/calendar"  element={<RequireLinkedIn><CalendarPage /></RequireLinkedIn>} />
            <Route path="/persona"   element={<RequireLinkedIn><Persona /></RequireLinkedIn>} />
            <Route path="/analytics" element={<RequireLinkedIn><Analytics /></RequireLinkedIn>} />
            <Route path="/settings"  element={<Settings />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const tenantId = useAuth((s) => s.tenantId);
  const location = useLocation();

  if (!tenantId) {
    if (location.pathname !== "/login") {
      return (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      );
    }
    return <Routes><Route path="/login" element={<Login />} /></Routes>;
  }

  return (
    <ThemeProvider>
      <Routes>
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="/*" element={<AppShell />} />
      </Routes>
    </ThemeProvider>
  );
}
