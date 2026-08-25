import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { HttpError } from "../../middleware/errorHandler";
import { assertChantierAccess, assertPlanAccess, assertPointAccess } from "../../utils/access";
import { toPointDTO } from "./mapper";
import { PointStatut } from "@prisma/client";
import { logActivityAsync } from "../activity/service";

const withCount = { include: { _count: { select: { photos: { where: { blocageId: null } }, blocages: { where: { statut: "OUVERT" } } } } } } as const;

const createSchema = z.object({
  id: z.string().min(1).optional(),
  identifiant: z.string().min(1),
  nom: z.string().optional(),
  type: z.string().optional(),
  commentaire: z.string().optional(),
  statut: z.nativeEnum(PointStatut).optional(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

const updateSchema = z.object({
  identifiant: z.string().min(1).optional(),
  nom: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  commentaire: z.string().nullable().optional(),
  statut: z.nativeEnum(PointStatut).optional(),
  x: z.number().min(0).max(1).optional(),
  y: z.number().min(0).max(1).optional(),
});

export const planPointsRouter = Router({ mergeParams: true });
planPointsRouter.use(requireAuth);

planPointsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    await assertPlanAccess(req.params.id, req.auth!);
    const points = await prisma.point.findMany({
      where: { planId: req.params.id },
      orderBy: { createdAt: "asc" },
      ...withCount,
    });
    res.json({ points: points.map(toPointDTO) });
  })
);

planPointsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { chantierId } = await assertPlanAccess(req.params.id, req.auth!);
    const input = createSchema.parse(req.body);
    const point = await prisma.point.create({
      data: { ...input, planId: req.params.id },
      ...withCount,
    });
    logActivityAsync({ organizationId: req.auth!.organizationId, chantierId, userId: req.auth!.userId, action: "POINT_CREE", description: point.identifiant, metadata: { pointId: point.id, pointIdentifiant: point.identifiant, planId: req.params.id } });
    res.status(201).json({ point: toPointDTO(point) });
  })
);

// Aggregated points across every plan of a chantier — for the "Points"
// overview tab, as opposed to the per-plan list used by the plan viewer.
export const chantierPointsRouter = Router({ mergeParams: true });
chantierPointsRouter.use(requireAuth);

chantierPointsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    await assertChantierAccess(req.params.id, req.auth!);
    const points = await prisma.point.findMany({
      where: { plan: { chantierId: req.params.id } },
      orderBy: { createdAt: "asc" },
      ...withCount,
    });
    res.json({ points: points.map(toPointDTO) });
  })
);

export const pointsRouter = Router();
pointsRouter.use(requireAuth);

pointsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    await assertPointAccess(req.params.id, req.auth!);
    const point = await prisma.point.findUnique({ where: { id: req.params.id }, ...withCount });
    if (!point) throw new HttpError(404, "Point introuvable");
    res.json({ point: toPointDTO(point) });
  })
);

pointsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const { chantierId } = await assertPointAccess(req.params.id, req.auth!);
    const input = updateSchema.parse(req.body);
    const before = await prisma.point.findUnique({ where: { id: req.params.id }, select: { identifiant: true, statut: true } });
    const point = await prisma.point.update({
      where: { id: req.params.id },
      data: input,
      ...withCount,
    });
    const auth = req.auth!;
    if (input.statut !== undefined && before && input.statut !== before.statut) {
      logActivityAsync({ organizationId: auth.organizationId, chantierId, userId: auth.userId, action: "POINT_STATUT_MODIFIE", description: `${point.identifiant} : ${before.statut} → ${point.statut}`, metadata: { pointId: point.id, pointIdentifiant: point.identifiant, previousStatut: before.statut, newStatut: point.statut } });
    } else {
      logActivityAsync({ organizationId: auth.organizationId, chantierId, userId: auth.userId, action: "POINT_MODIFIE", description: point.identifiant, metadata: { pointId: point.id, pointIdentifiant: point.identifiant } });
    }
    res.json({ point: toPointDTO(point) });
  })
);

pointsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await assertPointAccess(req.params.id, req.auth!);
    await prisma.point.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);
