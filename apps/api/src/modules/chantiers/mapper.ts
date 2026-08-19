import { Chantier, ChantierAssignment, User } from "@prisma/client";
import { ChantierDTO } from "@proactif-field/shared";

type ChantierWithRelations = Chantier & {
  assignments: ChantierAssignment[];
  responsable?: User | null;
};

export function toChantierDTO(chantier: ChantierWithRelations, viewerUserId?: string): ChantierDTO {
  const viewerAssignment = viewerUserId
    ? chantier.assignments.find((a) => a.userId === viewerUserId)
    : undefined;

  return {
    id: chantier.id,
    reference: chantier.reference,
    name: chantier.name,
    description: chantier.description,
    address: chantier.address,
    client: chantier.client,
    entrepriseExecutante: chantier.entrepriseExecutante,
    dateDebutPrevue: chantier.dateDebutPrevue ? chantier.dateDebutPrevue.toISOString() : null,
    dateFinPrevue: chantier.dateFinPrevue ? chantier.dateFinPrevue.toISOString() : null,
    statut: chantier.statut as ChantierDTO["statut"],
    organizationId: chantier.organizationId,
    createdById: chantier.createdById,
    responsableId: chantier.responsableId,
    responsableName: chantier.responsable?.name ?? null,
    assignedUserIds: chantier.assignments.map((a) => a.userId),
    isNewAssignment: viewerAssignment ? viewerAssignment.seenAt === null : false,
    createdAt: chantier.createdAt.toISOString(),
    updatedAt: chantier.updatedAt.toISOString(),
  };
}
