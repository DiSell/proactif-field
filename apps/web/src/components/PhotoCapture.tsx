import { useEffect, useRef, useState } from "react";
import { useFileObjectUrl } from "../api/files";
import Icon from "./Icon";

// Generic photo-capture grid: camera button, thumbnails, lightbox. Extracted
// from PointFiche so the field-report "mode simple" can reuse the exact
// same capture UX (see components/FieldReportItemCard.tsx) without either
// side depending on Plan/Point/offline-snapshot machinery. PointFiche keeps
// owning its point-specific data (confirmed photos via usePhotos, pending
// photos via the IndexedDB pendingPhotos store) and just hands this
// component the merged list to render.

export interface PhotoCaptureItem {
  id: string;
  takenAt: string;
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsAccuracy?: number | null;
  /** Shows the "en attente" badge and a cancel button — Point's not-yet-synced photos. */
  pending?: boolean;
  /** Raw bytes for a pending photo that has no server id to fetch by yet. Omit to resolve via fileKind/id instead. */
  blob?: Blob;
}

interface Props {
  fileKind: "photos" | "rapport-terrain-photos";
  photos: PhotoCaptureItem[];
  title: string;
  emptyLabel?: string;
  canCapture?: boolean;
  capturing?: boolean;
  onCapture: (file: File) => void;
  /** Cancels a not-yet-synced upload — only shown for photos with `pending: true` (PointFiche). */
  onCancelPending?: (id: string) => void;
  /** Deletes any photo, synced or not — shown on every thumbnail when provided (field-report entries). */
  onDeletePhoto?: (id: string) => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function formatGps(lat?: number | null, lng?: number | null, accuracy?: number | null): string | null {
  if (lat == null || lng == null) return null;
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}${accuracy != null ? ` (± ${Math.round(accuracy)} m)` : ""}`;
}

// Stays attached to the photo it belongs to — date/heure and GPS are always
// rendered together, right under that photo's thumbnail, never pulled up to
// a report/item-level summary.
function PhotoMeta({ photo }: { photo: PhotoCaptureItem }) {
  const gps = formatGps(photo.gpsLat, photo.gpsLng, photo.gpsAccuracy);
  return (
    <div className="photo-meta">
      <div>{formatDateTime(photo.takenAt)}</div>
      <div className="photo-gps">{gps ?? "GPS indisponible"}</div>
    </div>
  );
}

interface LightboxState {
  url: string;
  caption: string;
}

export default function PhotoCapture({ fileKind, photos, title, emptyLabel = "Aucune photo pour l'instant.", canCapture = true, capturing = false, onCapture, onCancelPending, onDeletePhoto }: Props) {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onCapture(file);
  }

  return (
    <div className="photo-section point-photo-section">
      <h3 className="photo-section-title">{title} ({photos.length})</h3>

      {photos.length === 0 ? (
        <p className="photo-section-empty">{emptyLabel}</p>
      ) : (
        <div className="photo-grid">
          {photos.map((photo) => (
            <PhotoThumb
              key={photo.id}
              photo={photo}
              fileKind={fileKind}
              onOpen={(url) => setLightbox({ url, caption: formatDateTime(photo.takenAt) })}
              onCancel={onCancelPending && photo.pending ? () => onCancelPending(photo.id) : undefined}
              onDelete={onDeletePhoto ? () => onDeletePhoto(photo.id) : undefined}
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
      {canCapture && (
        <button className="btn block photo-capture-btn" disabled={capturing} onClick={() => fileInputRef.current?.click()}>
          {!capturing && <Icon name="camera" />}{capturing ? "Enregistrement…" : "Prendre une photo"}
        </button>
      )}

      {lightbox && <PhotoLightbox state={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

function PhotoLightbox({ state, onClose }: { state: LightboxState; onClose: () => void }) {
  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose} aria-label="Fermer">
        <Icon name="close" />
      </button>
      <img src={state.url} alt="" onClick={(e) => e.stopPropagation()} />
      <div className="lightbox-caption">{state.caption}</div>
    </div>
  );
}

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  return (
    <button
      onClick={onDelete}
      aria-label="Supprimer la photo"
      style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.6)", color: "white", border: "none", borderRadius: "50%", width: 20, height: 20, fontSize: 12, lineHeight: "20px", padding: 0 }}
    >
      <Icon name="close" size={14} />
    </button>
  );
}

function PhotoThumb({
  photo,
  fileKind,
  onOpen,
  onCancel,
  onDelete,
}: {
  photo: PhotoCaptureItem;
  fileKind: Props["fileKind"];
  onOpen: (url: string) => void;
  onCancel?: () => void;
  onDelete?: () => void;
}) {
  return photo.blob ? (
    <BlobThumb photo={photo} onOpen={onOpen} onCancel={onCancel} onDelete={onDelete} />
  ) : (
    <RemoteThumb photo={photo} fileKind={fileKind} onOpen={onOpen} onDelete={onDelete} />
  );
}

// Used for every photo that already has a server (or offline-echoed) id to
// fetch by — see useFileObjectUrl, which resolves from the local cache
// first and only hits the network when online and uncached.
function RemoteThumb({ photo, fileKind, onOpen, onDelete }: { photo: PhotoCaptureItem; fileKind: Props["fileKind"]; onOpen: (url: string) => void; onDelete?: () => void }) {
  const { url, error, retry } = useFileObjectUrl(fileKind, photo.id);
  return (
    <div>
      <div style={{ position: "relative" }}>
        {error ? (
          <button
            onClick={retry}
            style={{ aspectRatio: 1, width: "100%", background: "var(--paper-2)", borderRadius: 8, border: "none", color: "#fca5a5", fontSize: 11 }}
          >
            Échec — réessayer
          </button>
        ) : url ? (
          <img src={url} alt="" onClick={() => onOpen(url)} style={{ cursor: "pointer" }} />
        ) : (
          <div style={{ aspectRatio: 1, background: "var(--paper-2)" }} />
        )}
        {onDelete && <DeleteButton onDelete={onDelete} />}
      </div>
      <PhotoMeta photo={photo} />
    </div>
  );
}

function BlobThumb({ photo, onOpen, onCancel, onDelete }: { photo: PhotoCaptureItem; onOpen: (url: string) => void; onCancel?: () => void; onDelete?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!photo.blob) return;
    const objectUrl = URL.createObjectURL(photo.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photo.blob]);

  return (
    <div>
      <div style={{ position: "relative" }}>
        {url && <img src={url} alt="" onClick={() => onOpen(url)} style={{ cursor: "pointer" }} />}
        {onCancel && <DeleteButton onDelete={onCancel} />}
        {!onCancel && onDelete && <DeleteButton onDelete={onDelete} />}
        {photo.pending && (
          <div style={{ position: "absolute", top: 4, left: 4, background: "rgba(245,158,11,0.9)", color: "#111", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4 }}>
            en attente
          </div>
        )}
      </div>
      <PhotoMeta photo={photo} />
    </div>
  );
}
