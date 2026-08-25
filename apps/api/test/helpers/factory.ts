import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { prisma } from "../../src/config/db";
import { signToken } from "../../src/middleware/auth";

let counter = 0;
function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

export async function createOrganization(name = unique("Org")) {
  return prisma.organization.create({
    data: { name, contactEmail: `${unique("contact")}@example.test` },
  });
}

export async function createUser(params: {
  organizationId: string;
  role?: UserRole;
  isActive?: boolean;
  name?: string;
}) {
  // Cost factor kept low on purpose: tests never exercise the real login
  // flow (they authenticate via signToken directly), so a fast, throwaway
  // hash is enough — this just satisfies the NOT NULL column.
  const passwordHash = await bcrypt.hash("Test1234!", 4);
  return prisma.user.create({
    data: {
      organizationId: params.organizationId,
      role: params.role ?? UserRole.ADMIN,
      isActive: params.isActive ?? true,
      name: params.name ?? unique("User"),
      email: `${unique("user")}@example.test`,
      passwordHash,
    },
  });
}

export async function createChantier(params: { organizationId: string; createdById: string; name?: string }) {
  const count = await prisma.chantier.count({ where: { organizationId: params.organizationId } });
  return prisma.chantier.create({
    data: {
      organizationId: params.organizationId,
      createdById: params.createdById,
      name: params.name ?? unique("Chantier"),
      reference: unique("CH-TEST"),
    },
  });
}

export function authHeader(user: { id: string }): Record<string, string> {
  return { Authorization: `Bearer ${signToken({ userId: user.id })}` };
}

export async function assignTechnician(chantierId: string, userId: string) {
  return prisma.chantierAssignment.create({ data: { chantierId, userId } });
}
