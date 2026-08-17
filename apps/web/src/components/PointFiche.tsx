import { useEffect, useRef, useState } from "react";
import { PointDTO, PointStatut } from "@proactif-field/shared";
import { useDeletePoint, usePhotos, useUpdatePoint } from "../api/hooks";
import { useFileObjectUrl } from "../api/files";
import { addPendingPhoto, getPendingPhotosForPoint, PendingPhoto, removePendingPhoto } from "../offline/db";
import { onSyncChange, trySync } from "../offline/syncManager";
import { getCurrentPositionSafe } from "../utils/geolocation";
import StatusBadge from "./StatusBadge";

interface Props {
  planId: string;
  point: PointDTO;
  onClose: () => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function formatGps(lat: number | null, lng: number | null, accuracy: number | null): string {
  if (lat === null || lng === null) return "GPS indisponible";
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}${accuracy ? ` (±${Math.round(accuracy)} m)` : ""}`;
}

export default function PointFiche({ planId, point, onClose }: Props) {
  const updatePoint = useUpdatePoint(planId);
  const deletePoint = useDeletePoint(planId);
  const { data: photos } = usePhotos(point.id);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [capturing, setCapturing] = useState(false);
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
    try {
      const takenAt = new Date().toISOString();
      const gps = await getCurrentPositionSafe();

      await addPendingPhoto({
        id: crypto.randomUUID(),
        planId,
        pointId: point.id,
        blob: file,
        fileName: file.name || `photo-${Date.now()}.jpg`,
        takenAt,
        gpsLat: gps?.lat ?? null,
        gpsLng: gps?.lng ?? null,
        gpsAccuracy: gps?.accuracy ?? null,
        createdAt: new Date().toISOString(),
      });

      const refreshed = await getPendingPhotosForPoint(point.id);
      setPending(refreshed);
      void trySync();
    } finally {
      setCapturing(false);
    }
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
          <input
            value={identifiant}
            onChange={(e) => setIdentifiant(e.target.value)}
            onBlur={() => saveField({ identifiant })}
          />
        </div>
        <div className="field">
          <label>Type (regard, chambre, vanne, poteau…)</label>
          <input
            value={type}
            onChange={(e) => setType(e.target.value)}
            onBlur={() => saveField({ type })}
            placeholder="ex: regard"
          />
        </div>
        <div className="field">
          <label>Nom (optionnel)</label>
          <input value={nom} onChange={(e) => setNom(e.target.value)} onBlur={() => saveField({ nom })} />
        </div>
        <div className="field">
          <label>Commentaire</label>
          <textarea
            rows={3}
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            onBlur={() => saveField({ commentaire })}
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

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={handleFileSelected}
        />
        <button
          className="btn block"
          disabled={capturing}
          onClick={() => fileInputRef.current?.click()}
          style={{ marginTop: 8 }}
        >
          {capturing ? "Enregistrement…" : "📷 Prendre une photo"}
        </button>

        <div className="photo-grid">
          {photos?.map((photo) => (
            <PhotoThumb key={photo.id} photoId={photo.id} takenAt={photo.takenAt} gpsLat={photo.gpsLat} gpsLng={photo.gpsLng} gpsAccuracy={photo.gpsAccuracy} />
          ))}
          {pending.map((p) => (
            <PendingThumb key={p.id} photo={p} onCancel={() => cancelPending(p.id)} />
          ))}
        </div>

        <button className="btn danger block" onClick={handleDeletePoint} style={{ marginTop: 16 }}>
          Supprimer ce point
        </button>
      </div>
    </div>
  );
}

function PhotoThumb({
  photoId,
  takenAt,
  gpsLat,
  gpsLng,
  gpsAccuracy,
}: {
  photoId: string;
  takenAt: string;
  gpsLat: number | null;
  gpsLng: number | null;
  gpsAccuracy: number | null;
}) {
  const url = useFileObjectUrl("photos", photoId);
  return (
    <div>
      {url ? <img src={url} alt="" /> : <div style={{ aspectRatio: 1, background: "#334155", borderRadius: 8 }} />}
      <div className="photo-meta">{formatDateTime(takenAt)}</div>
      <div className="photo-meta">{formatGps(gpsLat, gpsLng, gpsAccuracy)}</div>
    </div>
  );
}

function PendingThumb({ photo, onCancel }: { photo: PendingPhoto; onCancel: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(photo.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photo.blob]);

  return (
    <div>
      <div style={{ position: "relative" }}>
        {url && <img src={url} alt="" />}
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
      <div className="photo-meta">{formatGps(photo.gpsLat, photo.gpsLng, photo.gpsAccuracy)}</div>
    </div>
  );
}
