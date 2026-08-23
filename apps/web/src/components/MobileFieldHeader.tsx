import { PlanDTO } from "@proactif-field/shared";
import { Link } from "react-router-dom";
import Icon from "./Icon";

interface Props {
  backTo: string;
  plan: PlanDTO;
  plans: PlanDTO[];
  onPlanChange: (planId: string) => void;
}

export default function MobileFieldHeader({ backTo, plan, plans, onPlanChange }: Props) {
  return <header className="mobile-field-header">
    <Link to={backTo} aria-label="Retour au chantier"><Icon name="back" /></Link>
    <div><span>Plan</span>{plans.length > 1 ? <select value={plan.id} onChange={(event) => onPlanChange(event.target.value)} aria-label="Changer de plan">{plans.map((item) => <option key={item.id} value={item.id}>{item.fileName}</option>)}</select> : <strong>{plan.fileName}</strong>}</div>
    <span className="mobile-field-status" aria-label="Espace terrain"><span /></span>
  </header>;
}
