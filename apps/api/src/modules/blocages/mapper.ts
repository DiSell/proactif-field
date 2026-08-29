import { Blocage, Photo, Point, User } from "@prisma/client";
import { BlocageDTO, BlocageTracePoint } from "@proactif-field/shared";
import { toPhotoDTO } from "../photos/mapper";

export type BlocageWithRelations = Blocage & {
  point: Pick<Point, "identifiant">;
  createdBy: Pick<User, "name">;
  resolvedBy: Pick<User, "name"> | null;
  photos: Photo[];
};

export function toBlocageDTO(blocage: BlocageWithRelations): BlocageDTO {
  const flexionPoints: BlocageTracePoint[] = Array.isArray(blocage.flexionPoints)
    ? blocage.flexionPoints.flatMap((point) => {
        if (!point || typeof point !== "object" || Array.isArray(point)) return [];
        const value = point as Record<string, unknown>;
        if (typeof value.x !== "number" || typeof value.y !== "number") return [];
        return [{
          x: value.x,
          y: value.y,
          gpsLat: typeof value.gpsLat === "number" ? value.gpsLat : null,
          gpsLng: typeof value.gpsLng === "number" ? value.gpsLng : null,
          gpsAccuracy: typeof value.gpsAccuracy === "number" ? value.gpsAccuracy : null,
        }];
      })
    : [];
  return {
    id: blocage.id,
    organizationId: blocage.organizationId,
    chantierId: blocage.chantierId,
    pointId: blocage.pointId,
    pointIdentifiant: blocage.point.identifiant,
    createdById: blocage.createdById,
    createdByName: blocage.createdBy.name,
    titre: blocage.titre,
    description: blocage.description,
    statut: blocage.statut as BlocageDTO["statut"],
    priorite: blocage.priorite as BlocageDTO["priorite"],
    photos: blocage.photos.map(toPhotoDTO),
    photoCount: blocage.photos.length,
    startX: blocage.startX,
    startY: blocage.startY,
    endX: blocage.endX,
    endY: blocage.endY,
    flexionPoints,
    startGpsLat: blocage.startGpsLat,
    startGpsLng: blocage.startGpsLng,
    startGpsAccuracy: blocage.startGpsAccuracy,
    endGpsLat: blocage.endGpsLat,
    endGpsLng: blocage.endGpsLng,
    endGpsAccuracy: blocage.endGpsAccuracy,
    distanceMeters: blocage.distanceMeters,
    createdAt: blocage.createdAt.toISOString(),
    updatedAt: blocage.updatedAt.toISOString(),
    resolvedAt: blocage.resolvedAt?.toISOString() ?? null,
    resolvedById: blocage.resolvedById,
    resolvedByName: blocage.resolvedBy?.name ?? null,
  };
}
