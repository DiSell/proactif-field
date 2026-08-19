import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChantierDTO,
  CreatePointInput,
  CreateUserInput,
  DashboardStatsDTO,
  DocumentDTO,
  PhotoDTO,
  PlanDTO,
  PointDTO,
  ReportDTO,
  TermSuggestionDTO,
  UpdatePointInput,
  UpdateUserInput,
  UserDTO,
} from "@proactif-field/shared";
import { apiDelete, apiGet, apiPatchJson, apiPostForm, apiPostJson } from "./client";

export function useChantiers() {
  return useQuery({
    queryKey: ["chantiers"],
    queryFn: () => apiGet<{ chantiers: ChantierDTO[] }>("/api/chantiers").then((r) => r.chantiers),
  });
}

export function useChantier(id: string | undefined) {
  return useQuery({
    queryKey: ["chantiers", id],
    queryFn: () => apiGet<{ chantier: ChantierDTO }>(`/api/chantiers/${id}`).then((r) => r.chantier),
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
    queryFn: () =>
      apiGet<{ plans: PlanDTO[] }>(`/api/chantiers/${chantierId}/plans`).then((r) => r.plans),
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
    queryFn: () => apiGet<{ points: PointDTO[] }>(`/api/plans/${planId}/points`).then((r) => r.points),
    enabled: !!planId,
    refetchInterval: 15000,
  });
}

export function useChantierPoints(chantierId: string | undefined) {
  return useQuery({
    queryKey: ["chantiers", chantierId, "points"],
    queryFn: () =>
      apiGet<{ points: PointDTO[] }>(`/api/chantiers/${chantierId}/points`).then((r) => r.points),
    enabled: !!chantierId,
  });
}

export function useCreatePoint(planId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePointInput) =>
      apiPostJson<{ point: PointDTO }>(`/api/plans/${planId}/points`, input).then((r) => r.point),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plans", planId, "points"] }),
  });
}

export function useUpdatePoint(planId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePointInput }) =>
      apiPatchJson<{ point: PointDTO }>(`/api/points/${id}`, input).then((r) => r.point),
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

export function usePhotos(pointId: string | undefined) {
  return useQuery({
    queryKey: ["points", pointId, "photos"],
    queryFn: () => apiGet<{ photos: PhotoDTO[] }>(`/api/points/${pointId}/photos`).then((r) => r.photos),
    enabled: !!pointId,
  });
}

export function useUploadPhoto(planId: string | undefined, pointId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) =>
      apiPostForm<{ photo: PhotoDTO }>(`/api/points/${pointId}/photos`, form).then((r) => r.photo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["points", pointId, "photos"] });
      qc.invalidateQueries({ queryKey: ["plans", planId, "points"] });
    },
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

export function useGenerateReport(chantierId: string | undefined) {
  return useMutation({
    mutationFn: () =>
      apiPostJson<{ report: { id: string } }>(`/api/chantiers/${chantierId}/reports`, {}).then(
        (r) => r.report
      ),
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

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      apiPatchJson<{ user: UserDTO }>(`/api/users/${id}`, input).then((r) => r.user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
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
