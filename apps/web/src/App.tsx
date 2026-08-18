import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { UserRole } from "@proactif-field/shared";
import { useAuthStore } from "./auth/store";
import { startSyncLoop, onSyncChange, getLastSyncError } from "./offline/syncManager";
import { getPendingPhotos } from "./offline/db";
import LoginPage from "./pages/LoginPage";
import ChantiersListPage from "./pages/ChantiersListPage";
import ChantierDetailPage from "./pages/ChantierDetailPage";
import DashboardPage from "./pages/DashboardPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import ReportsPage from "./pages/ReportsPage";

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  if (!token) return <Navigate to="/login" replace />;
  if (user?.role !== UserRole.ADMIN) return <Navigate to="/" replace />;
  return children;
}

function SyncBanner() {
  const [pendingCount, setPendingCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      getPendingPhotos().then((list) => setPendingCount(list.length));
      setLastError(getLastSyncError());
    };
    refresh();
    return onSyncChange(refresh);
  }, []);

  if (pendingCount === 0) return null;
  return (
    <div className="sync-banner">
      {pendingCount} photo{pendingCount > 1 ? "s" : ""} en attente de synchronisation…
      {lastError && <div className="sync-banner-error">Dernière erreur : {lastError}</div>}
    </div>
  );
}

export default function App() {
  useEffect(() => startSyncLoop(), []);

  return (
    <div className="app-shell">
      <SyncBanner />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <ChantiersListPage />
            </RequireAuth>
          }
        />
        <Route
          path="/chantiers/:chantierId"
          element={
            <RequireAuth>
              <ChantierDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireAdmin>
              <DashboardPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireAdmin>
              <AdminUsersPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/reports"
          element={
            <RequireAdmin>
              <ReportsPage />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
