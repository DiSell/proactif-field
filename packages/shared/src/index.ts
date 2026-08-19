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

export enum UserRole {
  ADMIN = "ADMIN",
  TECHNICIEN = "TECHNICIEN",
}

export interface OrganizationDTO {
  id: string;
  name: string;
  createdAt: string;
}

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  organizationId: string;
  createdAt: string;
}

export enum ChantierStatut {
  PREPARATION = "PREPARATION",
  PRET = "PRET",
  EN_COURS = "EN_COURS",
  BLOQUE = "BLOQUE",
  TERMINE = "TERMINE",
  CLOTURE = "CLOTURE",
}

export interface ChantierDTO {
  id: string;
  reference: string;
  name: string;
  description: string | null;
  address: string | null;
  client: string | null;
  entrepriseExecutante: string | null;
  dateDebutPrevue: string | null;
  dateFinPrevue: string | null;
  statut: ChantierStatut;
  organizationId: string;
  createdById: string;
  responsableId: string | null;
  responsableName: string | null;
  assignedUserIds: string[];
  // True only when the requesting (technician) user has an assignment on
  // this chantier they haven't opened yet. Always false for ADMIN.
  isNewAssignment: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateChantierInput {
  name?: string;
  description?: string | null;
  address?: string | null;
  client?: string | null;
  entrepriseExecutante?: string | null;
  dateDebutPrevue?: string | null;
  dateFinPrevue?: string | null;
  statut?: ChantierStatut;
  responsableId?: string | null;
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
  chantierName: string;
  generatedAt: string;
  generatedById: string;
  generatedByName: string;
}

export interface DashboardStatsDTO {
  chantierCount: number;
  pointCount: number;
  pointCompleteCount: number;
  progressPercent: number;
  recentChantiers: ChantierDTO[];
  recentReports: ReportDTO[];
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

export interface TermSuggestionDTO {
  value: string;
  useCount: number;
  lastUsedAt: string;
}

export interface CreatePhotoInput {
  takenAt: string;
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsAccuracy?: number | null;
}

export interface DocumentDTO {
  id: string;
  chantierId: string;
  category: string;
  name: string;
  version: string | null;
  date: string | null;
  author: string | null;
  commentaire: string | null;
  fileName: string;
  uploadedById: string;
  uploadedByName: string;
  createdAt: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserInput {
  name?: string;
  role?: UserRole;
  isActive?: boolean;
}
