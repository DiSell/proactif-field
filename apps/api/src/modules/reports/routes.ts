import { Router } from "express";
import { prisma } from "../../config/db";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { generateChantierReport } from "./service";
import { toReportDTO } from "./mapper";

export const chantierReportsRouter = Router({ mergeParams: true });
chantierReportsRouter.use(requireAuth);

chantierReportsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const report = await generateChantierReport(req.params.id, req.auth!.userId);
    res.status(201).json({ report: toReportDTO(report) });
  })
);

chantierReportsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const reports = await prisma.report.findMany({
      where: { chantierId: req.params.id },
      orderBy: { generatedAt: "desc" },
    });
    res.json({ reports: reports.map(toReportDTO) });
  })
);
