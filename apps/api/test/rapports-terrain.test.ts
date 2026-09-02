import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { UserRole } from "@prisma/client";
import { createApp } from "../src/app";
import { prisma } from "../src/config/db";
import { authHeader, createOrganization, createUser } from "./helpers/factory";
import { cleanupOrganization } from "./helpers/cleanup";

const app = createApp();

describe("Rapports terrain", () => {
  const organizationIds: string[] = [];
  afterEach(async () => {
    for (const organizationId of organizationIds.splice(0)) await cleanupOrganization(organizationId);
  });

  it("permet à un technicien de créer un rapport terrain, avec date et technicien corrects", async () => {
    const organization = await createOrganization();
    organizationIds.push(organization.id);
    const technician = await createUser({ organizationId: organization.id, role: UserRole.TECHNICIEN, name: "Jean Terrain" });

    const before = Date.now();
    const response = await request(app)
      .post("/api/rapports-terrain")
      .set(authHeader(technician))
      .send({ nom: "Intervention réseau", typeTravaux: "Maintenance" });

    expect(response.status).toBe(201);
    const rapport = response.body.rapportTerrain;
    expect(rapport.nom).toBe("Intervention réseau");
    expect(rapport.createdById).toBe(technician.id);
    expect(rapport.createdByName).toBe("Jean Terrain");
    expect(new Date(rapport.createdAt).getTime()).toBeGreaterThanOrEqual(before);
    expect(rapport.items).toEqual([]);
  });

  it("accepte un rapport sans coordonnées GPS", async () => {
    const organization = await createOrganization();
    organizationIds.push(organization.id);
    const technician = await createUser({ organizationId: organization.id, role: UserRole.TECHNICIEN });

    const response = await request(app).post("/api/rapports-terrain").set(authHeader(technician)).send({ nom: "Sans GPS" });

    expect(response.status).toBe(201);
    expect(response.body.rapportTerrain.latitude).toBeNull();
    expect(response.body.rapportTerrain.longitude).toBeNull();
    expect(response.body.rapportTerrain.lieu).toBeNull();
  });

  it("accepte des coordonnées GPS quand elles sont fournies", async () => {
    const organization = await createOrganization();
    organizationIds.push(organization.id);
    const technician = await createUser({ organizationId: organization.id, role: UserRole.TECHNICIEN });

    const response = await request(app)
      .post("/api/rapports-terrain")
      .set(authHeader(technician))
      .send({ nom: "Avec GPS", latitude: 48.8566, longitude: 2.3522, gpsAccuracy: 12.5 });

    expect(response.status).toBe(201);
    expect(response.body.rapportTerrain.latitude).toBe(48.8566);
    expect(response.body.rapportTerrain.longitude).toBe(2.3522);
    expect(response.body.rapportTerrain.gpsAccuracy).toBe(12.5);
  });

  it("crée une entrée dans un rapport, puis plusieurs entrées ordonnées par date de saisie", async () => {
    const organization = await createOrganization();
    organizationIds.push(organization.id);
    const technician = await createUser({ organizationId: organization.id, role: UserRole.TECHNICIEN });
    const created = await request(app).post("/api/rapports-terrain").set(authHeader(technician)).send({ nom: "Rapport" });
    const rapportId = created.body.rapportTerrain.id as string;

    const item1 = await request(app).post(`/api/rapports-terrain/${rapportId}/items`).set(authHeader(technician)).send({ titre: "Regard 1", commentaire: "RAS" });
    expect(item1.status).toBe(201);
    expect(item1.body.item.titre).toBe("Regard 1");
    expect(item1.body.item.rapportTerrainId).toBe(rapportId);

    const item2 = await request(app).post(`/api/rapports-terrain/${rapportId}/items`).set(authHeader(technician)).send({ titre: "Regard 2" });
    expect(item2.status).toBe(201);

    const detail = await request(app).get(`/api/rapports-terrain/${rapportId}`).set(authHeader(technician));
    expect(detail.status).toBe(200);
    expect(detail.body.rapportTerrain.items.map((i: { titre: string }) => i.titre)).toEqual(["Regard 1", "Regard 2"]);
    expect(detail.body.rapportTerrain.itemCount).toBe(2);
  });

  it("ajoute une photo à une entrée", async () => {
    const organization = await createOrganization();
    organizationIds.push(organization.id);
    const technician = await createUser({ organizationId: organization.id, role: UserRole.TECHNICIEN });
    const created = await request(app).post("/api/rapports-terrain").set(authHeader(technician)).send({ nom: "Rapport photo" });
    const rapportId = created.body.rapportTerrain.id as string;
    const item = await request(app).post(`/api/rapports-terrain/${rapportId}/items`).set(authHeader(technician)).send({ titre: "Fuite" });
    const itemId = item.body.item.id as string;

    const photo = await request(app)
      .post(`/api/rapports-terrain/items/${itemId}/photos`)
      .set(authHeader(technician))
      .field("takenAt", new Date().toISOString())
      .field("gpsLat", "48.85")
      .field("gpsLng", "2.35")
      .attach("file", Buffer.from("photo terrain"), { filename: "photo.jpg", contentType: "image/jpeg" });

    expect(photo.status).toBe(201);
    expect(photo.body.photo.rapportTerrainItemId).toBe(itemId);
    expect(photo.body.photo.gpsLat).toBe(48.85);

    const detail = await request(app).get(`/api/rapports-terrain/${rapportId}`).set(authHeader(technician));
    expect(detail.body.rapportTerrain.photoCount).toBe(1);
    expect(detail.body.rapportTerrain.items[0].photos).toHaveLength(1);
  });

  it("permet à l'admin de voir tous les rapports terrain de son organisation", async () => {
    const organization = await createOrganization();
    organizationIds.push(organization.id);
    const admin = await createUser({ organizationId: organization.id, role: UserRole.ADMIN });
    const techA = await createUser({ organizationId: organization.id, role: UserRole.TECHNICIEN });
    const techB = await createUser({ organizationId: organization.id, role: UserRole.TECHNICIEN });
    await request(app).post("/api/rapports-terrain").set(authHeader(techA)).send({ nom: "Rapport A" });
    await request(app).post("/api/rapports-terrain").set(authHeader(techB)).send({ nom: "Rapport B" });

    const list = await request(app).get("/api/rapports-terrain").set(authHeader(admin));

    expect(list.status).toBe(200);
    expect(list.body.rapportsTerrain.map((r: { nom: string }) => r.nom).sort()).toEqual(["Rapport A", "Rapport B"]);
  });

  it("limite la liste d'un technicien à ses propres rapports", async () => {
    const organization = await createOrganization();
    organizationIds.push(organization.id);
    const techA = await createUser({ organizationId: organization.id, role: UserRole.TECHNICIEN });
    const techB = await createUser({ organizationId: organization.id, role: UserRole.TECHNICIEN });
    await request(app).post("/api/rapports-terrain").set(authHeader(techA)).send({ nom: "Rapport A" });
    await request(app).post("/api/rapports-terrain").set(authHeader(techB)).send({ nom: "Rapport B" });

    const list = await request(app).get("/api/rapports-terrain").set(authHeader(techA));

    expect(list.status).toBe(200);
    expect(list.body.rapportsTerrain.map((r: { nom: string }) => r.nom)).toEqual(["Rapport A"]);
  });

  it("refuse à un technicien l'accès au rapport d'un autre technicien de la même organisation", async () => {
    const organization = await createOrganization();
    organizationIds.push(organization.id);
    const techA = await createUser({ organizationId: organization.id, role: UserRole.TECHNICIEN });
    const techB = await createUser({ organizationId: organization.id, role: UserRole.TECHNICIEN });
    const created = await request(app).post("/api/rapports-terrain").set(authHeader(techA)).send({ nom: "Privé" });
    const rapportId = created.body.rapportTerrain.id as string;

    const response = await request(app).get(`/api/rapports-terrain/${rapportId}`).set(authHeader(techB));

    expect(response.status).toBe(404);
  });

  it("refuse l'accès cross-tenant à un rapport terrain", async () => {
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    organizationIds.push(orgA.id, orgB.id);
    const techA = await createUser({ organizationId: orgA.id, role: UserRole.TECHNICIEN });
    const adminB = await createUser({ organizationId: orgB.id, role: UserRole.ADMIN });
    const created = await request(app).post("/api/rapports-terrain").set(authHeader(techA)).send({ nom: "Org A" });
    const rapportId = created.body.rapportTerrain.id as string;

    const response = await request(app).get(`/api/rapports-terrain/${rapportId}`).set(authHeader(adminB));

    expect(response.status).toBe(404);
  });

  it("génère un PDF pour un rapport terrain et l'enregistre dans son historique", async () => {
    const organization = await createOrganization();
    organizationIds.push(organization.id);
    const technician = await createUser({ organizationId: organization.id, role: UserRole.TECHNICIEN });
    const created = await request(app).post("/api/rapports-terrain").set(authHeader(technician)).send({ nom: "Rapport PDF", observation: "Tout est en ordre" });
    const rapportId = created.body.rapportTerrain.id as string;
    await request(app).post(`/api/rapports-terrain/${rapportId}/items`).set(authHeader(technician)).send({ titre: "Point A" });

    const generated = await request(app).post(`/api/rapports-terrain/${rapportId}/pdf`).set(authHeader(technician));
    expect(generated.status).toBe(201);
    expect(generated.body.pdf.rapportTerrainId).toBe(rapportId);

    const list = await request(app).get(`/api/rapports-terrain/${rapportId}/pdf`).set(authHeader(technician));
    expect(list.status).toBe(200);
    expect(list.body.pdfs).toHaveLength(1);

    const file = await request(app).get(`/api/files/rapport-terrain-pdfs/${generated.body.pdf.id}`).set(authHeader(technician));
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toContain("application/pdf");
  });

  it("journalise la création, l'ajout d'entrée et la génération dans l'historique du rapport terrain", async () => {
    const organization = await createOrganization();
    organizationIds.push(organization.id);
    const technician = await createUser({ organizationId: organization.id, role: UserRole.TECHNICIEN });
    const created = await request(app).post("/api/rapports-terrain").set(authHeader(technician)).send({ nom: "Rapport journalisé" });
    const rapportId = created.body.rapportTerrain.id as string;
    await request(app).post(`/api/rapports-terrain/${rapportId}/items`).set(authHeader(technician)).send({ titre: "Entrée" });
    await request(app).post(`/api/rapports-terrain/${rapportId}/pdf`).set(authHeader(technician));

    const logs = await prisma.rapportTerrainActivityLog.findMany({ where: { rapportTerrainId: rapportId }, orderBy: { createdAt: "asc" } });

    expect(logs.map((l) => l.action)).toEqual(["RAPPORT_TERRAIN_CREE", "RAPPORT_TERRAIN_ITEM_AJOUTE", "RAPPORT_TERRAIN_GENERE"]);
    expect(logs.every((l) => l.organizationId === organization.id)).toBe(true);
  });

  it("accepte un id fourni par le client pour un rapport et une entrée (rejeu hors ligne)", async () => {
    const organization = await createOrganization();
    organizationIds.push(organization.id);
    const technician = await createUser({ organizationId: organization.id, role: UserRole.TECHNICIEN });
    const clientRapportId = `local-${Date.now()}`;
    const clientItemId = `local-item-${Date.now()}`;

    const created = await request(app).post("/api/rapports-terrain").set(authHeader(technician)).send({ id: clientRapportId, nom: "Créé hors ligne" });
    expect(created.status).toBe(201);
    expect(created.body.rapportTerrain.id).toBe(clientRapportId);

    const item = await request(app).post(`/api/rapports-terrain/${clientRapportId}/items`).set(authHeader(technician)).send({ id: clientItemId, titre: "Entrée hors ligne" });
    expect(item.status).toBe(201);
    expect(item.body.item.id).toBe(clientItemId);
  });

  it("permet de modifier les informations générales d'un rapport", async () => {
    const organization = await createOrganization();
    organizationIds.push(organization.id);
    const technician = await createUser({ organizationId: organization.id, role: UserRole.TECHNICIEN });
    const created = await request(app).post("/api/rapports-terrain").set(authHeader(technician)).send({ nom: "Avant" });
    const rapportId = created.body.rapportTerrain.id as string;

    const updated = await request(app).patch(`/api/rapports-terrain/${rapportId}`).set(authHeader(technician)).send({ nom: "Après", observation: "Complété" });

    expect(updated.status).toBe(200);
    expect(updated.body.rapportTerrain.nom).toBe("Après");
    expect(updated.body.rapportTerrain.observation).toBe("Complété");
  });
});
