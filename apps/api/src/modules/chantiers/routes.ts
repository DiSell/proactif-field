import { Router } from "express";
import { z } from "zod";
import { ChantierStatut } from "@prisma/client";
import { prisma } from "../../config/db";
import { requireAdmin, requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { HttpError } from "../../middleware/errorHandler";
import { toChantierDTO } from "./mapper";
import { toPointDTO } from "../points/mapper";
import { toBlocageDTO } from "../blocages/mapper";
import { toPhotoDTO } from "../photos/mapper";
import { assertChantierAccess } from "../../utils/access";
import { toPlanDTO } from "../plans/mapper";
import { notifyChantierAssignment } from "../push/service";
import { logActivityAsync } from "../activity/service";
import { toMaterielDTO } from "../materiel/mapper";

const withAssignments = { include: { assignments: true, responsable: true } } as const;

// References are never reused after a deletion. Looking at the highest
// numeric suffix also avoids the count+1 collision (CH-0001 deleted while
// CH-0002 still exists). The unique database constraint remains the final
// guard against two concurrent creations.
async function nextChantierReference(organizationId: string): Promise<string> {
  const references = await prisma.chantier.findMany({
    where: { organizationId, reference: { startsWith: "CH-" } },
    select: { reference: true },
  });
  const highest = references.reduce((max, { reference }) => {
    const match = /^CH-(\d+)$/.exec(reference);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `CH-${String(highest + 1).padStart(4, "0")}`;
}

export const chantiersRouter = Router();
chantiersRouter.use(requireAuth);

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  address: z.string().optional(),
  client: z.string().optional(),
  entrepriseExecutante: z.string().optional(),
  dateDebutPrevue: z.string().datetime().optional(),
  dateFinPrevue: z.string().datetime().optional(),
  responsableId: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  client: z.string().nullable().optional(),
  entrepriseExecutante: z.string().nullable().optional(),
  dateDebutPrevue: z.string().datetime().nullable().optional(),
  dateFinPrevue: z.string().datetime().nullable().optional(),
  responsableId: z.string().nullable().optional(),
  statut: z.nativeEnum(ChantierStatut).optional(),
});

async function assertResponsableInOrg(responsableId: string | null | undefined, organizationId: string) {
  if (!responsableId) return;
  const user = await prisma.user.findUnique({ where: { id: responsableId } });
  if (!user || user.organizationId !== organizationId) {
    throw new HttpError(404, "Responsable introuvable");
  }
}

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
    res.json({ chantiers: chantiers.map((c) => toChantierDTO(c, auth.userId)) });
  })
);

chantiersRouter.get(
  "/:id/sync",
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    await assertChantierAccess(req.params.id, auth);
    const [chantier, plans, points, blocages, photos, materiels] = await Promise.all([
      prisma.chantier.findUnique({ where: { id: req.params.id }, ...withAssignments }),
      prisma.plan.findMany({ where: { chantierId: req.params.id }, orderBy: { uploadedAt: "asc" } }),
      prisma.point.findMany({ where: { plan: { chantierId: req.params.id } }, orderBy: { createdAt: "asc" }, include: { _count: { select: { photos: { where: { blocageId: null } }, blocages: { where: { statut: "OUVERT" } } } } } }),
      prisma.blocage.findMany({ where: { chantierId: req.params.id }, orderBy: { createdAt: "asc" }, include: { point: { select: { identifiant: true } }, createdBy: { select: { name: true } }, resolvedBy: { select: { name: true } }, photos: { orderBy: { takenAt: "asc" } } } }),
      prisma.photo.findMany({ where: { point: { plan: { chantierId: req.params.id } } }, orderBy: { takenAt: "asc" } }),
      prisma.materiel.findMany({ where: { chantierId: req.params.id }, orderBy: { createdAt: "asc" }, include: { createdBy: { select: { name: true } }, updatedBy: { select: { name: true } } } }),
    ]);
    if (!chantier) throw new HttpError(404, "Chantier introuvable");
    res.json({ chantier: toChantierDTO(chantier, auth.userId), plans: plans.map(toPlanDTO), points: points.map(toPointDTO), blocages: blocages.map(toBlocageDTO), photos: photos.map(toPhotoDTO), materiels: materiels.map(toMaterielDTO), syncedAt: new Date().toISOString() });
  })
);

chantiersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const auth = req.auth!;
    const organizationId = auth.organizationId;
    await assertResponsableInOrg(input.responsableId, organizationId);
    const reference = await nextChantierReference(organizationId);
    const chantier = await prisma.chantier.create({
      data: {
        ...input,
        dateDebutPrevue: input.dateDebutPrevue ? new Date(input.dateDebutPrevue) : undefined,
        dateFinPrevue: input.dateFinPrevue ? new Date(input.dateFinPrevue) : undefined,
        reference,
        createdById: req.auth!.userId,
        organizationId,
        assignments: auth.role === "TECHNICIEN" ? { create: { userId: auth.userId, seenAt: new Date() } } : undefined,
      },
      ...withAssignments,
    });
    logActivityAsync({ organizationId, chantierId: chantier.id, userId: req.auth!.userId, action: "CHANTIER_CREE" });
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
    res.json({ chantier: toChantierDTO(chantier, auth.userId) });
  })
);

// Any authenticated user marks their own assignment as seen (clears the
// "Nouveau" badge) — no admin requirement, this only affects the caller's
// own row.
chantiersRouter.post(
  "/:id/assignments/seen",
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    await prisma.chantierAssignment.updateMany({
      where: { chantierId: req.params.id, userId: auth.userId, seenAt: null },
      data: { seenAt: new Date() },
    });
    res.status(204).send();
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
    await assertResponsableInOrg(input.responsableId, req.auth!.organizationId);
    const chantier = await prisma.chantier.update({
      where: { id: req.params.id },
      data: {
        ...input,
        dateDebutPrevue:
          input.dateDebutPrevue !== undefined
            ? input.dateDebutPrevue === null
              ? null
              : new Date(input.dateDebutPrevue)
            : undefined,
        dateFinPrevue:
          input.dateFinPrevue !== undefined
            ? input.dateFinPrevue === null
              ? null
              : new Date(input.dateFinPrevue)
            : undefined,
      },
      ...withAssignments,
    });
    logActivityAsync({ organizationId: req.auth!.organizationId, chantierId: chantier.id, userId: req.auth!.userId, action: "CHANTIER_MODIFIE" });
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
    const existingAssignment = await prisma.chantierAssignment.findUnique({ where: { chantierId_userId: { chantierId: chantier.id, userId } } });
    await prisma.chantierAssignment.upsert({
      where: { chantierId_userId: { chantierId: chantier.id, userId } },
      update: {},
      create: { chantierId: chantier.id, userId },
    });
    if (!existingAssignment) {
      if (user.role === "TECHNICIEN") void notifyChantierAssignment(userId, chantier).catch((error) => console.error("Notification d'affectation impossible", error));
      logActivityAsync({ organizationId: auth.organizationId, chantierId: chantier.id, userId: auth.userId, action: "TECHNICIEN_AFFECTE", description: user.name, metadata: { technicianId: user.id, technicianName: user.name } });
    }
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
    const deleted = await prisma.chantierAssignment
      .delete({ where: { chantierId_userId: { chantierId: chantier.id, userId: req.params.userId } } })
      .catch(() => null);
    if (deleted) {
      const technician = await prisma.user.findUnique({ where: { id: req.params.userId }, select: { name: true } });
      logActivityAsync({ organizationId: auth.organizationId, chantierId: chantier.id, userId: auth.userId, action: "TECHNICIEN_DESAFFECTE", description: technician?.name, metadata: { technicianId: req.params.userId, technicianName: technician?.name ?? "" } });
    }
    const updated = await prisma.chantier.findUnique({ where: { id: chantier.id }, ...withAssignments });
    res.json({ chantier: toChantierDTO(updated!) });
  })
);
