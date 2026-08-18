import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../config/db";

export interface AuthPayload {
  userId: string;
}

export interface AuthContext {
  userId: string;
  organizationId: string;
  role: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "30d" });
}

// Looked up fresh on every request (rather than trusting the JWT payload)
// so a deactivated account or a role change takes effect immediately,
// without waiting for the token to expire.
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentification requise" });
    return;
  }
  const token = header.slice("Bearer ".length);
  let payload: AuthPayload;
  try {
    payload = jwt.verify(token, env.jwtSecret) as AuthPayload;
  } catch {
    res.status(401).json({ error: "Token invalide ou expiré" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    res.status(401).json({ error: "Token invalide ou expiré" });
    return;
  }
  if (!user.isActive) {
    res.status(403).json({ error: "Compte désactivé" });
    return;
  }

  req.auth = { userId: user.id, organizationId: user.organizationId, role: user.role };
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.role !== "ADMIN") {
    res.status(403).json({ error: "Réservé aux administrateurs" });
    return;
  }
  next();
}
