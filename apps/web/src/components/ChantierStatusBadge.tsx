import { ChantierStatut } from "@proactif-field/shared";

const LABELS: Record<ChantierStatut, string> = {
  [ChantierStatut.PREPARATION]: "Préparation",
  [ChantierStatut.PRET]: "Prêt",
  [ChantierStatut.EN_COURS]: "En cours",
  [ChantierStatut.BLOQUE]: "Bloqué",
  [ChantierStatut.TERMINE]: "Terminé",
  [ChantierStatut.CLOTURE]: "Clôturé",
};

export default function ChantierStatusBadge({ statut }: { statut: ChantierStatut }) {
  return <span className={`chantier-status-badge ${statut}`}>{LABELS[statut]}</span>;
}
