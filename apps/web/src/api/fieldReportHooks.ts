import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreateRapportTerrainInput,
  CreateRapportTerrainItemInput,
  RapportTerrainDTO,
  RapportTerrainPdfDTO,
  UpdateRapportTerrainInput,
  UpdateRapportTerrainItemInput,
} from "@proactif-field/shared";
import { ApiError, apiGet, apiPostJson } from "./client";
import { useAuthStore } from "../auth/store";
import {
  createLocalFieldReport,
  createLocalFieldReportItem,
  deleteLocalFieldReport,
  getLocalFieldReportList,
  getLocalFieldReportRecord,
  mergeServerFieldReports,
  updateLocalFieldReport,
  updateLocalFieldReportItem,
} from "../offline/fieldReports";
import { onSyncChange, trySync } from "../offline/syncManager";
import { getLocalFieldReports } from "../offline/db";

// Kept in its own file rather than folded into api/hooks.ts: field reports
// are a separate, independent mode (see offline/fieldReports.ts) and don't
// share query keys or invalidation with anything chantier-related.
//
// Every write below (except PDF generation, which needs the server) goes
// through the local store first and lets trySync() push it — never a direct
// synchronous online call. Unlike chantier points/blocages, a field report
// has no pre-existing server snapshot to fall back to, so "local-first,
// sync in background" is the only option that's consistent whether online
// or offline — this also matches how PointFiche always writes a photo
// locally before syncing, online or not (see PhotoCapture/PointFiche).

const KEY = ["field-reports"] as const;

// Always ends by reading the local store, which is guaranteed fresh right
// after any local mutation (see the always-local-first writes below) — the
// online fetch, when it runs, is just a best-effort refresh merged into
// that same store first. A 404 from the online fetch is expected and
// harmless here: it just means "not synced to the server yet", not
// "doesn't exist" — the local copy (written the moment it was created)
// is still authoritative for this device either way.
async function refreshAndReadLocalFieldReports(): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user || !navigator.onLine) return;
  try {
    const list = await apiGet<{ rapportsTerrain: RapportTerrainDTO[] }>("/api/rapports-terrain").then((r) => r.rapportsTerrain);
    await mergeServerFieldReports(user.id, list);
  } catch (error) {
    if (!(error instanceof ApiError) && !(error instanceof TypeError)) throw error;
  }
}

export function useFieldReports() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const user = useAuthStore.getState().user;
      if (!user) return [];
      await refreshAndReadLocalFieldReports();
      return getLocalFieldReportList(user.id);
    },
  });
}

export function useFieldReport(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: async () => {
      const user = useAuthStore.getState().user;
      if (!user) throw new Error("Session absente");
      if (navigator.onLine) {
        try {
          const rapport = await apiGet<{ rapportTerrain: RapportTerrainDTO }>(`/api/rapports-terrain/${id}`).then((r) => r.rapportTerrain);
          await mergeServerFieldReports(user.id, [rapport]);
        } catch (error) {
          if (!(error instanceof ApiError) && !(error instanceof TypeError)) throw error;
        }
      }
      const local = await getLocalFieldReportRecord(user.id, id!);
      if (!local) throw new Error("Rapport terrain introuvable.");
      return local;
    },
    enabled: !!id,
  });
}

export function useCreateFieldReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRapportTerrainInput) => createLocalFieldReport(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); void trySync(); },
  });
}

export function useUpdateFieldReport(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateRapportTerrainInput) => updateLocalFieldReport(id!, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); void trySync(); },
  });
}

export function useDeleteFieldReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLocalFieldReport(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); void trySync(); },
  });
}

export function useCreateFieldReportItem(rapportId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRapportTerrainItemInput) => createLocalFieldReportItem(rapportId!, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [...KEY, rapportId] }); qc.invalidateQueries({ queryKey: KEY }); void trySync(); },
  });
}

export function useUpdateFieldReportItem(rapportId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRapportTerrainItemInput }) => updateLocalFieldReportItem(rapportId!, id, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [...KEY, rapportId] }); void trySync(); },
  });
}

// PDF generation needs the server (pdfkit runs there) — no offline path,
// same as useGenerateReport for chantier reports.
export function useGenerateFieldReportPdf(rapportId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPostJson<{ pdf: RapportTerrainPdfDTO }>(`/api/rapports-terrain/${rapportId}/pdf`, {}).then((r) => r.pdf),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, rapportId, "pdfs"] }),
  });
}

// Ids of reports with operations still queued locally — drives the "en
// attente de synchronisation" badge in the list/detail pages. Re-derived
// from the local store's `dirty` flag (see offline/fieldReports.ts) on
// every sync-state change, not from the query cache — sync can flip it
// without any query being invalidated.
export function useDirtyFieldReportIds(): Set<string> {
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  useEffect(() => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const refresh = () => { void getLocalFieldReports(user.id).then((records) => setDirty(new Set(records.filter((r) => r.dirty).map((r) => r.id)))); };
    refresh();
    return onSyncChange(refresh);
  }, []);
  return dirty;
}

export function useFieldReportPdfs(rapportId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, rapportId, "pdfs"],
    queryFn: () => apiGet<{ pdfs: RapportTerrainPdfDTO[] }>(`/api/rapports-terrain/${rapportId}/pdf`).then((r) => r.pdfs),
    enabled: !!rapportId,
  });
}
