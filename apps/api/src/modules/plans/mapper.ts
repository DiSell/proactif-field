import { Plan } from "@prisma/client";
import { PlanDTO } from "@proactif-field/shared";

export function toPlanDTO(plan: Plan): PlanDTO {
  return {
    id: plan.id,
    chantierId: plan.chantierId,
    fileName: plan.fileName,
    fileType: plan.fileType as PlanDTO["fileType"],
    width: plan.width,
    height: plan.height,
    uploadedAt: plan.uploadedAt.toISOString(),
  };
}
