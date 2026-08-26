import { useEffect, useState } from "react";
import { apiFetchArrayBuffer, apiFetchBlob } from "../api/client";
import PdfCanvasPages from "./PdfCanvasPages";

interface Props {
  documentId: string;
  fileName: string;
  onClose: () => void;
  onDownload: () => void;
}

type Kind = "pdf" | "image" | "text" | "other";

function getKind(fileName: string): Kind {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) return "image";
  if (ext === "txt") return "text";
  return "other";
}

export default function DocumentPreview({ documentId, fileName, onClose, onDownload }: Props) {
  const kind = getKind(fileName);
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [fetching, setFetching] = useState(kind !== "other");
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    if (kind === "pdf") {
      apiFetchArrayBuffer(`/api/files/documents/${documentId}`)
        .then((buf) => {
          if (!cancelled) {
            setPdfBuffer(buf);
            setFetching(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setFetchError(true);
            setFetching(false);
          }
        });
    } else if (kind === "image") {
      apiFetchBlob(`/api/files/documents/${documentId}`)
        .then((blob) => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setImageUrl(objectUrl);
          setFetching(false);
        })
        .catch(() => {
          if (!cancelled) {
            setFetchError(true);
            setFetching(false);
          }
        });
    } else if (kind === "text") {
      apiFetchBlob(`/api/files/documents/${documentId}`)
        .then((blob) => blob.text())
        .then((text) => {
          if (!cancelled) {
            setTextContent(text);
            setFetching(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setFetchError(true);
            setFetching(false);
          }
        });
    }

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId, kind]);

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet report-preview-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h2 style={{ margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {fileName}
          </h2>
          <button className="btn secondary" onClick={onClose}>
            Fermer
          </button>
        </div>

        {kind === "pdf" && pdfBuffer && <PdfCanvasPages arrayBuffer={pdfBuffer} />}

        {kind !== "pdf" && (
          <div className="report-preview-frame">
            {fetching && <p style={{ color: "var(--ink-muted)", padding: 16 }}>Chargement de l'aperçu…</p>}
            {fetchError && <p style={{ color: "#fca5a5", padding: 16 }}>Impossible d'afficher l'aperçu.</p>}
            {!fetching && !fetchError && kind === "image" && imageUrl && (
              <img src={imageUrl} alt="" style={{ maxWidth: "100%", display: "block", margin: "0 auto" }} />
            )}
            {!fetching && !fetchError && kind === "text" && textContent !== null && (
              <pre className="document-text-preview">{textContent}</pre>
            )}
            {!fetching && !fetchError && kind === "other" && (
              <p style={{ color: "var(--ink-muted)", padding: 16, textAlign: "center" }}>
                Aperçu non disponible pour ce type de fichier. Télécharge-le pour l'ouvrir.
              </p>
            )}
          </div>
        )}

        <button className="btn block" onClick={onDownload} style={{ marginTop: 12 }}>
          ⬇️ Télécharger
        </button>
      </div>
    </div>
  );
}
