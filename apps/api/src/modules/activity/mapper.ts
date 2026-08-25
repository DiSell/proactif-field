import { ActivityLog, User } from "@prisma/client";
import { ActivityLogDTO } from "@proactif-field/shared";

type ActivityLogWithUser = ActivityLog & { user: Pick<User, "name"> };

export function toActivityLogDTO(entry: ActivityLogWithUser): ActivityLogDTO {
  return {
    id: entry.id,
    chantierId: entry.chantierId,
    userId: entry.userId,
    userName: entry.user.name,
    action: entry.action,
    description: entry.description,
    // Already allowlisted at write time by logActivity — safe to expose as-is.
    metadata: (entry.metadata as ActivityLogDTO["metadata"]) ?? null,
    createdAt: entry.createdAt.toISOString(),
  };
}
