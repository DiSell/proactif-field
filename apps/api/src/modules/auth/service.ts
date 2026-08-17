import bcrypt from "bcryptjs";
import { prisma } from "../../config/db";
import { HttpError } from "../../middleware/errorHandler";
import { signToken } from "../../middleware/auth";

export async function registerUser(email: string, password: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new HttpError(409, "Un compte existe déjà avec cet email");
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, name },
  });
  const token = signToken({ userId: user.id });
  return { token, user };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new HttpError(401, "Email ou mot de passe incorrect");
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new HttpError(401, "Email ou mot de passe incorrect");
  }
  const token = signToken({ userId: user.id });
  return { token, user };
}
