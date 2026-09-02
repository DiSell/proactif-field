import PdfCanvasPages from "./PdfCanvasPages";

interface Props {
  arrayBuffer: ArrayBuffer;
  onClose: () => void;
  onDownload: () => void;
  /** Optional — omit to keep this preview exactly as it was (chantier reports). */
  onShare?: () => void;
}

export default function ReportPreview({ arrayBuffer, onClose, onDownload, onShare }: Props) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet report-preview-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h2 style={{ margin: 0 }}>Aperçu du rapport</h2>
          <button className="btn secondary" onClick={onClose}>
            Fermer
          </button>
        </div>

        <PdfCanvasPages arrayBuffer={arrayBuffer} />

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {onShare && (
            <button className="btn secondary block" onClick={onShare}>
              Partager
            </button>
          )}
          <button className="btn block" onClick={onDownload}>
            ⬇️ Télécharger le PDF
          </button>
        </div>
      </div>
    </div>
  );
}
