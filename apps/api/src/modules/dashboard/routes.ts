import { Router } from "express";
import { prisma } from "../../config/db";
import { requireAdmin, requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { toChantierDTO } from "../chantiers/mapper";
import { toReportDTO } from "../reports/mapper";
import { DashboardStatsDTO } from "@proactif-field/shared";

// Company-wide overview — ADMIN only (this is the "espace entreprise" side,
// distinct from the terrain/technician view).
export const dashboardRouter = Router();
dashboardRouter.use(requireAuth, requireAdmin);

dashboardRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const organizationId = req.auth!.organizationId;

    const [chantierCount, pointCount, pointCompleteCount, recentChantiers, recentReports] = await Promise.all([
      prisma.chantier.count({ where: { organizationId } }),
      prisma.point.count({ where: { plan: { chantier: { organizationId } } } }),
      prisma.point.count({ where: { plan: { chantier: { organizationId } }, statut: "VERT" } }),
      prisma.chantier.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { assignments: true },
      }),
      prisma.report.findMany({
        where: { chantier: { organizationId } },
        orderBy: { generatedAt: "desc" },
        take: 5,
        include: { chantier: true, generatedBy: true },
      }),
    ]);

    const stats: DashboardStatsDTO = {
      chantierCount,
      pointCount,
      pointCompleteCount,
      progressPercent: pointCount === 0 ? 0 : Math.round((pointCompleteCount / pointCount) * 100),
      recentChantiers: recentChantiers.map((c) => toChantierDTO(c)),
      recentReports: recentReports.map(toReportDTO),
    };

    res.json(stats);
  })
);
