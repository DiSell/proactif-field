import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { UserRole } from "@proactif-field/shared";
import { useAuthStore } from "./auth/store";
import { startSyncLoop, onSyncChange, getLastSyncError } from "./offline/syncManager";
import { getPendingPhotos } from "./offline/db";
import AppLayout from "./components/AppLayout";
import ChantierLayout from "./components/ChantierLayout";
import LoginPage from "./pages/LoginPage";
import ChantiersListPage from "./pages/ChantiersListPage";
import ChantierOverviewPage from "./pages/chantier/ChantierOverviewPage";
import ChantierDocumentsPage from "./pages/chantier/ChantierDocumentsPage";
import ChantierPlansPage from "./pages/chantier/ChantierPlansPage";
import ChantierPointsPage from "./pages/chantier/ChantierPointsPage";
import ChantierMaterielPage from "./pages/chantier/ChantierMaterielPage";
import ChantierEquipePage from "./pages/chantier/ChantierEquipePage";
import ChantierBlocagesPage from "./pages/chantier/ChantierBlocagesPage";
import ChantierRapportsPage from "./pages/chantier/ChantierRapportsPage";
import ChantierHistoriquePage from "./pages/chantier/ChantierHistoriquePage";
import DashboardPage from "./pages/DashboardPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminEntreprisePage from "./pages/AdminEntreprisePage";
import AdminParametresPage from "./pages/AdminParametresPage";
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
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<ChantiersListPage />} />
          <Route path="/dashboard" element={<RequireAdmin><DashboardPage /></RequireAdmin>} />
          <Route path="/admin/users" element={<RequireAdmin><AdminUsersPage /></RequireAdmin>} />
          <Route path="/admin/entreprise" element={<RequireAdmin><AdminEntreprisePage /></RequireAdmin>} />
          <Route path="/admin/parametres" element={<RequireAdmin><AdminParametresPage /></RequireAdmin>} />
          <Route path="/reports" element={<RequireAdmin><ReportsPage /></RequireAdmin>} />

          <Route path="/chantiers/:chantierId" element={<ChantierLayout />}>
            <Route index element={<ChantierOverviewPage />} />
            <Route path="documents" element={<ChantierDocumentsPage />} />
            <Route path="plans" element={<ChantierPlansPage />} />
            <Route path="points" element={<ChantierPointsPage />} />
            <Route path="materiel" element={<ChantierMaterielPage />} />
            <Route path="equipe" element={<ChantierEquipePage />} />
            <Route path="blocages" element={<ChantierBlocagesPage />} />
            <Route path="rapports" element={<RequireAdmin><ChantierRapportsPage /></RequireAdmin>} />
            <Route path="historique" element={<ChantierHistoriquePage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
