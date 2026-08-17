import { Photo } from "@prisma/client";
import { PhotoDTO } from "@proactif-field/shared";

export function toPhotoDTO(photo: Photo): PhotoDTO {
  return {
    id: photo.id,
    pointId: photo.pointId,
    takenAt: photo.takenAt.toISOString(),
    gpsLat: photo.gpsLat,
    gpsLng: photo.gpsLng,
    gpsAccuracy: photo.gpsAccuracy,
    createdAt: photo.createdAt.toISOString(),
  };
}
