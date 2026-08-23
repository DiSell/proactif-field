import crypto from "crypto";
import nodemailer from "nodemailer";
import { env } from "../../config/env";
import { HttpError } from "../../middleware/errorHandler";

export const invitationEmailEnabled = Boolean(env.smtpHost && env.smtpFrom);
const transporter = invitationEmailEnabled ? nodemailer.createTransport({ host: env.smtpHost, port: env.smtpPort, secure: env.smtpSecure, auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined }) : null;

export function createInvitationToken(): { raw: string; hash: string; expiresAt: Date } {
  const raw = crypto.randomBytes(32).toString("base64url");
  return { raw, hash: crypto.createHash("sha256").update(raw).digest("hex"), expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) };
}

export function hashInvitationToken(raw: string): string { return crypto.createHash("sha256").update(raw).digest("hex"); }
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!)); }

export async function sendTechnicianInvitation(input: { email: string; name: string; role: string; organizationName: string; contactEmail?: string | null; token: string }): Promise<void> {
  if (!transporter) throw new HttpError(503, "L'envoi d'invitations n'est pas encore configuré");
  const link = `${env.webUrl.replace(/\/$/, "")}/activate/${encodeURIComponent(input.token)}`;
  const technicalAddress = env.smtpFrom.match(/<([^>]+)>/)?.[1] ?? env.smtpFrom;
  const displayName = `${input.organizationName.replace(/["\r\n]/g, "")} via Proactif Field`;
  await transporter.sendMail({ from: { name: displayName, address: technicalAddress }, replyTo: input.contactEmail || undefined, to: input.email, subject: `Invitation ${input.organizationName} — Proactif Field`, text: `Bonjour ${input.name},\n\n${input.organizationName} vous invite sur Proactif Field avec le rôle ${input.role}. Choisissez votre mot de passe dans les 48 heures :\n${link}\n\nCe lien est personnel et à usage unique. Si vous n'attendiez pas cette invitation, ignorez cet e-mail.`, html: `<p>Bonjour ${escapeHtml(input.name)},</p><p><strong>${escapeHtml(input.organizationName)}</strong> vous invite sur Proactif Field avec le rôle <strong>${escapeHtml(input.role)}</strong>.</p><p><a href="${link}">Choisir mon mot de passe</a></p><p>Ce lien personnel expire dans 48 heures et ne fonctionne qu'une fois. Ne le transférez à personne.</p>` });
}
