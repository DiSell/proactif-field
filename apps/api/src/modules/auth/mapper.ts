import { User } from "@prisma/client";
import { UserDTO } from "@proactif-field/shared";

export function toUserDTO(user: User): UserDTO {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as UserDTO["role"],
    isActive: user.isActive,
    organizationId: user.organizationId,
    createdAt: user.createdAt.toISOString(),
    invitationPending: user.invitedAt !== null && user.invitationAcceptedAt === null,
    phone: user.phone,
    employerCompany: user.employerCompany,
  };
}
