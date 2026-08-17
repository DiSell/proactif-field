import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./auth/store";
import { startSyncLoop, onSyncChange } from "./offline/syncManager";
import { getPendingPhotos } from "./offline/db";
import LoginPage from "./pages/LoginPage";
import ChantiersListPage from "./pages/ChantiersListPage";
import ChantierDetailPage from "./pages/ChantierDetailPage";

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function SyncBanner() {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const refresh = () => getPendingPhotos().then((list) => setPendingCount(list.length));
    refresh();
    return onSyncChange(refresh);
  }, []);

  if (pendingCount === 0) return null;
  return (
    <div className="sync-banner">
      {pendingCount} photo{pendingCount > 1 ? "s" : ""} en attente de synchronisation…
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
