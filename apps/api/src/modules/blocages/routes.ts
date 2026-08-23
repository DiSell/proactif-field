import path from "path";
import { BlocagePriorite, BlocageStatut } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db";
import { requireAuth } from "../../middleware/auth";
import { HttpError } from "../../middleware/errorHandler";
import { uploadPhoto } from "../../middleware/upload";
import { asyncHandler } from "../../utils/asyncHandler";
import { assertBlocageAccess, assertChantierAccess, assertPointAccess } from "../../utils/access";
import { toBlocageDTO } from "./mapper";

const relations = { include: { point: { select: { identifiant: true } }, createdBy: { select: { name: true } }, resolvedBy: { select: { name: true } }, photos: { orderBy: { takenAt: "asc" as const } } } } as const;
const createSchema = z.object({ id: z.string().min(1).optional(), titre: z.string().trim().min(1).max(160), description: z.string().trim().min(1).max(3000), priorite: z.nativeEnum(BlocagePriorite).default(BlocagePriorite.NORMALE) });
const updateSchema = z.object({ titre: z.string().trim().min(1).max(160).optional(), description: z.string().trim().min(1).max(3000).optional(), priorite: z.nativeEnum(BlocagePriorite).optional(), statut: z.nativeEnum(BlocageStatut).optional() });
const photoMetaSchema = z.object({ takenAt: z.string().datetime(), gpsLat: z.coerce.number().nullable().optional(), gpsLng: z.coerce.number().nullable().optional(), gpsAccuracy: z.coerce.number().nullable().optional() });

export const chantierBlocagesRouter = Router({ mergeParams: true });
chantierBlocagesRouter.use(requireAuth);
chantierBlocagesRouter.get("/", asyncHandler(async (req, res) => {
  await assertChantierAccess(req.params.id, req.auth!);
  const statut = req.query.statut ? z.nativeEnum(BlocageStatut).parse(req.query.statut) : undefined;
  const blocages = await prisma.blocage.findMany({ where: { chantierId: req.params.id, ...(statut ? { statut } : {}) }, orderBy: { createdAt: "desc" }, ...relations });
  res.json({ blocages: blocages.map(toBlocageDTO) });
}));

export const pointBlocagesRouter = Router({ mergeParams: true });
pointBlocagesRouter.use(requireAuth);
pointBlocagesRouter.get("/", asyncHandler(async (req, res) => {
  await assertPointAccess(req.params.id, req.auth!);
  const blocages = await prisma.blocage.findMany({ where: { pointId: req.params.id }, orderBy: { createdAt: "desc" }, ...relations });
  res.json({ blocages: blocages.map(toBlocageDTO) });
}));
pointBlocagesRouter.post("/", asyncHandler(async (req, res) => {
  const { planId } = await assertPointAccess(req.params.id, req.auth!);
  const input = createSchema.parse(req.body);
  const plan = await prisma.plan.findUnique({ where: { id: planId }, include: { chantier: { select: { id: true, organizationId: true } } } });
  if (!plan) throw new HttpError(404, "Point introuvable");
  const blocage = await prisma.$transaction(async (tx) => {
    const created = await tx.blocage.create({ data: { ...input, pointId: req.params.id, chantierId: plan.chantier.id, organizationId: plan.chantier.organizationId, createdById: req.auth!.userId }, ...relations });
    await tx.activityLog.create({ data: { chantierId: plan.chantier.id, userId: req.auth!.userId, action: "BLOCAGE_CREE", description: `${created.titre} · ${created.point.identifiant}` } });
    return created;
  });
  res.status(201).json({ blocage: toBlocageDTO(blocage) });
}));

export const blocagesRouter = Router();
blocagesRouter.use(requireAuth);
blocagesRouter.get("/:id", asyncHandler(async (req, res) => {
  await assertBlocageAccess(req.params.id, req.auth!);
  const blocage = await prisma.blocage.findUnique({ where: { id: req.params.id }, ...relations });
  if (!blocage) throw new HttpError(404, "Blocage introuvable");
  res.json({ blocage: toBlocageDTO(blocage) });
}));
blocagesRouter.patch("/:id", asyncHandler(async (req, res) => {
  const access = await assertBlocageAccess(req.params.id, req.auth!);
  const input = updateSchema.parse(req.body);
  const blocage = await prisma.$transaction(async (tx) => {
    const updated = await tx.blocage.update({ where: { id: req.params.id }, data: { ...input, ...(input.statut === BlocageStatut.RESOLU ? { resolvedAt: new Date(), resolvedById: req.auth!.userId } : input.statut === BlocageStatut.OUVERT ? { resolvedAt: null, resolvedById: null } : {}) }, ...relations });
    await tx.activityLog.create({ data: { chantierId: access.chantierId, userId: req.auth!.userId, action: input.statut === BlocageStatut.RESOLU ? "BLOCAGE_RESOLU" : "BLOCAGE_MODIFIE", description: `${updated.titre} · ${updated.point.identifiant}` } });
    return updated;
  });
  res.json({ blocage: toBlocageDTO(blocage) });
}));
blocagesRouter.post("/:id/photos", uploadPhoto.single("file"), asyncHandler(async (req, res) => {
  const access = await assertBlocageAccess(req.params.id, req.auth!);
  if (!req.file) throw new HttpError(400, "Aucun fichier reçu");
  const input = photoMetaSchema.parse(req.body);
  const photo = await prisma.photo.create({ data: { pointId: access.pointId, blocageId: req.params.id, filePath: path.join("photos", req.file.filename), takenAt: new Date(input.takenAt), gpsLat: input.gpsLat ?? null, gpsLng: input.gpsLng ?? null, gpsAccuracy: input.gpsAccuracy ?? null } });
  res.status(201).json({ photo: { id: photo.id, pointId: photo.pointId, blocageId: photo.blocageId, takenAt: photo.takenAt.toISOString(), gpsLat: photo.gpsLat, gpsLng: photo.gpsLng, gpsAccuracy: photo.gpsAccuracy, createdAt: photo.createdAt.toISOString() } });
}));
