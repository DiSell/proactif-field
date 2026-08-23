import { BlocageDTO, BlocagePhotoRole, BlocageStatut, CreateBlocageInput, CreatePointInput, PhotoDTO, PointDTO, UpdateBlocageInput, UpdatePointInput } from "@proactif-field/shared";
import { useAuthStore } from "../auth/store";
import { enqueueOperation, getSnapshots, mutateSnapshot } from "./db";
import { cacheLocalFile } from "./cache";

function userId(): string {
  const id = useAuthStore.getState().user?.id;
  if (!id) throw new Error("Session absente");
  return id;
}

export async function findSnapshotByPlan(planId: string) {
  return (await getSnapshots(userId())).find((snapshot) => snapshot.plans.some((plan) => plan.id === planId));
}

export async function findSnapshotByPoint(pointId: string) {
  return (await getSnapshots(userId())).find((snapshot) => snapshot.points.some((point) => point.id === pointId));
}

export async function createLocalPoint(planId: string, input: CreatePointInput): Promise<PointDTO> {
  const snapshot = await findSnapshotByPlan(planId);
  if (!snapshot) throw new Error("Plan indisponible hors ligne. Synchronisez d'abord le chantier.");
  const now = new Date().toISOString();
  const point: PointDTO = { id: input.id ?? crypto.randomUUID(), planId, identifiant: input.identifiant, nom: input.nom ?? null, type: input.type ?? null, commentaire: input.commentaire ?? null, statut: input.statut ?? "GRIS", x: input.x, y: input.y, photoCount: 0, openBlocageCount: 0, createdAt: now, updatedAt: now } as PointDTO;
  await mutateSnapshot(userId(), snapshot.chantier.id, (current) => ({ ...current, points: [...current.points, point] }));
  await enqueueOperation({ id: crypto.randomUUID(), userId: userId(), chantierId: snapshot.chantier.id, type: "POINT_CREATE", resourceId: point.id, payload: { planId, input: { ...input, id: point.id } }, createdAt: now });
  return point;
}

export async function updateLocalPoint(id: string, input: UpdatePointInput): Promise<PointDTO> {
  const snapshot = await findSnapshotByPoint(id);
  if (!snapshot) throw new Error("Point indisponible hors ligne.");
  let updated!: PointDTO;
  await mutateSnapshot(userId(), snapshot.chantier.id, (current) => ({ ...current, points: current.points.map((point) => point.id === id ? (updated = { ...point, ...input, updatedAt: new Date().toISOString() }) : point) }));
  await enqueueOperation({ id: crypto.randomUUID(), userId: userId(), chantierId: snapshot.chantier.id, type: "POINT_UPDATE", resourceId: id, payload: { input }, createdAt: new Date().toISOString() });
  return updated;
}

export async function createLocalBlocage(pointId: string, input: CreateBlocageInput): Promise<BlocageDTO> {
  const snapshot = await findSnapshotByPoint(pointId);
  const user = useAuthStore.getState().user;
  if (!snapshot || !user) throw new Error("Point indisponible hors ligne.");
  const point = snapshot.points.find((item) => item.id === pointId)!;
  const now = new Date().toISOString();
  const blocage: BlocageDTO = { id: input.id ?? crypto.randomUUID(), organizationId: user.organizationId, chantierId: snapshot.chantier.id, pointId, pointIdentifiant: point.identifiant, createdById: user.id, createdByName: user.name, titre: input.titre, description: input.description, statut: BlocageStatut.OUVERT, priorite: input.priorite, photos: [], photoCount: 0, startX: input.startX ?? null, startY: input.startY ?? null, endX: input.endX ?? point.x, endY: input.endY ?? point.y, startGpsLat: input.startGpsLat ?? null, startGpsLng: input.startGpsLng ?? null, startGpsAccuracy: input.startGpsAccuracy ?? null, endGpsLat: input.endGpsLat ?? null, endGpsLng: input.endGpsLng ?? null, endGpsAccuracy: input.endGpsAccuracy ?? null, distanceMeters: gpsDistance(input.startGpsLat, input.startGpsLng, input.endGpsLat, input.endGpsLng), createdAt: now, updatedAt: now, resolvedAt: null, resolvedById: null, resolvedByName: null };
  await mutateSnapshot(user.id, snapshot.chantier.id, (current) => ({ ...current, blocages: [...current.blocages, blocage], points: current.points.map((item) => item.id === pointId ? { ...item, openBlocageCount: item.openBlocageCount + 1 } : item) }));
  await enqueueOperation({ id: crypto.randomUUID(), userId: user.id, chantierId: snapshot.chantier.id, type: "BLOCAGE_CREATE", resourceId: blocage.id, payload: { pointId, input: { ...input, id: blocage.id } }, createdAt: now });
  return blocage;
}

