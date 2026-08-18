import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "../../config/db";
import { requireAdmin, requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { HttpError } from "../../middleware/errorHandler";
import { toUserDTO } from "../auth/mapper";

export const usersRouter = Router();
usersRouter.use(requireAuth, requireAdmin);

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(UserRole),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
});

usersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      where: { organizationId: req.auth!.organizationId },
      orderBy: { createdAt: "asc" },
    });
    res.json({ users: users.map(toUserDTO) });
  })
);

// No email-invitation flow yet: an ADMIN creates the account directly with
// a password they set, and communicates it to the technician out of band.
// Architecture (this endpoint, isActive flag) is compatible with adding
// invite-by-email later without breaking changes.
usersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new HttpError(409, "Un compte existe déjà avec cet email");
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role,
        organizationId: req.auth!.organizationId,
      },
    });
    res.status(201).json({ user: toUserDTO(user) });
  })
);

usersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = updateSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.organizationId !== req.auth!.organizationId) {
      throw new HttpError(404, "Utilisateur introuvable");
    }
    if (existing.id === req.auth!.userId && input.isActive === false) {
      throw new HttpError(400, "Impossible de désactiver son propre compte");
    }
    const user = await prisma.user.update({ where: { id: req.params.id }, data: input });
    res.json({ user: toUserDTO(user) });
  })
);
