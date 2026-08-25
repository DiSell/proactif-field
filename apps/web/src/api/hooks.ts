import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityLogPageDTO,
  ChantierDTO,
  BlocageDTO,
  BlocageStatut,
  CreateBlocageInput,
  UpdateBlocageInput,
  CreateMaterielInput,
  CreatePointInput,
  CreateUserInput,
  DashboardStatsDTO,
  DocumentDTO,
  MaterielDTO,
  PhotoDTO,
  PlanDTO,
  PointDTO,
  ReportDTO,
  TermSuggestionDTO,
  UpdateMaterielInput,
  UpdatePointInput,
  UpdateUserInput,
  UserDTO,
  OrganizationDTO,
  UpdateOrganizationInput,
} from "@proactif-field/shared";
import { apiDelete, apiGet, apiPatchJson, apiPostForm, apiPostJson } from "./client";
import { currentSnapshot, currentSnapshots, refreshAssignedSnapshots, refreshChantierSnapshot } from "../offline/snapshots";
import { createLocalBlocage, createLocalPoint, enqueueBlocagePhoto, findSnapshotByPlan, findSnapshotByPoint, updateLocalBlocage, updateLocalMateriel, updateLocalPoint } from "../offline/localData";
import { trySync } from "../offline/syncManager";

async function onlineOrLocal<T>(online: () => Promise<T>, local: () => Promise<T>): Promise<T> {
  if (!navigator.onLine) return local();
  try { return await online(); } catch (error) {
    if (!navigator.onLine || error instanceof TypeError) return local();
    throw error;
  }
}

export function useChantiers() {
  return useQuery({
    queryKey: ["chantiers"],
    queryFn: () => onlineOrLocal(
      async () => { const result = await apiGet<{ chantiers: ChantierDTO[] }>("/api/chantiers").then((r) => r.chantiers); void refreshAssignedSnapshots(result).catch((error) => console.error("Préchargement hors ligne incomplet", error)); return result; },
      async () => (await currentSnapshots()).map((snapshot) => snapshot.chantier)
    ),
  });
}

export function useChantier(id: string | undefined) {
  return useQuery({
    queryKey: ["chantiers", id],
    queryFn: () => onlineOrLocal(
      () => apiGet<{ chantier: ChantierDTO }>(`/api/chantiers/${id}`).then((r) => r.chantier),
      async () => { const snapshot = await currentSnapshot(id!); if (!snapshot) throw new Error("Chantier non synchronisé"); return snapshot.chantier; }
    ),
    enabled: !!id,
  });
}

export function useCreateChantier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description?: string; address?: string }) =>
      apiPostJson<{ chantier: ChantierDTO }>("/api/chantiers", input).then((r) => r.chantier),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chantiers"] }),
  });
}

export function usePlans(chantierId: string | undefined) {
  return useQuery({
    queryKey: ["chantiers", chantierId, "plans"],
    queryFn: () => onlineOrLocal(
      async () => { const plans = await apiGet<{ plans: PlanDTO[] }>(`/api/chantiers/${chantierId}/plans`).then((r) => r.plans); void refreshChantierSnapshot(chantierId!).catch((error) => console.error("Préchargement hors ligne incomplet", error)); return plans; },
      async () => (await currentSnapshot(chantierId!))?.plans ?? []
    ),
    enabled: !!chantierId,
  });
}

export function useUploadPlan(chantierId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiPostForm<{ plan: PlanDTO }>(`/api/chantiers/${chantierId}/plans`, form).then(
        (r) => r.plan
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chantiers", chantierId, "plans"] }),
  });
}

export function usePoints(planId: string | undefined) {
  return useQuery({
    queryKey: ["plans", planId, "points"],
    queryFn: () => onlineOrLocal(
      () => apiGet<{ points: PointDTO[] }>(`/api/plans/${planId}/points`).then((r) => r.points),
      async () => (await findSnapshotByPlan(planId!))?.points.filter((point) => point.planId === planId) ?? []
    ),
    enabled: !!planId,
    refetchInterval: 15000,
  });
}

export function useChantierPoints(chantierId: string | undefined) {
  return useQuery({
    queryKey: ["chantiers", chantierId, "points"],
    queryFn: () => onlineOrLocal(
      () => apiGet<{ points: PointDTO[] }>(`/api/chantiers/${chantierId}/points`).then((r) => r.points),
      async () => (await currentSnapshot(chantierId!))?.points ?? []
    ),
    enabled: !!chantierId,
  });
}

export function useCreatePoint(planId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePointInput) => onlineOrLocal(
      () => apiPostJson<{ point: PointDTO }>(`/api/plans/${planId}/points`, input).then((r) => r.point),
      () => createLocalPoint(planId!, { ...input, id: input.id ?? crypto.randomUUID() })
    ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plans", planId, "points"] }),
  });
}

