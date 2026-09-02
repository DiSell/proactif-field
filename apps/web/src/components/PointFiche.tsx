import { useEffect, useState } from "react";
import { BlocageTracePoint, PointDTO, PointStatut } from "@proactif-field/shared";
import { useDeletePoint, usePhotos, useUpdatePoint } from "../api/hooks";
import {
  addPendingPhoto,
  getPendingPhotosForPoint,
  PendingPhoto,
  removePendingPhoto,
  updatePendingPhotoGps,
} from "../offline/db";
import { onSyncChange, trySync } from "../offline/syncManager";
import { getCurrentPositionSafe } from "../utils/geolocation";
import { useAuthStore } from "../auth/store";
import AutocompleteInput from "./AutocompleteInput";
import Icon from "./Icon";
import PointBlocages from "./PointBlocages";
import PhotoCapture, { PhotoCaptureItem } from "./PhotoCapture";

interface Props {
  planId: string;
  point: PointDTO;
  onClose: () => void;
  canCapture?: boolean;
  displayMode?: "sheet" | "panel";
  hidden?: boolean;
  blockageStart?: { x: number; y: number; gps: { lat: number; lng: number; accuracy: number } | null } | null;
  onPickBlockageStart?: () => void;
  blockageFlexions?: BlocageTracePoint[];
  onPickFlexion?: () => void;
  onUndoFlexion?: () => void;
  onClearFlexions?: () => void;
  initialBlocageOpen?: boolean;
}

export default function PointFiche({ planId, point, onClose, canCapture = true, displayMode = "sheet", hidden = false, blockageStart, blockageFlexions = [], onPickBlockageStart, onPickFlexion, onUndoFlexion, onClearFlexions, initialBlocageOpen = false }: Props) {
  const updatePoint = useUpdatePoint(planId);
  const deletePoint = useDeletePoint(planId);
  const { data: photos } = usePhotos(point.id);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [capturing, setCapturing] = useState(false);
  const userId = useAuthStore((state) => state.user?.id);

  const [identifiant, setIdentifiant] = useState(point.identifiant);
  const [nom, setNom] = useState(point.nom ?? "");
  const [type, setType] = useState(point.type ?? "");
  const [commentaire, setCommentaire] = useState(point.commentaire ?? "");

  useEffect(() => {
    if (!userId) return;
    const refresh = () => getPendingPhotosForPoint(userId, point.id).then(setPending);
    refresh();
    return onSyncChange(refresh);
  }, [point.id, userId]);

  function saveField(patch: Partial<{ identifiant: string; nom: string; type: string; commentaire: string }>) {
    updatePoint.mutate({ id: point.id, input: patch });
  }

  function changeStatut(statut: PointStatut) {
    updatePoint.mutate({ id: point.id, input: { statut } });
  }

  async function handleCapture(file: File) {
    if (!userId) return;

    setCapturing(true);
    const pendingId = crypto.randomUUID();
    try {
      const takenAt = new Date().toISOString();
      const arrayBuffer = await file.arrayBuffer();

      // Save immediately without waiting on GPS, so the button frees up right
      // away and the next photo can be taken without delay — GPS is attached
      // in the background afterwards if/when it resolves.
      await addPendingPhoto({
        id: pendingId,
        userId,
        planId,
        pointId: point.id,
        arrayBuffer,
        mimeType: file.type || "image/jpeg",
        fileName: file.name || `photo-${Date.now()}.jpg`,
        takenAt,
        gpsLat: null,
        gpsLng: null,
        gpsAccuracy: null,
        createdAt: new Date().toISOString(),
      });

      const refreshed = await getPendingPhotosForPoint(userId, point.id);
      setPending(refreshed);
      void trySync();
    } finally {
      setCapturing(false);
    }

    getCurrentPositionSafe().then((gps) => {
      if (gps) void updatePendingPhotoGps(pendingId, gps);
    });
  }

  async function cancelPending(id: string) {
    await removePendingPhoto(id);
    if (userId) setPending(await getPendingPhotosForPoint(userId, point.id));
  }

  async function handleDeletePoint() {
    if (!confirm(`Supprimer le point "${point.identifiant}" et ses photos ?`)) return;
    await deletePoint.mutateAsync(point.id);
    onClose();
  }

  return (
    <div className={`sheet-overlay ${displayMode === "panel" ? "point-panel-overlay" : ""} ${hidden ? "point-panel-hidden" : ""}`} onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <div><div className="section-title" style={{ margin: 0 }}>Point {point.identifiant}</div><h2 style={{ margin: 0 }}>{nom || type || "Fiche du point"}</h2></div>
          <button className="btn secondary" onClick={onClose}>
            <Icon name="close" /> Fermer
          </button>
        </div>

        <div className="field point-field-identifier">
          <label>Identifiant</label>
          <AutocompleteInput
            field="point.identifiant"
            value={identifiant}
            onChange={setIdentifiant}
            onCommit={(v) => saveField({ identifiant: v })}
          />
        </div>
        <div className="field point-field-type">
          <label>Type (regard, chambre, vanne, poteau…)</label>
          <AutocompleteInput
            field="point.type"
            value={type}
            onChange={setType}
            onCommit={(v) => saveField({ type: v })}
            placeholder="ex: regard"
          />
        </div>
        <div className="field point-field-name">
          <label>Nom (optionnel)</label>
          <AutocompleteInput
            field="point.nom"
            value={nom}
            onChange={setNom}
            onCommit={(v) => saveField({ nom: v })}
          />
        </div>
        <div className="field point-field-comment">
          <label>Commentaire</label>
          <AutocompleteInput
            field="point.commentaire"
            value={commentaire}
            onChange={setCommentaire}
            onCommit={(v) => saveField({ commentaire: v })}
            multiline
            rows={3}
          />
        </div>
        <div className="field point-field-status">
          <label>Statut</label>
          <div className="status-selector">
            {(Object.values(PointStatut) as PointStatut[]).map((s) => (
              <button
                key={s}
                className={`btn secondary ${s} ${point.statut === s ? "active" : ""}`}
                onClick={() => changeStatut(s)}
              >
                <span><span className={`status-dot ${s}`} /> {s === PointStatut.GRIS ? "À faire" : s === PointStatut.ORANGE ? "En cours" : "Terminé"}</span>
              </button>
            ))}
          </div>
        </div>

        <PointBlocages planId={planId} point={point} blockageStart={blockageStart} blockageFlexions={blockageFlexions} onPickBlockageStart={onPickBlockageStart} onPickFlexion={onPickFlexion} onUndoFlexion={onUndoFlexion} onClearFlexions={onClearFlexions} initialFormOpen={initialBlocageOpen} />

        <PhotoCapture
          fileKind="photos"
          title="Photos du point"
          canCapture={canCapture}
          capturing={capturing}
          onCapture={handleCapture}
          onCancelPending={cancelPending}
          photos={[
            ...(photos ?? []).map((photo): PhotoCaptureItem => ({ id: photo.id, takenAt: photo.takenAt })),
            ...pending.map((p): PhotoCaptureItem => ({ id: p.id, takenAt: p.takenAt, pending: true, blob: new Blob([p.arrayBuffer], { type: p.mimeType }) })),
          ]}
        />

        <button className="btn danger block point-delete-button" onClick={handleDeletePoint} style={{ marginTop: 16 }}>
          Supprimer ce point
        </button>
      </div>
    </div>
  );
}
