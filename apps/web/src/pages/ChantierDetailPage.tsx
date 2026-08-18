import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PointDTO, UserRole } from "@proactif-field/shared";
import {
  useAssignChantier,
  useChantier,
  useCreatePoint,
  useGenerateReport,
  usePlans,
  usePoints,
  useUnassignChantier,
  useUploadPlan,
  useUsers,
} from "../api/hooks";
import { apiFetchArrayBuffer } from "../api/client";
import { useAuthStore } from "../auth/store";
import PlanViewer from "../components/PlanViewer";
import PointFiche from "../components/PointFiche";
import ReportPreview from "../components/ReportPreview";

export default function ChantierDetailPage() {
  const { chantierId } = useParams<{ chantierId: string }>();
  const { data: chantier } = useChantier(chantierId);
  const { data: plans } = usePlans(chantierId);
  const uploadPlan = useUploadPlan(chantierId);
  const generateReport = useGenerateReport(chantierId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === UserRole.ADMIN;

  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<PointDTO | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportBuffer, setReportBuffer] = useState<ArrayBuffer | null>(null);
  const [showAssign, setShowAssign] = useState(false);

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

  async function handleGenerateReport() {
    if (!chantierId) return;
    setReportBusy(true);
    try {
      const report = await generateReport.mutateAsync();
      const buffer = await apiFetchArrayBuffer(`/api/files/reports/${report.id}`);
      setReportBuffer(buffer);
    } finally {
      setReportBusy(false);
    }
  }

  function downloadReport() {
    if (!reportBuffer) return;
    const blob = new Blob([reportBuffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-${chantier?.name ?? "chantier"}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="topbar">
        <Link to="/" className="btn secondary">
          ← Chantiers
        </Link>
        <h1 style={{ flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis" }}>
          {chantier?.name}
        </h1>
        {isAdmin && (
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn secondary" onClick={() => setShowAssign(true)}>
              👥
            </button>
            <button className="btn secondary" onClick={handleGenerateReport} disabled={reportBusy}>
              {reportBusy ? "…" : "📄 Rapport"}
            </button>
          </div>
        )}
      </div>

      {plans && plans.length > 1 && (
        <div style={{ display: "flex", gap: 6, padding: "8px 12px", overflowX: "auto", background: "#1e293b" }}>
          {plans.map((p) => (
            <button
              key={p.id}
              className="btn secondary"
              style={{ outline: p.id === activePlanId ? "2px solid white" : "none", flexShrink: 0 }}
              onClick={() => setActivePlanId(p.id)}
            >
              {p.fileName}
            </button>
          ))}
          {isAdmin && (
            <button className="btn secondary" style={{ flexShrink: 0 }} onClick={() => fileInputRef.current?.click()}>
              + Plan
            </button>
          )}
        </div>
      )}

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
              <p style={{ color: "#94a3b8" }}>En attente d'un plan importé par un administrateur.</p>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, position: "relative" }}>
          {activePlan && (
            <PlanViewer
              plan={activePlan}
              points={points ?? []}
              onCreatePoint={handleCreatePoint}
              onSelectPoint={setSelectedPoint}
            />
          )}
        </div>
      )}

      {selectedPoint && activePlan && (
        <PointFiche planId={activePlan.id} point={selectedPoint} onClose={() => setSelectedPoint(null)} />
      )}

      {reportBuffer && (
        <ReportPreview arrayBuffer={reportBuffer} onClose={() => setReportBuffer(null)} onDownload={downloadReport} />
      )}

      {showAssign && chantierId && chantier && (
        <AssignTechniciansSheet
          chantierId={chantierId}
          assignedUserIds={chantier.assignedUserIds}
          onClose={() => setShowAssign(false)}
        />
      )}
    </>
  );
}

function AssignTechniciansSheet({
  chantierId,
  assignedUserIds,
  onClose,
}: {
  chantierId: string;
  assignedUserIds: string[];
  onClose: () => void;
}) {
  const { data: users } = useUsers();
  const assign = useAssignChantier(chantierId);
  const unassign = useUnassignChantier(chantierId);
  const technicians = users?.filter((u) => u.role === UserRole.TECHNICIEN) ?? [];

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h2 style={{ margin: 0 }}>Techniciens assignés</h2>
          <button className="btn secondary" onClick={onClose}>
            Fermer
          </button>
        </div>

        {technicians.length === 0 && (
          <p style={{ color: "#94a3b8" }}>
            Aucun technicien dans l'entreprise. Ajoutes-en depuis la page "Utilisateurs".
          </p>
        )}

        {technicians.map((tech) => {
          const isAssigned = assignedUserIds.includes(tech.id);
          return (
            <label key={tech.id} className="assign-row">
              <input
                type="checkbox"
                checked={isAssigned}
                onChange={() =>
                  isAssigned ? unassign.mutate(tech.id) : assign.mutate(tech.id)
                }
              />
              <span>{tech.name}</span>
              <span style={{ color: "#94a3b8", fontSize: 13 }}>{tech.email}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
