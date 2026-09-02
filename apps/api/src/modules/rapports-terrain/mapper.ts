import { RapportTerrain, RapportTerrainItem, RapportTerrainPhoto, RapportTerrainPdf, User } from "@prisma/client";
import { RapportTerrainDTO, RapportTerrainItemDTO, RapportTerrainPdfDTO, RapportTerrainPhotoDTO } from "@proactif-field/shared";

type ItemWithRelations = RapportTerrainItem & { photos: RapportTerrainPhoto[]; createdBy: Pick<User, "name"> };
type RapportWithRelations = RapportTerrain & { items: ItemWithRelations[]; createdBy: Pick<User, "name"> };
type PdfWithRelations = RapportTerrainPdf & { generatedBy: Pick<User, "name"> };

export function toRapportTerrainPhotoDTO(photo: RapportTerrainPhoto): RapportTerrainPhotoDTO {
  return {
    id: photo.id,
    rapportTerrainItemId: photo.rapportTerrainItemId,
    takenAt: photo.takenAt.toISOString(),
    gpsLat: photo.gpsLat,
    gpsLng: photo.gpsLng,
    gpsAccuracy: photo.gpsAccuracy,
    createdAt: photo.createdAt.toISOString(),
  };
}

export function toRapportTerrainItemDTO(item: ItemWithRelations): RapportTerrainItemDTO {
  return {
    id: item.id,
    rapportTerrainId: item.rapportTerrainId,
    createdById: item.createdById,
    createdByName: item.createdBy.name,
    titre: item.titre,
    commentaire: item.commentaire,
    latitude: item.latitude,
    longitude: item.longitude,
    gpsAccuracy: item.gpsAccuracy,
    capturedAt: item.capturedAt.toISOString(),
    photos: item.photos.map(toRapportTerrainPhotoDTO),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function toRapportTerrainDTO(rapport: RapportWithRelations): RapportTerrainDTO {
  return {
    id: rapport.id,
    organizationId: rapport.organizationId,
    createdById: rapport.createdById,
    createdByName: rapport.createdBy.name,
    nom: rapport.nom,
    typeTravaux: rapport.typeTravaux,
    observation: rapport.observation,
    latitude: rapport.latitude,
    longitude: rapport.longitude,
    gpsAccuracy: rapport.gpsAccuracy,
    lieu: rapport.lieu,
    items: rapport.items.map(toRapportTerrainItemDTO),
    itemCount: rapport.items.length,
    photoCount: rapport.items.reduce((sum, item) => sum + item.photos.length, 0),
    createdAt: rapport.createdAt.toISOString(),
    updatedAt: rapport.updatedAt.toISOString(),
  };
}

export function toRapportTerrainPdfDTO(pdf: PdfWithRelations): RapportTerrainPdfDTO {
  return {
    id: pdf.id,
    rapportTerrainId: pdf.rapportTerrainId,
    generatedAt: pdf.generatedAt.toISOString(),
    generatedById: pdf.generatedById,
    generatedByName: pdf.generatedBy.name,
  };
}
