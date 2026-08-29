import { Router } from "express";
import { z } from "zod";
import path from "path";
import { prisma } from "../../config/db";
import { requireAdmin, requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { HttpError } from "../../middleware/errorHandler";
import { uploadDocument } from "../../middleware/upload";
import { assertChantierAccess, assertDocumentAccess } from "../../utils/access";
import { decodeOriginalFilename, deleteFile } from "../../utils/storage";
import { toDocumentDTO } from "./mapper";
import { logActivityAsync } from "../activity/service";

const withUploader = { include: { uploadedBy: true } } as const;

const metaSchema = z.object({
  category: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  version: z.string().max(50).optional(),
  date: z.string().datetime().optional(),
  author: z.string().max(200).optional(),
  commentaire: z.string().max(2000).optional(),
});

// Anyone with chantier access can view and add field documents. Deletion
// stays ADMIN-only so a technician cannot remove the shared library.
export const chantierDocumentsRouter = Router({ mergeParams: true });
chantierDocumentsRouter.use(requireAuth);

chantierDocumentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    await assertChantierAccess(req.params.id, req.auth!);
    const documents = await prisma.document.findMany({
      where: { chantierId: req.params.id },
      orderBy: { createdAt: "desc" },
      ...withUploader,
    });
    res.json({ documents: documents.map(toDocumentDTO) });
  })
);

chantierDocumentsRouter.post(
  "/",
  uploadDocument.single("file"),
  asyncHandler(async (req, res) => {
    await assertChantierAccess(req.params.id, req.auth!);
    if (!req.file) throw new HttpError(400, "Aucun fichier reçu");
    const input = metaSchema.parse(req.body);

    const document = await prisma.document.create({
      data: {
        chantierId: req.params.id,
        category: input.category,
        name: input.name,
        version: input.version,
        date: input.date ? new Date(input.date) : undefined,
        author: input.author,
        commentaire: input.commentaire,
        fileName: decodeOriginalFilename(req.file.originalname),
        filePath: path.join("documents", req.file.filename),
        uploadedById: req.auth!.userId,
      },
      ...withUploader,
    });
    logActivityAsync({ organizationId: req.auth!.organizationId, chantierId: req.params.id, userId: req.auth!.userId, action: "DOCUMENT_AJOUTE", description: document.name, metadata: { documentId: document.id, documentName: document.name } });
    res.status(201).json({ document: toDocumentDTO(document) });
  })
);

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

documentsRouter.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    await assertDocumentAccess(req.params.id, req.auth!);
    const document = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!document) throw new HttpError(404, "Document introuvable");
    await prisma.document.delete({ where: { id: req.params.id } });
    deleteFile(document.filePath);
    res.status(204).send();
  })
);
