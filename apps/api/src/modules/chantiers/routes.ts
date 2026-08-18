import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db";
import { requireAdmin, requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { HttpError } from "../../middleware/errorHandler";
import { toChantierDTO } from "./mapper";

const withAssignments = { include: { assignments: true } } as const;

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
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const chantiers = await prisma.chantier.findMany({
      where: {
        organizationId: auth.organizationId,
        ...(auth.role === "TECHNICIEN" ? { assignments: { some: { userId: auth.userId } } } : {}),
      },
      orderBy: { createdAt: "desc" },
      ...withAssignments,
    });
    res.json({ chantiers: chantiers.map(toChantierDTO) });
  })
);

chantiersRouter.post(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const chantier = await prisma.chantier.create({
      data: { ...input, createdById: req.auth!.userId, organizationId: req.auth!.organizationId },
      ...withAssignments,
    });
    res.status(201).json({ chantier: toChantierDTO(chantier) });
  })
);

chantiersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const chantier = await prisma.chantier.findUnique({ where: { id: req.params.id }, ...withAssignments });
    if (!chantier || chantier.organizationId !== auth.organizationId) {
      throw new HttpError(404, "Chantier introuvable");
    }
    if (auth.role === "TECHNICIEN" && !chantier.assignments.some((a) => a.userId === auth.userId)) {
      throw new HttpError(404, "Chantier introuvable");
    }
    res.json({ chantier: toChantierDTO(chantier) });
  })
);

chantiersRouter.patch(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = updateSchema.parse(req.body);
    const existing = await prisma.chantier.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.organizationId !== req.auth!.organizationId) {
      throw new HttpError(404, "Chantier introuvable");
    }
    const chantier = await prisma.chantier.update({
      where: { id: req.params.id },
      data: input,
      ...withAssignments,
    });
    res.json({ chantier: toChantierDTO(chantier) });
  })
);

chantiersRouter.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.chantier.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.organizationId !== req.auth!.organizationId) {
      throw new HttpError(404, "Chantier introuvable");
    }
    await prisma.chantier.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

const assignSchema = z.object({ userId: z.string().min(1) });

chantiersRouter.post(
  "/:id/assignments",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { userId } = assignSchema.parse(req.body);
    const auth = req.auth!;
    const chantier = await prisma.chantier.findUnique({ where: { id: req.params.id } });
    if (!chantier || chantier.organizationId !== auth.organizationId) {
      throw new HttpError(404, "Chantier introuvable");
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.organizationId !== auth.organizationId) {
      throw new HttpError(404, "Utilisateur introuvable");
    }
    await prisma.chantierAssignment.upsert({
      where: { chantierId_userId: { chantierId: chantier.id, userId } },
      update: {},
      create: { chantierId: chantier.id, userId },
    });
    const updated = await prisma.chantier.findUnique({ where: { id: chantier.id }, ...withAssignments });
    res.status(201).json({ chantier: toChantierDTO(updated!) });
  })
);

chantiersRouter.delete(
  "/:id/assignments/:userId",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const chantier = await prisma.chantier.findUnique({ where: { id: req.params.id } });
    if (!chantier || chantier.organizationId !== auth.organizationId) {
      throw new HttpError(404, "Chantier introuvable");
    }
    await prisma.chantierAssignment
      .delete({ where: { chantierId_userId: { chantierId: chantier.id, userId: req.params.userId } } })
      .catch(() => undefined);
    const updated = await prisma.chantier.findUnique({ where: { id: chantier.id }, ...withAssignments });
    res.json({ chantier: toChantierDTO(updated!) });
  })
);
