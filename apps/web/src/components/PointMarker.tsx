import { PointDTO } from "@proactif-field/shared";

interface Props {
  point: PointDTO;
  onClick: () => void;
}

export default function PointMarker({ point, onClick }: Props) {
  return (
    <div
      className="point-marker"
      style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <div className={`pin ${point.statut}`}>
        {point.photoCount > 0 && <span className="photo-count">{point.photoCount}</span>}
      </div>
      <span className="label">{point.identifiant}</span>
    </div>
  );
}
