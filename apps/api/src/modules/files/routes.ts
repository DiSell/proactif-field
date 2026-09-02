import { Router } from "express";
import { prisma } from "../../config/db";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { HttpError } from "../../middleware/errorHandler";
import { absolutePathFor } from "../../utils/storage";
import { assertDocumentAccess, assertPlanAccess, assertPointAccess, assertReportAccess, assertRapportTerrainPdfAccess, assertRapportTerrainPhotoAccess } from "../../utils/access";

export const filesRouter = Router();
filesRouter.use(requireAuth);

filesRouter.get(
  "/plans/:id",
  asyncHandler(async (req, res) => {
    await assertPlanAccess(req.params.id, req.auth!);
    const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
    if (!plan) throw new HttpError(404, "Plan introuvable");
    res.sendFile(absolutePathFor(plan.filePath));
  })
);

filesRouter.get(
  "/photos/:id",
  asyncHandler(async (req, res) => {
    const photo = await prisma.photo.findUnique({ where: { id: req.params.id } });
    if (!photo) throw new HttpError(404, "Photo introuvable");
    await assertPointAccess(photo.pointId, req.auth!);
    res.sendFile(absolutePathFor(photo.filePath));
  })
);

filesRouter.get(
  "/documents/:id",
  asyncHandler(async (req, res) => {
    await assertDocumentAccess(req.params.id, req.auth!);
    const document = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!document) throw new HttpError(404, "Document introuvable");
    res.download(absolutePathFor(document.filePath), document.fileName);
  })
);

filesRouter.get(
  "/reports/:id",
  asyncHandler(async (req, res) => {
    await assertReportAccess(req.params.id, req.auth!);
    const report = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!report) throw new HttpError(404, "Rapport introuvable");
    res.sendFile(absolutePathFor(report.filePath));
  })
);

filesRouter.get(
  "/rapport-terrain-photos/:id",
  asyncHandler(async (req, res) => {
    const photo = await prisma.rapportTerrainPhoto.findUnique({ where: { id: req.params.id } });
    if (!photo) throw new HttpError(404, "Photo introuvable");
    await assertRapportTerrainPhotoAccess(req.params.id, req.auth!);
    res.sendFile(absolutePathFor(photo.filePath));
  })
);

filesRouter.get(
  "/rapport-terrain-pdfs/:id",
  asyncHandler(async (req, res) => {
    await assertRapportTerrainPdfAccess(req.params.id, req.auth!);
    const pdf = await prisma.rapportTerrainPdf.findUnique({ where: { id: req.params.id } });
    if (!pdf) throw new HttpError(404, "Rapport introuvable");
    res.sendFile(absolutePathFor(pdf.filePath));
  })
);
