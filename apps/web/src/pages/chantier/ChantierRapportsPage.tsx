import { useState } from "react";
import { useParams } from "react-router-dom";
import { useChantier, useGenerateReport } from "../../api/hooks";
import { apiFetchArrayBuffer } from "../../api/client";
import ReportPreview from "../../components/ReportPreview";

export default function ChantierRapportsPage() {
  const { chantierId } = useParams<{ chantierId: string }>();
  const { data: chantier } = useChantier(chantierId);
  const generateReport = useGenerateReport(chantierId);
  const [busy, setBusy] = useState(false);
  const [reportBuffer, setReportBuffer] = useState<ArrayBuffer | null>(null);

  async function handleGenerateReport() {
    if (!chantierId) return;
    setBusy(true);
    try {
      const report = await generateReport.mutateAsync();
      const buffer = await apiFetchArrayBuffer(`/api/files/reports/${report.id}`);
      setReportBuffer(buffer);
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
        {busy ? "Génération…" : "📄 Générer le rapport PDF"}
      </button>

      {reportBuffer && (
        <ReportPreview arrayBuffer={reportBuffer} onClose={() => setReportBuffer(null)} onDownload={downloadReport} />
      )}
    </div>
  );
}
