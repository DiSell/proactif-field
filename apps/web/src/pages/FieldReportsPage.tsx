import { Link } from "react-router-dom";
import { useFieldReports, useDirtyFieldReportIds } from "../api/fieldReportHooks";
import Icon from "../components/Icon";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export default function FieldReportsPage() {
  const { data: reports, isLoading } = useFieldReports();
  const dirtyIds = useDirtyFieldReportIds();

  return (
    <div className="page field-reports-page">
      <div className="field-reports-head">
        <div>
          <span className="section-title" style={{ margin: 0 }}>Mode simple</span>
          <h1 style={{ fontSize: 28 }}>Rapport terrain</h1>
        </div>
        <Link to="/rapport-terrain/nouveau" className="btn">
          <Icon name="plus" /> Nouveau rapport
        </Link>
      </div>

      {isLoading && <p>Chargement…</p>}
      {reports?.length === 0 && (
        <div className="empty-state">
          <Icon name="camera" size={32} />
          <p>Aucun rapport terrain pour le moment.<br />Créez-en un pour commencer.</p>
        </div>
      )}

      <div className="field-report-list">
        {reports?.map((rapport) => (
          <Link key={rapport.id} to={`/rapport-terrain/${rapport.id}`} className="card card-link field-report-card">
            <div className="field-report-card-head">
              <h3>{rapport.nom}</h3>
              {dirtyIds.has(rapport.id) && <span className="field-report-sync-badge">En attente de synchronisation</span>}
            </div>
            <p>{formatDateTime(rapport.createdAt)} · {rapport.createdByName}</p>
            <div className="field-report-card-meta">
              {rapport.typeTravaux && <span>{rapport.typeTravaux}</span>}
              {rapport.lieu && <span>{rapport.lieu}</span>}
              <span>{rapport.itemCount} entrée{rapport.itemCount > 1 ? "s" : ""} · {rapport.photoCount} photo{rapport.photoCount > 1 ? "s" : ""}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
