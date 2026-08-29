import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { PlanFileType } from "@prisma/client";
import { createApp } from "../src/app";
import { prisma } from "../src/config/db";
import { cleanupOrganization } from "./helpers/cleanup";
import { authHeader, createChantier, createOrganization, createUser } from "./helpers/factory";

describe("Tracé des blocages", () => {
  const organizationIds: string[] = [];
  afterEach(async () => {
    for (const organizationId of organizationIds.splice(0)) await cleanupOrganization(organizationId);
  });

  it("conserve les flexions et cumule la distance GPS des segments", async () => {
    const organization = await createOrganization();
    organizationIds.push(organization.id);
    const admin = await createUser({ organizationId: organization.id });
    const chantier = await createChantier({ organizationId: organization.id, createdById: admin.id });
    const plan = await prisma.plan.create({ data: { chantierId: chantier.id, fileName: "plan.png", filePath: "plans/plan.png", fileType: PlanFileType.PNG } });
    const point = await prisma.point.create({ data: { planId: plan.id, identifiant: "P1", x: 0.8, y: 0.8 } });

    const response = await request(createApp())
      .post(`/api/points/${point.id}/blocages`)
      .set(authHeader(admin))
      .send({
        titre: "Obstacle courbe",
        description: "Contourner la zone",
        priorite: "NORMALE",
        startX: 0.1,
        startY: 0.1,
        endX: 0.8,
        endY: 0.8,
        startGpsLat: 48,
        startGpsLng: 2,
        flexionPoints: [{ x: 0.4, y: 0.2, gpsLat: 48.0001, gpsLng: 2.0001, gpsAccuracy: 5 }],
        endGpsLat: 48.0002,
        endGpsLng: 2.0002,
      });

    expect(response.status).toBe(201);
    expect(response.body.blocage.flexionPoints).toEqual([{ x: 0.4, y: 0.2, gpsLat: 48.0001, gpsLng: 2.0001, gpsAccuracy: 5 }]);
    expect(response.body.blocage.distanceMeters).toBeGreaterThan(20);
  });
});
