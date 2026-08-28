import { PointDTO } from "@proactif-field/shared";

interface Props {
  point: PointDTO;
  onClick: () => void;
  selected?: boolean;
  rotation?: number;
}

export default function PointMarker({ point, onClick, selected = false, rotation = 0 }: Props) {
  return (
    <div
      className={`point-marker ${selected ? "point-marker-selected" : ""} ${point.openBlocageCount > 0 ? "point-marker-blocked" : ""}`}
      style={{
        left: `${point.x * 100}%`,
        top: `${point.y * 100}%`,
        // The marker's position tracks the plan's own rotation (it's placed
        // relative to plan content, same as the plan image), but the pin
        // and label counter-rotate so they stay upright and legible.
        transform: rotation ? `translate(-50%, -100%) rotate(${-rotation}deg)` : undefined,
        transformOrigin: rotation ? "50% 100%" : undefined,
      }}
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
