import { openDB } from "idb";
import { ChantierSyncDTO, RapportTerrainDTO } from "@proactif-field/shared";

const DB_NAME = "proactif-field-offline";
const DB_VERSION = 4;

export interface PendingPhoto {
  id: string;
  userId: string;
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
  | "PHOTO_BLOCAGE_CREATE"
  | "MATERIEL_UPDATE"
  | "FIELD_REPORT_CREATE"
  | "FIELD_REPORT_UPDATE"
  | "FIELD_REPORT_DELETE"
  | "FIELD_REPORT_ITEM_CREATE"
  | "FIELD_REPORT_ITEM_UPDATE"
  | "FIELD_REPORT_PHOTO_CREATE";

// Operation types whose sync side-effect is "go refresh this chantier's
// snapshot" (see syncManager.ts). Field reports have no chantier snapshot,
// so their operations are deliberately excluded from that refresh set.
export const CHANTIER_OPERATION_TYPES: readonly OfflineOperationType[] = [
  "POINT_CREATE",
  "POINT_UPDATE",
  "PHOTO_CREATE",
  "BLOCAGE_CREATE",
  "BLOCAGE_UPDATE",
  "PHOTO_BLOCAGE_CREATE",
  "MATERIEL_UPDATE",
];

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

// A field report's local copy is the source of truth on this device — unlike
// chantier snapshots (a cache refreshed from a server that stays
// authoritative), a report created offline has nowhere else to live until
// it syncs. `dirty` marks a record with operations still pending, so an
// online refresh (see offline/fieldReports.ts) never overwrites local edits
// that haven't reached the server yet.
export interface LocalFieldReportRecord {
  id: string;
  userId: string;
  dirty: boolean;
  rapport: RapportTerrainDTO;
}

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db, oldVersion, _newVersion, transaction) {
    if (!db.objectStoreNames.contains("pendingPhotos")) {
      const store = db.createObjectStore("pendingPhotos", { keyPath: "id" });
      store.createIndex("by-point", "pointId");
    }
    if (oldVersion < 3) {
      const store = transaction.objectStore("pendingPhotos");
      // V1/V2 photos had no owner and cannot be attributed safely.
      store.clear();
      store.createIndex("by-user", "userId");
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
    if (!db.objectStoreNames.contains("fieldReports")) {
      const store = db.createObjectStore("fieldReports", { keyPath: "id" });
      store.createIndex("by-user", "userId");
    }
  },
});

export async function addPendingPhoto(photo: PendingPhoto) { return (await dbPromise).put("pendingPhotos", photo); }
export async function getPendingPhotos(userId: string): Promise<PendingPhoto[]> { return (await dbPromise).getAllFromIndex("pendingPhotos", "by-user", userId); }
export async function getPendingPhotosForPoint(userId: string, pointId: string): Promise<PendingPhoto[]> {
  return (await getPendingPhotos(userId)).filter((photo) => photo.pointId === pointId);
}
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

export async function putLocalFieldReport(record: LocalFieldReportRecord): Promise<void> { await (await dbPromise).put("fieldReports", record); }
export async function getLocalFieldReport(userId: string, id: string): Promise<LocalFieldReportRecord | undefined> {
  const record = await (await dbPromise).get("fieldReports", id) as LocalFieldReportRecord | undefined;
  return record?.userId === userId ? record : undefined;
}
export async function getLocalFieldReports(userId: string): Promise<LocalFieldReportRecord[]> {
  return (await dbPromise).getAllFromIndex("fieldReports", "by-user", userId);
}
export async function removeLocalFieldReport(id: string): Promise<void> { await (await dbPromise).delete("fieldReports", id); }

export async function clearOfflineData(userId?: string): Promise<void> {
  const db = await dbPromise;
  if (!userId) {
    await Promise.all([db.clear("snapshots"), db.clear("operations"), db.clear("pendingPhotos"), db.clear("fieldReports")]);
    return;
  }
  const tx = db.transaction(["snapshots", "operations", "fieldReports"], "readwrite");
  const snapshots = await tx.objectStore("snapshots").index("by-user").getAllKeys(userId);
  const operations = await tx.objectStore("operations").index("by-user").getAllKeys(userId);
  const fieldReports = await tx.objectStore("fieldReports").index("by-user").getAllKeys(userId);
  await Promise.all([
    ...snapshots.map((key) => tx.objectStore("snapshots").delete(key)),
    ...operations.map((key) => tx.objectStore("operations").delete(key)),
    ...fieldReports.map((key) => tx.objectStore("fieldReports").delete(key)),
  ]);
  await tx.done;
  // Le store historique n'avait pas de propriétaire : on le purge pour ne
  // jamais exposer les photos d'une session au prochain utilisateur.
  await db.clear("pendingPhotos");
}
