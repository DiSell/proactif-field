import { useEffect, useRef, useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { BlocageDTO, BlocageStatut, PlanDTO, PointDTO } from "@proactif-field/shared";
import { apiFetchArrayBuffer } from "../api/client";
import { useFileObjectUrl } from "../api/files";
import PointMarker from "./PointMarker";
import PlanToolbar from "./PlanToolbar";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface Props {
  plan: PlanDTO;
  points: PointDTO[];
  onCreatePoint: (x: number, y: number) => void;
  onSelectPoint: (point: PointDTO) => void;
  canCreatePoint?: boolean;
  plans?: PlanDTO[];
  selectedPointId?: string | null;
  onPlanChange?: (planId: string) => void;
  onAddPlan?: () => void;
  blocages?: BlocageDTO[];
  placingBlockageStart?: boolean;
  onPlaceBlockageStart?: (x: number, y: number) => void;
}

export default function PlanViewer({ plan, points, onCreatePoint, onSelectPoint, canCreatePoint = true, plans = [plan], selectedPointId, onPlanChange = () => undefined, onAddPlan, blocages = [], placingBlockageStart = false, onPlaceBlockageStart }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const [pointsVisible, setPointsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rotation, setRotation] = useState(0);
  // Non-null only while a 2-finger twist is actively in progress, so the
  // plan follows the fingers 1:1 without the snap transition fighting it.
  const [liveRotation, setLiveRotation] = useState<number | null>(null);
  const displayRotation = liveRotation ?? rotation;

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(document.fullscreenElement === viewerRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Rotation is a view-only convenience (not saved), so it doesn't carry
  // over confusingly to the next plan you open.
  useEffect(() => setRotation(0), [plan.id]);

  // Two-finger twist to rotate on touch devices, alongside the toolbar
  // button. Listens passively (no preventDefault) so it never interferes
  // with react-zoom-pan-pinch's own pinch-to-zoom/pan handling on the same
  // touches — this only reads the angle between the two touch points, it
  // doesn't consume the gesture. Snaps to the nearest 90° on release, same
  // as the button, so counter-rotated markers/labels never end up askew.
  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;

    let gesture: { startAngle: number; baseRotation: number } | null = null;
    const angleBetween = (a: Touch, b: Touch) => Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * (180 / Math.PI);

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        gesture = { startAngle: angleBetween(e.touches[0], e.touches[1]), baseRotation: rotation };
      }
    }
    function onTouchMove(e: TouchEvent) {
      if (e.touches.length === 2 && gesture) {
        const delta = angleBetween(e.touches[0], e.touches[1]) - gesture.startAngle;
        setLiveRotation(gesture.baseRotation + delta);
      }
    }
    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2 && gesture) {
        gesture = null;
        setLiveRotation((current) => {
          if (current != null) setRotation(((Math.round(current / 90) * 90) % 360 + 360) % 360);
          return null;
        });
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [rotation]);

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await viewerRef.current?.requestFullscreen();
  }

  function handleContentClick(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest(".point-marker")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    if (placingBlockageStart) { onPlaceBlockageStart?.(x, y); return; }
    if (!canCreatePoint) return;
    onCreatePoint(x, y);
  }

  return (
    <div className="plan-viewer" ref={viewerRef}>
      <TransformWrapper initialScale={1} minScale={0.3} maxScale={6} centerOnInit doubleClick={{ mode: "toggle" }}>
        <PlanToolbar plan={plan} plans={plans} pointsVisible={pointsVisible} isFullscreen={isFullscreen} rotation={rotation} onPlanChange={onPlanChange} onTogglePoints={() => setPointsVisible((visible) => !visible)} onToggleFullscreen={toggleFullscreen} onRotate={() => setRotation((r) => (r + 90) % 360)} onAddPlan={onAddPlan} />
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
          <div className="plan-content" ref={contentRef} onClick={handleContentClick} style={{ transform: displayRotation ? `rotate(${displayRotation}deg)` : undefined, transitionDuration: liveRotation != null ? "0s" : undefined }}>
            {plan.fileType === "PDF" ? (
              <PdfPage planId={plan.id} />
            ) : (
              <PlanImage planId={plan.id} />
            )}
            <svg className="blocage-traces" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {blocages.filter((blocage) => blocage.startX != null && blocage.startY != null && blocage.endX != null && blocage.endY != null).map((blocage) => <g key={blocage.id} className={blocage.statut === BlocageStatut.OUVERT ? "open" : "resolved"}>
                <line x1={blocage.startX! * 100} y1={blocage.startY! * 100} x2={blocage.endX! * 100} y2={blocage.endY! * 100} />
                <circle cx={blocage.startX! * 100} cy={blocage.startY! * 100} r="1.5" />
                <line className="cross" x1={blocage.endX! * 100 - 1.8} y1={blocage.endY! * 100 - 1.8} x2={blocage.endX! * 100 + 1.8} y2={blocage.endY! * 100 + 1.8} />
                <line className="cross" x1={blocage.endX! * 100 + 1.8} y1={blocage.endY! * 100 - 1.8} x2={blocage.endX! * 100 - 1.8} y2={blocage.endY! * 100 + 1.8} />
              </g>)}
            </svg>
            {blocages.filter((blocage) => blocage.distanceMeters != null && blocage.startX != null && blocage.startY != null && blocage.endX != null && blocage.endY != null).map((blocage) => <span key={`distance-${blocage.id}`} className="blocage-distance" style={{ left: `${((blocage.startX! + blocage.endX!) / 2) * 100}%`, top: `${((blocage.startY! + blocage.endY!) / 2) * 100}%`, transform: displayRotation ? `translate(-50%, -50%) rotate(${-displayRotation}deg)` : undefined }}>{blocage.distanceMeters!.toFixed(1)} m</span>)}
            {pointsVisible && points.map((point) => (
              <PointMarker key={point.id} point={point} selected={point.id === selectedPointId} rotation={displayRotation} onClick={() => placingBlockageStart ? onPlaceBlockageStart?.(point.x, point.y) : onSelectPoint(point)} />
            ))}
          </div>
        </TransformComponent>
      </TransformWrapper>
      {/* Rendered outside the pannable/zoomable/rotatable .plan-content so it
          stays put on screen as a real banner, instead of moving/rotating
          with the plan and ending up wherever the current transform happens
          to place it (it used to sit inside .plan-content, right on top of
          the marker). */}
      {placingBlockageStart && <div className="blocage-placement-hint">Touchez le départ A sur le plan</div>}
    </div>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={{ padding: 40, color: "var(--ink-muted)", textAlign: "center" }}>
      <p>Le plan n'a pas pu être chargé.</p>
      <button className="btn secondary" onClick={onRetry}>
        Réessayer
      </button>
    </div>
  );
}

function PlanImage({ planId }: { planId: string }) {
  const { url, error, retry } = useFileObjectUrl("plans", planId);
  if (error) return <LoadError onRetry={retry} />;
  if (!url) return <div style={{ padding: 40, color: "var(--ink-muted)" }}>Chargement du plan…</div>;
  return <img src={url} alt="Plan" draggable={false} />;
}

function PdfPage({ planId }: { planId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    apiFetchArrayBuffer(`/api/files/plans/${planId}`)
      .then(async (buffer) => {
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
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          setError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [planId, attempt]);

  if (error) return <LoadError onRetry={() => setAttempt((a) => a + 1)} />;

  return (
    <>
      {loading && <div style={{ padding: 40, color: "var(--ink-muted)" }}>Chargement du plan…</div>}
      <canvas ref={canvasRef} style={{ display: loading ? "none" : "block" }} />
    </>
  );
}