export function useUpdatePoint(planId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePointInput }) => onlineOrLocal(
      () => apiPatchJson<{ point: PointDTO }>(`/api/points/${id}`, input).then((r) => r.point),
      () => updateLocalPoint(id, input)
    ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plans", planId, "points"] }),
  });
}

export function useDeletePoint(planId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/points/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plans", planId, "points"] }),
  });
}

export function usePointBlocages(pointId: string | undefined) {
  return useQuery({ queryKey: ["points", pointId, "blocages"], queryFn: () => onlineOrLocal(() => apiGet<{ blocages: BlocageDTO[] }>(`/api/points/${pointId}/blocages`).then((r) => r.blocages), async () => (await findSnapshotByPoint(pointId!))?.blocages.filter((blocage) => blocage.pointId === pointId) ?? []), enabled: !!pointId });
}

export function useChantierBlocages(chantierId: string | undefined, statut?: BlocageStatut) {
  return useQuery({ queryKey: ["chantiers", chantierId, "blocages", statut ?? "TOUS"], queryFn: () => onlineOrLocal(() => apiGet<{ blocages: BlocageDTO[] }>(`/api/chantiers/${chantierId}/blocages${statut ? `?statut=${statut}` : ""}`).then((r) => r.blocages), async () => ((await currentSnapshot(chantierId!))?.blocages ?? []).filter((blocage) => !statut || blocage.statut === statut)), enabled: !!chantierId });
}

export function useCreateBlocage(planId: string | undefined, pointId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: CreateBlocageInput) => onlineOrLocal(() => apiPostJson<{ blocage: BlocageDTO }>(`/api/points/${pointId}/blocages`, input).then((r) => r.blocage), () => createLocalBlocage(pointId!, { ...input, id: input.id ?? crypto.randomUUID() })), onSuccess: (blocage) => { qc.invalidateQueries({ queryKey: ["points", pointId, "blocages"] }); qc.invalidateQueries({ queryKey: ["plans", planId, "points"] }); qc.invalidateQueries({ queryKey: ["chantiers", blocage.chantierId, "blocages"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); void trySync(); } });
}

export function useUpdateBlocage(planId: string | undefined, chantierId?: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: UpdateBlocageInput }) => onlineOrLocal(() => apiPatchJson<{ blocage: BlocageDTO }>(`/api/blocages/${id}`, input).then((r) => r.blocage), () => updateLocalBlocage(id, input)), onSuccess: (blocage) => { qc.invalidateQueries({ queryKey: ["points", blocage.pointId, "blocages"] }); qc.invalidateQueries({ queryKey: ["plans", planId, "points"] }); qc.invalidateQueries({ queryKey: ["chantiers", blocage.chantierId, "points"] }); qc.invalidateQueries({ queryKey: ["chantiers", chantierId ?? blocage.chantierId, "blocages"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); void trySync(); } });
}

export function useUploadBlocagePhoto(pointId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ blocageId, form }: { blocageId: string; form: FormData }) => onlineOrLocal(() => apiPostForm<{ photo: PhotoDTO }>(`/api/blocages/${blocageId}/photos`, form).then((r) => r.photo), () => enqueueBlocagePhoto(blocageId, form)), onSuccess: () => { qc.invalidateQueries({ queryKey: ["points", pointId, "blocages"] }); void trySync(); } });
}

export function usePhotos(pointId: string | undefined) {
  return useQuery({
    queryKey: ["points", pointId, "photos"],
    queryFn: () => onlineOrLocal(() => apiGet<{ photos: PhotoDTO[] }>(`/api/points/${pointId}/photos`).then((r) => r.photos), async () => (await findSnapshotByPoint(pointId!))?.photos.filter((photo) => photo.pointId === pointId && !photo.blocageId) ?? []),
    enabled: !!pointId,
  });
}

export function useTermSuggestions(field: string, query: string, enabled: boolean) {
  return useQuery({
    queryKey: ["terms", field, query],
    queryFn: () =>
      apiGet<{ suggestions: TermSuggestionDTO[] }>(
        `/api/terms?field=${encodeURIComponent(field)}&q=${encodeURIComponent(query)}`
      ).then((r) => r.suggestions),
    enabled,
    staleTime: 10000,
  });
}

export function useRecordTerm() {
  return useMutation({
    mutationFn: (input: { field: string; value: string }) =>
      apiPostJson<{ suggestion: TermSuggestionDTO }>("/api/terms", input),
  });
}

export function useChantierReports(chantierId: string | undefined) {
  return useQuery({
    queryKey: ["chantiers", chantierId, "reports"],
    queryFn: () =>
      apiGet<{ reports: ReportDTO[] }>(`/api/chantiers/${chantierId}/reports`).then((r) => r.reports),
    enabled: !!chantierId,
  });
}

