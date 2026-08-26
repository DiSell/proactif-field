import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { UserRole } from "@prisma/client";
import { createApp } from "../src/app";
import { assignTechnician, authHeader, createChantier, createOrganization, createUser } from "./helpers/factory";
import { cleanupOrganization } from "./helpers/cleanup";

const app = createApp();

describe("Chantier reports", () => {
  const orgsToClean: string[] = [];
  afterEach(async () => {
    await Promise.all(orgsToClean.splice(0).map(cleanupOrganization));
  });

  it("lists reports for a chantier the caller is authorized on", async () => {
    const org = await createOrganization();
    orgsToClean.push(org.id);
    const admin = await createUser({ organizationId: org.id, role: UserRole.ADMIN });
    const chantier = await createChantier({ organizationId: org.id, createdById: admin.id });

    const res = await request(app)
      .get(`/api/chantiers/${chantier.id}/reports`)
      .set(authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body.reports).toEqual([]);
  });

  it("refuses listing reports for a chantier in another organization", async () => {
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    orgsToClean.push(orgA.id, orgB.id);
    const adminA = await createUser({ organizationId: orgA.id, role: UserRole.ADMIN });
    const adminB = await createUser({ organizationId: orgB.id, role: UserRole.ADMIN });
    const chantierB = await createChantier({ organizationId: orgB.id, createdById: adminB.id });

    const res = await request(app)
      .get(`/api/chantiers/${chantierB.id}/reports`)
      .set(authHeader(adminA));

    expect(res.status).toBe(404);
  });

  it("shows a generated report in the chantier's report list", async () => {
    const org = await createOrganization();
    orgsToClean.push(org.id);
    const admin = await createUser({ organizationId: org.id, role: UserRole.ADMIN });
    const chantier = await createChantier({ organizationId: org.id, createdById: admin.id });

    const generated = await request(app)
      .post(`/api/chantiers/${chantier.id}/reports`)
      .set(authHeader(admin))
      .send({});
    expect(generated.status).toBe(201);
    const reportId = generated.body.report.id;

    const list = await request(app)
      .get(`/api/chantiers/${chantier.id}/reports`)
      .set(authHeader(admin));

    expect(list.status).toBe(200);
    expect(list.body.reports.map((r: { id: string }) => r.id)).toContain(reportId);
  });

  it("lets an assigned TECHNICIEN view and generate reports on their chantier", async () => {
    const org = await createOrganization();
    orgsToClean.push(org.id);
    const admin = await createUser({ organizationId: org.id, role: UserRole.ADMIN });
    const technician = await createUser({ organizationId: org.id, role: UserRole.TECHNICIEN });
    const chantier = await createChantier({ organizationId: org.id, createdById: admin.id });
    await assignTechnician(chantier.id, technician.id);

    const generated = await request(app)
      .post(`/api/chantiers/${chantier.id}/reports`)
      .set(authHeader(technician))
      .send({});
    expect(generated.status).toBe(201);

    const list = await request(app)
      .get(`/api/chantiers/${chantier.id}/reports`)
      .set(authHeader(technician));
    expect(list.status).toBe(200);
    expect(list.body.reports.map((r: { id: string }) => r.id)).toContain(generated.body.report.id);
  });

  it("refuses a technician who isn't assigned to the chantier", async () => {
    const org = await createOrganization();
    orgsToClean.push(org.id);
    const admin = await createUser({ organizationId: org.id, role: UserRole.ADMIN });
    const outsider = await createUser({ organizationId: org.id, role: UserRole.TECHNICIEN });
    const chantier = await createChantier({ organizationId: org.id, createdById: admin.id });

    const res = await request(app)
      .get(`/api/chantiers/${chantier.id}/reports`)
      .set(authHeader(outsider));
    expect(res.status).toBe(404);
  });
});
