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

export async function assertPointAccess(pointId: string, auth: AuthContext): Promise<{ planId: string }> {
  const point = await prisma.point.findUnique({ where: { id: pointId }, select: { planId: true } });
  if (!point) throw new HttpError(404, "Point introuvable");
  await assertPlanAccess(point.planId, auth);
  return point;
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

export async function assertBlocageAccess(blocageId: string, auth: AuthContext): Promise<{ chantierId: string; pointId: string }> {
  const blocage = await prisma.blocage.findUnique({ where: { id: blocageId }, select: { chantierId: true, pointId: true, organizationId: true } });
  if (!blocage || blocage.organizationId !== auth.organizationId) {
    throw new HttpError(404, "Blocage introuvable");
  }
  await assertChantierAccess(blocage.chantierId, auth);
  return blocage;
}
