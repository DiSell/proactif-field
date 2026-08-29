import { ChantierDTO, ChantierSyncDTO, UserRole } from "@proactif-field/shared";
import { apiGet } from "../api/client";
import { useAuthStore } from "../auth/store";
import { cacheProtectedFile, deleteCachedChantierFiles } from "./cache";
import { getOperations, getPendingPhotos, getSnapshot, getSnapshots, purgeUnassignedSnapshots, putSnapshot, removeOperation, removePendingPhoto } from "./db";

export async function refreshChantierSnapshot(chantierId: string): Promise<ChantierSyncDTO> {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error("Session absente");
  const snapshot = await apiGet<ChantierSyncDTO>(`/api/chantiers/${chantierId}/sync`);
  await Promise.all(snapshot.plans.map((plan) => cacheProtectedFile(user.id, "plans", plan.id)));
  await Promise.all(snapshot.photos.map((photo) => cacheProtectedFile(user.id, "photos", photo.id).catch(() => null)));
  await putSnapshot(user.id, snapshot);
  return snapshot;
}

export async function refreshAssignedSnapshots(chantiers: ChantierDTO[]): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user || user.role !== UserRole.TECHNICIEN) return;
  const previous = await getSnapshots(user.id);
  const pendingChantiers = new Set((await getOperations(user.id)).map((operation) => operation.chantierId));
  const assignedIds = chantiers.map((chantier) => chantier.id);
  const removed = await purgeUnassignedSnapshots(user.id, assignedIds);
  for (const chantierId of removed) {
    const old = previous.find((snapshot) => snapshot.chantier.id === chantierId);
    if (old) {
      await deleteCachedChantierFiles(user.id, old.plans.map((plan) => plan.id), old.photos.map((photo) => photo.id));
      const planIds = new Set(old.plans.map((plan) => plan.id));
      await Promise.all((await getPendingPhotos(user.id)).filter((photo) => planIds.has(photo.planId)).map((photo) => removePendingPhoto(photo.id)));
    }
    await Promise.all((await getOperations(user.id)).filter((operation) => operation.chantierId === chantierId).map((operation) => removeOperation(operation.id)));
  }
  await Promise.all(chantiers.filter((chantier) => !pendingChantiers.has(chantier.id)).map((chantier) => refreshChantierSnapshot(chantier.id)));
}

export async function currentSnapshot(chantierId: string): Promise<ChantierSyncDTO | undefined> {
  const user = useAuthStore.getState().user;
  return user ? getSnapshot(user.id, chantierId) : undefined;
}

export async function currentSnapshots(): Promise<ChantierSyncDTO[]> {
  const user = useAuthStore.getState().user;
  return user ? getSnapshots(user.id) : [];
}
