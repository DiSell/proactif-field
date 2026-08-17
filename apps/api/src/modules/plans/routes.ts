import { Router } from "express";
import path from "path";
import { prisma } from "../../config/db";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { HttpError } from "../../middleware/errorHandler";
import { uploadPlan } from "../../middleware/upload";
import { toPlanDTO } from "./mapper";
import { PlanFileType } from "@prisma/client";

const extToFileType: Record<string, PlanFileType> = {
  ".pdf": "PDF",
  ".png": "PNG",
  ".jpg": "JPG",
  ".jpeg": "JPG",
  ".svg": "SVG",
};

export const chantierPlansRouter = Router({ mergeParams: true });
chantierPlansRouter.use(requireAuth);

chantierPlansRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const plans = await prisma.plan.findMany({
      where: { chantierId: req.params.id },
      orderBy: { uploadedAt: "desc" },
    });
    res.json({ plans: plans.map(toPlanDTO) });
  })
);

chantierPlansRouter.post(
  "/",
  uploadPlan.single("file"),
  asyncHandler(async (req, res) => {
    const chantier = await prisma.chantier.findUnique({ where: { id: req.params.id } });
    if (!chantier) throw new HttpError(404, "Chantier introuvable");
    if (!req.file) throw new HttpError(400, "Aucun fichier reçu");

    const ext = path.extname(req.file.originalname).toLowerCase();
    const fileType = extToFileType[ext];
    if (!fileType) throw new HttpError(400, "Type de fichier non supporté");

    const plan = await prisma.plan.create({
      data: {
        chantierId: chantier.id,
        fileName: req.file.originalname,
        filePath: path.join("plans", req.file.filename),
        fileType,
      },
    });
    res.status(201).json({ plan: toPlanDTO(plan) });
  })
);

export const plansRouter = Router();
plansRouter.use(requireAuth);

plansRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
    if (!plan) throw new HttpError(404, "Plan introuvable");
    res.json({ plan: toPlanDTO(plan) });
  })
);

plansRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
    if (!plan) throw new HttpError(404, "Plan introuvable");
    await prisma.plan.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);
