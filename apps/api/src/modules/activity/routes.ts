import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { assertChantierAccess } from "../../utils/access";
import { toActivityLogDTO } from "./mapper";

const querySchema = z.object({
  take: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).optional(),
});

// Read-only view of the audit trail written by other modules (see
// blocages/routes.ts for the ActivityLog.create calls). Same access rule as
// documents: anyone with chantier access can view it, only ADMIN vs
// TECHNICIEN scoping happens through assertChantierAccess.
export const chantierActivityRouter = Router({ mergeParams: true });
chantierActivityRouter.use(requireAuth);

chantierActivityRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    await assertChantierAccess(req.params.id, req.auth!);
    const { take, cursor } = querySchema.parse(req.query);
    const entries = await prisma.activityLog.findMany({
      where: { chantierId: req.params.id },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { user: { select: { name: true } } },
    });
    const hasMore = entries.length > take;
    const page = hasMore ? entries.slice(0, take) : entries;
    res.json({
      activities: page.map(toActivityLogDTO),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  })
);
