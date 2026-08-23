import { PointDTO } from "@proactif-field/shared";

interface Props {
  point: PointDTO;
  onClick: () => void;
  selected?: boolean;
}

export default function PointMarker({ point, onClick, selected = false }: Props) {
  return (
    <div
      className={`point-marker ${selected ? "point-marker-selected" : ""} ${point.openBlocageCount > 0 ? "point-marker-blocked" : ""}`}
      style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <div className={`pin ${point.statut}`}>
        {point.photoCount > 0 && <span className="photo-count">{point.photoCount}</span>}
        {point.openBlocageCount > 0 && <span className="blocage-count" title="Blocage ouvert">!</span>}
      </div>
      <span className="label">{point.identifiant}</span>
    </div>
  );
}
