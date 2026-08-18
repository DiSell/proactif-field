import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { toTermSuggestionDTO } from "./mapper";

export const termsRouter = Router();
termsRouter.use(requireAuth);

const querySchema = z.object({
  field: z.string().min(1).max(100),
  q: z.string().max(200).optional(),
});

const recordSchema = z.object({
  field: z.string().min(1).max(100),
  value: z.string().trim().min(1).max(300),
});

// Business-agnostic autocomplete: suggestions for a given field, ranked by
// how often (useCount) and how recently (lastUsedAt) each value was used —
// no hardcoded vocabulary, just whatever this team has actually typed.
termsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { field, q } = querySchema.parse(req.query);
    const terms = await prisma.termValue.findMany({
      where: {
        organizationId: req.auth!.organizationId,
        field,
        ...(q ? { value: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: [{ useCount: "desc" }, { lastUsedAt: "desc" }],
      take: 8,
    });
    res.json({ suggestions: terms.map(toTermSuggestionDTO) });
  })
);

termsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { field, value } = recordSchema.parse(req.body);
    const organizationId = req.auth!.organizationId;
    const term = await prisma.termValue.upsert({
      where: { organizationId_field_value: { organizationId, field, value } },
      update: { useCount: { increment: 1 }, lastUsedAt: new Date() },
      create: { organizationId, field, value },
    });
    res.status(201).json({ suggestion: toTermSuggestionDTO(term) });
  })
);
