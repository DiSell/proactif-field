import { PhotoDTO } from "@proactif-field/shared";
import { apiPatchJson, apiPostForm, apiPostJson, apiDelete, ApiError } from "../api/client";
import { queryClient } from "../api/queryClient";
import { useAuthStore } from "../auth/store";
import { CHANTIER_OPERATION_TYPES, getOperations, getPendingPhotos, OfflineOperation, putOperation, removeOperation, removePendingPhoto } from "./db";
import { refreshChantierSnapshot } from "./snapshots";
import { refreshFieldReportDirtyFlag } from "./fieldReports";

let syncing = false;
let lastError: string | null = null;
const listeners = new Set<() => void>();

export function onSyncChange(listener: () => void): () => void { listeners.add(listener); return () => listeners.delete(listener); }
export function getLastSyncError(): string | null { return lastError; }
export function isSyncing(): boolean { return syncing; }
function notify() { listeners.forEach((listener) => listener()); }

function photoForm(payload: Record<string, unknown>): FormData {
  const form = new FormData();
  form.append("file", new Blob([payload.arrayBuffer as ArrayBuffer], { type: payload.mimeType as string }), payload.fileName as string);
  form.append("takenAt", payload.takenAt as string);
  if (payload.blocageRole) form.append("blocageRole", String(payload.blocageRole));
  // Only field-report photos set this — see offline/fieldReports.ts — so the
  // id generated for the optimistic local copy becomes the permanent one,
  // same idea as the client-supplied ids Point/Blocage already accept.
  if (payload.id) form.append("id", String(payload.id));
  for (const key of ["gpsLat", "gpsLng", "gpsAccuracy"] as const) if (payload[key] != null) form.append(key, String(payload[key]));
  return form;
}

async function execute(type: string, resourceId: string, payload: Record<string, unknown>): Promise<void> {
  switch (type) {
    case "POINT_CREATE": await apiPostJson(`/api/plans/${payload.planId}/points`, payload.input); break;
    case "POINT_UPDATE": await apiPatchJson(`/api/points/${resourceId}`, payload.input); break;
    case "PHOTO_CREATE": await apiPostForm(`/api/points/${payload.pointId}/photos`, photoForm(payload)); break;
    case "BLOCAGE_CREATE": await apiPostJson(`/api/points/${payload.pointId}/blocages`, payload.input); break;
    case "BLOCAGE_UPDATE": await apiPatchJson(`/api/blocages/${resourceId}`, payload.input); break;
    case "PHOTO_BLOCAGE_CREATE": await apiPostForm(`/api/blocages/${payload.blocageId}/photos`, photoForm(payload)); break;
    case "MATERIEL_UPDATE": await apiPatchJson(`/api/materiel/${resourceId}`, payload.input); break;
    default: throw new Error(`Opération hors ligne inconnue : ${type}`);
  }
}

// Isolated from execute() above on purpose (see OfflineOperationType in
// db.ts): a field report op is never routed through the chantier switch, and
// a future field-report case can never accidentally shadow a chantier one.
async function executeFieldReport(type: string, resourceId: string, payload: Record<string, unknown>): Promise<void> {
  switch (type) {
    case "FIELD_REPORT_CREATE": await apiPostJson(`/api/rapports-terrain`, payload.input); break;
    case "FIELD_REPORT_UPDATE": await apiPatchJson(`/api/rapports-terrain/${resourceId}`, payload.input); break;
    case "FIELD_REPORT_DELETE": await apiDelete(`/api/rapports-terrain/${resourceId}`); break;
    case "FIELD_REPORT_ITEM_CREATE": await apiPostJson(`/api/rapports-terrain/${payload.rapportTerrainId}/items`, payload.input); break;
    case "FIELD_REPORT_ITEM_UPDATE": await apiPatchJson(`/api/rapports-terrain/items/${resourceId}`, payload.input); break;
    case "FIELD_REPORT_ITEM_DELETE": await apiDelete(`/api/rapports-terrain/items/${resourceId}`); break;
    case "FIELD_REPORT_PHOTO_CREATE": await apiPostForm(`/api/rapports-terrain/items/${payload.itemId}/photos`, photoForm(payload)); break;
    case "FIELD_REPORT_PHOTO_DELETE": await apiDelete(`/api/rapports-terrain/photos/${resourceId}`); break;
    default: throw new Error(`Opération hors ligne inconnue : ${type}`);
  }
}

// Runs one operation queue to completion, stopping at the first failure so
// later operations on the same resource never run out of order — but the
// caller only ever hands this a same-domain subset (chantier XOR field
// report), so a failure in one domain can't block the other's queue.
async function runQueue(operations: OfflineOperation[], run: (op: OfflineOperation) => Promise<void>): Promise<void> {
  for (const operation of operations) {
    await putOperation({ ...operation, state: "SYNCING" }); notify();
    try {
      await run(operation);
      await removeOperation(operation.id);
      lastError = null;
    } catch (error) {
      lastError = error instanceof ApiError || error instanceof Error ? error.message : "Erreur inconnue";
      await putOperation({ ...operation, attempts: operation.attempts + 1, state: "ERROR", lastError });
      break;
    }
  }
}

export async function trySync(): Promise<void> {
  const user = useAuthStore.getState().user;
  if (syncing || !navigator.onLine || !user) return;
  syncing = true; notify();
  const refreshedChantiers = new Set<string>();
  const touchedFieldReports = new Set<string>();
  try {
    const operations = await getOperations(user.id);
    const chantierOps = operations.filter((op) => CHANTIER_OPERATION_TYPES.includes(op.type));
    const fieldReportOps = operations.filter((op) => !CHANTIER_OPERATION_TYPES.includes(op.type));

    await runQueue(chantierOps, async (operation) => {
      await execute(operation.type, operation.resourceId, operation.payload);
      refreshedChantiers.add(operation.chantierId);
    });
    await runQueue(fieldReportOps, async (operation) => {
      await executeFieldReport(operation.type, operation.resourceId, operation.payload);
      const rapportTerrainId = operation.payload.rapportTerrainId;
      if (typeof rapportTerrainId === "string") touchedFieldReports.add(rapportTerrainId);
    });

    for (const photo of await getPendingPhotos(user.id)) {
      try {
        await apiPostForm<{ photo: PhotoDTO }>(`/api/points/${photo.pointId}/photos`, photoForm(photo as unknown as Record<string, unknown>));
        await removePendingPhoto(photo.id);
        lastError = null;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Erreur inconnue";
        break;
      }
    }
    for (const chantierId of refreshedChantiers) await refreshChantierSnapshot(chantierId);
    for (const rapportTerrainId of touchedFieldReports) await refreshFieldReportDirtyFlag(user.id, rapportTerrainId);
    await queryClient.invalidateQueries();
  } finally {
    syncing = false; notify();
  }
}

export function startSyncLoop(): () => void {
  const interval = window.setInterval(() => void trySync(), 20000);
  const online = () => void trySync();
  window.addEventListener("online", online);
  void trySync();
  return () => { clearInterval(interval); window.removeEventListener("online", online); };
}
