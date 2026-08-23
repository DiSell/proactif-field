import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { PointDTO, UserRole } from "@proactif-field/shared";
import { useCreatePoint, usePlans, usePoints, useUploadPlan } from "../../api/hooks";
import { useAuthStore } from "../../auth/store";
import PlanViewer from "../../components/PlanViewer";
import PointFiche from "../../components/PointFiche";
import MobileFieldHeader from "../../components/MobileFieldHeader";

// This is the core terrain screen (plan viewer + point creation/selection),
// unchanged from before the dossier-chantier navigation restructure — only
// its container changed (used to be the whole chantier page, now it's the
// "Plans" tab).
export default function ChantierPlansPage() {
  const { chantierId } = useParams<{ chantierId: string }>();
  const { data: plans } = usePlans(chantierId);
  const uploadPlan = useUploadPlan(chantierId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isTechnician = currentUser?.role === UserRole.TECHNICIEN;

  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<PointDTO | null>(null);

  useEffect(() => {
    if (plans && plans.length > 0 && !activePlanId) {
      setActivePlanId(plans[0].id);
    }
  }, [plans, activePlanId]);

  const activePlan = plans?.find((p) => p.id === activePlanId) ?? null;
  const { data: points } = usePoints(activePlan?.id);
  const createPoint = useCreatePoint(activePlan?.id);

  useEffect(() => {
    if (!selectedPoint || !points) return;
    const fresh = points.find((p) => p.id === selectedPoint.id);
    if (fresh) setSelectedPoint(fresh);
  }, [points, selectedPoint?.id]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const plan = await uploadPlan.mutateAsync(file);
    setActivePlanId(plan.id);
  }

  async function handleCreatePoint(x: number, y: number) {
    if (!activePlan) return;
    const nextNumber = (points?.length ?? 0) + 1;
    const point = await createPoint.mutateAsync({
      identifiant: `P${nextNumber}`,
      x,
      y,
    });
    setSelectedPoint(point);
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.svg"
        style={{ display: "none" }}
        onChange={handleUpload}
      />

      {!plans ? (
        <div className="page">Chargement…</div>
      ) : plans.length === 0 ? (
        <div className="page">
          <div className="upload-zone">
            <p>Aucun plan importé pour ce chantier.</p>
            {isAdmin ? (
              <button className="btn" onClick={() => fileInputRef.current?.click()} disabled={uploadPlan.isPending}>
                {uploadPlan.isPending ? "Import…" : "Importer un plan (PDF, PNG, JPG, SVG)"}
              </button>
            ) : (
              <p style={{ color: "var(--ink-muted)" }}>En attente d'un plan importé par un administrateur.</p>
            )}
          </div>
        </div>
      ) : (
        <div className={`plan-workspace ${selectedPoint ? "has-point-panel" : ""}`}>
          {activePlan && <MobileFieldHeader backTo={`/chantiers/${chantierId}`} plan={activePlan} plans={plans} onPlanChange={(planId) => { setActivePlanId(planId); setSelectedPoint(null); }} />}
          <div className="plan-workspace-main">
          {activePlan && (
            <PlanViewer
              plan={activePlan}
              plans={plans}
              points={points ?? []}
              onCreatePoint={handleCreatePoint}
              onSelectPoint={setSelectedPoint}
              canCreatePoint={isTechnician}
              selectedPointId={selectedPoint?.id}
              onPlanChange={(planId) => { setActivePlanId(planId); setSelectedPoint(null); }}
              onAddPlan={isAdmin ? () => fileInputRef.current?.click() : undefined}
            />
          )}
          </div>
          {selectedPoint && activePlan && <PointFiche planId={activePlan.id} point={selectedPoint} canCapture={isTechnician} displayMode="panel" onClose={() => setSelectedPoint(null)} />}
        </div>
      )}
    </>
  );
}
