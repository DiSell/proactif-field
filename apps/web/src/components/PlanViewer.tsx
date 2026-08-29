import { useEffect, useRef, useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { BlocageDTO, BlocageStatut, BlocageTracePoint, PlanDTO, PointDTO } from "@proactif-field/shared";
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
  placingFlexion?: boolean;
  onPlaceFlexion?: (x: number, y: number) => void;
  draftTrace?: { start: { x: number; y: number }; flexions: BlocageTracePoint[]; end: { x: number; y: number } } | null;
}

type TraceCoordinate = { x: number; y: number };

function smoothTracePath(points: TraceCoordinate[]): string {
  if (points.length < 2) return "";
  const scaled = points.map((point) => ({ x: point.x * 100, y: point.y * 100 }));
  let path = `M ${scaled[0].x} ${scaled[0].y}`;
  for (let index = 0; index < scaled.length - 1; index += 1) {
    const previous = scaled[Math.max(0, index - 1)];
    const current = scaled[index];
    const next = scaled[index + 1];
    const after = scaled[Math.min(scaled.length - 1, index + 2)];
    const control1 = { x: current.x + (next.x - previous.x) / 6, y: current.y + (next.y - previous.y) / 6 };
    const control2 = { x: next.x - (after.x - current.x) / 6, y: next.y - (after.y - current.y) / 6 };
    path += ` C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${next.x} ${next.y}`;
  }
  return path;
}

function blocageTrace(blocage: BlocageDTO): TraceCoordinate[] {
  if (blocage.startX == null || blocage.startY == null || blocage.endX == null || blocage.endY == null) return [];
  return [{ x: blocage.startX, y: blocage.startY }, ...(blocage.flexionPoints ?? []), { x: blocage.endX, y: blocage.endY }];
}

export default function PlanViewer({ plan, points, onCreatePoint, onSelectPoint, canCreatePoint = true, plans = [plan], selectedPointId, onPlanChange = () => undefined, onAddPlan, blocages = [], placingBlockageStart = false, onPlaceBlockageStart, placingFlexion = false, onPlaceFlexion, draftTrace = null }: Props) {
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
    if (placingFlexion) { onPlaceFlexion?.(x, y); return; }
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
              {blocages.filter((blocage) => blocageTrace(blocage).length > 1).map((blocage) => <g key={blocage.id} className={blocage.statut === BlocageStatut.OUVERT ? "open" : "resolved"}>
                <path d={smoothTracePath(blocageTrace(blocage))} fill="none" />
                <circle cx={blocage.startX! * 100} cy={blocage.startY! * 100} r="1.5" />
                {(blocage.flexionPoints ?? []).map((flexion, index) => <circle key={index} className="flexion" cx={flexion.x * 100} cy={flexion.y * 100} r="1" />)}
                <line className="cross" x1={blocage.endX! * 100 - 1.8} y1={blocage.endY! * 100 - 1.8} x2={blocage.endX! * 100 + 1.8} y2={blocage.endY! * 100 + 1.8} />
                <line className="cross" x1={blocage.endX! * 100 + 1.8} y1={blocage.endY! * 100 - 1.8} x2={blocage.endX! * 100 - 1.8} y2={blocage.endY! * 100 + 1.8} />
              </g>)}
              {draftTrace && <g className="draft"><path d={smoothTracePath([draftTrace.start, ...draftTrace.flexions, draftTrace.end])} fill="none" />{draftTrace.flexions.map((flexion, index) => <circle key={index} className="flexion" cx={flexion.x * 100} cy={flexion.y * 100} r="1" />)}</g>}
            </svg>
            {blocages.filter((blocage) => blocage.distanceMeters != null && blocage.startX != null && blocage.startY != null && blocage.endX != null && blocage.endY != null).map((blocage) => <span key={`distance-${blocage.id}`} className="blocage-distance" style={{ left: `${((blocage.startX! + blocage.endX!) / 2) * 100}%`, top: `${((blocage.startY! + blocage.endY!) / 2) * 100}%`, transform: displayRotation ? `translate(-50%, -50%) rotate(${-displayRotation}deg)` : undefined }}>{blocage.distanceMeters!.toFixed(1)} m</span>)}
            {pointsVisible && points.map((point) => (
              <PointMarker key={point.id} point={point} selected={point.id === selectedPointId} rotation={displayRotation} onClick={() => placingBlockageStart ? onPlaceBlockageStart?.(point.x, point.y) : placingFlexion ? onPlaceFlexion?.(point.x, point.y) : onSelectPoint(point)} />
            ))}
          </div>
        </TransformComponent>
      </TransformWrapper>
      {/* Rendered outside the pannable/zoomable/rotatable .plan-content so it
          stays put on screen as a real banner, instead of moving/rotating
          with the plan and ending up wherever the current transform happens
          to place it (it used to sit inside .plan-content, right on top of
          the marker). */}
      {(placingBlockageStart || placingFlexion) && <div className="blocage-placement-hint">{placingFlexion ? "Touchez le plan pour placer la flexion" : "Touchez le départ A sur le plan"}</div>}
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
