import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { UserRole } from "@prisma/client";
import { createApp } from "../src/app";
import { prisma } from "../src/config/db";
import { cleanupOrganization } from "./helpers/cleanup";
import { assignTechnician, authHeader, createChantier, createOrganization, createUser } from "./helpers/factory";

describe("Espace technicien", () => {
  const organizationIds: string[] = [];
  afterEach(async () => {
    for (const organizationId of organizationIds.splice(0)) await cleanupOrganization(organizationId);
  });

  it("limite l'historique global aux chantiers affectés", async () => {
    const organization = await createOrganization();
    organizationIds.push(organization.id);
    const admin = await createUser({ organizationId: organization.id });
    const technician = await createUser({ organizationId: organization.id, role: UserRole.TECHNICIEN });
    const assigned = await createChantier({ organizationId: organization.id, createdById: admin.id, name: "Affecté" });
    const hidden = await createChantier({ organizationId: organization.id, createdById: admin.id, name: "Masqué" });
    await assignTechnician(assigned.id, technician.id);
    await prisma.activityLog.createMany({ data: [
      { organizationId: organization.id, chantierId: assigned.id, userId: admin.id, action: "CHANTIER_MODIFIE" },
      { organizationId: organization.id, chantierId: hidden.id, userId: admin.id, action: "CHANTIER_MODIFIE" },
    ] });

    const response = await request(createApp()).get("/api/activity").set(authHeader(technician));

    expect(response.status).toBe(200);
    expect(response.body.activities).toHaveLength(1);
    expect(response.body.activities[0].chantierId).toBe(assigned.id);
    expect(response.body.activities[0].chantierName).toBe("Affecté");
  });

  it("permet au technicien de modifier son propre profil", async () => {
    const organization = await createOrganization();
    organizationIds.push(organization.id);
    const technician = await createUser({ organizationId: organization.id, role: UserRole.TECHNICIEN });

    const response = await request(createApp()).patch("/api/auth/me").set(authHeader(technician)).send({ name: "Nouveau nom", phone: "0600000000", employerCompany: "Entreprise terrain" });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ name: "Nouveau nom", phone: "0600000000", employerCompany: "Entreprise terrain" });
  });

  it("permet de créer un chantier puis d'ajouter une carte et un document", async () => {
    const organization = await createOrganization();
    organizationIds.push(organization.id);
    const technician = await createUser({ organizationId: organization.id, role: UserRole.TECHNICIEN });

    const creation = await request(createApp()).post("/api/chantiers").set(authHeader(technician)).send({ name: "Chantier terrain" });
    expect(creation.status).toBe(201);
    expect(creation.body.chantier.assignedUserIds).toContain(technician.id);
    const chantierId = creation.body.chantier.id as string;

    const plan = await request(createApp())
      .post(`/api/chantiers/${chantierId}/plans`)
      .set(authHeader(technician))
      .attach("file", Buffer.from("carte terrain"), { filename: "carte.png", contentType: "image/png" });
    expect(plan.status).toBe(201);

    const document = await request(createApp())
      .post(`/api/chantiers/${chantierId}/documents`)
      .set(authHeader(technician))
      .field("category", "Terrain")
      .field("name", "Notice")
      .attach("file", Buffer.from("notice terrain"), { filename: "notice.txt", contentType: "text/plain" });
    expect(document.status).toBe(201);
    expect(document.body.document.uploadedById).toBe(technician.id);
  });
});
