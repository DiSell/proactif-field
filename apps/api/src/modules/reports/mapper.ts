import { Report } from "@prisma/client";
import { ReportDTO } from "@proactif-field/shared";

export function toReportDTO(report: Report): ReportDTO {
  return {
    id: report.id,
    chantierId: report.chantierId,
    generatedAt: report.generatedAt.toISOString(),
    generatedById: report.generatedById,
  };
}
