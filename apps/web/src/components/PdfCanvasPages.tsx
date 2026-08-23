import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// iOS/mobile Safari doesn't reliably render PDFs inside an <iframe> (often
// just blank), so we render each page onto a canvas ourselves with pdf.js —
// works consistently everywhere. Shared by the report and document previews.
export default function PdfCanvasPages({ arrayBuffer }: { arrayBuffer: ArrayBuffer }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    (async () => {
      try {
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
        const container = containerRef.current;
        if (!container || cancelled) return;
        container.innerHTML = "";

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.4 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "report-preview-page";
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (cancelled) return;
          container.appendChild(canvas);
        }
        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          setLoading(false);
          setError(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [arrayBuffer]);

  return (
    <div className="report-preview-frame">
      {loading && <p style={{ color: "var(--ink-muted)", padding: 16 }}>Chargement de l'aperçu…</p>}
      {error && <p style={{ color: "#fca5a5", padding: 16 }}>Impossible d'afficher l'aperçu.</p>}
      <div ref={containerRef} className="report-preview-pages" />
    </div>
  );
}
