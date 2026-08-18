import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler";
import { registerUser, loginUser } from "./service";
import { requireAuth } from "../../middleware/auth";
import { prisma } from "../../config/db";
import { HttpError } from "../../middleware/errorHandler";
import { toUserDTO } from "./mapper";

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
