import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { UserRole } from "@prisma/client";
import { createApp } from "../src/app";
import { logActivity } from "../src/modules/activity/service";
import { authHeader, createChantier, createOrganization, createUser } from "./helpers/factory";
import { cleanupOrganization } from "./helpers/cleanup";

const app = createApp();

describe("Chantier activity (Historique)", () => {
  const orgsToClean: string[] = [];
  afterEach(async () => {
    await Promise.all(orgsToClean.splice(0).map(cleanupOrganization));
  });

  it("records a real business event and lists it back", async () => {
    const org = await createOrganization();
    orgsToClean.push(org.id);
    const admin = await createUser({ organizationId: org.id, role: UserRole.ADMIN });

    const created = await request(app)
      .post("/api/chantiers")
      .set(authHeader(admin))
      .send({ name: "Chantier avec historique" });
    expect(created.status).toBe(201);

    const res = await request(app)
      .get(`/api/chantiers/${created.body.chantier.id}/activity`)
      .set(authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body.activities).toHaveLength(1);
    expect(res.body.activities[0]).toMatchObject({
      action: "CHANTIER_CREE",
      userName: admin.name,
      chantierId: created.body.chantier.id,
    });
  });

  it("returns entries sorted most-recent-first and paginates by cursor", async () => {
    const org = await createOrganization();
    orgsToClean.push(org.id);
    const admin = await createUser({ organizationId: org.id, role: UserRole.ADMIN });
    const chantier = await createChantier({ organizationId: org.id, createdById: admin.id });

    for (let i = 0; i < 5; i += 1) {
      await logActivity({ organizationId: org.id, chantierId: chantier.id, userId: admin.id, action: "CHANTIER_MODIFIE" });
      await new Promise((resolve) => setTimeout(resolve, 5)); // keep createdAt strictly increasing
    }

    const firstPage = await request(app)
      .get(`/api/chantiers/${chantier.id}/activity?take=2`)
      .set(authHeader(admin));
    expect(firstPage.status).toBe(200);
    expect(firstPage.body.activities).toHaveLength(2);
    expect(firstPage.body.nextCursor).toBeTruthy();

    const [first, second] = firstPage.body.activities;
    expect(new Date(first.createdAt).getTime()).toBeGreaterThanOrEqual(new Date(second.createdAt).getTime());

    const secondPage = await request(app)
      .get(`/api/chantiers/${chantier.id}/activity?take=2&cursor=${firstPage.body.nextCursor}`)
      .set(authHeader(admin));
    expect(secondPage.status).toBe(200);
    expect(secondPage.body.activities).toHaveLength(2);
    const firstPageIds = new Set(firstPage.body.activities.map((entry: { id: string }) => entry.id));
    for (const entry of secondPage.body.activities) {
      expect(firstPageIds.has(entry.id)).toBe(false);
    }
  });

  it("refuses access to a chantier's activity outside the caller's organization", async () => {
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    orgsToClean.push(orgA.id, orgB.id);
    const adminA = await createUser({ organizationId: orgA.id, role: UserRole.ADMIN });
    const adminB = await createUser({ organizationId: orgB.id, role: UserRole.ADMIN });
    const chantierB = await createChantier({ organizationId: orgB.id, createdById: adminB.id });

    const res = await request(app)
      .get(`/api/chantiers/${chantierB.id}/activity`)
      .set(authHeader(adminA));

    expect(res.status).toBe(404);
  });
});
