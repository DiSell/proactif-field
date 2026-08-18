import { Link, NavLink, Outlet, useParams } from "react-router-dom";
import { UserRole } from "@proactif-field/shared";
import { useChantier } from "../api/hooks";
import { useAuthStore } from "../auth/store";

export default function ChantierLayout() {
  const { chantierId } = useParams<{ chantierId: string }>();
  const { data: chantier } = useChantier(chantierId);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === UserRole.ADMIN;

  const base = `/chantiers/${chantierId}`;
  const tabs = [
    { to: base, label: "Vue d'ensemble", end: true },
    { to: `${base}/documents`, label: "Documents" },
    { to: `${base}/plans`, label: "Plans" },
    { to: `${base}/points`, label: "Points" },
    { to: `${base}/materiel`, label: "Matériel" },
    { to: `${base}/equipe`, label: "Équipe" },
    { to: `${base}/blocages`, label: "Blocages" },
    ...(isAdmin ? [{ to: `${base}/rapports`, label: "Rapports" }] : []),
    { to: `${base}/historique`, label: "Historique" },
  ];

  return (
    <div className="chantier-shell">
      <div className="topbar">
        <Link to="/" className="btn secondary">
          ← Chantiers
        </Link>
        <h1 style={{ flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis" }}>
          {chantier?.name}
        </h1>
        <div style={{ width: 90 }} />
      </div>

      <nav className="chantier-tabs">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => `chantier-tab ${isActive ? "chantier-tab-active" : ""}`}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <div className="chantier-content">
        <Outlet />
      </div>
    </div>
  );
}
