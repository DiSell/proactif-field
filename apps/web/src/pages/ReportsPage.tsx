import { useState } from "react";
import { useOrgReports } from "../api/hooks";
import { apiFetchBlob } from "../api/client";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export default function ReportsPage() {
  const { data: reports, isLoading } = useOrgReports();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function download(reportId: string, chantierName: string) {
    setDownloadingId(reportId);
    try {
      const blob = await apiFetchBlob(`/api/files/reports/${reportId}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rapport-${chantierName}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <>
      <div className="topbar">
        <h1>Rapports</h1>
      </div>

      <div className="page">
        {isLoading && <p>Chargement…</p>}
        {reports?.length === 0 && <p style={{ color: "var(--ink-muted)" }}>Aucun rapport généré pour le moment.</p>}
        {reports?.map((r) => (
          <div key={r.id} className="card user-card">
            <div>
              <h3>{r.chantierName}</h3>
              <p>
                {formatDateTime(r.generatedAt)} · par {r.generatedByName}
              </p>
            </div>
            <button
              className="btn secondary"
              onClick={() => download(r.id, r.chantierName)}
              disabled={downloadingId === r.id}
            >
              {downloadingId === r.id ? "…" : "⬇️ Télécharger"}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
