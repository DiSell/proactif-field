import { useCallback, useEffect, useRef, useState } from "react";
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
  onFinishFlexions?: () => void;
  onUndoFlexion?: () => void;
  draftTrace?: { start: { x: number; y: number }; flexions: BlocageTracePoint[]; end: { x: number; y: number } } | null;
  onDrawBlockage?: (start: TraceCoordinate, end: TraceCoordinate) => void;
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

function TraceArrival({ x, y }: TraceCoordinate) {
  const centerX = x * 100;
  const centerY = y * 100;
  return <>
    <circle className="arrival-ring" cx={centerX} cy={centerY} r="2.8" />
    <line x1={centerX - 2} y1={centerY - 2} x2={centerX + 2} y2={centerY + 2} />
    <line x1={centerX + 2} y1={centerY - 2} x2={centerX - 2} y2={centerY + 2} />
  </>;
}

export default function PlanViewer({ plan, points, onCreatePoint, onSelectPoint, canCreatePoint = true, plans = [plan], selectedPointId, onPlanChange = () => undefined, onAddPlan, blocages = [], placingBlockageStart = false, onPlaceBlockageStart, placingFlexion = false, onPlaceFlexion, onFinishFlexions, onUndoFlexion, draftTrace = null, onDrawBlockage }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const centerViewRef = useRef<(() => void) | null>(null);
  const [pointsVisible, setPointsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rotation, setRotation] = useState(0);
  // Non-null only while a 2-finger twist is actively in progress, so the
  // plan follows the fingers 1:1 without the snap transition fighting it.
  const [liveRotation, setLiveRotation] = useState<number | null>(null);
  const [actionMenu, setActionMenu] = useState<{ left: number; top: number; point: TraceCoordinate } | null>(null);
  const [drawingBlockage, setDrawingBlockage] = useState(false);
  const [drawStart, setDrawStart] = useState<TraceCoordinate | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<TraceCoordinate | null>(null);
  const suppressClickRef = useRef(false);
  const displayRotation = liveRotation ?? rotation;
  const recenterPlan = useCallback(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => centerViewRef.current?.()));
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(document.fullscreenElement === viewerRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Rotation is a view-only convenience (not saved), so it doesn't carry
  // over confusingly to the next plan you open.
  useEffect(() => setRotation(0), [plan.id]);

  // Google Maps-style two-finger twist: the plan follows the gesture
  // continuously and keeps the exact angle on release. The listener stays
  // passive so pinch-to-zoom and rotation can happen in the same gesture.
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
        const rawDelta = angleBetween(e.touches[0], e.touches[1]) - gesture.startAngle;
        const delta = ((rawDelta + 180) % 360 + 360) % 360 - 180;
        setLiveRotation(gesture.baseRotation + delta);
      }
    }
    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2 && gesture) {
        gesture = null;
        setLiveRotation((current) => {
          if (current != null) {
            setRotation(((current % 360) + 360) % 360);
          }
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
  }, [rotation, recenterPlan]);

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await viewerRef.current?.requestFullscreen();
  }

  function rotatePlan() {
    setLiveRotation(null);
    setRotation(0);
  }

  const planReady = useCallback(() => recenterPlan(), [recenterPlan]);

  function clientToPlan(clientX: number, clientY: number, element: HTMLDivElement): TraceCoordinate {
    const rect = element.getBoundingClientRect();
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    const radians = rotation * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const rotatedWidth = Math.abs(width * cos) + Math.abs(height * sin);
    const scale = rotatedWidth > 0 ? rect.width / rotatedWidth : 1;
    const screenDx = (clientX - (rect.left + rect.width / 2)) / scale;
    const screenDy = (clientY - (rect.top + rect.height / 2)) / scale;
    const localDx = screenDx * cos + screenDy * sin;
    const localDy = -screenDx * sin + screenDy * cos;
    return { x: (localDx + width / 2) / width, y: (localDy + height / 2) / height };
  }

  function handleContentClick(e: React.MouseEvent<HTMLDivElement>) {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    if ((e.target as HTMLElement).closest(".point-marker")) return;
    const { x, y } = clientToPlan(e.clientX, e.clientY, e.currentTarget);
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    if (placingBlockageStart) { onPlaceBlockageStart?.(x, y); return; }
    if (placingFlexion) { onPlaceFlexion?.(x, y); return; }
  }

  function openActionMenu(event: React.MouseEvent<HTMLDivElement>) {
    if (!canCreatePoint || placingBlockageStart || placingFlexion) return;
    event.preventDefault();
    suppressClickRef.current = true;
    const viewerRect = viewerRef.current?.getBoundingClientRect();
    if (!viewerRect) return;
    setActionMenu({ left: event.clientX - viewerRect.left, top: event.clientY - viewerRect.top, point: clientToPlan(event.clientX, event.clientY, event.currentTarget) });
  }

  function handleDrawPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!drawingBlockage) return;
    event.preventDefault();
    event.stopPropagation();
    const point = clientToPlan(event.clientX, event.clientY, event.currentTarget);
    setDrawStart(point); setDrawCurrent(point);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleDrawPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!drawingBlockage || !drawStart) return;
    event.preventDefault();
    setDrawCurrent(clientToPlan(event.clientX, event.clientY, event.currentTarget));
  }

  function handleDrawPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!drawingBlockage || !drawStart) return;
    event.preventDefault(); event.stopPropagation(); suppressClickRef.current = true;
    const end = clientToPlan(event.clientX, event.clientY, event.currentTarget);
    setDrawingBlockage(false); setDrawStart(null); setDrawCurrent(null);
    if (Math.hypot(end.x - drawStart.x, end.y - drawStart.y) > .01) onDrawBlockage?.(drawStart, end);
  }

  return (
    <div className="plan-viewer" ref={viewerRef}>
      <TransformWrapper initialScale={1} minScale={0.3} maxScale={6} centerOnInit doubleClick={{ mode: "toggle" }}>
        {({ centerView }) => <>
        {void (centerViewRef.current = () => centerView())}
        <PlanToolbar plan={plan} plans={plans} pointsVisible={pointsVisible} isFullscreen={isFullscreen} rotation={rotation} onPlanChange={onPlanChange} onTogglePoints={() => setPointsVisible((visible) => !visible)} onToggleFullscreen={toggleFullscreen} onRotate={rotatePlan} onAddPlan={onAddPlan} />
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
          <div className={`plan-content ${drawingBlockage ? "drawing-blockage" : ""}`} ref={contentRef} onClick={handleContentClick} onContextMenu={openActionMenu} onPointerDown={handleDrawPointerDown} onPointerMove={handleDrawPointerMove} onPointerUp={handleDrawPointerUp} style={{ transform: displayRotation ? `rotate(${displayRotation}deg)` : undefined, transformOrigin: "50% 50%", transitionDuration: liveRotation != null ? "0s" : undefined }}>
            {plan.fileType === "PDF" ? (
              <PdfPage planId={plan.id} onReady={planReady} />
            ) : (
              <PlanImage planId={plan.id} onReady={planReady} />
            )}
            <svg className="blocage-traces" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {blocages.filter((blocage) => blocageTrace(blocage).length > 1).map((blocage) => <g key={blocage.id} className={blocage.statut === BlocageStatut.OUVERT ? "open" : "resolved"}>
                <path d={smoothTracePath(blocageTrace(blocage))} fill="none" />
                <circle cx={blocage.startX! * 100} cy={blocage.startY! * 100} r="1.5" />
                {(blocage.flexionPoints ?? []).map((flexion, index) => <circle key={index} className="flexion" cx={flexion.x * 100} cy={flexion.y * 100} r="1" />)}
              </g>)}
              {draftTrace && <g className="draft"><path d={smoothTracePath([draftTrace.start, ...draftTrace.flexions, draftTrace.end])} fill="none" />{draftTrace.flexions.map((flexion, index) => <circle key={index} className="flexion" cx={flexion.x * 100} cy={flexion.y * 100} r="1" />)}</g>}
              {drawStart && drawCurrent && <g className="draft"><line x1={drawStart.x * 100} y1={drawStart.y * 100} x2={drawCurrent.x * 100} y2={drawCurrent.y * 100} /><circle cx={drawStart.x * 100} cy={drawStart.y * 100} r="1.5" /></g>}
            </svg>
            {blocages.filter((blocage) => blocage.distanceMeters != null && blocage.startX != null && blocage.startY != null && blocage.endX != null && blocage.endY != null).map((blocage) => <span key={`distance-${blocage.id}`} className="blocage-distance" style={{ left: `${((blocage.startX! + blocage.endX!) / 2) * 100}%`, top: `${((blocage.startY! + blocage.endY!) / 2) * 100}%`, transform: displayRotation ? `translate(-50%, -50%) rotate(${-displayRotation}deg)` : undefined }}>{blocage.distanceMeters!.toFixed(1)} m</span>)}
            {pointsVisible && points.map((point) => (
              <PointMarker key={point.id} point={point} selected={point.id === selectedPointId} rotation={displayRotation} onClick={() => placingBlockageStart ? onPlaceBlockageStart?.(point.x, point.y) : placingFlexion ? onPlaceFlexion?.(point.x, point.y) : onSelectPoint(point)} />
            ))}
            <svg className="blocage-arrivals" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {blocages.filter((blocage) => blocage.endX != null && blocage.endY != null).map((blocage) => <g key={blocage.id} className={blocage.statut === BlocageStatut.OUVERT ? "open" : "resolved"}><TraceArrival x={blocage.endX!} y={blocage.endY!} /></g>)}
              {draftTrace && <g className="draft"><TraceArrival x={draftTrace.end.x} y={draftTrace.end.y} /></g>}
            </svg>
          </div>
        </TransformComponent>
        </>}
      </TransformWrapper>
      {/* Rendered outside the pannable/zoomable/rotatable .plan-content so it
          stays put on screen as a real banner, instead of moving/rotating
          with the plan and ending up wherever the current transform happens
          to place it (it used to sit inside .plan-content, right on top of
          the marker). */}
      {placingBlockageStart && <div className="blocage-placement-hint">Touchez le départ A sur le plan</div>}
      {drawingBlockage && <div className="blocage-placement-hint">Gardez le doigt appuyé et glissez de A vers B</div>}
      {placingFlexion && <div className="blocage-placement-controls"><strong>Touchez le plan pour ajouter les flexions</strong><span>{draftTrace?.flexions.length ?? 0} placée{(draftTrace?.flexions.length ?? 0) > 1 ? "s" : ""}</span><button type="button" disabled={!draftTrace?.flexions.length} onClick={onUndoFlexion}>Annuler la dernière</button><button type="button" className="done" onClick={onFinishFlexions}>Terminer</button></div>}
      {actionMenu && <div className="plan-action-menu" style={{ left: actionMenu.left, top: actionMenu.top }}><button type="button" onClick={() => { onCreatePoint(actionMenu.point.x, actionMenu.point.y); setActionMenu(null); }}>Point info</button><button type="button" onClick={() => { setActionMenu(null); setDrawingBlockage(true); }}>Tracer un blocage</button><button type="button" className="cancel" onClick={() => setActionMenu(null)}>Annuler</button></div>}
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

function PlanImage({ planId, onReady }: { planId: string; onReady: () => void }) {
  const { url, error, retry } = useFileObjectUrl("plans", planId);
  if (error) return <LoadError onRetry={retry} />;
  if (!url) return <div style={{ padding: 40, color: "var(--ink-muted)" }}>Chargement du plan…</div>;
  return <img src={url} alt="Plan" draggable={false} onLoad={onReady} />;
}

function PdfPage({ planId, onReady }: { planId: string; onReady: () => void }) {
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
        if (!cancelled) { setLoading(false); onReady(); }
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
  }, [planId, attempt, onReady]);

  if (error) return <LoadError onRetry={() => setAttempt((a) => a + 1)} />;

  return (
    <>
      {loading && <div style={{ padding: 40, color: "var(--ink-muted)" }}>Chargement du plan…</div>}
      <canvas ref={canvasRef} style={{ display: loading ? "none" : "block" }} />
    </>
  );
}
