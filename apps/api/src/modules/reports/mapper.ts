import { Report, Chantier, User } from "@prisma/client";
import { ReportDTO } from "@proactif-field/shared";

type ReportWithRelations = Report & { chantier: Chantier; generatedBy: User };

export function toReportDTO(report: ReportWithRelations): ReportDTO {
  return {
    id: report.id,
    chantierId: report.chantierId,
    chantierName: report.chantier.name,
    generatedAt: report.generatedAt.toISOString(),
    generatedById: report.generatedById,
    generatedByName: report.generatedBy.name,
  };
}
