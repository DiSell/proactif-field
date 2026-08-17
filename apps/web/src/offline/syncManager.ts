import { apiPostForm } from "../api/client";
import { queryClient } from "../api/queryClient";
import { PhotoDTO } from "@proactif-field/shared";
import { getPendingPhotos, removePendingPhoto } from "./db";

let syncing = false;
const listeners = new Set<() => void>();

export function onSyncChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
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
        const form = new FormData();
        form.append("file", photo.blob, photo.fileName);
        form.append("takenAt", photo.takenAt);
        if (photo.gpsLat !== null) form.append("gpsLat", String(photo.gpsLat));
        if (photo.gpsLng !== null) form.append("gpsLng", String(photo.gpsLng));
        if (photo.gpsAccuracy !== null) form.append("gpsAccuracy", String(photo.gpsAccuracy));

        await apiPostForm<{ photo: PhotoDTO }>(`/api/points/${photo.pointId}/photos`, form);
        await removePendingPhoto(photo.id);
        queryClient.invalidateQueries({ queryKey: ["points", photo.pointId, "photos"] });
        queryClient.invalidateQueries({ queryKey: ["plans", photo.planId, "points"] });
      } catch {
        // Laisse la photo en attente, on réessaiera au prochain cycle.
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
