import { PointStatut } from "@proactif-field/shared";

const LABELS: Record<PointStatut, string> = {
  [PointStatut.GRIS]: "À faire",
  [PointStatut.ORANGE]: "En cours",
  [PointStatut.VERT]: "Terminé",
};

export default function StatusBadge({ statut }: { statut: PointStatut }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span className={`status-dot ${statut}`} />
      {LABELS[statut]}
    </span>
  );
}
