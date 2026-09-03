import { Router } from "express";
import { z } from "zod";
import path from "path";
import { prisma } from "../../config/db";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { HttpError } from "../../middleware/errorHandler";
import { uploadRapportTerrainPhoto } from "../../middleware/upload";
import { deleteFile } from "../../utils/storage";
import {
  assertRapportTerrainAccess,
  assertRapportTerrainItemAccess,
  assertRapportTerrainPhotoAccess,
} from "../../utils/access";
import { toRapportTerrainDTO, toRapportTerrainItemDTO, toRapportTerrainPdfDTO } from "./mapper";
import { logRapportTerrainActivityAsync } from "./activity";
import { generateFieldReportPdf } from "./service";
import { reverseGeocode } from "./geocoding";
import { streamFieldReportExport } from "./export";

const withRelations = {
  include: {
    createdBy: true,
    items: { include: { photos: { orderBy: { takenAt: "asc" } as const }, createdBy: true }, orderBy: { createdAt: "asc" as const } },
  },
} as const;

const nullableNumber = z.number().nullable().optional();
const nullableString = z.string().trim().max(500).nullable().optional();

const createRapportSchema = z.object({
  id: z.string().min(1).optional(),
  nom: z.string().trim().min(1).max(200),
  typeTravaux: nullableString,
  observation: z.string().trim().max(5000).nullable().optional(),
  latitude: nullableNumber,
  longitude: nullableNumber,
  gpsAccuracy: nullableNumber,
  lieu: nullableString,
});

const updateRapportSchema = z.object({
  nom: z.string().trim().min(1).max(200).optional(),
  typeTravaux: nullableString,
  observation: z.string().trim().max(5000).nullable().optional(),
  latitude: nullableNumber,
  longitude: nullableNumber,
  gpsAccuracy: nullableNumber,
  lieu: nullableString,
});

const createItemSchema = z.object({
  id: z.string().min(1).optional(),
  titre: nullableString,
  commentaire: z.string().trim().max(2000).nullable().optional(),
  latitude: nullableNumber,
  longitude: nullableNumber,
  gpsAccuracy: nullableNumber,
  capturedAt: z.string().datetime().optional(),
});

const updateItemSchema = z.object({
  titre: nullableString,
  commentaire: z.string().trim().max(2000).nullable().optional(),
});

const photoMetaSchema = z.object({
  id: z.string().min(1).optional(),
  takenAt: z.string().datetime(),
  gpsLat: z.coerce.number().nullable().optional(),
  gpsLng: z.coerce.number().nullable().optional(),
  gpsAccuracy: z.coerce.number().nullable().optional(),
});

// GET/POST /api/rapports-terrain and GET/PATCH/DELETE /api/rapports-terrain/:id.
// List/detail scoping (ADMIN sees the whole organization, TECHNICIEN only
// their own) lives in assertRapportTerrainAccess, mirroring how
// assertChantierAccess scopes TECHNICIEN by assignment.
export const rapportsTerrainRouter = Router();
rapportsTerrainRouter.use(requireAuth);

rapportsTerrainRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const rapports = await prisma.rapportTerrain.findMany({
      where: {
        organizationId: auth.organizationId,
        ...(auth.role === "TECHNICIEN" ? { createdById: auth.userId } : {}),
      },
      orderBy: { createdAt: "desc" },
      ...withRelations,
    });
    res.json({ rapportsTerrain: rapports.map(toRapportTerrainDTO) });
  })
);

rapportsTerrainRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const input = createRapportSchema.parse(req.body);

    let lieu = input.lieu ?? null;
    if (!lieu && input.latitude != null && input.longitude != null) {
      try {
        const geocoded = await reverseGeocode(input.latitude, input.longitude);
        lieu = geocoded?.label ?? null;
      } catch (error) {
        console.error("Reverse geocoding indisponible, rapport créé sans lieu", error);
      }
    }

    const rapport = await prisma.rapportTerrain.create({
      data: {
        id: input.id,
        organizationId: auth.organizationId,
        createdById: auth.userId,
        nom: input.nom,
        typeTravaux: input.typeTravaux ?? null,
        observation: input.observation ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        gpsAccuracy: input.gpsAccuracy ?? null,
        lieu,
      },
      ...withRelations,
    });
    logRapportTerrainActivityAsync({ organizationId: auth.organizationId, rapportTerrainId: rapport.id, userId: auth.userId, action: "RAPPORT_TERRAIN_CREE", description: rapport.nom });
    res.status(201).json({ rapportTerrain: toRapportTerrainDTO(rapport) });
  })
);

rapportsTerrainRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    await assertRapportTerrainAccess(req.params.id, req.auth!);
    const rapport = await prisma.rapportTerrain.findUnique({ where: { id: req.params.id }, ...withRelations });
    if (!rapport) throw new HttpError(404, "Rapport terrain introuvable");
    res.json({ rapportTerrain: toRapportTerrainDTO(rapport) });
  })
);

// Full-fidelity export (.zip: original photos + a plain-text info file) —
// for handing the report to someone who has no account and just needs the
// raw material for their own folder. See export.ts for the rationale.
rapportsTerrainRouter.get(
  "/:id/export",
  asyncHandler(async (req, res) => {
    await assertRapportTerrainAccess(req.params.id, req.auth!);
    await streamFieldReportExport(req.params.id, res);
  })
);

rapportsTerrainRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    await assertRapportTerrainAccess(req.params.id, auth);
    const input = updateRapportSchema.parse(req.body);
    const rapport = await prisma.rapportTerrain.update({ where: { id: req.params.id }, data: input, ...withRelations });
    logRapportTerrainActivityAsync({ organizationId: auth.organizationId, rapportTerrainId: rapport.id, userId: auth.userId, action: "RAPPORT_TERRAIN_MODIFIE", description: rapport.nom });
    res.json({ rapportTerrain: toRapportTerrainDTO(rapport) });
  })
);

rapportsTerrainRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    await assertRapportTerrainAccess(req.params.id, auth);
    await prisma.rapportTerrain.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

rapportsTerrainRouter.post(
  "/:id/items",
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    await assertRapportTerrainAccess(req.params.id, auth);
    const input = createItemSchema.parse(req.body);
    const item = await prisma.rapportTerrainItem.create({
      data: {
        id: input.id,
        rapportTerrainId: req.params.id,
        organizationId: auth.organizationId,
        createdById: auth.userId,
        titre: input.titre ?? null,
        commentaire: input.commentaire ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        gpsAccuracy: input.gpsAccuracy ?? null,
        capturedAt: input.capturedAt ? new Date(input.capturedAt) : undefined,
      },
      include: { photos: true, createdBy: true },
    });
    // Touch the parent so its updatedAt reflects the latest field activity.
    await prisma.rapportTerrain.update({ where: { id: req.params.id }, data: { updatedAt: new Date() } });
    logRapportTerrainActivityAsync({ organizationId: auth.organizationId, rapportTerrainId: req.params.id, userId: auth.userId, action: "RAPPORT_TERRAIN_ITEM_AJOUTE", metadata: { itemId: item.id, itemTitre: item.titre } });
    res.status(201).json({ item: toRapportTerrainItemDTO(item) });
  })
);

// PATCH /api/rapports-terrain/items/:id and POST /api/rapports-terrain/items/:id/photos.
export const rapportTerrainItemsRouter = Router();
rapportTerrainItemsRouter.use(requireAuth);

rapportTerrainItemsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    await assertRapportTerrainItemAccess(req.params.id, auth);
    const input = updateItemSchema.parse(req.body);
    const item = await prisma.rapportTerrainItem.update({ where: { id: req.params.id }, data: input, include: { photos: { orderBy: { takenAt: "asc" } }, createdBy: true } });
    res.json({ item: toRapportTerrainItemDTO(item) });
  })
);

rapportTerrainItemsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const { rapportTerrainId } = await assertRapportTerrainItemAccess(req.params.id, auth);
    const item = await prisma.rapportTerrainItem.findUnique({ where: { id: req.params.id }, select: { titre: true } });
    // Cascades to its photos (schema.prisma) — matches Point's own delete,
    // which doesn't clean up files on disk either (see modules/points/routes.ts).
    await prisma.rapportTerrainItem.delete({ where: { id: req.params.id } });
    await prisma.rapportTerrain.update({ where: { id: rapportTerrainId }, data: { updatedAt: new Date() } });
    logRapportTerrainActivityAsync({ organizationId: auth.organizationId, rapportTerrainId, userId: auth.userId, action: "RAPPORT_TERRAIN_ITEM_SUPPRIME", metadata: { itemId: req.params.id, itemTitre: item?.titre } });
    res.status(204).send();
  })
);

rapportTerrainItemsRouter.post(
  "/:id/photos",
  uploadRapportTerrainPhoto.single("file"),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const { rapportTerrainId } = await assertRapportTerrainItemAccess(req.params.id, auth);
    if (!req.file) throw new HttpError(400, "Aucun fichier reçu");
    const input = photoMetaSchema.parse(req.body);

    const photo = await prisma.rapportTerrainPhoto.create({
      data: {
        id: input.id,
        rapportTerrainItemId: req.params.id,
        filePath: path.join("rapport-terrain-photos", req.file.filename),
        takenAt: new Date(input.takenAt),
        gpsLat: input.gpsLat ?? null,
        gpsLng: input.gpsLng ?? null,
        gpsAccuracy: input.gpsAccuracy ?? null,
      },
    });
    const item = await prisma.rapportTerrainItem.findUnique({ where: { id: req.params.id }, select: { titre: true } });
    logRapportTerrainActivityAsync({ organizationId: auth.organizationId, rapportTerrainId, userId: auth.userId, action: "RAPPORT_TERRAIN_PHOTO_AJOUTEE", metadata: { itemId: req.params.id, itemTitre: item?.titre } });
    res.status(201).json({ photo: { id: photo.id, rapportTerrainItemId: photo.rapportTerrainItemId, takenAt: photo.takenAt.toISOString(), gpsLat: photo.gpsLat, gpsLng: photo.gpsLng, gpsAccuracy: photo.gpsAccuracy, createdAt: photo.createdAt.toISOString() } });
  })
);

// DELETE /api/rapports-terrain/photos/:id.
export const rapportTerrainPhotosRouter = Router();
rapportTerrainPhotosRouter.use(requireAuth);

rapportTerrainPhotosRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const { rapportTerrainId } = await assertRapportTerrainPhotoAccess(req.params.id, auth);
    const photo = await prisma.rapportTerrainPhoto.findUnique({ where: { id: req.params.id } });
    if (!photo) throw new HttpError(404, "Photo introuvable");
    await prisma.rapportTerrainPhoto.delete({ where: { id: req.params.id } });
    // Matches modules/photos/routes.ts: a photo's file is removed from disk
    // on delete (unlike whole-item/whole-report delete, which only cascade
    // the DB rows — see the item DELETE handler above).
    deleteFile(photo.filePath);
    await prisma.rapportTerrain.update({ where: { id: rapportTerrainId }, data: { updatedAt: new Date() } });
    res.status(204).send();
  })
);

// POST/GET /api/rapports-terrain/:id/pdf — generate and list generated PDFs.
export const rapportTerrainPdfRouter = Router({ mergeParams: true });
rapportTerrainPdfRouter.use(requireAuth);

rapportTerrainPdfRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    await assertRapportTerrainAccess(req.params.id, req.auth!);
    const pdf = await generateFieldReportPdf(req.params.id, req.auth!.userId);
    res.status(201).json({ pdf: toRapportTerrainPdfDTO(pdf) });
  })
);

rapportTerrainPdfRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    await assertRapportTerrainAccess(req.params.id, req.auth!);
    const pdfs = await prisma.rapportTerrainPdf.findMany({ where: { rapportTerrainId: req.params.id }, orderBy: { generatedAt: "desc" }, include: { generatedBy: true } });
    res.json({ pdfs: pdfs.map(toRapportTerrainPdfDTO) });
  })
);
