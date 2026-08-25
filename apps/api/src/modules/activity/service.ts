import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db";

// Every action the audit trail can record. Kept as a union (not the DB
// column, which stays a plain string) so every call site is type-checked
// against the list this module actually understands.
export type ActivityAction =
  | "CHANTIER_CREE"
  | "CHANTIER_MODIFIE"
  | "PLAN_AJOUTE"
  | "DOCUMENT_AJOUTE"
  | "POINT_CREE"
  | "POINT_MODIFIE"
  | "POINT_STATUT_MODIFIE"
  | "PHOTO_AJOUTEE"
  | "TECHNICIEN_AFFECTE"
  | "TECHNICIEN_DESAFFECTE"
  | "RAPPORT_GENERE"
  | "BLOCAGE_CREE"
  | "BLOCAGE_MODIFIE"
  | "BLOCAGE_RESOLU"
  | "MATERIEL_AJOUTE"
  | "MATERIEL_MODIFIE"
  | "MATERIEL_SUPPRIME";

// Explicit allowlist of metadata keys per action — the ONLY fields that can
// ever land in ActivityLog.metadata. A caller passing an extra or
// unexpected key (a stray object, a raw entity, anything not on this list)
// silently loses it rather than having it persisted. This is what keeps
// every module's log entries structurally compatible with the timeline
// renderer, and keeps secrets/file contents out by construction: nothing
// resembling a password, token or file body is ever on these lists.
const METADATA_KEYS: Record<ActivityAction, readonly string[]> = {
  CHANTIER_CREE: [],
  CHANTIER_MODIFIE: [],
  PLAN_AJOUTE: ["planId", "planName"],
  DOCUMENT_AJOUTE: ["documentId", "documentName"],
  POINT_CREE: ["pointId", "pointIdentifiant", "planId"],
  POINT_MODIFIE: ["pointId", "pointIdentifiant"],
  POINT_STATUT_MODIFIE: ["pointId", "pointIdentifiant", "previousStatut", "newStatut"],
  PHOTO_AJOUTEE: ["pointId", "pointIdentifiant"],
  TECHNICIEN_AFFECTE: ["technicianId", "technicianName"],
  TECHNICIEN_DESAFFECTE: ["technicianId", "technicianName"],
  RAPPORT_GENERE: ["reportId"],
  BLOCAGE_CREE: ["blocageId", "pointId", "pointIdentifiant"],
  BLOCAGE_MODIFIE: ["blocageId", "pointId", "pointIdentifiant"],
  BLOCAGE_RESOLU: ["blocageId", "pointId", "pointIdentifiant"],
  MATERIEL_AJOUTE: ["materielId", "designation", "reference"],
  MATERIEL_MODIFIE: ["materielId", "designation", "reference", "previousQuantiteUtilisee", "newQuantiteUtilisee"],
  MATERIEL_SUPPRIME: ["materielId", "designation", "reference"],
};

type MetadataValue = string | number | boolean;

export interface LogActivityInput {
  organizationId: string;
  chantierId: string;
  userId: string;
  action: ActivityAction;
  description?: string | null;
  metadata?: Record<string, MetadataValue | null | undefined>;
}

function sanitizeMetadata(
  action: ActivityAction,
  metadata: LogActivityInput["metadata"]
): Prisma.JsonObject | undefined {
  if (!metadata) return undefined;
  const allowedKeys = METADATA_KEYS[action] ?? [];
  const filtered: Prisma.JsonObject = {};
  for (const key of allowedKeys) {
    const value = metadata[key];
    if (value !== undefined && value !== null) filtered[key] = value;
  }
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

// Central write path for the chantier audit trail. Every module records an
// event through this function instead of calling `activityLog.create`
// directly, so metadata always passes through the same allowlist. Pass a
// transaction client when the log must be atomic with the write it
// documents (see blocages/routes.ts); otherwise it runs as a standalone,
// best-effort write that callers fire-and-forget so a logging hiccup never
// blocks the real business action.
export async function logActivity(
  input: LogActivityInput,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  await client.activityLog.create({
    data: {
      organizationId: input.organizationId,
      chantierId: input.chantierId,
      userId: input.userId,
      action: input.action,
      description: input.description ?? null,
      metadata: sanitizeMetadata(input.action, input.metadata),
    },
  });
}

// Fire-and-forget variant for the common case: the log is a secondary
// record of something that already succeeded, so a transient DB hiccup on
// this write must never fail (or delay) the request that triggered it.
export function logActivityAsync(input: LogActivityInput): void {
  void logActivity(input).catch((error) => console.error("Journalisation d'activité impossible", error));
}
