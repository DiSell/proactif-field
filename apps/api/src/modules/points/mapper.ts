import { Point } from "@prisma/client";
import { PointDTO } from "@proactif-field/shared";

type PointWithCount = Point & { _count: { photos: number; blocages: number } };

export function toPointDTO(point: PointWithCount): PointDTO {
  return {
    id: point.id,
    planId: point.planId,
    identifiant: point.identifiant,
    nom: point.nom,
    type: point.type,
    commentaire: point.commentaire,
    statut: point.statut as PointDTO["statut"],
    x: point.x,
    y: point.y,
    photoCount: point._count.photos,
    openBlocageCount: point._count.blocages,
    createdAt: point.createdAt.toISOString(),
    updatedAt: point.updatedAt.toISOString(),
  };
}
