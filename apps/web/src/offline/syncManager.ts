import { PhotoDTO } from "@proactif-field/shared";
import { apiPatchJson, apiPostForm, apiPostJson, ApiError } from "../api/client";
import { queryClient } from "../api/queryClient";
import { useAuthStore } from "../auth/store";
import { getOperations, getPendingPhotos, putOperation, removeOperation, removePendingPhoto } from "./db";
import { refreshChantierSnapshot } from "./snapshots";

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
    default: throw new Error(`Opération hors ligne inconnue : ${type}`);
  }
}

export async function trySync(): Promise<void> {
  const user = useAuthStore.getState().user;
  if (syncing || !navigator.onLine || !user) return;
  syncing = true; notify();
  const refreshed = new Set<string>();
  try {
    for (const operation of await getOperations(user.id)) {
      await putOperation({ ...operation, state: "SYNCING" }); notify();
      try {
        await execute(operation.type, operation.resourceId, operation.payload);
        await removeOperation(operation.id);
        refreshed.add(operation.chantierId);
        lastError = null;
      } catch (error) {
        lastError = error instanceof ApiError || error instanceof Error ? error.message : "Erreur inconnue";
        await putOperation({ ...operation, attempts: operation.attempts + 1, state: "ERROR", lastError });
        break;
      }
    }
    for (const photo of await getPendingPhotos()) {
      try {
        await apiPostForm<{ photo: PhotoDTO }>(`/api/points/${photo.pointId}/photos`, photoForm(photo as unknown as Record<string, unknown>));
        await removePendingPhoto(photo.id);
        lastError = null;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Erreur inconnue";
        break;
      }
    }
    for (const chantierId of refreshed) await refreshChantierSnapshot(chantierId);
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