export async function updateLocalBlocage(id: string, input: UpdateBlocageInput): Promise<BlocageDTO> {
  const snapshot = (await getSnapshots(userId())).find((item) => item.blocages.some((blocage) => blocage.id === id));
  const user = useAuthStore.getState().user;
  if (!snapshot || !user) throw new Error("Blocage indisponible hors ligne.");
  const previous = snapshot.blocages.find((blocage) => blocage.id === id)!;
  let updated!: BlocageDTO;
  await mutateSnapshot(user.id, snapshot.chantier.id, (current) => ({ ...current, blocages: current.blocages.map((blocage) => blocage.id === id ? (updated = { ...blocage, ...input, updatedAt: new Date().toISOString(), resolvedAt: input.statut === BlocageStatut.RESOLU ? new Date().toISOString() : blocage.resolvedAt, resolvedById: input.statut === BlocageStatut.RESOLU ? user.id : blocage.resolvedById, resolvedByName: input.statut === BlocageStatut.RESOLU ? user.name : blocage.resolvedByName }) : blocage), points: current.points.map((point) => point.id === previous.pointId && previous.statut !== input.statut ? { ...point, openBlocageCount: Math.max(0, point.openBlocageCount + (input.statut === BlocageStatut.OUVERT ? 1 : -1)) } : point) }));
  await enqueueOperation({ id: crypto.randomUUID(), userId: user.id, chantierId: snapshot.chantier.id, type: "BLOCAGE_UPDATE", resourceId: id, payload: { input }, createdAt: new Date().toISOString() });
  return updated;
}

export async function enqueueBlocagePhoto(blocageId: string, form: FormData): Promise<PhotoDTO> {
  const snapshot = (await getSnapshots(userId())).find((item) => item.blocages.some((blocage) => blocage.id === blocageId));
  if (!snapshot) throw new Error("Blocage indisponible hors ligne.");
  const file = form.get("file");
  if (!(file instanceof Blob)) throw new Error("Photo absente");
  const id = crypto.randomUUID(); const now = new Date().toISOString();
  const role = String(form.get("blocageRole") ?? BlocagePhotoRole.BLOCAGE) as BlocagePhotoRole;
  const photo: PhotoDTO = { id, pointId: snapshot.blocages.find((blocage) => blocage.id === blocageId)!.pointId, blocageId, blocageRole: role, takenAt: String(form.get("takenAt") ?? now), gpsLat: null, gpsLng: null, gpsAccuracy: null, createdAt: now };
  await cacheLocalFile(userId(), "photos", id, file);
  await mutateSnapshot(userId(), snapshot.chantier.id, (current) => ({ ...current, photos: [...current.photos, photo], blocages: current.blocages.map((blocage) => blocage.id === blocageId ? { ...blocage, photos: [...blocage.photos, photo], photoCount: blocage.photoCount + 1 } : blocage) }));
  await enqueueOperation({ id: crypto.randomUUID(), userId: userId(), chantierId: snapshot.chantier.id, type: "PHOTO_BLOCAGE_CREATE", resourceId: blocageId, payload: { blocageId, blocageRole: role, arrayBuffer: await file.arrayBuffer(), mimeType: file.type || "image/jpeg", fileName: file instanceof File ? file.name : `photo-${Date.now()}.jpg`, takenAt: photo.takenAt }, createdAt: now });
  return photo;
}

function gpsDistance(aLat?: number | null, aLng?: number | null, bLat?: number | null, bLng?: number | null): number | null {
  if (aLat == null || aLng == null || bLat == null || bLng == null) return null;
  const rad = (value: number) => value * Math.PI / 180; const dLat = rad(bLat - aLat); const dLng = rad(bLng - aLng);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
