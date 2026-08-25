import { Router } from "express";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "../../config/db";
import { requireAdmin, requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { HttpError } from "../../middleware/errorHandler";
import { assertChantierAccess, assertMaterielAccess } from "../../utils/access";
import { logActivityAsync } from "../activity/service";
import { toMaterielDTO } from "./mapper";

const withNames = { include: { createdBy: { select: { name: true } }, updatedBy: { select: { name: true } } } } as const;

const quantity = z.number().min(0).nullable().optional();

const createSchema = z.object({
  reference: z.string().trim().max(100).optional(),
  designation: z.string().trim().min(1).max(200),
  quantitePrevue: quantity,
  quantiteUtilisee: quantity,
  unite: z.string().trim().max(30).optional(),
  commentaire: z.string().trim().max(1000).optional(),
});

const updateSchemaAdmin = z.object({
  reference: z.string().trim().max(100).nullable().optional(),
  designation: z.string().trim().min(1).max(200).optional(),
  quantitePrevue: quantity,
  quantiteUtilisee: quantity,
  unite: z.string().trim().max(30).nullable().optional(),
  commentaire: z.string().trim().max(1000).nullable().optional(),
});

// TECHNICIEN records field reality — what was actually used, and why —
// without opening the administrative form. Everything else on a Materiel
// row (designation, reference, quantitePrevue, unite) stays ADMIN-only.
const updateSchemaTechnicien = z.object({
  quantiteUtilisee: quantity,
  commentaire: z.string().trim().max(1000).nullable().optional(),
});

// Viewable by anyone with chantier access (technicians need to see and
// record what's actually being used in the field); only ADMIN manages the
// list itself — same split as documents/plans.
export const chantierMaterielRouter = Router({ mergeParams: true });
chantierMaterielRouter.use(requireAuth);

chantierMaterielRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    await assertChantierAccess(req.params.id, req.auth!);
    const materiels = await prisma.materiel.findMany({
      where: { chantierId: req.params.id },
      orderBy: { createdAt: "asc" },
      ...withNames,
    });
    res.json({ materiels: materiels.map(toMaterielDTO) });
  })
);

chantierMaterielRouter.post(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    await assertChantierAccess(req.params.id, req.auth!);
    const input = createSchema.parse(req.body);
    const materiel = await prisma.materiel.create({
      data: {
        ...input,
        chantierId: req.params.id,
        organizationId: req.auth!.organizationId,
        createdById: req.auth!.userId,
      },
      ...withNames,
    });
    logActivityAsync({
      organizationId: req.auth!.organizationId,
      chantierId: req.params.id,
      userId: req.auth!.userId,
      action: "MATERIEL_AJOUTE",
      description: materiel.designation,
      metadata: { materielId: materiel.id, designation: materiel.designation, reference: materiel.reference ?? undefined },
    });
    res.status(201).json({ materiel: toMaterielDTO(materiel) });
  })
);

export const materielRouter = Router();
materielRouter.use(requireAuth);

materielRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const { chantierId } = await assertMaterielAccess(req.params.id, req.auth!);
    const isAdmin = req.auth!.role === UserRole.ADMIN;
    const input = isAdmin ? updateSchemaAdmin.parse(req.body) : updateSchemaTechnicien.parse(req.body);

    const before = await prisma.materiel.findUniqueOrThrow({ where: { id: req.params.id } });
    const materiel = await prisma.materiel.update({
      where: { id: req.params.id },
      data: { ...input, updatedById: req.auth!.userId },
      ...withNames,
    });
    logActivityAsync({
      organizationId: req.auth!.organizationId,
      chantierId,
      userId: req.auth!.userId,
      action: "MATERIEL_MODIFIE",
      description: materiel.designation,
      metadata: {
        materielId: materiel.id,
        designation: materiel.designation,
        reference: materiel.reference ?? undefined,
        previousQuantiteUtilisee: before.quantiteUtilisee ?? undefined,
        newQuantiteUtilisee: materiel.quantiteUtilisee ?? undefined,
      },
    });
    res.json({ materiel: toMaterielDTO(materiel) });
  })
);

materielRouter.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { chantierId } = await assertMaterielAccess(req.params.id, req.auth!);
    const materiel = await prisma.materiel.findUnique({ where: { id: req.params.id } });
    if (!materiel) throw new HttpError(404, "Matériel introuvable");
    await prisma.materiel.delete({ where: { id: req.params.id } });
    logActivityAsync({
      organizationId: req.auth!.organizationId,
      chantierId,
      userId: req.auth!.userId,
      action: "MATERIEL_SUPPRIME",
      description: materiel.designation,
      metadata: { materielId: materiel.id, designation: materiel.designation, reference: materiel.reference ?? undefined },
    });
    res.status(204).send();
  })
);
