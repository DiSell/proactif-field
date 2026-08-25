import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { UserRole } from "@prisma/client";
import { createApp } from "../src/app";
import { assignTechnician, authHeader, createChantier, createOrganization, createUser } from "./helpers/factory";
import { cleanupOrganization } from "./helpers/cleanup";

const app = createApp();

describe("Chantier materiel", () => {
  const orgsToClean: string[] = [];
  afterEach(async () => {
    await Promise.all(orgsToClean.splice(0).map(cleanupOrganization));
  });

  async function setupChantierWithTechnician() {
    const org = await createOrganization();
    orgsToClean.push(org.id);
    const admin = await createUser({ organizationId: org.id, role: UserRole.ADMIN });
    const technician = await createUser({ organizationId: org.id, role: UserRole.TECHNICIEN });
    const chantier = await createChantier({ organizationId: org.id, createdById: admin.id });
    await assignTechnician(chantier.id, technician.id);
    return { org, admin, technician, chantier };
  }

  it("lets an ADMIN create a materiel line", async () => {
    const { admin, chantier } = await setupChantierWithTechnician();

    const res = await request(app)
      .post(`/api/chantiers/${chantier.id}/materiel`)
      .set(authHeader(admin))
      .send({ designation: "Câble fibre 12FO", reference: "REF-001", quantitePrevue: 500, unite: "m" });

    expect(res.status).toBe(201);
    expect(res.body.materiel).toMatchObject({
      designation: "Câble fibre 12FO",
      reference: "REF-001",
      quantitePrevue: 500,
      unite: "m",
      createdByName: admin.name,
    });
  });

  it("lets an ADMIN modify a materiel line", async () => {
    const { admin, chantier } = await setupChantierWithTechnician();
    const created = await request(app)
      .post(`/api/chantiers/${chantier.id}/materiel`)
      .set(authHeader(admin))
      .send({ designation: "Boîtier de raccordement" });

    const res = await request(app)
      .patch(`/api/materiel/${created.body.materiel.id}`)
      .set(authHeader(admin))
      .send({ designation: "Boîtier de raccordement 24FO", reference: "BOI-24" });

    expect(res.status).toBe(200);
    expect(res.body.materiel).toMatchObject({ designation: "Boîtier de raccordement 24FO", reference: "BOI-24" });
  });

  it("lets an assigned TECHNICIEN view the materiel list", async () => {
    const { admin, technician, chantier } = await setupChantierWithTechnician();
    await request(app).post(`/api/chantiers/${chantier.id}/materiel`).set(authHeader(admin)).send({ designation: "Poteau bois" });

    const res = await request(app)
      .get(`/api/chantiers/${chantier.id}/materiel`)
      .set(authHeader(technician));

    expect(res.status).toBe(200);
    expect(res.body.materiels).toHaveLength(1);
  });

  it("lets an assigned TECHNICIEN update quantiteUtilisee", async () => {
    const { admin, technician, chantier } = await setupChantierWithTechnician();
    const created = await request(app)
      .post(`/api/chantiers/${chantier.id}/materiel`)
      .set(authHeader(admin))
      .send({ designation: "Fourreau PVC", quantitePrevue: 100, unite: "m" });

    const res = await request(app)
      .patch(`/api/materiel/${created.body.materiel.id}`)
      .set(authHeader(technician))
      .send({ quantiteUtilisee: 42, commentaire: "Reste du tourets" });

    expect(res.status).toBe(200);
    expect(res.body.materiel.quantiteUtilisee).toBe(42);
    expect(res.body.materiel.commentaire).toBe("Reste du tourets");
    // TECHNICIEN can't touch administrative fields even if it sends them.
    expect(res.body.materiel.designation).toBe("Fourreau PVC");
  });

  it("refuses a technician who isn't assigned to the chantier", async () => {
    const org = await createOrganization();
    orgsToClean.push(org.id);
    const admin = await createUser({ organizationId: org.id, role: UserRole.ADMIN });
    const outsider = await createUser({ organizationId: org.id, role: UserRole.TECHNICIEN });
    const chantier = await createChantier({ organizationId: org.id, createdById: admin.id });
    const created = await request(app).post(`/api/chantiers/${chantier.id}/materiel`).set(authHeader(admin)).send({ designation: "Coffret" });

    const res = await request(app)
      .get(`/api/chantiers/${chantier.id}/materiel`)
      .set(authHeader(outsider));
    expect(res.status).toBe(404);

    const patchRes = await request(app)
      .patch(`/api/materiel/${created.body.materiel.id}`)
      .set(authHeader(outsider))
      .send({ quantiteUtilisee: 1 });
    expect(patchRes.status).toBe(404);
  });

  it("refuses another organization's materiel with 404", async () => {
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    orgsToClean.push(orgA.id, orgB.id);
    const adminA = await createUser({ organizationId: orgA.id, role: UserRole.ADMIN });
    const adminB = await createUser({ organizationId: orgB.id, role: UserRole.ADMIN });
    const chantierB = await createChantier({ organizationId: orgB.id, createdById: adminB.id });
    const created = await request(app).post(`/api/chantiers/${chantierB.id}/materiel`).set(authHeader(adminB)).send({ designation: "Armoire" });

    const list = await request(app).get(`/api/chantiers/${chantierB.id}/materiel`).set(authHeader(adminA));
    expect(list.status).toBe(404);

    const patch = await request(app).patch(`/api/materiel/${created.body.materiel.id}`).set(authHeader(adminA)).send({ quantiteUtilisee: 1 });
    expect(patch.status).toBe(404);

    const del = await request(app).delete(`/api/materiel/${created.body.materiel.id}`).set(authHeader(adminA));
    expect(del.status).toBe(404);
  });

  it("lets an ADMIN delete a materiel line", async () => {
    const { admin, chantier } = await setupChantierWithTechnician();
    const created = await request(app).post(`/api/chantiers/${chantier.id}/materiel`).set(authHeader(admin)).send({ designation: "Attache colson" });

    const res = await request(app).delete(`/api/materiel/${created.body.materiel.id}`).set(authHeader(admin));
    expect(res.status).toBe(204);

    const list = await request(app).get(`/api/chantiers/${chantier.id}/materiel`).set(authHeader(admin));
    expect(list.body.materiels).toHaveLength(0);
  });

  it("allows quantiteUtilisee greater than quantitePrevue without blocking", async () => {
    const { admin, chantier } = await setupChantierWithTechnician();
    const created = await request(app)
      .post(`/api/chantiers/${chantier.id}/materiel`)
      .set(authHeader(admin))
      .send({ designation: "Touret câble", quantitePrevue: 10, unite: "unités" });

    const res = await request(app)
      .patch(`/api/materiel/${created.body.materiel.id}`)
      .set(authHeader(admin))
      .send({ quantiteUtilisee: 15 });

    expect(res.status).toBe(200);
    expect(res.body.materiel.quantiteUtilisee).toBe(15);
    expect(res.body.materiel.quantitePrevue).toBe(10);
  });

  it("includes materiel in the chantier sync snapshot", async () => {
    const { admin, chantier } = await setupChantierWithTechnician();
    await request(app).post(`/api/chantiers/${chantier.id}/materiel`).set(authHeader(admin)).send({ designation: "Épissure optique" });

    const res = await request(app).get(`/api/chantiers/${chantier.id}/sync`).set(authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body.materiels).toHaveLength(1);
    expect(res.body.materiels[0].designation).toBe("Épissure optique");
  });

  it("records a MATERIEL_AJOUTE activity log entry on creation", async () => {
    const { admin, chantier } = await setupChantierWithTechnician();

    const created = await request(app)
      .post(`/api/chantiers/${chantier.id}/materiel`)
      .set(authHeader(admin))
      .send({ designation: "Connecteur SC/APC", reference: "SC-APC-1" });
    expect(created.status).toBe(201);

    const activity = await request(app).get(`/api/chantiers/${chantier.id}/activity`).set(authHeader(admin));
    expect(activity.status).toBe(200);
    const entry = activity.body.activities.find((a: { action: string }) => a.action === "MATERIEL_AJOUTE");
    expect(entry).toBeTruthy();
    expect(entry.metadata).toMatchObject({ designation: "Connecteur SC/APC", reference: "SC-APC-1" });
  });
});
