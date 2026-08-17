import { Router } from "express";
import { z } from "zod";
import path from "path";
import { prisma } from "../../config/db";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { HttpError } from "../../middleware/errorHandler";
import { uploadPhoto } from "../../middleware/upload";
import { toPhotoDTO } from "./mapper";
import { deleteFile } from "../../utils/storage";

const metaSchema = z.object({
  takenAt: z.string().datetime(),
  gpsLat: z.coerce.number().nullable().optional(),
  gpsLng: z.coerce.number().nullable().optional(),
  gpsAccuracy: z.coerce.number().nullable().optional(),
});

export const pointPhotosRouter = Router({ mergeParams: true });
pointPhotosRouter.use(requireAuth);

pointPhotosRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const photos = await prisma.photo.findMany({
      where: { pointId: req.params.id },
      orderBy: { takenAt: "asc" },
    });
    res.json({ photos: photos.map(toPhotoDTO) });
  })
);

pointPhotosRouter.post(
  "/",
  uploadPhoto.single("file"),
  asyncHandler(async (req, res) => {
    const point = await prisma.point.findUnique({ where: { id: req.params.id } });
    if (!point) throw new HttpError(404, "Point introuvable");
    if (!req.file) throw new HttpError(400, "Aucun fichier reçu");

    const input = metaSchema.parse(req.body);

    const photo = await prisma.photo.create({
      data: {
        pointId: point.id,
        filePath: path.join("photos", req.file.filename),
        takenAt: new Date(input.takenAt),
        gpsLat: input.gpsLat ?? null,
        gpsLng: input.gpsLng ?? null,
        gpsAccuracy: input.gpsAccuracy ?? null,
      },
    });

    if (point.statut === "GRIS") {
      await prisma.point.update({ where: { id: point.id }, data: { statut: "ORANGE" } });
    }

    res.status(201).json({ photo: toPhotoDTO(photo) });
  })
);

export const photosRouter = Router();
photosRouter.use(requireAuth);

photosRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const photo = await prisma.photo.findUnique({ where: { id: req.params.id } });
    if (!photo) throw new HttpError(404, "Photo introuvable");
    await prisma.photo.delete({ where: { id: req.params.id } });
    deleteFile(photo.filePath);
    res.status(204).send();
  })
);
