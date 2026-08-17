import { openDB, DBSchema } from "idb";

export interface PendingPhoto {
  id: string;
  planId: string;
  pointId: string;
  // Stored as a raw ArrayBuffer rather than a Blob/File: Safari has a
  // long-standing IndexedDB bug where Blobs can come back corrupted/
  // truncated on read (especially after the tab was backgrounded), which
  // was silently sending broken multipart uploads to the server
  // ("Unexpected end of form"). Plain ArrayBuffers don't hit that bug.
  arrayBuffer: ArrayBuffer;
  mimeType: string;
  fileName: string;
  takenAt: string;
  gpsLat: number | null;
  gpsLng: number | null;
  gpsAccuracy: number | null;
  createdAt: string;
}

interface OfflineDB extends DBSchema {
  pendingPhotos: {
    key: string;
    value: PendingPhoto;
  };
}

const dbPromise = openDB<OfflineDB>("proactif-field-offline", 1, {
  upgrade(db) {
    db.createObjectStore("pendingPhotos", { keyPath: "id" });
  },
});

export async function addPendingPhoto(photo: PendingPhoto): Promise<void> {
  const db = await dbPromise;
  await db.put("pendingPhotos", photo);
}

export async function getPendingPhotos(): Promise<PendingPhoto[]> {
  const db = await dbPromise;
  return db.getAll("pendingPhotos");
}

export async function getPendingPhotosForPoint(pointId: string): Promise<PendingPhoto[]> {
  const all = await getPendingPhotos();
  return all.filter((p) => p.pointId === pointId);
}

export async function removePendingPhoto(id: string): Promise<void> {
  const db = await dbPromise;
  await db.delete("pendingPhotos", id);
}

export async function updatePendingPhotoGps(
  id: string,
  gps: { lat: number; lng: number; accuracy: number }
): Promise<void> {
  const db = await dbPromise;
  const existing = await db.get("pendingPhotos", id);
  // The photo may already have synced (and been removed) by the time GPS
  // resolves in the background — that's fine, just skip.
  if (!existing) return;
  await db.put("pendingPhotos", {
    ...existing,
    gpsLat: gps.lat,
    gpsLng: gps.lng,
    gpsAccuracy: gps.accuracy,
  });
}
