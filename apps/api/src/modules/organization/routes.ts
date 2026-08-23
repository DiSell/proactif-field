import path from "path";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db";
import { requireAdmin, requireAuth } from "../../middleware/auth";
import { uploadOrganizationLogo } from "../../middleware/upload";
import { asyncHandler } from "../../utils/asyncHandler";
import { HttpError } from "../../middleware/errorHandler";
import { absolutePathFor, deleteFile } from "../../utils/storage";
import { toOrganizationDTO } from "./mapper";

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const updateSchema = z.object({ name: z.string().trim().min(1).max(160).optional(), legalName: optionalText(200), address: optionalText(300), postalCode: optionalText(30), city: optionalText(120), country: optionalText(120), phone: optionalText(40), contactEmail: z.string().trim().email().optional(), notificationEmail: z.string().trim().email().nullable().optional(), responsibleName: optionalText(160), website: z.string().trim().url().nullable().optional(), timezone: z.string().trim().min(1).max(80).optional(), locale: z.enum(["fr-FR", "en-GB"]).optional() });

export const organizationRouter = Router();
organizationRouter.use(requireAuth);
organizationRouter.get("/", requireAdmin, asyncHandler(async (req, res) => { const organization = await prisma.organization.findUnique({ where: { id: req.auth!.organizationId } }); if (!organization) throw new HttpError(404, "Entreprise introuvable"); res.json({ organization: toOrganizationDTO(organization) }); }));
organizationRouter.patch("/", requireAdmin, asyncHandler(async (req, res) => { const input = updateSchema.parse(req.body); const organization = await prisma.organization.update({ where: { id: req.auth!.organizationId }, data: input }); res.json({ organization: toOrganizationDTO(organization) }); }));
organizationRouter.post("/logo", requireAdmin, uploadOrganizationLogo.single("file"), asyncHandler(async (req, res) => { if (!req.file) throw new HttpError(400, "Aucun logo reçu"); const current = await prisma.organization.findUnique({ where: { id: req.auth!.organizationId } }); if (!current) throw new HttpError(404, "Entreprise introuvable"); const logoPath = path.join("organization-logos", req.file.filename); const organization = await prisma.organization.update({ where: { id: current.id }, data: { logoPath } }); if (current.logoPath) deleteFile(current.logoPath); res.status(201).json({ organization: toOrganizationDTO(organization) }); }));
organizationRouter.get("/logo", asyncHandler(async (req, res) => { const organization = await prisma.organization.findUnique({ where: { id: req.auth!.organizationId }, select: { logoPath: true } }); if (!organization?.logoPath) throw new HttpError(404, "Logo introuvable"); res.sendFile(absolutePathFor(organization.logoPath)); }));
