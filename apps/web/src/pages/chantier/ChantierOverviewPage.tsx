import { useParams } from "react-router-dom";
import { ChantierStatut } from "@proactif-field/shared";
import { useChantier, usePlans } from "../../api/hooks";

const STATUT_LABELS: Record<ChantierStatut, string> = {
  [ChantierStatut.PREPARATION]: "Préparation",
  [ChantierStatut.PRET]: "Prêt",
  [ChantierStatut.EN_COURS]: "En cours",
  [ChantierStatut.BLOQUE]: "Bloqué",
  [ChantierStatut.TERMINE]: "Terminé",
  [ChantierStatut.CLOTURE]: "Clôturé",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

export default function ChantierOverviewPage() {
  const { chantierId } = useParams<{ chantierId: string }>();
  const { data: chantier } = useChantier(chantierId);
  const { data: plans } = usePlans(chantierId);

  if (!chantier) return <div className="page">Chargement…</div>;

  return (
    <div className="page">
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{chantier.reference}</div>
          <div className="stat-label">Référence</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{STATUT_LABELS[chantier.statut]}</div>
          <div className="stat-label">Statut</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{plans?.length ?? "…"}</div>
          <div className="stat-label">Plans</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{chantier.assignedUserIds.length}</div>
          <div className="stat-label">Techniciens assignés</div>
        </div>
      </div>

      <div className="card">
        <h3>Informations</h3>
        <dl className="detail-list">
          <dt>Client / donneur d'ordre</dt>
          <dd>{chantier.client || "—"}</dd>
          <dt>Entreprise exécutante</dt>
          <dd>{chantier.entrepriseExecutante || "—"}</dd>
          <dt>Adresse / zone d'intervention</dt>
          <dd>{chantier.address || "—"}</dd>
          <dt>Responsable</dt>
          <dd>{chantier.responsableName || "—"}</dd>
          <dt>Date de début prévue</dt>
          <dd>{formatDate(chantier.dateDebutPrevue)}</dd>
          <dt>Date de fin prévue</dt>
          <dd>{formatDate(chantier.dateFinPrevue)}</dd>
        </dl>
        {chantier.description && (
          <>
            <h3>Description / objet des travaux</h3>
            <p>{chantier.description}</p>
          </>
        )}
      </div>
    </div>
  );
}
