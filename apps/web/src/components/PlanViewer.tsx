import { useEffect, useRef, useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PlanDTO, PointDTO } from "@proactif-field/shared";
import { apiFetchArrayBuffer } from "../api/client";
import { useFileObjectUrl } from "../api/files";
import PointMarker from "./PointMarker";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface Props {
  plan: PlanDTO;
  points: PointDTO[];
  onCreatePoint: (x: number, y: number) => void;
  onSelectPoint: (point: PointDTO) => void;
}

export default function PlanViewer({ plan, points, onCreatePoint, onSelectPoint }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);

  function handleContentClick(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest(".point-marker")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    onCreatePoint(x, y);
  }

  return (
    <div className="plan-viewer">
      <TransformWrapper initialScale={1} minScale={0.3} maxScale={6} centerOnInit doubleClick={{ mode: "toggle" }}>
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
          <div className="plan-content" ref={contentRef} onClick={handleContentClick}>
            {plan.fileType === "PDF" ? (
              <PdfPage planId={plan.id} />
            ) : (
              <PlanImage planId={plan.id} />
            )}
            {points.map((point) => (
              <PointMarker key={point.id} point={point} onClick={() => onSelectPoint(point)} />
            ))}
          </div>
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}

function PlanImage({ planId }: { planId: string }) {
  const url = useFileObjectUrl("plans", planId);
  if (!url) return <div style={{ padding: 40, color: "#94a3b8" }}>Chargement du plan…</div>;
  return <img src={url} alt="Plan" draggable={false} />;
}

function PdfPage({ planId }: { planId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetchArrayBuffer(`/api/files/plans/${planId}`).then(async (buffer) => {
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport }).promise;
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [planId]);

  return (
    <>
      {loading && <div style={{ padding: 40, color: "#94a3b8" }}>Chargement du plan…</div>}
      <canvas ref={canvasRef} style={{ display: loading ? "none" : "block" }} />
    </>
  );
}
