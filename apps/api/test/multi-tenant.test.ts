import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { UserRole } from "@prisma/client";
import { createApp } from "../src/app";
import { authHeader, createChantier, createOrganization, createUser } from "./helpers/factory";
import { cleanupOrganization } from "./helpers/cleanup";

const app = createApp();

describe("Multi-tenant isolation", () => {
  const orgsToClean: string[] = [];
  afterEach(async () => {
    await Promise.all(orgsToClean.splice(0).map(cleanupOrganization));
  });

  it("returns 404 (not 403) for another organization's chantier activity", async () => {
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

  it("returns 404 (not 403) for another organization's chantier reports", async () => {
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
});
