import { useState } from "react";
import { useParams } from "react-router-dom";
import { useChantier, useChantierReports, useGenerateReport } from "../../api/hooks";
import { apiFetchArrayBuffer } from "../../api/client";
import ReportPreview from "../../components/ReportPreview";
import Icon from "../../components/Icon";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export default function ChantierRapportsPage() {
  const { chantierId } = useParams<{ chantierId: string }>();
  const { data: chantier } = useChantier(chantierId);
  const { data: reports, isLoading } = useChantierReports(chantierId);
  const generateReport = useGenerateReport(chantierId);
  const [busy, setBusy] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [reportBuffer, setReportBuffer] = useState<ArrayBuffer | null>(null);

  async function openReport(reportId: string) {
    setOpeningId(reportId);
    try {
      const buffer = await apiFetchArrayBuffer(`/api/files/reports/${reportId}`);
      setReportBuffer(buffer);
    } finally {
      setOpeningId(null);
    }
  }

  async function handleGenerateReport() {
    if (!chantierId) return;
    setBusy(true);
    try {
      const report = await generateReport.mutateAsync();
      await openReport(report.id);
    } finally {
      setBusy(false);
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
    <div className="page">
      <button className="btn block" onClick={handleGenerateReport} disabled={busy}>
        {!busy && <Icon name="report" />}{busy ? "Génération…" : "Générer le rapport PDF"}
      </button>

      {isLoading && <p>Chargement…</p>}
      {reports?.length === 0 && (
        <p style={{ color: "var(--ink-muted)" }}>Aucun rapport généré pour ce chantier pour le moment.</p>
      )}
      {reports?.map((r) => (
        <div key={r.id} className="card user-card">
          <div>
            <h3>Rapport du {formatDateTime(r.generatedAt)}</h3>
            <p>Généré par {r.generatedByName}</p>
          </div>
          <button className="btn secondary" onClick={() => openReport(r.id)} disabled={openingId === r.id}>
            {openingId === r.id ? "…" : "Ouvrir"}
          </button>
        </div>
      ))}

      {reportBuffer && (
        <ReportPreview arrayBuffer={reportBuffer} onClose={() => setReportBuffer(null)} onDownload={downloadReport} />
      )}
    </div>
  );
}
