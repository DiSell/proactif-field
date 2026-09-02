import {
  CreateRapportTerrainInput,
  CreateRapportTerrainItemInput,
  RapportTerrainDTO,
  RapportTerrainItemDTO,
  RapportTerrainPhotoDTO,
  UpdateRapportTerrainInput,
  UpdateRapportTerrainItemInput,
} from "@proactif-field/shared";
import {
  enqueueOperation,
  getLocalFieldReport,
  getLocalFieldReports,
  getOperations,
  putLocalFieldReport,
  putOperation,
  removeLocalFieldReport,
  removeOperation,
} from "./db";
import { cacheLocalFile } from "./cache";
import { useAuthStore } from "../auth/store";

// Field reports have no chantier snapshot to lean on (see offline/snapshots.ts):
// a report created offline has nowhere else to live until it syncs, so the
// local IndexedDB copy IS the source of truth on this device, not a cache of
// one. This module is intentionally separate from offline/localData.ts,
// which assumes a snapshot already exists (see createLocalPoint) — a field
// report never needs one.

function requireUser() {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error("Session absente");
  return user;
}

export async function getLocalFieldReportList(userId: string): Promise<RapportTerrainDTO[]> {
  const records = await getLocalFieldReports(userId);
  return records.map((r) => r.rapport).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getLocalFieldReportRecord(userId: string, id: string): Promise<RapportTerrainDTO | undefined> {
  return (await getLocalFieldReport(userId, id))?.rapport;
}

// Reconciles a freshly-fetched server list into the local store: a record
// still `dirty` (pending, unsynced local operations) is left untouched so a
// server response never clobbers an edit the server hasn't seen yet; every
// other record is replaced by/added from the server's version, sourcing the
// local device's list without a separate "snapshot" concept.
export async function mergeServerFieldReports(userId: string, serverReports: RapportTerrainDTO[]): Promise<void> {
  const local = await getLocalFieldReports(userId);
  const dirtyIds = new Set(local.filter((r) => r.dirty).map((r) => r.id));
  for (const rapport of serverReports) {
    if (dirtyIds.has(rapport.id)) continue;
    await putLocalFieldReport({ id: rapport.id, userId, dirty: false, rapport });
  }
}

async function isStillDirty(userId: string, rapportId: string): Promise<boolean> {
  const operations = await getOperations(userId);
  return operations.some((op) => op.payload.rapportTerrainId === rapportId);
}

// Called by syncManager after a field-report operation succeeds — clears
// the `dirty` flag once no operation for this report remains queued, so a
// later server refresh is allowed to take over again.
export async function refreshFieldReportDirtyFlag(userId: string, rapportId: string): Promise<void> {
  const record = await getLocalFieldReport(userId, rapportId);
  if (!record) return;
  const dirty = await isStillDirty(userId, rapportId);
  if (record.dirty !== dirty) await putLocalFieldReport({ ...record, dirty });
}

export async function createLocalFieldReport(input: CreateRapportTerrainInput): Promise<RapportTerrainDTO> {
  const user = await requireUser();
  const id = input.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const rapport: RapportTerrainDTO = {
    id,
    organizationId: user.organizationId,
    createdById: user.id,
    createdByName: user.name,
    nom: input.nom,
    typeTravaux: input.typeTravaux ?? null,
    observation: input.observation ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    gpsAccuracy: input.gpsAccuracy ?? null,
    lieu: input.lieu ?? null,
    items: [],
    itemCount: 0,
    photoCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  await putLocalFieldReport({ id, userId: user.id, dirty: true, rapport });
  await enqueueOperation({ id: crypto.randomUUID(), userId: user.id, chantierId: id, type: "FIELD_REPORT_CREATE", resourceId: id, payload: { rapportTerrainId: id, input: { ...input, id } }, createdAt: now });
  return rapport;
}

export async function updateLocalFieldReport(id: string, input: UpdateRapportTerrainInput): Promise<RapportTerrainDTO> {
  const user = await requireUser();
  const record = await getLocalFieldReport(user.id, id);
  if (!record) throw new Error("Rapport terrain indisponible hors ligne.");
  const rapport: RapportTerrainDTO = { ...record.rapport, ...input, updatedAt: new Date().toISOString() };
  await putLocalFieldReport({ ...record, dirty: true, rapport });
  await enqueueOperation({ id: crypto.randomUUID(), userId: user.id, chantierId: id, type: "FIELD_REPORT_UPDATE", resourceId: id, payload: { rapportTerrainId: id, input }, createdAt: new Date().toISOString() });
  return rapport;
}

export async function deleteLocalFieldReport(id: string): Promise<void> {
  const user = await requireUser();
  const pending = await getOperations(user.id);
  const stillUnsynced = pending.some((op) => op.type === "FIELD_REPORT_CREATE" && op.resourceId === id);
  await removeLocalFieldReport(id);
  if (stillUnsynced) {
    // Never reached the server — drop every queued operation for it locally
    // instead of round-tripping a create-then-delete.
    await Promise.all(pending.filter((op) => op.payload.rapportTerrainId === id).map((op) => removeOperation(op.id)));
    return;
  }
  await enqueueOperation({ id: crypto.randomUUID(), userId: user.id, chantierId: id, type: "FIELD_REPORT_DELETE", resourceId: id, payload: { rapportTerrainId: id }, createdAt: new Date().toISOString() });
}

export async function createLocalFieldReportItem(rapportTerrainId: string, input: CreateRapportTerrainItemInput): Promise<RapportTerrainItemDTO> {
  const user = await requireUser();
  const record = await getLocalFieldReport(user.id, rapportTerrainId);
  if (!record) throw new Error("Rapport terrain indisponible hors ligne.");
  const id = input.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const item: RapportTerrainItemDTO = {
    id,
    rapportTerrainId,
    createdById: user.id,
    createdByName: user.name,
    titre: input.titre ?? null,
    commentaire: input.commentaire ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    gpsAccuracy: input.gpsAccuracy ?? null,
    capturedAt: input.capturedAt ?? now,
    photos: [],
    createdAt: now,
    updatedAt: now,
  };
  const rapport: RapportTerrainDTO = { ...record.rapport, items: [...record.rapport.items, item], itemCount: record.rapport.itemCount + 1, updatedAt: now };
  await putLocalFieldReport({ ...record, dirty: true, rapport });
  await enqueueOperation({ id: crypto.randomUUID(), userId: user.id, chantierId: rapportTerrainId, type: "FIELD_REPORT_ITEM_CREATE", resourceId: id, payload: { rapportTerrainId, input: { ...input, id } }, createdAt: now });
  return item;
}

export async function updateLocalFieldReportItem(rapportTerrainId: string, itemId: string, input: UpdateRapportTerrainItemInput): Promise<RapportTerrainItemDTO> {
  const user = await requireUser();
  const record = await getLocalFieldReport(user.id, rapportTerrainId);
  if (!record) throw new Error("Rapport terrain indisponible hors ligne.");
  let updated!: RapportTerrainItemDTO;
  const now = new Date().toISOString();
  const items = record.rapport.items.map((item) => item.id === itemId ? (updated = { ...item, ...input, updatedAt: now }) : item);
  if (!updated) throw new Error("Entrée introuvable.");
  await putLocalFieldReport({ ...record, dirty: true, rapport: { ...record.rapport, items, updatedAt: now } });
  await enqueueOperation({ id: crypto.randomUUID(), userId: user.id, chantierId: rapportTerrainId, type: "FIELD_REPORT_ITEM_UPDATE", resourceId: itemId, payload: { rapportTerrainId, itemId, input }, createdAt: now });
  return updated;
}

// Mirrors deleteLocalFieldReport: an item still waiting on its own
// FIELD_REPORT_ITEM_CREATE (never reached the server) is dropped locally
// along with every operation queued for it — including its photo uploads —
// instead of round-tripping a create-then-delete. Otherwise a genuine
// FIELD_REPORT_ITEM_DELETE is queued.
export async function deleteLocalFieldReportItem(rapportTerrainId: string, itemId: string): Promise<void> {
  const user = await requireUser();
  const record = await getLocalFieldReport(user.id, rapportTerrainId);
  if (!record) throw new Error("Rapport terrain indisponible hors ligne.");
  const item = record.rapport.items.find((i) => i.id === itemId);
  const items = record.rapport.items.filter((i) => i.id !== itemId);
  const now = new Date().toISOString();
  await putLocalFieldReport({ ...record, dirty: true, rapport: { ...record.rapport, items, itemCount: items.length, photoCount: record.rapport.photoCount - (item?.photos.length ?? 0), updatedAt: now } });

  const pending = await getOperations(user.id);
  const stillUnsynced = pending.some((op) => op.type === "FIELD_REPORT_ITEM_CREATE" && op.resourceId === itemId);
  if (stillUnsynced) {
    await Promise.all(pending.filter((op) => op.payload.itemId === itemId || op.resourceId === itemId).map((op) => removeOperation(op.id)));
    return;
  }
  await enqueueOperation({ id: crypto.randomUUID(), userId: user.id, chantierId: rapportTerrainId, type: "FIELD_REPORT_ITEM_DELETE", resourceId: itemId, payload: { rapportTerrainId, itemId }, createdAt: now });
}

export async function addLocalFieldReportItemPhoto(rapportTerrainId: string, itemId: string, file: Blob, gps: { lat: number; lng: number; accuracy: number } | null): Promise<RapportTerrainPhotoDTO> {
  const user = await requireUser();
  const record = await getLocalFieldReport(user.id, rapportTerrainId);
  if (!record) throw new Error("Rapport terrain indisponible hors ligne.");
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const photo: RapportTerrainPhotoDTO = { id, rapportTerrainItemId: itemId, takenAt: now, gpsLat: gps?.lat ?? null, gpsLng: gps?.lng ?? null, gpsAccuracy: gps?.accuracy ?? null, createdAt: now };
  await cacheLocalFile(user.id, "rapport-terrain-photos", id, file);
  const items = record.rapport.items.map((item) => item.id === itemId ? { ...item, photos: [...item.photos, photo] } : item);
  await putLocalFieldReport({ ...record, dirty: true, rapport: { ...record.rapport, items, photoCount: record.rapport.photoCount + 1, updatedAt: now } });
  await enqueueOperation({
    id: crypto.randomUUID(),
    userId: user.id,
    chantierId: rapportTerrainId,
    type: "FIELD_REPORT_PHOTO_CREATE",
    resourceId: id,
    payload: { rapportTerrainId, itemId, id, arrayBuffer: await file.arrayBuffer(), mimeType: file.type || "image/jpeg", fileName: file instanceof File ? file.name : `photo-${Date.now()}.jpg`, takenAt: now, gpsLat: gps?.lat, gpsLng: gps?.lng, gpsAccuracy: gps?.accuracy },
    createdAt: now,
  });
  return photo;
}

// Same "cancel if never synced, else queue a real delete" logic as
// deleteLocalFieldReportItem/deleteLocalFieldReport.
export async function deleteLocalFieldReportItemPhoto(rapportTerrainId: string, itemId: string, photoId: string): Promise<void> {
  const user = await requireUser();
  const record = await getLocalFieldReport(user.id, rapportTerrainId);
  if (!record) throw new Error("Rapport terrain indisponible hors ligne.");
  const now = new Date().toISOString();
  const items = record.rapport.items.map((item) => item.id !== itemId ? item : { ...item, photos: item.photos.filter((p) => p.id !== photoId) });
  await putLocalFieldReport({ ...record, dirty: true, rapport: { ...record.rapport, items, photoCount: Math.max(0, record.rapport.photoCount - 1), updatedAt: now } });

  const pending = await getOperations(user.id);
  const stillUnsynced = pending.some((op) => op.type === "FIELD_REPORT_PHOTO_CREATE" && op.payload.id === photoId);
  if (stillUnsynced) {
    await Promise.all(pending.filter((op) => op.type === "FIELD_REPORT_PHOTO_CREATE" && op.payload.id === photoId).map((op) => removeOperation(op.id)));
    return;
  }
  await enqueueOperation({ id: crypto.randomUUID(), userId: user.id, chantierId: rapportTerrainId, type: "FIELD_REPORT_PHOTO_DELETE", resourceId: photoId, payload: { rapportTerrainId, itemId, photoId }, createdAt: now });
}

// Mirrors updatePendingPhotoGps (db.ts): a photo is saved immediately so the
// capture button frees up right away, and GPS — which can take a few
// seconds — is attached in the background afterwards, both on the local
// record (so the UI reflects it) and on the still-queued upload operation
// (so the eventual upload carries it), same two-step flow as PointFiche.
export async function updateLocalFieldReportItemPhotoGps(rapportTerrainId: string, itemId: string, photoId: string, gps: { lat: number; lng: number; accuracy: number }): Promise<void> {
  const user = requireUser();
  const record = await getLocalFieldReport(user.id, rapportTerrainId);
  if (record) {
    const items = record.rapport.items.map((item) => item.id !== itemId ? item : {
      ...item,
      photos: item.photos.map((photo) => photo.id === photoId ? { ...photo, gpsLat: gps.lat, gpsLng: gps.lng, gpsAccuracy: gps.accuracy } : photo),
    });
    await putLocalFieldReport({ ...record, rapport: { ...record.rapport, items } });
  }
  const pending = (await getOperations(user.id)).find((op) => op.type === "FIELD_REPORT_PHOTO_CREATE" && op.payload.id === photoId);
  if (pending) await putOperation({ ...pending, payload: { ...pending.payload, gpsLat: gps.lat, gpsLng: gps.lng, gpsAccuracy: gps.accuracy } });
}
