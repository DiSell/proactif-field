import { Router } from "express";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { prisma } from "../../config/db";
import { requireAdmin, requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { HttpError } from "../../middleware/errorHandler";
import { uploadPlan } from "../../middleware/upload";
import { absolutePathFor, decodeOriginalFilename } from "../../utils/storage";
import { assertChantierAccess, assertPlanAccess } from "../../utils/access";
import { toPlanDTO } from "./mapper";
import { PlanFileType } from "@prisma/client";
import { logActivityAsync } from "../activity/service";

const extToFileType: Record<string, PlanFileType> = {
  ".pdf": "PDF",
  ".png": "PNG",
  ".jpg": "JPG",
  ".jpeg": "JPG",
  ".svg": "SVG",
};

// Plans photographed on-site with a phone camera can be huge (several MB, 4000px+),
// which makes pan/zoom janky on mobile. Downscale and re-encode so the browser has
// much less data to decode and composite. .rotate() also auto-applies EXIF
// orientation, fixing the "photo displays sideways" issue common with phone cameras.
const MAX_PLAN_DIMENSION = 2400;

async function optimizeRasterPlan(relativePath: string, fileType: PlanFileType): Promise<void> {
  if (fileType !== "PNG" && fileType !== "JPG") return;
  try {
    const absPath = absolutePathFor(relativePath);
    const pipeline = sharp(absPath).rotate();
    const metadata = await pipeline.metadata();
    if ((metadata.width ?? 0) > MAX_PLAN_DIMENSION || (metadata.height ?? 0) > MAX_PLAN_DIMENSION) {
      pipeline.resize({
        width: MAX_PLAN_DIMENSION,
        height: MAX_PLAN_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      });
    }
    const buffer =
      fileType === "JPG"
        ? await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer()
        : await pipeline.png({ compressionLevel: 8 }).toBuffer();
    await fs.promises.writeFile(absPath, buffer);
  } catch (err) {
    console.error(`Optimisation du plan ${relativePath} échouée, fichier original conservé`, err);
  }
}

export const chantierPlansRouter = Router({ mergeParams: true });
chantierPlansRouter.use(requireAuth);

chantierPlansRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    await assertChantierAccess(req.params.id, req.auth!);
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
    await assertChantierAccess(req.params.id, req.auth!);
    if (!req.file) throw new HttpError(400, "Aucun fichier reçu");

    const ext = path.extname(req.file.originalname).toLowerCase();
    const fileType = extToFileType[ext];
    if (!fileType) throw new HttpError(400, "Type de fichier non supporté");

    const filePath = path.join("plans", req.file.filename);
    await optimizeRasterPlan(filePath, fileType);

    const plan = await prisma.plan.create({
      data: {
        chantierId: req.params.id,
        fileName: decodeOriginalFilename(req.file.originalname),
        filePath,
        fileType,
      },
    });
    logActivityAsync({ organizationId: req.auth!.organizationId, chantierId: req.params.id, userId: req.auth!.userId, action: "PLAN_AJOUTE", description: plan.fileName, metadata: { planId: plan.id, planName: plan.fileName } });
    res.status(201).json({ plan: toPlanDTO(plan) });
  })
);

export const plansRouter = Router();
plansRouter.use(requireAuth);

plansRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    await assertPlanAccess(req.params.id, req.auth!);
    const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
    if (!plan) throw new HttpError(404, "Plan introuvable");
    res.json({ plan: toPlanDTO(plan) });
  })
);

plansRouter.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    await assertPlanAccess(req.params.id, req.auth!);
    await prisma.plan.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);
