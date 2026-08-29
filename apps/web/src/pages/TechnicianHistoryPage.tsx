import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ActivityLogDTO } from "@proactif-field/shared";
import { useGlobalActivity } from "../api/hooks";
import Icon from "../components/Icon";

const ACTION_LABELS: Record<string, string> = {
  CHANTIER_CREE: "Création du chantier",
  CHANTIER_MODIFIE: "Informations du chantier modifiées",
  PLAN_AJOUTE: "Plan ajouté",
  DOCUMENT_AJOUTE: "Document ajouté",
  POINT_CREE: "Point créé",
  POINT_MODIFIE: "Point modifié",
  POINT_STATUT_MODIFIE: "Statut d’un point modifié",
  PHOTO_AJOUTEE: "Photo ajoutée",
  TECHNICIEN_AFFECTE: "Technicien affecté",
  TECHNICIEN_DESAFFECTE: "Technicien retiré",
  RAPPORT_GENERE: "Rapport généré",
  BLOCAGE_CREE: "Blocage signalé",
  BLOCAGE_MODIFIE: "Blocage modifié",
  BLOCAGE_RESOLU: "Blocage résolu",
  MATERIEL_AJOUTE: "Matériel ajouté",
  MATERIEL_MODIFIE: "Matériel modifié",
  MATERIEL_SUPPRIME: "Matériel supprimé",
};

export default function TechnicianHistoryPage() {
  const [cursor, setCursor] = useState<string | null>(null);
  const [entries, setEntries] = useState<ActivityLogDTO[]>([]);
  const { data, isLoading, isFetching, isError } = useGlobalActivity(cursor);

  useEffect(() => {
    if (!data) return;
    setEntries((previous) => cursor ? [...previous, ...data.activities] : data.activities);
  }, [data, cursor]);

  return <><div className="topbar"><h1>Historique</h1></div><main className="page">
    {isLoading && entries.length === 0 && <p>Chargement…</p>}
    {isError && <div className="error-banner">Impossible de charger l’historique.</div>}
    {!isLoading && !isError && entries.length === 0 && <div className="empty-state"><Icon name="report" size={38} /><p>Aucune activité sur vos chantiers.</p></div>}
    {entries.length > 0 && <ul className="activity-timeline">{entries.map((entry) => <li key={entry.id} className="activity-timeline-row">
      <span className="activity-timeline-icon"><Icon name="report" size={16} /></span>
      <time>{new Date(entry.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</time>
      <span><Link to={`/chantiers/${entry.chantierId}`}><strong>{entry.chantierReference} · {entry.chantierName}</strong></Link><br />{ACTION_LABELS[entry.action] ?? entry.description ?? entry.action} · {entry.userName}</span>
    </li>)}</ul>}
    {data?.nextCursor && <button className="btn secondary block" disabled={isFetching} onClick={() => setCursor(data.nextCursor)}>{isFetching ? "Chargement…" : "Charger plus"}</button>}
  </main></>;
}
