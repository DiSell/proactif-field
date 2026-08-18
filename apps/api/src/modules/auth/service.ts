import bcrypt from "bcryptjs";
import { prisma } from "../../config/db";
import { HttpError } from "../../middleware/errorHandler";
import { signToken } from "../../middleware/auth";

// Self-registration always creates a brand new Organization (the user
// becomes its first ADMIN) — there's no email-invitation flow yet, so
// joining an existing organization happens only via an ADMIN creating the
// account directly from /admin/users.
export async function registerUser(
  email: string,
  password: string,
  name: string,
  organizationName: string
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new HttpError(409, "Un compte existe déjà avec cet email");
  }
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({ data: { name: organizationName } });
    return tx.user.create({
      data: { email, passwordHash, name, role: "ADMIN", organizationId: organization.id },
    });
  });

  const token = signToken({ userId: user.id });
  return { token, user };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new HttpError(401, "Email ou mot de passe incorrect");
  }
  if (!user.isActive) {
    throw new HttpError(403, "Compte désactivé");
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new HttpError(401, "Email ou mot de passe incorrect");
  }
  const token = signToken({ userId: user.id });
  return { token, user };
}
