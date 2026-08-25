import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { UserRole } from "@prisma/client";
import { createApp } from "../src/app";
import { HttpError } from "../src/middleware/errorHandler";
import { assertNotLastActiveAdmin } from "../src/modules/users/routes";
import { authHeader, createOrganization, createUser } from "./helpers/factory";
import { cleanupOrganization } from "./helpers/cleanup";

const app = createApp();

describe("User deletion — last active admin guard", () => {
  const orgsToClean: string[] = [];
  afterEach(async () => {
    await Promise.all(orgsToClean.splice(0).map(cleanupOrganization));
  });

  it("allows an admin to delete a technician", async () => {
    const org = await createOrganization();
    orgsToClean.push(org.id);
    const admin = await createUser({ organizationId: org.id, role: UserRole.ADMIN });
    const technician = await createUser({ organizationId: org.id, role: UserRole.TECHNICIEN });

    const res = await request(app).delete(`/api/users/${technician.id}`).set(authHeader(admin));

    expect(res.status).toBe(204);
  });

  it("allows deleting another admin when several admins are active", async () => {
    const org = await createOrganization();
    orgsToClean.push(org.id);
    const admin1 = await createUser({ organizationId: org.id, role: UserRole.ADMIN });
    const admin2 = await createUser({ organizationId: org.id, role: UserRole.ADMIN });

    const res = await request(app).delete(`/api/users/${admin2.id}`).set(authHeader(admin1));

    expect(res.status).toBe(204);
  });

  it("refuses to delete your own account regardless of admin count", async () => {
    const org = await createOrganization();
    orgsToClean.push(org.id);
    const admin1 = await createUser({ organizationId: org.id, role: UserRole.ADMIN });
    await createUser({ organizationId: org.id, role: UserRole.ADMIN }); // a second active admin

    const res = await request(app).delete(`/api/users/${admin1.id}`).set(authHeader(admin1));

    expect(res.status).toBe(400);
  });

  // The live API can never actually produce this 409: usersRouter requires
  // an active ADMIN caller, and that caller is always a distinct surviving
  // admin (or is blocked earlier by the self-delete check above), so the
  // active-admin count never reaches the boundary this guard checks through
  // a real request. It's a defense-in-depth invariant, not a reachable HTTP
  // flow — so it's verified directly against the exported guard function
  // instead of through supertest. See the comment on assertNotLastActiveAdmin
  // in modules/users/routes.ts.
  it("assertNotLastActiveAdmin rejects the organization's sole active admin", async () => {
    const org = await createOrganization();
    orgsToClean.push(org.id);
    const soleAdmin = await createUser({ organizationId: org.id, role: UserRole.ADMIN });

    await expect(assertNotLastActiveAdmin(soleAdmin)).rejects.toMatchObject({
      status: 409,
    } satisfies Partial<HttpError>);
  });

  it("assertNotLastActiveAdmin allows it when another active admin remains", async () => {
    const org = await createOrganization();
    orgsToClean.push(org.id);
    const admin1 = await createUser({ organizationId: org.id, role: UserRole.ADMIN });
    await createUser({ organizationId: org.id, role: UserRole.ADMIN });

    await expect(assertNotLastActiveAdmin(admin1)).resolves.toBeUndefined();
  });
});
