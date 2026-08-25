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

export enum BlocageStatut {
  OUVERT = "OUVERT",
  RESOLU = "RESOLU",
}

export enum BlocagePriorite {
  FAIBLE = "FAIBLE",
  NORMALE = "NORMALE",
  HAUTE = "HAUTE",
}

export enum BlocagePhotoRole { DEPART = "DEPART", BLOCAGE = "BLOCAGE" }

export interface OrganizationDTO {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  legalName: string | null;
  logoUrl: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  contactEmail: string | null;
  notificationEmail: string | null;
  responsibleName: string | null;
  website: string | null;
  timezone: string;
  locale: string;
  notificationPreferences: Record<string, boolean>;
}

export type UpdateOrganizationInput = Partial<Pick<OrganizationDTO, "name" | "legalName" | "address" | "postalCode" | "city" | "country" | "phone" | "contactEmail" | "notificationEmail" | "responsibleName" | "website" | "timezone" | "locale">>;

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  organizationId: string;
  createdAt: string;
  invitationPending: boolean;
  phone: string | null;
  employerCompany: string | null;
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
  openBlocageCount: number;
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
  blocageId: string | null;
  blocageRole: BlocagePhotoRole | null;
}

export interface BlocageDTO {
  id: string;
  organizationId: string;
  chantierId: string;
  pointId: string;
  pointIdentifiant: string;
  createdById: string;
  createdByName: string;
  titre: string;
  description: string;
  statut: BlocageStatut;
  priorite: BlocagePriorite;
  photos: PhotoDTO[];
  photoCount: number;
  startX: number | null;
  startY: number | null;
  endX: number | null;
  endY: number | null;
  startGpsLat: number | null;
  startGpsLng: number | null;
  startGpsAccuracy: number | null;
  endGpsLat: number | null;
  endGpsLng: number | null;
  endGpsAccuracy: number | null;
  distanceMeters: number | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolvedById: string | null;
  resolvedByName: string | null;
}

export interface CreateBlocageInput {
  id?: string;
  titre: string;
  description: string;
  priorite: BlocagePriorite;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  startGpsLat?: number | null;
  startGpsLng?: number | null;
  startGpsAccuracy?: number | null;
  endGpsLat?: number | null;
  endGpsLng?: number | null;
  endGpsAccuracy?: number | null;
}

export interface UpdateBlocageInput {
  titre?: string;
  description?: string;
  priorite?: BlocagePriorite;
  statut?: BlocageStatut;
}

export interface ReportDTO {
  id: string;
  chantierId: string;
  chantierName: string;
  generatedAt: string;
  generatedById: string;
  generatedByName: string;
}

export interface ActivityLogDTO {
  id: string;
  chantierId: string;
  userId: string;
  userName: string;
  action: string;
  description: string | null;
  metadata: Record<string, string | number | boolean> | null;
  createdAt: string;
}

export interface ActivityLogPageDTO {
  activities: ActivityLogDTO[];
  nextCursor: string | null;
}

export interface DashboardStatsDTO {
  chantierCount: number;
  pointCount: number;
  pointCompleteCount: number;
  progressPercent: number;
  recentChantiers: ChantierDTO[];
  recentReports: ReportDTO[];
  openBlocageCount: number;
  recentBlocages: BlocageDTO[];
}

export interface CreatePointInput {
  id?: string;
  identifiant: string;
  nom?: string;
  type?: string;
  commentaire?: string;
  statut?: PointStatut;
  x: number;
  y: number;
}

export interface ChantierSyncDTO {
  chantier: ChantierDTO;
  plans: PlanDTO[];
  points: PointDTO[];
  blocages: BlocageDTO[];
  photos: PhotoDTO[];
  materiels: MaterielDTO[];
  syncedAt: string;
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

export interface MaterielDTO {
  id: string;
  chantierId: string;
  reference: string | null;
  designation: string;
  quantitePrevue: number | null;
  quantiteUtilisee: number | null;
  unite: string | null;
  commentaire: string | null;
  createdById: string;
  createdByName: string;
  updatedById: string | null;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMaterielInput {
  reference?: string;
  designation: string;
  quantitePrevue?: number | null;
  quantiteUtilisee?: number | null;
  unite?: string;
  commentaire?: string;
}

// Also used for the TECHNICIEN quick-edit, which the backend restricts to
// quantiteUtilisee/commentaire regardless of what this type allows — see
// modules/materiel/routes.ts.
export interface UpdateMaterielInput {
  reference?: string | null;
  designation?: string;
  quantitePrevue?: number | null;
  quantiteUtilisee?: number | null;
  unite?: string | null;
  commentaire?: string | null;
}

export interface CreateUserInput {
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  employerCompany?: string;
}

export interface UpdateUserInput {
  name?: string;
  role?: UserRole;
  isActive?: boolean;
  phone?: string | null;
  employerCompany?: string | null;
}
