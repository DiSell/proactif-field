import { Blocage, Photo, Point, User } from "@prisma/client";
import { BlocageDTO } from "@proactif-field/shared";
import { toPhotoDTO } from "../photos/mapper";

export type BlocageWithRelations = Blocage & {
  point: Pick<Point, "identifiant">;
  createdBy: Pick<User, "name">;
  resolvedBy: Pick<User, "name"> | null;
  photos: Photo[];
};

export function toBlocageDTO(blocage: BlocageWithRelations): BlocageDTO {
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
    createdAt: blocage.createdAt.toISOString(),
    updatedAt: blocage.updatedAt.toISOString(),
    resolvedAt: blocage.resolvedAt?.toISOString() ?? null,
    resolvedById: blocage.resolvedById,
    resolvedByName: blocage.resolvedBy?.name ?? null,
  };
}
