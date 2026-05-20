import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
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

function AppShell() {
  useAccountBootstrap();
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8">
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
