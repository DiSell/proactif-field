import { PointDTO } from "@proactif-field/shared";
import { useParams } from "react-router-dom";
import { useFileObjectUrl } from "../../api/files";
import { useChantierPoints, usePhotos } from "../../api/hooks";
import StatusBadge from "../../components/StatusBadge";

export default function ChantierPointsPage() {
  const { chantierId } = useParams<{ chantierId: string }>();
  const { data: points, isLoading } = useChantierPoints(chantierId);

  return (
    <div className="page">
      {isLoading && <p>Chargement…</p>}
      {points?.length === 0 && <p style={{ color: "var(--ink-muted)" }}>Aucun point pour l'instant.</p>}
      {points?.map((point) => <PointCard key={point.id} point={point} />)}
    </div>
  );
}

function PointCard({ point }: { point: PointDTO }) {
  const { data: photos, isLoading } = usePhotos(point.id);

  return (
    <article className="card chantier-point-card">
      <div className="chantier-point-card-header">
        <div>
          <h3>{point.type ? `[${point.type}] ` : ""}{point.identifiant}{point.nom ? ` — ${point.nom}` : ""}</h3>
          <p>{point.photoCount} photo{point.photoCount > 1 ? "s" : ""}</p>
        </div>
        <StatusBadge statut={point.statut} />
      </div>
      {isLoading && point.photoCount > 0 && <div className="chantier-point-photo-loading" aria-label="Chargement des photos" />}
      {!!photos?.length && <div className="chantier-point-photo-grid">{photos.map((photo) => <PointPhoto key={photo.id} id={photo.id} />)}</div>}
    </article>
  );
}

function PointPhoto({ id }: { id: string }) {
  const { url, error, retry } = useFileObjectUrl("photos", id);
  if (error) return <button type="button" className="chantier-point-photo-error" onClick={retry}>Réessayer</button>;
  if (!url) return <span className="chantier-point-photo-placeholder" />;
  return <a href={url} target="_blank" rel="noreferrer" className="chantier-point-photo-link"><img src={url} alt="Photo du point" loading="lazy" /></a>;
}
