import { Router } from "express";
import { prisma } from "../../config/db";
import { requireAdmin, requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { assertChantierAccess } from "../../utils/access";
import { generateChantierReport } from "./service";
import { toReportDTO } from "./mapper";

const withRelations = { include: { chantier: true, generatedBy: true } } as const;

// Viewable and generatable by anyone with chantier access: a technician
// finishing an intervention hands the report to the client on the spot, so
// they need to review and (re)generate it themselves, not wait on an
// ADMIN. assertChantierAccess still scopes a TECHNICIEN to chantiers
// they're assigned to. The org-wide /reports screen below stays ADMIN-only.
export const chantierReportsRouter = Router({ mergeParams: true });
chantierReportsRouter.use(requireAuth);

chantierReportsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    await assertChantierAccess(req.params.id, req.auth!);
    const report = await generateChantierReport(req.params.id, req.auth!.userId);
    res.status(201).json({ report: toReportDTO(report) });
  })
);

chantierReportsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    await assertChantierAccess(req.params.id, req.auth!);
    const reports = await prisma.report.findMany({
      where: { chantierId: req.params.id },
      orderBy: { generatedAt: "desc" },
      ...withRelations,
    });
    res.json({ reports: reports.map(toReportDTO) });
  })
);

// Org-wide listing for the /reports screen.
export const orgReportsRouter = Router();
orgReportsRouter.use(requireAuth, requireAdmin);

orgReportsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const reports = await prisma.report.findMany({
      where: { chantier: { organizationId: req.auth!.organizationId } },
      orderBy: { generatedAt: "desc" },
      ...withRelations,
    });
    res.json({ reports: reports.map(toReportDTO) });
  })
);
