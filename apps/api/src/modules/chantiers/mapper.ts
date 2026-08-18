import { Chantier, ChantierAssignment } from "@prisma/client";
import { ChantierDTO } from "@proactif-field/shared";

type ChantierWithAssignments = Chantier & { assignments: ChantierAssignment[] };

export function toChantierDTO(chantier: ChantierWithAssignments): ChantierDTO {
  return {
    id: chantier.id,
    name: chantier.name,
    description: chantier.description,
    address: chantier.address,
    organizationId: chantier.organizationId,
    createdById: chantier.createdById,
    assignedUserIds: chantier.assignments.map((a) => a.userId),
    createdAt: chantier.createdAt.toISOString(),
    updatedAt: chantier.updatedAt.toISOString(),
  };
}
