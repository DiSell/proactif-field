import { Router } from "express";
import { prisma } from "../../config/db";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { HttpError } from "../../middleware/errorHandler";
import { absolutePathFor } from "../../utils/storage";

export const filesRouter = Router();
filesRouter.use(requireAuth);

filesRouter.get(
  "/plans/:id",
  asyncHandler(async (req, res) => {
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
    res.sendFile(absolutePathFor(photo.filePath));
  })
);

filesRouter.get(
  "/reports/:id",
  asyncHandler(async (req, res) => {
    const report = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!report) throw new HttpError(404, "Rapport introuvable");
    res.sendFile(absolutePathFor(report.filePath));
  })
);
