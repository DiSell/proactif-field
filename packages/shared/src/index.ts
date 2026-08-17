export enum PointStatut {
  GRIS = "GRIS",
  ORANGE = "ORANGE",
  VERT = "VERT",
}

export enum PlanFileType {
  PDF = "PDF",
  PNG = "PNG",
  JPG = "JPG",
  SVG = "SVG",
}

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface ChantierDTO {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanDTO {
  id: string;
  chantierId: string;
  fileName: string;
  fileType: PlanFileType;
  width: number | null;
  height: number | null;
  uploadedAt: string;
}

export interface PointDTO {
  id: string;
  planId: string;
  identifiant: string;
  nom: string | null;
  type: string | null;
  commentaire: string | null;
  statut: PointStatut;
  x: number;
  y: number;
  photoCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PhotoDTO {
  id: string;
  pointId: string;
  takenAt: string;
  gpsLat: number | null;
  gpsLng: number | null;
  gpsAccuracy: number | null;
  createdAt: string;
}

export interface ReportDTO {
  id: string;
  chantierId: string;
  generatedAt: string;
  generatedById: string;
}

export interface CreatePointInput {
  identifiant: string;
  nom?: string;
  type?: string;
  commentaire?: string;
  statut?: PointStatut;
  x: number;
  y: number;
}

export interface UpdatePointInput {
  identifiant?: string;
  nom?: string | null;
  type?: string | null;
  commentaire?: string | null;
  statut?: PointStatut;
  x?: number;
  y?: number;
}

export interface CreatePhotoInput {
  takenAt: string;
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsAccuracy?: number | null;
}
