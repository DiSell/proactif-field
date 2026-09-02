import { prisma } from "../config/db";
import { HttpError } from "../middleware/errorHandler";
import { AuthContext } from "../middleware/auth";

// Every one of these throws a 404 (never 403) on an inaccessible resource,
// so a user can't tell the difference between "doesn't exist" and
// "belongs to another organization" — no cross-tenant existence leak.

export async function assertChantierAccess(chantierId: string, auth: AuthContext): Promise<void> {
  const chantier = await prisma.chantier.findUnique({
    where: { id: chantierId },
    select: { organizationId: true },
  });
  if (!chantier || chantier.organizationId !== auth.organizationId) {
    throw new HttpError(404, "Chantier introuvable");
  }
  if (auth.role === "TECHNICIEN") {
    const assignment = await prisma.chantierAssignment.findUnique({
      where: { chantierId_userId: { chantierId, userId: auth.userId } },
    });
    if (!assignment) {
      throw new HttpError(404, "Chantier introuvable");
    }
  }
}

export async function assertPlanAccess(planId: string, auth: AuthContext): Promise<{ chantierId: string }> {
  const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { chantierId: true } });
  if (!plan) throw new HttpError(404, "Plan introuvable");
  await assertChantierAccess(plan.chantierId, auth);
  return plan;
}

export async function assertPointAccess(pointId: string, auth: AuthContext): Promise<{ planId: string; chantierId: string }> {
  const point = await prisma.point.findUnique({ where: { id: pointId }, select: { planId: true } });
  if (!point) throw new HttpError(404, "Point introuvable");
  const { chantierId } = await assertPlanAccess(point.planId, auth);
  return { planId: point.planId, chantierId };
}

export async function assertPhotoAccess(photoId: string, auth: AuthContext): Promise<{ pointId: string }> {
  const photo = await prisma.photo.findUnique({ where: { id: photoId }, select: { pointId: true } });
  if (!photo) throw new HttpError(404, "Photo introuvable");
  await assertPointAccess(photo.pointId, auth);
  return photo;
}

export async function assertReportAccess(reportId: string, auth: AuthContext): Promise<{ chantierId: string }> {
  const report = await prisma.report.findUnique({ where: { id: reportId }, select: { chantierId: true } });
  if (!report) throw new HttpError(404, "Rapport introuvable");
  await assertChantierAccess(report.chantierId, auth);
  return report;
}

export async function assertDocumentAccess(documentId: string, auth: AuthContext): Promise<{ chantierId: string }> {
  const doc = await prisma.document.findUnique({ where: { id: documentId }, select: { chantierId: true } });
  if (!doc) throw new HttpError(404, "Document introuvable");
  await assertChantierAccess(doc.chantierId, auth);
  return doc;
}

export async function assertMaterielAccess(materielId: string, auth: AuthContext): Promise<{ chantierId: string }> {
  const materiel = await prisma.materiel.findUnique({ where: { id: materielId }, select: { chantierId: true, organizationId: true } });
  if (!materiel || materiel.organizationId !== auth.organizationId) {
    throw new HttpError(404, "Matériel introuvable");
  }
  await assertChantierAccess(materiel.chantierId, auth);
  return { chantierId: materiel.chantierId };
}

export async function assertBlocageAccess(blocageId: string, auth: AuthContext): Promise<{ chantierId: string; pointId: string }> {
  const blocage = await prisma.blocage.findUnique({ where: { id: blocageId }, select: { chantierId: true, pointId: true, organizationId: true } });
  if (!blocage || blocage.organizationId !== auth.organizationId) {
    throw new HttpError(404, "Blocage introuvable");
  }
  await assertChantierAccess(blocage.chantierId, auth);
  return blocage;
}

// Field reports have no chantier/plan to scope by, so access is: same
// organization, and for a TECHNICIEN, ownership (createdById) — an ADMIN
// sees and manages every report in their organization, same as they do for
// chantiers. 404 (never 403) on a mismatch, same rationale as above.
export async function assertRapportTerrainAccess(rapportTerrainId: string, auth: AuthContext): Promise<{ organizationId: string; createdById: string }> {
  const rapport = await prisma.rapportTerrain.findUnique({ where: { id: rapportTerrainId }, select: { organizationId: true, createdById: true } });
  if (!rapport || rapport.organizationId !== auth.organizationId) {
    throw new HttpError(404, "Rapport terrain introuvable");
  }
  if (auth.role === "TECHNICIEN" && rapport.createdById !== auth.userId) {
    throw new HttpError(404, "Rapport terrain introuvable");
  }
  return rapport;
}

export async function assertRapportTerrainItemAccess(itemId: string, auth: AuthContext): Promise<{ rapportTerrainId: string; organizationId: string; createdById: string }> {
  const item = await prisma.rapportTerrainItem.findUnique({ where: { id: itemId }, select: { rapportTerrainId: true } });
  if (!item) throw new HttpError(404, "Entrée introuvable");
  const rapport = await assertRapportTerrainAccess(item.rapportTerrainId, auth);
  return { rapportTerrainId: item.rapportTerrainId, ...rapport };
}

export async function assertRapportTerrainPhotoAccess(photoId: string, auth: AuthContext): Promise<{ rapportTerrainItemId: string; rapportTerrainId: string }> {
  const photo = await prisma.rapportTerrainPhoto.findUnique({ where: { id: photoId }, select: { rapportTerrainItemId: true } });
  if (!photo) throw new HttpError(404, "Photo introuvable");
  const { rapportTerrainId } = await assertRapportTerrainItemAccess(photo.rapportTerrainItemId, auth);
  return { rapportTerrainItemId: photo.rapportTerrainItemId, rapportTerrainId };
}

export async function assertRapportTerrainPdfAccess(pdfId: string, auth: AuthContext): Promise<{ rapportTerrainId: string }> {
  const pdf = await prisma.rapportTerrainPdf.findUnique({ where: { id: pdfId }, select: { rapportTerrainId: true } });
  if (!pdf) throw new HttpError(404, "Rapport introuvable");
  await assertRapportTerrainAccess(pdf.rapportTerrainId, auth);
  return pdf;
}
