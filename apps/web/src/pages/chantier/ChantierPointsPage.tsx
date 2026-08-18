import { useParams } from "react-router-dom";
import { useChantierPoints } from "../../api/hooks";
import StatusBadge from "../../components/StatusBadge";

export default function ChantierPointsPage() {
  const { chantierId } = useParams<{ chantierId: string }>();
  const { data: points, isLoading } = useChantierPoints(chantierId);

  return (
    <div className="page">
      {isLoading && <p>Chargement…</p>}
      {points?.length === 0 && <p style={{ color: "#94a3b8" }}>Aucun point pour l'instant.</p>}
      {points?.map((p) => (
        <div key={p.id} className="card user-card">
          <div>
            <h3>
              {p.type ? `[${p.type}] ` : ""}
              {p.identifiant}
              {p.nom ? ` — ${p.nom}` : ""}
            </h3>
            <p>{p.photoCount} photo{p.photoCount > 1 ? "s" : ""}</p>
          </div>
          <StatusBadge statut={p.statut} />
        </div>
      ))}
    </div>
  );
}
