import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ActivityLogDTO } from "@proactif-field/shared";
import { useChantierActivity } from "../../api/hooks";
import Icon, { IconName } from "../../components/Icon";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

const STATUT_LABELS: Record<string, string> = { GRIS: "À faire", ORANGE: "En cours", VERT: "Terminé" };
const statutLabel = (value: unknown): string => STATUT_LABELS[String(value)] ?? String(value);

const ACTION_ICONS: Record<string, IconName> = {
  CHANTIER_CREE: "chantier",
  CHANTIER_MODIFIE: "settings",
  PLAN_AJOUTE: "building",
  DOCUMENT_AJOUTE: "report",
  POINT_CREE: "locate",
  POINT_MODIFIE: "locate",
  POINT_STATUT_MODIFIE: "check",
  PHOTO_AJOUTEE: "camera",
  TECHNICIEN_AFFECTE: "users",
  TECHNICIEN_DESAFFECTE: "users",
  RAPPORT_GENERE: "report",
  BLOCAGE_CREE: "warning",
  BLOCAGE_MODIFIE: "warning",
  BLOCAGE_RESOLU: "check",
};

// Turns (action, metadata) into a sentence a site manager can read at a
// glance — no route paths, no ids, no server jargon. Falls back to the raw
// `description` (or the action code itself) for entries whose metadata
// predates a given field, so older rows still render sensibly.
function actionSentence(entry: ActivityLogDTO): string {
  const meta = entry.metadata ?? {};
  switch (entry.action) {
    case "CHANTIER_CREE":
      return "a créé ce dossier chantier";
    case "CHANTIER_MODIFIE":
      return "a modifié les informations du chantier";
    case "PLAN_AJOUTE":
      return meta.planName ? `a ajouté le plan « ${meta.planName} »` : "a ajouté un plan";
    case "DOCUMENT_AJOUTE":
      return meta.documentName ? `a ajouté le document « ${meta.documentName} »` : "a ajouté un document";
    case "POINT_CREE":
      return meta.pointIdentifiant ? `a créé le point ${meta.pointIdentifiant}` : "a créé un point";
    case "POINT_MODIFIE":
      return meta.pointIdentifiant ? `a modifié le point ${meta.pointIdentifiant}` : "a modifié un point";
    case "POINT_STATUT_MODIFIE":
      return meta.pointIdentifiant
        ? `a fait passer le statut du point ${meta.pointIdentifiant} de « ${statutLabel(meta.previousStatut)} » à « ${statutLabel(meta.newStatut)} »`
        : "a modifié le statut d'un point";
    case "PHOTO_AJOUTEE":
      return meta.pointIdentifiant ? `a ajouté une photo sur le point ${meta.pointIdentifiant}` : "a ajouté une photo";
    case "TECHNICIEN_AFFECTE":
      return meta.technicianName ? `a affecté ${meta.technicianName} au chantier` : "a affecté un technicien au chantier";
    case "TECHNICIEN_DESAFFECTE":
      return meta.technicianName ? `a retiré ${meta.technicianName} du chantier` : "a retiré un technicien du chantier";
    case "RAPPORT_GENERE":
      return "a généré un rapport PDF";
    case "BLOCAGE_CREE":
      return meta.pointIdentifiant ? `a signalé un blocage sur le point ${meta.pointIdentifiant}` : "a signalé un blocage";
    case "BLOCAGE_MODIFIE":
      return meta.pointIdentifiant ? `a modifié le blocage du point ${meta.pointIdentifiant}` : "a modifié un blocage";
    case "BLOCAGE_RESOLU":
      return meta.pointIdentifiant ? `a résolu le blocage du point ${meta.pointIdentifiant}` : "a résolu un blocage";
    default:
      return entry.description ?? entry.action;
  }
}

export default function ChantierHistoriquePage() {
  const { chantierId } = useParams<{ chantierId: string }>();
  const [cursor, setCursor] = useState<string | null>(null);
  const [entries, setEntries] = useState<ActivityLogDTO[]>([]);
  const { data, isLoading, isFetching } = useChantierActivity(chantierId, cursor);

  useEffect(() => {
    setCursor(null);
    setEntries([]);
  }, [chantierId]);

  useEffect(() => {
    if (!data) return;
    setEntries((previous) => (cursor ? [...previous, ...data.activities] : data.activities));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return (
    <div className="page">
      {isLoading && entries.length === 0 && <p>Chargement…</p>}
      {!isLoading && entries.length === 0 && (
        <div className="upload-zone">
          <p>Aucune activité enregistrée pour ce chantier.</p>
          <p style={{ color: "var(--ink-muted)", fontSize: 13 }}>
            Le journal se remplit automatiquement au fil des actions (chantier, plans, points, photos, documents, équipe, blocages, rapports…).
          </p>
        </div>
      )}
      {entries.length > 0 && (
        <ul className="activity-timeline">
          {entries.map((entry) => (
            <li key={entry.id} className="activity-timeline-row">
              <span className="activity-timeline-icon"><Icon name={ACTION_ICONS[entry.action] ?? "more"} size={16} /></span>
              <time>{formatDateTime(entry.createdAt)}</time>
              <span>
                <strong>{entry.userName}</strong> {actionSentence(entry)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {data?.nextCursor && (
        <button
          className="btn secondary block"
          onClick={() => setCursor(data.nextCursor)}
          disabled={isFetching}
        >
          {isFetching ? "Chargement…" : "Charger plus"}
        </button>
      )}
    </div>
  );
}
