import { openDB } from "idb";
import { ChantierSyncDTO } from "@proactif-field/shared";

const DB_NAME = "proactif-field-offline";
const DB_VERSION = 2;

export interface PendingPhoto {
  id: string;
  planId: string;
  pointId: string;
  arrayBuffer: ArrayBuffer;
  mimeType: string;
  fileName: string;
  takenAt: string;
  gpsLat: number | null;
  gpsLng: number | null;
  gpsAccuracy: number | null;
  createdAt: string;
}

export type OfflineOperationType =
  | "POINT_CREATE"
  | "POINT_UPDATE"
  | "PHOTO_CREATE"
  | "BLOCAGE_CREATE"
  | "BLOCAGE_UPDATE"
  | "PHOTO_BLOCAGE_CREATE";

export interface OfflineOperation {
  id: string;
  userId: string;
  chantierId: string;
  type: OfflineOperationType;
  resourceId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  state: "PENDING" | "SYNCING" | "ERROR";
  lastError?: string;
}

export interface OfflineSnapshotRecord {
  id: string;
  userId: string;
  chantierId: string;
  snapshot: ChantierSyncDTO;
  updatedAt: string;
}

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains("pendingPhotos")) {
      const store = db.createObjectStore("pendingPhotos", { keyPath: "id" });
      store.createIndex("by-point", "pointId");
    }
    if (!db.objectStoreNames.contains("snapshots")) {
      const store = db.createObjectStore("snapshots", { keyPath: "id" });
      store.createIndex("by-user", "userId");
      store.createIndex("by-chantier", "chantierId");
    }
    if (!db.objectStoreNames.contains("operations")) {
      const store = db.createObjectStore("operations", { keyPath: "id" });
      store.createIndex("by-user", "userId");
      store.createIndex("by-created", "createdAt");
    }
  },
});

export async function addPendingPhoto(photo: PendingPhoto) { return (await dbPromise).put("pendingPhotos", photo); }
export async function getPendingPhotos(): Promise<PendingPhoto[]> { return (await dbPromise).getAll("pendingPhotos"); }
export async function getPendingPhotosForPoint(pointId: string): Promise<PendingPhoto[]> { return (await dbPromise).getAllFromIndex("pendingPhotos", "by-point", pointId); }
export async function removePendingPhoto(id: string) { return (await dbPromise).delete("pendingPhotos", id); }
export async function updatePendingPhotoGps(id: string, gps: { lat: number; lng: number; accuracy: number }) {
  const db = await dbPromise;
  const photo = await db.get("pendingPhotos", id) as PendingPhoto | undefined;
  if (photo) await db.put("pendingPhotos", { ...photo, gpsLat: gps.lat, gpsLng: gps.lng, gpsAccuracy: gps.accuracy });
}

const snapshotKey = (userId: string, chantierId: string) => `${userId}:${chantierId}`;

export async function putSnapshot(userId: string, snapshot: ChantierSyncDTO): Promise<void> {
  await (await dbPromise).put("snapshots", { id: snapshotKey(userId, snapshot.chantier.id), userId, chantierId: snapshot.chantier.id, snapshot, updatedAt: new Date().toISOString() });
}

export async function getSnapshot(userId: string, chantierId: string): Promise<ChantierSyncDTO | undefined> {
  const record = await (await dbPromise).get("snapshots", snapshotKey(userId, chantierId)) as OfflineSnapshotRecord | undefined;
  return record?.snapshot;
}

export async function getSnapshots(userId: string): Promise<ChantierSyncDTO[]> {
  const records = await (await dbPromise).getAllFromIndex("snapshots", "by-user", userId) as OfflineSnapshotRecord[];
  return records.map((record) => record.snapshot);
}

export async function mutateSnapshot(userId: string, chantierId: string, mutate: (snapshot: ChantierSyncDTO) => ChantierSyncDTO): Promise<ChantierSyncDTO> {
  const current = await getSnapshot(userId, chantierId);
  if (!current) throw new Error("Ce chantier n'a pas encore été synchronisé sur cet appareil.");
  const next = mutate(current);
  await putSnapshot(userId, next);
  return next;
}

export async function purgeUnassignedSnapshots(userId: string, assignedIds: string[]): Promise<string[]> {
  const db = await dbPromise;
  const records = await db.getAllFromIndex("snapshots", "by-user", userId) as OfflineSnapshotRecord[];
  const removed: string[] = [];
  for (const record of records) {
    if (!assignedIds.includes(record.chantierId)) {
      await db.delete("snapshots", record.id);
      removed.push(record.chantierId);
    }
  }
  return removed;
}

export async function enqueueOperation(operation: Omit<OfflineOperation, "attempts" | "state">): Promise<void> {
  await (await dbPromise).put("operations", { ...operation, attempts: 0, state: "PENDING" });
}

export async function getOperations(userId?: string): Promise<OfflineOperation[]> {
  const db = await dbPromise;
  const operations = (userId ? await db.getAllFromIndex("operations", "by-user", userId) : await db.getAll("operations")) as OfflineOperation[];
  return operations.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function putOperation(operation: OfflineOperation): Promise<void> { await (await dbPromise).put("operations", operation); }
export async function removeOperation(id: string): Promise<void> { await (await dbPromise).delete("operations", id); }

export async function clearOfflineData(userId?: string): Promise<void> {
  const db = await dbPromise;
  if (!userId) {
    await Promise.all([db.clear("snapshots"), db.clear("operations"), db.clear("pendingPhotos")]);
    return;
  }
  const tx = db.transaction(["snapshots", "operations"], "readwrite");
  const snapshots = await tx.objectStore("snapshots").index("by-user").getAllKeys(userId);
  const operations = await tx.objectStore("operations").index("by-user").getAllKeys(userId);
  await Promise.all([...snapshots.map((key) => tx.objectStore("snapshots").delete(key)), ...operations.map((key) => tx.objectStore("operations").delete(key))]);
  await tx.done;
  // Le store historique n'avait pas de propriétaire : on le purge pour ne
  // jamais exposer les photos d'une session au prochain utilisateur.
  await db.clear("pendingPhotos");
}
