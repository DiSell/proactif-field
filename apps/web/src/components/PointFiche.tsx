import { useEffect, useRef, useState } from "react";
import { PointDTO, PointStatut } from "@proactif-field/shared";
import { useDeletePoint, usePhotos, useUpdatePoint } from "../api/hooks";
import { useFileObjectUrl } from "../api/files";
import {
  addPendingPhoto,
  getPendingPhotosForPoint,
  PendingPhoto,
  removePendingPhoto,
  updatePendingPhotoGps,
} from "../offline/db";
import { onSyncChange, trySync } from "../offline/syncManager";
import { getCurrentPositionSafe } from "../utils/geolocation";
import AutocompleteInput from "./AutocompleteInput";
import StatusBadge from "./StatusBadge";

interface Props {
  planId: string;
  point: PointDTO;
  onClose: () => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

interface LightboxState {
  url: string;
  caption: string;
}

export default function PointFiche({ planId, point, onClose }: Props) {
  const updatePoint = useUpdatePoint(planId);
  const deletePoint = useDeletePoint(planId);
  const { data: photos } = usePhotos(point.id);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [identifiant, setIdentifiant] = useState(point.identifiant);
  const [nom, setNom] = useState(point.nom ?? "");
  const [type, setType] = useState(point.type ?? "");
  const [commentaire, setCommentaire] = useState(point.commentaire ?? "");

  useEffect(() => {
    const refresh = () => getPendingPhotosForPoint(point.id).then(setPending);
    refresh();
    return onSyncChange(refresh);
  }, [point.id]);

  function saveField(patch: Partial<{ identifiant: string; nom: string; type: string; commentaire: string }>) {
    updatePoint.mutate({ id: point.id, input: patch });
  }

  function changeStatut(statut: PointStatut) {
    updatePoint.mutate({ id: point.id, input: { statut } });
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

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

      const refreshed = await getPendingPhotosForPoint(point.id);
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
    setPending(await getPendingPhotosForPoint(point.id));
  }

  async function handleDeletePoint() {
    if (!confirm(`Supprimer le point "${point.identifiant}" et ses photos ?`)) return;
    await deletePoint.mutateAsync(point.id);
    onClose();
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h2 style={{ margin: 0 }}>Fiche du point</h2>
          <button className="btn secondary" onClick={onClose}>
            Fermer
          </button>
        </div>

        <div className="field">
          <label>Identifiant</label>
          <AutocompleteInput
            field="point.identifiant"
            value={identifiant}
            onChange={setIdentifiant}
            onCommit={(v) => saveField({ identifiant: v })}
          />
        </div>
        <div className="field">
          <label>Type (regard, chambre, vanne, poteau…)</label>
          <AutocompleteInput
            field="point.type"
            value={type}
            onChange={setType}
            onCommit={(v) => saveField({ type: v })}
            placeholder="ex: regard"
          />
        </div>
        <div className="field">
          <label>Nom (optionnel)</label>
          <AutocompleteInput
            field="point.nom"
            value={nom}
            onChange={setNom}
            onCommit={(v) => saveField({ nom: v })}
          />
        </div>
        <div className="field">
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
        <div className="field">
          <label>Statut</label>
          <div style={{ display: "flex", gap: 8 }}>
            {(Object.values(PointStatut) as PointStatut[]).map((s) => (
              <button
                key={s}
                className="btn secondary"
                style={{
                  flex: 1,
                  outline: point.statut === s ? "2px solid white" : "none",
                }}
                onClick={() => changeStatut(s)}
              >
                <StatusBadge statut={s} />
              </button>
            ))}
          </div>
        </div>

        <div className="photo-section">
          <h3 className="photo-section-title">Photos du point ({(photos?.length ?? 0) + pending.length})</h3>

          {(photos?.length ?? 0) + pending.length === 0 ? (
            <p className="photo-section-empty">Aucune photo pour l'instant.</p>
          ) : (
            <div className="photo-grid">
              {photos?.map((photo) => (
                <PhotoThumb
                  key={photo.id}
                  photoId={photo.id}
                  takenAt={photo.takenAt}
                  onOpen={(url) => setLightbox({ url, caption: formatDateTime(photo.takenAt) })}
                />
              ))}
              {pending.map((p) => (
                <PendingThumb
                  key={p.id}
                  photo={p}
                  onCancel={() => cancelPending(p.id)}
                  onOpen={(url) => setLightbox({ url, caption: formatDateTime(p.takenAt) })}
                />
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={handleFileSelected}
          />
          <button
            className="btn block photo-capture-btn"
            disabled={capturing}
            onClick={() => fileInputRef.current?.click()}
          >
            {capturing ? "Enregistrement…" : "📷 Prendre une photo"}
          </button>
        </div>

        <button className="btn danger block" onClick={handleDeletePoint} style={{ marginTop: 16 }}>
          Supprimer ce point
        </button>
      </div>

      {lightbox && <PhotoLightbox state={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

function PhotoLightbox({ state, onClose }: { state: LightboxState; onClose: () => void }) {
  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose} aria-label="Fermer">
        ✕
      </button>
      <img src={state.url} alt="" onClick={(e) => e.stopPropagation()} />
      <div className="lightbox-caption">{state.caption}</div>
    </div>
  );
}

function PhotoThumb({
  photoId,
  takenAt,
  onOpen,
}: {
  photoId: string;
  takenAt: string;
  onOpen: (url: string) => void;
}) {
  const { url, error, retry } = useFileObjectUrl("photos", photoId);
  return (
    <div>
      {error ? (
        <button
          onClick={retry}
          style={{
            aspectRatio: 1,
            width: "100%",
            background: "#334155",
            borderRadius: 8,
            border: "none",
            color: "#fca5a5",
            fontSize: 11,
          }}
        >
          Échec — réessayer
        </button>
      ) : url ? (
        <img src={url} alt="" onClick={() => onOpen(url)} style={{ cursor: "pointer" }} />
      ) : (
        <div style={{ aspectRatio: 1, background: "#334155", borderRadius: 8 }} />
      )}
      <div className="photo-meta">{formatDateTime(takenAt)}</div>
    </div>
  );
}

function PendingThumb({
  photo,
  onCancel,
  onOpen,
}: {
  photo: PendingPhoto;
  onCancel: () => void;
  onOpen: (url: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const blob = new Blob([photo.arrayBuffer], { type: photo.mimeType });
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photo.arrayBuffer, photo.mimeType]);

  return (
    <div>
      <div style={{ position: "relative" }}>
        {url && <img src={url} alt="" onClick={() => onOpen(url)} style={{ cursor: "pointer" }} />}
        <div
          style={{
            position: "absolute",
            top: 4,
            left: 4,
            background: "rgba(245,158,11,0.9)",
            color: "#111",
            fontSize: 9,
            fontWeight: 700,
            padding: "1px 5px",
            borderRadius: 4,
          }}
        >
          en attente
        </div>
        <button
          onClick={onCancel}
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            background: "rgba(0,0,0,0.6)",
            color: "white",
            border: "none",
            borderRadius: "50%",
            width: 20,
            height: 20,
            fontSize: 12,
            lineHeight: "20px",
            padding: 0,
          }}
        >
          ✕
        </button>
      </div>
      <div className="photo-meta">{formatDateTime(photo.takenAt)}</div>
    </div>
  );
}