export function useGenerateReport(chantierId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiPostJson<{ report: { id: string } }>(`/api/chantiers/${chantierId}/reports`, {}).then(
        (r) => r.report
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chantiers", chantierId, "reports"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// Simple "load more" pagination: pass the previous page's nextCursor to
// fetch the next batch; the page component accumulates results itself.
export function useChantierActivity(chantierId: string | undefined, cursor: string | null) {
  return useQuery({
    queryKey: ["chantiers", chantierId, "activity", cursor ?? "first"],
    queryFn: () =>
      apiGet<ActivityLogPageDTO>(
        `/api/chantiers/${chantierId}/activity${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`
      ),
    enabled: !!chantierId,
  });
}

export function useAssignChantier(chantierId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiPostJson<{ chantier: ChantierDTO }>(`/api/chantiers/${chantierId}/assignments`, { userId }).then(
        (r) => r.chantier
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chantiers"] });
      qc.invalidateQueries({ queryKey: ["chantiers", chantierId] });
    },
  });
}

export function useUnassignChantier(chantierId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => apiDelete(`/api/chantiers/${chantierId}/assignments/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chantiers"] });
      qc.invalidateQueries({ queryKey: ["chantiers", chantierId] });
    },
  });
}

export function useMarkAssignmentSeen(chantierId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPostJson(`/api/chantiers/${chantierId}/assignments/seen`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chantiers"] }),
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => apiGet<{ users: UserDTO[] }>("/api/users").then((r) => r.users),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) =>
      apiPostJson<{ user: UserDTO }>("/api/users", input).then((r) => r.user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useResendUserInvitation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => apiPostJson(`/api/users/${id}/resend-invitation`, {}), onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }) });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      apiPatchJson<{ user: UserDTO }>(`/api/users/${id}`, input).then((r) => r.user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => apiDelete(`/api/users/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); qc.invalidateQueries({ queryKey: ["chantiers"] }); } });
}

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiGet<DashboardStatsDTO>("/api/dashboard"),
  });
}

export function useDocuments(chantierId: string | undefined) {
  return useQuery({
    queryKey: ["chantiers", chantierId, "documents"],
    queryFn: () =>
      apiGet<{ documents: DocumentDTO[] }>(`/api/chantiers/${chantierId}/documents`).then((r) => r.documents),
    enabled: !!chantierId,
  });
}

export function useUploadDocument(chantierId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) =>
      apiPostForm<{ document: DocumentDTO }>(`/api/chantiers/${chantierId}/documents`, form).then(
        (r) => r.document
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chantiers", chantierId, "documents"] }),
  });
}

export function useDeleteDocument(chantierId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/documents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chantiers", chantierId, "documents"] }),
  });
}

export function useOrgReports() {
  return useQuery({
    queryKey: ["reports"],
    queryFn: () => apiGet<{ reports: ReportDTO[] }>("/api/reports").then((r) => r.reports),
  });
}

export function useOrganization() {
  return useQuery({ queryKey: ["organization"], queryFn: () => apiGet<{ organization: OrganizationDTO }>("/api/organization").then((result) => result.organization) });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: UpdateOrganizationInput) => apiPatchJson<{ organization: OrganizationDTO }>("/api/organization", input).then((result) => result.organization), onSuccess: (organization) => qc.setQueryData(["organization"], organization) });
}

export function useChantierMateriel(chantierId: string | undefined) {
  return useQuery({
    queryKey: ["chantiers", chantierId, "materiel"],
    queryFn: () => onlineOrLocal(
      () => apiGet<{ materiels: MaterielDTO[] }>(`/api/chantiers/${chantierId}/materiel`).then((r) => r.materiels),
      async () => (await currentSnapshot(chantierId!))?.materiels ?? []
    ),
    enabled: !!chantierId,
  });
}

export function useCreateMateriel(chantierId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMaterielInput) =>
      apiPostJson<{ materiel: MaterielDTO }>(`/api/chantiers/${chantierId}/materiel`, input).then((r) => r.materiel),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chantiers", chantierId, "materiel"] }),
  });
}

// Online: PATCH straight away. Offline: written into the snapshot + queued
// as a MATERIEL_UPDATE operation for the next sync — the only offline
// materiel path (create/delete stay ADMIN-only, online-only, matching
// documents/plans).
export function useUpdateMateriel(chantierId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMaterielInput }) => onlineOrLocal(
      () => apiPatchJson<{ materiel: MaterielDTO }>(`/api/materiel/${id}`, input).then((r) => r.materiel),
      () => updateLocalMateriel(id, input)
    ),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["chantiers", chantierId, "materiel"] }); void trySync(); },
  });
}

export function useDeleteMateriel(chantierId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/materiel/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chantiers", chantierId, "materiel"] }),
  });
}

export function useUploadOrganizationLogo() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (file: File) => { const form = new FormData(); form.append("file", file); return apiPostForm<{ organization: OrganizationDTO }>("/api/organization/logo", form).then((result) => result.organization); }, onSuccess: (organization) => qc.setQueryData(["organization"], organization) });
}
