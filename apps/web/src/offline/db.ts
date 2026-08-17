import { openDB, DBSchema } from "idb";

export interface PendingPhoto {
  id: string;
  planId: string;
  pointId: string;
  blob: Blob;
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
