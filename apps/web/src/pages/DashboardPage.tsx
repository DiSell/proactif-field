import { Link } from "react-router-dom";
import { useDashboard } from "../api/hooks";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useDashboard();

  return (
    <>
      <div className="topbar">
        <Link to="/" className="btn secondary">
          ← Chantiers
        </Link>
        <h1>Tableau de bord</h1>
        <div style={{ width: 90 }} />
      </div>

      <div className="page">
        {isLoading && <p>Chargement…</p>}
        {stats && (
          <>
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-value">{stats.chantierCount}</div>
                <div className="stat-label">Chantiers</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.pointCount}</div>
                <div className="stat-label">Points</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.pointCompleteCount}</div>
                <div className="stat-label">Points terminés</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.progressPercent}%</div>
                <div className="stat-label">Progression</div>
              </div>
            </div>

            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: `${stats.progressPercent}%` }} />
            </div>

            <h2 className="section-title">Derniers chantiers</h2>
            {stats.recentChantiers.length === 0 && <p style={{ color: "#94a3b8" }}>Aucun chantier.</p>}
            {stats.recentChantiers.map((c) => (
              <Link key={c.id} to={`/chantiers/${c.id}`} className="card-link">
                <div className="card">
                  <h3>{c.name}</h3>
                  {c.address && <p>{c.address}</p>}
                </div>
              </Link>
            ))}

            <h2 className="section-title">Derniers rapports générés</h2>
            {stats.recentReports.length === 0 && <p style={{ color: "#94a3b8" }}>Aucun rapport généré.</p>}
            {stats.recentReports.map((r) => (
              <div key={r.id} className="card">
                <h3>{r.chantierName}</h3>
                <p>
                  {formatDateTime(r.generatedAt)} · par {r.generatedByName}
                </p>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}
