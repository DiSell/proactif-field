import path from "path";
import { BlocagePhotoRole, BlocagePriorite, BlocageStatut } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db";
import { requireAuth } from "../../middleware/auth";
import { HttpError } from "../../middleware/errorHandler";
import { uploadPhoto } from "../../middleware/upload";
import { asyncHandler } from "../../utils/asyncHandler";
import { assertBlocageAccess, assertChantierAccess, assertPointAccess } from "../../utils/access";
import { toBlocageDTO } from "./mapper";
import { logActivity } from "../activity/service";

const relations = { include: { point: { select: { identifiant: true } }, createdBy: { select: { name: true } }, resolvedBy: { select: { name: true } }, photos: { orderBy: { takenAt: "asc" as const } } } } as const;
const coordinate = z.number().min(0).max(1);
const tracePointSchema = z.object({ x: coordinate, y: coordinate, gpsLat: z.number().nullable(), gpsLng: z.number().nullable(), gpsAccuracy: z.number().nonnegative().nullable() });
const createSchema = z.object({ id: z.string().min(1).optional(), titre: z.string().trim().min(1).max(160), description: z.string().trim().min(1).max(3000), priorite: z.nativeEnum(BlocagePriorite).default(BlocagePriorite.NORMALE), startX: coordinate.optional(), startY: coordinate.optional(), endX: coordinate.optional(), endY: coordinate.optional(), flexionPoints: z.array(tracePointSchema).max(50).default([]), startGpsLat: z.number().nullable().optional(), startGpsLng: z.number().nullable().optional(), startGpsAccuracy: z.number().nonnegative().nullable().optional(), endGpsLat: z.number().nullable().optional(), endGpsLng: z.number().nullable().optional(), endGpsAccuracy: z.number().nonnegative().nullable().optional() });
const updateSchema = z.object({ titre: z.string().trim().min(1).max(160).optional(), description: z.string().trim().min(1).max(3000).optional(), priorite: z.nativeEnum(BlocagePriorite).optional(), statut: z.nativeEnum(BlocageStatut).optional() });
const photoMetaSchema = z.object({ takenAt: z.string().datetime(), gpsLat: z.coerce.number().nullable().optional(), gpsLng: z.coerce.number().nullable().optional(), gpsAccuracy: z.coerce.number().nullable().optional(), blocageRole: z.nativeEnum(BlocagePhotoRole).default(BlocagePhotoRole.BLOCAGE) });

function gpsDistanceMeters(aLat?: number | null, aLng?: number | null, bLat?: number | null, bLng?: number | null): number | null {
  if (aLat == null || aLng == null || bLat == null || bLng == null) return null;
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(bLat - aLat); const dLng = rad(bLng - aLng);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function traceDistanceMeters(input: z.infer<typeof createSchema>): number | null {
  const positions = [
    { lat: input.startGpsLat, lng: input.startGpsLng },
    ...input.flexionPoints.map((point) => ({ lat: point.gpsLat, lng: point.gpsLng })),
    { lat: input.endGpsLat, lng: input.endGpsLng },
  ];
  let total = 0;
  for (let index = 1; index < positions.length; index += 1) {
    const segment = gpsDistanceMeters(positions[index - 1].lat, positions[index - 1].lng, positions[index].lat, positions[index].lng);
    if (segment == null) return null;
    total += segment;
  }
  return total;
}

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
    const created = await tx.blocage.create({ data: { ...input, distanceMeters: traceDistanceMeters(input), pointId: req.params.id, chantierId: plan.chantier.id, organizationId: plan.chantier.organizationId, createdById: req.auth!.userId }, ...relations });
    await logActivity({ organizationId: plan.chantier.organizationId, chantierId: plan.chantier.id, userId: req.auth!.userId, action: "BLOCAGE_CREE", description: `${created.titre} · ${created.point.identifiant}`, metadata: { blocageId: created.id, pointId: created.pointId, pointIdentifiant: created.point.identifiant } }, tx);
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
    const action = input.statut === BlocageStatut.RESOLU ? "BLOCAGE_RESOLU" : "BLOCAGE_MODIFIE";
    await logActivity({ organizationId: req.auth!.organizationId, chantierId: access.chantierId, userId: req.auth!.userId, action, description: `${updated.titre} · ${updated.point.identifiant}`, metadata: { blocageId: updated.id, pointId: updated.pointId, pointIdentifiant: updated.point.identifiant } }, tx);
    return updated;
  });
  res.json({ blocage: toBlocageDTO(blocage) });
}));
blocagesRouter.post("/:id/photos", uploadPhoto.single("file"), asyncHandler(async (req, res) => {
  const access = await assertBlocageAccess(req.params.id, req.auth!);
  if (!req.file) throw new HttpError(400, "Aucun fichier reçu");
  const input = photoMetaSchema.parse(req.body);
  const photo = await prisma.photo.create({ data: { pointId: access.pointId, blocageId: req.params.id, blocageRole: input.blocageRole, filePath: path.join("photos", req.file.filename), takenAt: new Date(input.takenAt), gpsLat: input.gpsLat ?? null, gpsLng: input.gpsLng ?? null, gpsAccuracy: input.gpsAccuracy ?? null } });
  res.status(201).json({ photo: { id: photo.id, pointId: photo.pointId, blocageId: photo.blocageId, blocageRole: photo.blocageRole, takenAt: photo.takenAt.toISOString(), gpsLat: photo.gpsLat, gpsLng: photo.gpsLng, gpsAccuracy: photo.gpsAccuracy, createdAt: photo.createdAt.toISOString() } });
}));
