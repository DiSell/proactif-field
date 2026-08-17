import { Chantier } from "@prisma/client";
import { ChantierDTO } from "@proactif-field/shared";

export function toChantierDTO(chantier: Chantier): ChantierDTO {
  return {
    id: chantier.id,
    name: chantier.name,
    description: chantier.description,
    address: chantier.address,
    createdById: chantier.createdById,
    createdAt: chantier.createdAt.toISOString(),
    updatedAt: chantier.updatedAt.toISOString(),
  };
}
