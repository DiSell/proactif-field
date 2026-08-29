import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler";
import { registerUser, loginUser } from "./service";
import { requireAuth } from "../../middleware/auth";
import { prisma } from "../../config/db";
import { HttpError } from "../../middleware/errorHandler";
import { toUserDTO } from "./mapper";
import bcrypt from "bcryptjs";
import { hashInvitationToken } from "../invitations/service";
import { signToken } from "../../middleware/auth";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  organizationName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const ownProfileSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  employerCompany: z.string().trim().max(160).nullable().optional(),
});

authRouter.get("/invitations/:token", asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { inviteTokenHash: hashInvitationToken(req.params.token) }, include: { organization: { select: { name: true } } } });
  if (!user || user.invitationAcceptedAt || !user.inviteExpiresAt || user.inviteExpiresAt <= new Date()) throw new HttpError(404, "Invitation invalide ou expirée");
  res.json({ invitation: { name: user.name, email: user.email, organizationName: user.organization.name, expiresAt: user.inviteExpiresAt.toISOString() } });
}));

authRouter.post("/invitations/:token/accept", asyncHandler(async (req, res) => {
  const { password } = z.object({ password: z.string().min(8) }).parse(req.body);
  const hash = hashInvitationToken(req.params.token);
  const user = await prisma.user.findUnique({ where: { inviteTokenHash: hash } });
  if (!user || user.invitationAcceptedAt || !user.inviteExpiresAt || user.inviteExpiresAt <= new Date()) throw new HttpError(404, "Invitation invalide ou expirée");
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await prisma.user.updateMany({ where: { id: user.id, inviteTokenHash: hash, invitationAcceptedAt: null }, data: { passwordHash, isActive: true, invitationAcceptedAt: new Date(), inviteTokenHash: null, inviteExpiresAt: null } });
  if (result.count !== 1) throw new HttpError(409, "Cette invitation a déjà été utilisée");
  const activated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  res.json({ token: signToken({ userId: activated.id }), user: toUserDTO(activated) });
}));

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const { token, user } = await registerUser(
      input.email,
      input.password,
      input.name,
      input.organizationName
    );
    res.status(201).json({ token, user: toUserDTO(user) });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const { token, user } = await loginUser(input.email, input.password);
    res.json({ token, user: toUserDTO(user) });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user) {
      throw new HttpError(404, "Utilisateur introuvable");
    }
    res.json({ user: toUserDTO(user) });
  })
);

authRouter.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = ownProfileSchema.parse(req.body);
    const user = await prisma.user.update({ where: { id: req.auth!.userId }, data: input });
    res.json({ user: toUserDTO(user) });
  })
);
