import PdfCanvasPages from "./PdfCanvasPages";

interface Props {
  arrayBuffer: ArrayBuffer;
  onClose: () => void;
  onDownload: () => void;
}

export default function ReportPreview({ arrayBuffer, onClose, onDownload }: Props) {
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

        <button className="btn block" onClick={onDownload} style={{ marginTop: 12 }}>
          ⬇️ Télécharger le PDF
        </button>
      </div>
    </div>
  );
}
