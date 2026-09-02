import { prisma } from "../../config/db";

// Mirrors modules/activity/service.ts (same allowlist-per-action shape),
// but writes to its own table: ActivityLog.chantierId is required and this
// report has no chantier, so it can't reuse that log without weakening a
// constraint shared by the whole existing chantier flow.
export type RapportTerrainActivityAction =
  | "RAPPORT_TERRAIN_CREE"
  | "RAPPORT_TERRAIN_MODIFIE"
  | "RAPPORT_TERRAIN_ITEM_AJOUTE"
  | "RAPPORT_TERRAIN_ITEM_SUPPRIME"
  | "RAPPORT_TERRAIN_PHOTO_AJOUTEE"
  | "RAPPORT_TERRAIN_GENERE"
  | "RAPPORT_TERRAIN_SUPPRIME";

const METADATA_KEYS: Record<RapportTerrainActivityAction, readonly string[]> = {
  RAPPORT_TERRAIN_CREE: [],
  RAPPORT_TERRAIN_MODIFIE: [],
  RAPPORT_TERRAIN_ITEM_AJOUTE: ["itemId", "itemTitre"],
  RAPPORT_TERRAIN_ITEM_SUPPRIME: ["itemId", "itemTitre"],
  RAPPORT_TERRAIN_PHOTO_AJOUTEE: ["itemId", "itemTitre"],
  RAPPORT_TERRAIN_GENERE: ["pdfId"],
  RAPPORT_TERRAIN_SUPPRIME: [],
};

type MetadataValue = string | number | boolean;

export interface LogRapportTerrainActivityInput {
  organizationId: string;
  rapportTerrainId: string;
  userId: string;
  action: RapportTerrainActivityAction;
  description?: string | null;
  metadata?: Record<string, MetadataValue | null | undefined>;
}

function sanitizeMetadata(action: RapportTerrainActivityAction, metadata: LogRapportTerrainActivityInput["metadata"]) {
  if (!metadata) return undefined;
  const allowedKeys = METADATA_KEYS[action] ?? [];
  const filtered: Record<string, MetadataValue> = {};
  for (const key of allowedKeys) {
    const value = metadata[key];
    if (value !== undefined && value !== null) filtered[key] = value;
  }
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

// Fire-and-forget, same rationale as logActivityAsync: a logging hiccup
// must never fail (or delay) the request that triggered it.
export function logRapportTerrainActivityAsync(input: LogRapportTerrainActivityInput): void {
  void prisma.rapportTerrainActivityLog
    .create({
      data: {
        organizationId: input.organizationId,
        rapportTerrainId: input.rapportTerrainId,
        userId: input.userId,
        action: input.action,
        description: input.description ?? null,
        metadata: sanitizeMetadata(input.action, input.metadata),
      },
    })
    .catch((error) => console.error("Journalisation d'activité (rapport terrain) impossible", error));
}
