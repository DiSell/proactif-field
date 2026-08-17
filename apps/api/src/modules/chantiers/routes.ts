import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { HttpError } from "../../middleware/errorHandler";
import { toChantierDTO } from "./mapper";

export const chantiersRouter = Router();
chantiersRouter.use(requireAuth);

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  address: z.string().optional(),
});

const updateSchema = createSchema.partial();

chantiersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const chantiers = await prisma.chantier.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ chantiers: chantiers.map(toChantierDTO) });
  })
);

chantiersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const chantier = await prisma.chantier.create({
      data: { ...input, createdById: req.auth!.userId },
    });
    res.status(201).json({ chantier: toChantierDTO(chantier) });
  })
);

chantiersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const chantier = await prisma.chantier.findUnique({ where: { id: req.params.id } });
    if (!chantier) throw new HttpError(404, "Chantier introuvable");
    res.json({ chantier: toChantierDTO(chantier) });
  })
);

chantiersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = updateSchema.parse(req.body);
    const existing = await prisma.chantier.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new HttpError(404, "Chantier introuvable");
    const chantier = await prisma.chantier.update({ where: { id: req.params.id }, data: input });
    res.json({ chantier: toChantierDTO(chantier) });
  })
);

chantiersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.chantier.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new HttpError(404, "Chantier introuvable");
    await prisma.chantier.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);
