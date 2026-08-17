import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChantierDTO,
  CreatePointInput,
  PhotoDTO,
  PlanDTO,
  PointDTO,
  TermSuggestionDTO,
  UpdatePointInput,
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
