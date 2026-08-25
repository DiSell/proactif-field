import { Materiel, User } from "@prisma/client";
import { MaterielDTO } from "@proactif-field/shared";

type MaterielWithNames = Materiel & {
  createdBy: Pick<User, "name">;
  updatedBy: Pick<User, "name"> | null;
};

export function toMaterielDTO(materiel: MaterielWithNames): MaterielDTO {
  return {
    id: materiel.id,
    chantierId: materiel.chantierId,
    reference: materiel.reference,
    designation: materiel.designation,
    quantitePrevue: materiel.quantitePrevue,
    quantiteUtilisee: materiel.quantiteUtilisee,
    unite: materiel.unite,
    commentaire: materiel.commentaire,
    createdById: materiel.createdById,
    createdByName: materiel.createdBy.name,
    updatedById: materiel.updatedById,
    updatedByName: materiel.updatedBy?.name ?? null,
    createdAt: materiel.createdAt.toISOString(),
    updatedAt: materiel.updatedAt.toISOString(),
  };
}
