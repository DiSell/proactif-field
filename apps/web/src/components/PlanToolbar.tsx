import { PlanDTO } from "@proactif-field/shared";
import { useControls } from "react-zoom-pan-pinch";
import Icon from "./Icon";

interface Props {
  plan: PlanDTO;
  plans: PlanDTO[];
  pointsVisible: boolean;
  isFullscreen: boolean;
  onPlanChange: (planId: string) => void;
  onTogglePoints: () => void;
  onToggleFullscreen: () => void;
  onAddPlan?: () => void;
}

export default function PlanToolbar({ plan, plans, pointsVisible, isFullscreen, onPlanChange, onTogglePoints, onToggleFullscreen, onAddPlan }: Props) {
  const { zoomIn, zoomOut, resetTransform } = useControls();

  return <div className="plan-toolbar" role="toolbar" aria-label="Outils du plan">
    <div className="plan-toolbar-file">
      <span>Plan actif</span>
      {plans.length > 1 ? <select value={plan.id} onChange={(event) => onPlanChange(event.target.value)} aria-label="Changer de plan">{plans.map((item) => <option key={item.id} value={item.id}>{item.fileName}</option>)}</select> : <strong title={plan.fileName}>{plan.fileName}</strong>}
    </div>
    <div className="plan-toolbar-actions">
      {onAddPlan && <button className="plan-tool-add" onClick={onAddPlan} title="Ajouter un plan" aria-label="Ajouter un plan"><Icon name="plus" /></button>}
      <button className="plan-tool-zoom-out" onClick={() => zoomOut()} title="Zoom arrière" aria-label="Zoom arrière"><Icon name="zoom-out" /></button>
      <button className="plan-tool-zoom-in" onClick={() => zoomIn()} title="Zoom avant" aria-label="Zoom avant"><Icon name="zoom-in" /></button>
      <button className="plan-tool-reset" onClick={() => resetTransform()} title="Recentrer le plan" aria-label="Recentrer le plan"><Icon name="locate" /></button>
      <button className={`plan-tool-points ${pointsVisible ? "active" : ""}`} onClick={onTogglePoints} title={pointsVisible ? "Masquer les points" : "Afficher les points"} aria-label={pointsVisible ? "Masquer les points" : "Afficher les points"} aria-pressed={pointsVisible}><Icon name="eye" /></button>
      <button className="plan-tool-fullscreen" onClick={onToggleFullscreen} title={isFullscreen ? "Quitter le plein écran" : "Afficher en plein écran"} aria-label={isFullscreen ? "Quitter le plein écran" : "Afficher en plein écran"}><span className="fullscreen-icon">{isFullscreen ? "↙" : "↗"}</span></button>
    </div>
  </div>;
}
