import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/config/db";
import { cleanupOrganization } from "./helpers/cleanup";
import { authHeader, createChantier, createOrganization, createUser } from "./helpers/factory";

describe("Chantiers", () => {
  const organizationIds: string[] = [];
  afterEach(async () => {
    for (const organizationId of organizationIds.splice(0)) await cleanupOrganization(organizationId);
  });

  it("does not reuse an existing reference after a chantier is deleted", async () => {
    const organization = await createOrganization();
    organizationIds.push(organization.id);
    const admin = await createUser({ organizationId: organization.id });
    const first = await createChantier({ organizationId: organization.id, createdById: admin.id });
    const second = await createChantier({ organizationId: organization.id, createdById: admin.id });
    await prisma.chantier.update({ where: { id: first.id }, data: { reference: "CH-0001" } });
    await prisma.chantier.update({ where: { id: second.id }, data: { reference: "CH-0002" } });
    await prisma.chantier.delete({ where: { id: first.id } });

    const response = await request(createApp())
      .post("/api/chantiers")
      .set(authHeader(admin))
      .send({ name: "Nouveau chantier" });

    expect(response.status).toBe(201);
    expect(response.body.chantier.reference).toBe("CH-0003");
  });
});
