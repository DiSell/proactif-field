import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { BlocageTracePoint, PointDTO, UserRole } from "@proactif-field/shared";
import { useChantierBlocages, useCreatePoint, usePlans, usePoints, useUploadPlan } from "../../api/hooks";
import { useAuthStore } from "../../auth/store";
import PlanViewer from "../../components/PlanViewer";
import PointFiche from "../../components/PointFiche";
import MobileFieldHeader from "../../components/MobileFieldHeader";
import { getCurrentPositionSafe } from "../../utils/geolocation";

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
  const [placingBlockageStart, setPlacingBlockageStart] = useState(false);
  const [blockageStart, setBlockageStart] = useState<{ x: number; y: number; gps: { lat: number; lng: number; accuracy: number } | null } | null>(null);
  const [placingFlexion, setPlacingFlexion] = useState(false);
  const [blockageFlexions, setBlockageFlexions] = useState<BlocageTracePoint[]>([]);
  const [openBlocageForm, setOpenBlocageForm] = useState(false);
  const { data: chantierBlocages } = useChantierBlocages(chantierId);

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
    setOpenBlocageForm(false);
    setSelectedPoint(point);
  }

  async function handleDrawBlockage(start: { x: number; y: number }, end: { x: number; y: number }) {
    if (!activePlan) return;
    const nextNumber = (points?.length ?? 0) + 1;
    const point = await createPoint.mutateAsync({ identifiant: `P${nextNumber}`, x: end.x, y: end.y });
    setBlockageStart({ x: start.x, y: start.y, gps: null });
    setBlockageFlexions([]);
    setOpenBlocageForm(true);
    setSelectedPoint(point);
    void getCurrentPositionSafe().then((gps) => {
      if (gps) setBlockageStart((current) => current?.x === start.x && current.y === start.y ? { ...current, gps } : current);
    });
  }

  async function handlePlaceBlockageStart(x: number, y: number) {
    setBlockageStart({ x, y, gps: null });
    setPlacingBlockageStart(false);
    void getCurrentPositionSafe().then((gps) => {
      if (gps) setBlockageStart((current) => current?.x === x && current.y === y ? { ...current, gps } : current);
    });
  }

  function handlePlaceFlexion(x: number, y: number) {
    const flexion: BlocageTracePoint = { x, y, gpsLat: null, gpsLng: null, gpsAccuracy: null };
    setBlockageFlexions((points) => [...points, flexion]);
    void getCurrentPositionSafe().then((gps) => {
      if (gps) setBlockageFlexions((points) => points.map((point) => point === flexion ? { ...point, gpsLat: gps.lat, gpsLng: gps.lng, gpsAccuracy: gps.accuracy } : point));
    });
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
            {isAdmin || isTechnician ? (
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
              onSelectPoint={(point) => { setSelectedPoint(point); setBlockageStart(null); setBlockageFlexions([]); setPlacingBlockageStart(false); setPlacingFlexion(false); setOpenBlocageForm(false); }}
              canCreatePoint={isTechnician}
              selectedPointId={selectedPoint?.id}
              onPlanChange={(planId) => { setActivePlanId(planId); setSelectedPoint(null); }}
              onAddPlan={isAdmin || isTechnician ? () => fileInputRef.current?.click() : undefined}
              blocages={(chantierBlocages ?? []).filter((blocage) => (points ?? []).some((point) => point.id === blocage.pointId))}
              placingBlockageStart={placingBlockageStart}
              onPlaceBlockageStart={handlePlaceBlockageStart}
              placingFlexion={placingFlexion}
              onPlaceFlexion={handlePlaceFlexion}
              onFinishFlexions={() => setPlacingFlexion(false)}
              onUndoFlexion={() => setBlockageFlexions((points) => points.slice(0, -1))}
              draftTrace={selectedPoint && blockageStart ? { start: blockageStart, flexions: blockageFlexions, end: selectedPoint } : null}
              onDrawBlockage={handleDrawBlockage}
            />
          )}
          </div>
          {selectedPoint && activePlan && <PointFiche key={selectedPoint.id} planId={activePlan.id} point={selectedPoint} canCapture={isTechnician} displayMode="panel" hidden={placingBlockageStart || placingFlexion} blockageStart={blockageStart} blockageFlexions={blockageFlexions} initialBlocageOpen={openBlocageForm} onPickBlockageStart={() => { setBlockageFlexions([]); setPlacingBlockageStart(true); }} onPickFlexion={() => setPlacingFlexion(true)} onUndoFlexion={() => setBlockageFlexions((points) => points.slice(0, -1))} onClearFlexions={() => setBlockageFlexions([])} onClose={() => { setSelectedPoint(null); setBlockageStart(null); setBlockageFlexions([]); setOpenBlocageForm(false); }} />}
        </div>
      )}
    </>
  );
}
