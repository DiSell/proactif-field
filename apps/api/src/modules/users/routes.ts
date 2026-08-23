import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "../../config/db";
import { requireAdmin, requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { HttpError } from "../../middleware/errorHandler";
import { toUserDTO } from "../auth/mapper";
import crypto from "crypto";
import { createInvitationToken, invitationEmailEnabled, sendTechnicianInvitation } from "../invitations/service";

export const usersRouter = Router();
usersRouter.use(requireAuth, requireAdmin);

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.nativeEnum(UserRole),
  phone: z.string().trim().max(40).optional(),
  employerCompany: z.string().trim().max(160).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  employerCompany: z.string().trim().max(160).nullable().optional(),
});

usersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      where: { organizationId: req.auth!.organizationId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    res.json({ users: users.map(toUserDTO) });
  })
);

usersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new HttpError(409, "Un compte existe déjà avec cet email");
    }
    if (!invitationEmailEnabled) throw new HttpError(503, "Configurez l'envoi d'e-mails avant d'inviter un utilisateur");
    const invitation = createInvitationToken();
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("base64url"), 10);
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash, isActive: false, inviteTokenHash: invitation.hash, inviteExpiresAt: invitation.expiresAt, invitedAt: new Date(), invitationAcceptedAt: null,
        role: input.role,
        phone: input.phone || null,
        employerCompany: input.employerCompany || null,
        organizationId: req.auth!.organizationId,
      },
    });
    const organization = await prisma.organization.findUnique({ where: { id: req.auth!.organizationId }, select: { name: true, contactEmail: true } });
    await sendTechnicianInvitation({ email: user.email, name: user.name, role: user.role, organizationName: organization?.name ?? "Votre entreprise", contactEmail: organization?.contactEmail, token: invitation.raw });
    res.status(201).json({ user: toUserDTO(user) });
  })
);

usersRouter.post("/:id/resend-invitation", asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, include: { organization: { select: { name: true, contactEmail: true } } } });
  if (!user || user.organizationId !== req.auth!.organizationId) throw new HttpError(404, "Utilisateur introuvable");
  if (user.invitationAcceptedAt) throw new HttpError(400, "Ce compte est déjà activé");
  const invitation = createInvitationToken();
  await prisma.user.update({ where: { id: user.id }, data: { inviteTokenHash: invitation.hash, inviteExpiresAt: invitation.expiresAt, invitedAt: new Date() } });
  await sendTechnicianInvitation({ email: user.email, name: user.name, role: user.role, organizationName: user.organization.name, contactEmail: user.organization.contactEmail, token: invitation.raw });
  res.status(204).send();
}));

usersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = updateSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt || existing.organizationId !== req.auth!.organizationId) {
      throw new HttpError(404, "Utilisateur introuvable");
    }
    if (existing.id === req.auth!.userId && input.isActive === false) {
      throw new HttpError(400, "Impossible de désactiver son propre compte");
    }
    const user = await prisma.user.update({ where: { id: req.params.id }, data: input });
    res.json({ user: toUserDTO(user) });
  })
);

usersRouter.delete("/:id", asyncHandler(async (req, res) => {
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.deletedAt || existing.organizationId !== req.auth!.organizationId) throw new HttpError(404, "Utilisateur introuvable");
  if (existing.id === req.auth!.userId) throw new HttpError(400, "Impossible de supprimer votre propre compte");
  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("base64url"), 10);
  await prisma.$transaction([
    prisma.chantierAssignment.deleteMany({ where: { userId: existing.id } }),
    prisma.pushSubscription.deleteMany({ where: { userId: existing.id } }),
    prisma.user.update({ where: { id: existing.id }, data: { isActive: false, deletedAt: new Date(), name: "Utilisateur supprimé", email: `deleted-${existing.id}@invalid.local`, passwordHash, inviteTokenHash: null, inviteExpiresAt: null } }),
  ]);
  res.status(204).send();
}));
