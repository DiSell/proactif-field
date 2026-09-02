import { prisma } from "../../src/config/db";

// Deletes everything created for a test organization, in FK-safe order.
// Chantier cascades (schema.prisma) take care of Plan/Point/Photo/Document/
// Blocage/ActivityLog/ChantierAssignment/Report/Materiel underneath it, so
// only the org-level tables need an explicit pass. Organization's own
// dependents (User, Chantier, TermValue) use ON DELETE RESTRICT, so they
// must be cleared before the Organization row itself.
export async function cleanupOrganization(organizationId: string): Promise<void> {
  await prisma.chantier.deleteMany({ where: { organizationId } });
  // RapportTerrain is org-rooted (no chantier), so it needs its own pass —
  // RapportTerrainItem/Photo/Pdf/ActivityLog cascade from it (schema.prisma).
  await prisma.rapportTerrain.deleteMany({ where: { organizationId } });
  await prisma.termValue.deleteMany({ where: { organizationId } });
  await prisma.user.deleteMany({ where: { organizationId } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
}
