import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { env } from "../../config/env";
import { pushEnabled } from "./service";

const subscriptionSchema = z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }) });
export const pushRouter = Router();
pushRouter.use(requireAuth);
pushRouter.get("/config", (_req, res) => res.json({ enabled: pushEnabled, publicKey: pushEnabled ? env.vapidPublicKey : null }));
pushRouter.post("/subscriptions", asyncHandler(async (req, res) => {
  const input = subscriptionSchema.parse(req.body);
  const subscription = await prisma.pushSubscription.upsert({ where: { endpoint: input.endpoint }, update: { userId: req.auth!.userId, p256dh: input.keys.p256dh, auth: input.keys.auth }, create: { userId: req.auth!.userId, endpoint: input.endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth } });
  res.status(201).json({ id: subscription.id });
}));
pushRouter.delete("/subscriptions", asyncHandler(async (req, res) => {
  const input = z.object({ endpoint: z.string().url() }).parse(req.body);
  await prisma.pushSubscription.deleteMany({ where: { endpoint: input.endpoint, userId: req.auth!.userId } });
  res.status(204).send();
}));
