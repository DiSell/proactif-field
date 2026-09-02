import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { UserRole } from "@proactif-field/shared";
import { useAuthStore } from "./auth/store";
import { startSyncLoop, onSyncChange, getLastSyncError, isSyncing, trySync } from "./offline/syncManager";
import { getOperations, getPendingPhotos } from "./offline/db";
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
import ActivateAccountPage from "./pages/ActivateAccountPage";
import TechnicianAccountPage from "./pages/TechnicianAccountPage";
import TechnicianHistoryPage from "./pages/TechnicianHistoryPage";
import FieldReportsPage from "./pages/FieldReportsPage";
import FieldReportNewPage from "./pages/FieldReportNewPage";
import FieldReportDetailPage from "./pages/FieldReportDetailPage";

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

function RequireTechnician({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  if (!token) return <Navigate to="/login" replace />;
  if (user?.role !== UserRole.TECHNICIEN) return <Navigate to="/" replace />;
  return children;
}

function SyncBanner() {
  const [pendingCount, setPendingCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const userId = useAuthStore((state) => state.user?.id);

  useEffect(() => {
    const refresh = () => {
      Promise.all([userId ? getPendingPhotos(userId) : Promise.resolve([]), getOperations(userId)]).then(([photos, operations]) => setPendingCount(photos.length + operations.length));
      setLastError(getLastSyncError());
      setOnline(navigator.onLine);
    };
    refresh();
    const unsubscribe = onSyncChange(refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => { unsubscribe(); window.removeEventListener("online", refresh); window.removeEventListener("offline", refresh); };
  }, [userId]);

  if (online && pendingCount === 0 && !lastError) return null;
  return (
    <div className="sync-banner">
      <span>{online ? (isSyncing() ? "Synchronisation…" : "En ligne") : "Mode hors ligne"}{pendingCount > 0 ? ` · ${pendingCount} opération${pendingCount > 1 ? "s" : ""} en attente` : ""}</span>
      {online && pendingCount > 0 && <button className="btn secondary" onClick={() => void trySync()}>Synchroniser maintenant</button>}
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
        <Route path="/activate/:token" element={<ActivateAccountPage />} />
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
          <Route path="/mon-compte" element={<RequireTechnician><TechnicianAccountPage /></RequireTechnician>} />
          <Route path="/historique" element={<RequireTechnician><TechnicianHistoryPage /></RequireTechnician>} />
          <Route path="/rapport-terrain" element={<FieldReportsPage />} />
          <Route path="/rapport-terrain/nouveau" element={<FieldReportNewPage />} />
          <Route path="/rapport-terrain/:id" element={<FieldReportDetailPage />} />

          <Route path="/chantiers/:chantierId" element={<ChantierLayout />}>
            <Route index element={<ChantierOverviewPage />} />
            <Route path="documents" element={<ChantierDocumentsPage />} />
            <Route path="plans" element={<ChantierPlansPage />} />
            <Route path="points" element={<ChantierPointsPage />} />
            <Route path="materiel" element={<ChantierMaterielPage />} />
            <Route path="equipe" element={<ChantierEquipePage />} />
            <Route path="blocages" element={<ChantierBlocagesPage />} />
            <Route path="rapports" element={<ChantierRapportsPage />} />
            <Route path="historique" element={<ChantierHistoriquePage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
