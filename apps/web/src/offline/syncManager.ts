import { apiPostForm, ApiError } from "../api/client";
import { queryClient } from "../api/queryClient";
import { PhotoDTO } from "@proactif-field/shared";
import { getPendingPhotos, removePendingPhoto } from "./db";

let syncing = false;
let lastError: string | null = null;
const listeners = new Set<() => void>();

export function onSyncChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLastSyncError(): string | null {
  return lastError;
}

function notify() {
  listeners.forEach((l) => l());
}

export async function trySync(): Promise<void> {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  try {
    const pending = await getPendingPhotos();
    for (const photo of pending) {
      try {
        const blob = new Blob([photo.arrayBuffer], { type: photo.mimeType });
        const form = new FormData();
        form.append("file", blob, photo.fileName);
        form.append("takenAt", photo.takenAt);
        if (photo.gpsLat !== null) form.append("gpsLat", String(photo.gpsLat));
        if (photo.gpsLng !== null) form.append("gpsLng", String(photo.gpsLng));
        if (photo.gpsAccuracy !== null) form.append("gpsAccuracy", String(photo.gpsAccuracy));

        await apiPostForm<{ photo: PhotoDTO }>(`/api/points/${photo.pointId}/photos`, form);
        await removePendingPhoto(photo.id);
        queryClient.invalidateQueries({ queryKey: ["points", photo.pointId, "photos"] });
        queryClient.invalidateQueries({ queryKey: ["plans", photo.planId, "points"] });
        lastError = null;
      } catch (err) {
        // Laisse la photo en attente, on réessaiera au prochain cycle — mais
        // on garde le message pour pouvoir l'afficher et diagnostiquer.
        lastError = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Erreur inconnue";
        console.error("Échec de synchronisation d'une photo", err);
      }
    }
  } finally {
    syncing = false;
    notify();
  }
}

export function startSyncLoop(): () => void {
  const interval = setInterval(trySync, 20000);
  window.addEventListener("online", trySync);
  void trySync();
  return () => {
    clearInterval(interval);
    window.removeEventListener("online", trySync);
  };
}
