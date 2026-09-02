import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateFieldReportItem,
  useDeleteFieldReport,
  useDirtyFieldReportIds,
  useFieldReport,
  useFieldReportPdfs,
  useGenerateFieldReportPdf,
  useUpdateFieldReport,
} from "../api/fieldReportHooks";
import { apiFetchArrayBuffer } from "../api/client";
import { addLocalFieldReportItemPhoto, updateLocalFieldReportItemPhotoGps } from "../offline/fieldReports";
import { trySync } from "../offline/syncManager";
import { getCurrentPositionSafe } from "../utils/geolocation";
import AutocompleteInput from "../components/AutocompleteInput";
import FieldReportItemCard from "../components/FieldReportItemCard";
import ReportPreview from "../components/ReportPreview";
import Icon from "../components/Icon";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function formatGps(lat: number | null, lng: number | null, accuracy: number | null): string | null {
  if (lat == null || lng == null) return null;
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}${accuracy != null ? ` (± ${Math.round(accuracy)} m)` : ""}`;
}

export default function FieldReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: rapport, isLoading, isError, error } = useFieldReport(id);
  const dirtyIds = useDirtyFieldReportIds();
  const createItem = useCreateFieldReportItem(id);
  const updateReport = useUpdateFieldReport(id);
  const deleteReport = useDeleteFieldReport();
  const generatePdf = useGenerateFieldReportPdf(id);
  const { data: pdfs } = useFieldReportPdfs(id);

  const [editingHeader, setEditingHeader] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [lastCreatedItemId, setLastCreatedItemId] = useState<string | null>(null);
  const [validatedItemIds, setValidatedItemIds] = useState<Set<string>>(new Set());
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [openingPdf, setOpeningPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleMainCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !id) return;
    setCapturing(true);
    try {
      const item = await createItem.mutateAsync({});
      setLastCreatedItemId(item.id);
      const photo = await addLocalFieldReportItemPhoto(id, item.id, file, null);
      qc.invalidateQueries({ queryKey: ["field-reports", id] });
      void trySync();
      getCurrentPositionSafe().then((gps) => {
        if (gps) void updateLocalFieldReportItemPhotoGps(id, item.id, photo.id, gps).then(() => qc.invalidateQueries({ queryKey: ["field-reports", id] }));
      });
    } finally {
      setCapturing(false);
    }
  }

  // "Valider" locks in the current entry (badge, no more nudging to finish
  // it) and immediately re-opens the camera for the next one — same
  // one-photo-at-a-time loop as PointFiche, just with an explicit step
  // between entries instead of relying only on the top capture button.
  function handleValidate(itemId: string) {
    setValidatedItemIds((prev) => new Set(prev).add(itemId));
    fileInputRef.current?.click();
  }

  async function handleDelete() {
    if (!id || !confirm("Supprimer ce rapport terrain et toutes ses photos ?")) return;
    await deleteReport.mutateAsync(id);
    navigate("/rapport-terrain", { replace: true });
  }

  async function handleGeneratePdf() {
    if (!id) return;
    setOpeningPdf(true);
    setPdfError(null);
    try {
      const pdf = await generatePdf.mutateAsync();
      setPdfBuffer(await apiFetchArrayBuffer(`/api/files/rapport-terrain-pdfs/${pdf.id}`));
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "Échec de la génération du PDF.");
    } finally {
      setOpeningPdf(false);
    }
  }

  async function openExistingPdf(pdfId: string) {
    setOpeningPdf(true);
    setPdfError(null);
    try {
      setPdfBuffer(await apiFetchArrayBuffer(`/api/files/rapport-terrain-pdfs/${pdfId}`));
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "Échec de l'ouverture du PDF.");
    } finally {
      setOpeningPdf(false);
    }
  }

  function pdfFileName(): string {
    return `rapport-terrain-${(rapport?.nom ?? "sans-nom").replace(/[^a-z0-9]+/gi, "-")}.pdf`;
  }

  function downloadPdf() {
    if (!pdfBuffer) return;
    const blob = new Blob([pdfBuffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = pdfFileName();
    a.click();
    URL.revokeObjectURL(url);
  }

  // Native share sheet (mobile) so the technician can send the PDF straight
  // to email/WhatsApp/etc. without a download-then-attach detour. Falls
  // back to a plain download wherever file sharing isn't supported (most
  // desktop browsers) rather than showing a button that would just fail.
  async function sharePdf() {
    if (!pdfBuffer) return;
    const file = new File([pdfBuffer], pdfFileName(), { type: "application/pdf" });
    const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean; share?: (data: { files: File[]; title?: string }) => Promise<void> };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: rapport?.nom ?? "Rapport terrain" });
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") setPdfError(err.message);
      }
    } else {
      downloadPdf();
    }
  }

  if (isError) {
    return (
      <div className="page">
        <div className="error-banner">{error instanceof Error ? error.message : "Impossible de charger ce rapport."}</div>
        <Link className="btn secondary" to="/rapport-terrain">Retour aux rapports terrain</Link>
      </div>
    );
  }

  if (isLoading || !rapport) return <div className="page"><p>Chargement…</p></div>;

  const gps = formatGps(rapport.latitude, rapport.longitude, rapport.gpsAccuracy);
  const items = [...rapport.items].reverse();

  return (
    <div className="page field-report-detail-page">
      <div className="field-report-detail-head">
        <Link to="/rapport-terrain" className="chantier-back" aria-label="Retour aux rapports terrain"><Icon name="back" /></Link>
        <div>
          <span className="section-title" style={{ margin: 0 }}>Rapport terrain{dirtyIds.has(rapport.id) && " · en attente de synchronisation"}</span>
          <h1 style={{ fontSize: 24 }}>{rapport.nom}</h1>
        </div>
      </div>

      {!editingHeader ? (
        <div className="card field-report-summary">
          <dl className="detail-list">
            <dt>Date</dt><dd>{formatDateTime(rapport.createdAt)}</dd>
            <dt>Technicien</dt><dd>{rapport.createdByName}</dd>
            {rapport.typeTravaux && <><dt>Type de travaux</dt><dd>{rapport.typeTravaux}</dd></>}
            {rapport.lieu && <><dt>Lieu</dt><dd>{rapport.lieu}</dd></>}
            <dt>GPS</dt><dd>{gps ?? "Indisponible"}</dd>
            {rapport.observation && <><dt>Observation</dt><dd>{rapport.observation}</dd></>}
          </dl>
          <button className="btn secondary" onClick={() => setEditingHeader(true)} style={{ marginTop: 10 }}>Modifier les informations</button>
        </div>
      ) : (
        <FieldReportHeaderForm rapport={rapport} onSave={(input) => { updateReport.mutate(input); setEditingHeader(false); }} onCancel={() => setEditingHeader(false)} />
      )}

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleMainCapture} />
      <button className="btn block field-report-main-capture" disabled={capturing} onClick={() => fileInputRef.current?.click()}>
        {!capturing && <Icon name="camera" />}{capturing ? "Enregistrement…" : "+ Nouveau point"}
      </button>

      {items.length === 0 ? (
        <p className="photo-section-empty" style={{ marginTop: 16 }}>Aucune entrée pour l'instant — prenez une photo pour commencer.</p>
      ) : (
        <div className="field-report-item-list">
          {items.map((item, index) => {
            const isActive = item.id === lastCreatedItemId && !validatedItemIds.has(item.id);
            return (
              <FieldReportItemCard
                key={item.id}
                rapportId={rapport.id}
                item={item}
                index={items.length - 1 - index}
                autoFocus={isActive}
                validated={validatedItemIds.has(item.id)}
                onValidate={isActive ? () => handleValidate(item.id) : undefined}
              />
            );
          })}
        </div>
      )}

      <div className="section-title" style={{ marginTop: 28 }}>Rapport PDF</div>
      {pdfError && <div className="error-banner">{pdfError}</div>}
      <button className="btn block" onClick={handleGeneratePdf} disabled={openingPdf || generatePdf.isPending}>
        <Icon name="report" /> {openingPdf || generatePdf.isPending ? "Génération…" : "Générer et prévisualiser le PDF"}
      </button>
      {pdfs && pdfs.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {pdfs.map((pdf) => (
            <div key={pdf.id} className="card user-card">
              <div><h3 style={{ fontSize: 14 }}>PDF du {formatDateTime(pdf.generatedAt)}</h3><p>Généré par {pdf.generatedByName}</p></div>
              <button className="btn secondary" onClick={() => openExistingPdf(pdf.id)} disabled={openingPdf}>Ouvrir</button>
            </div>
          ))}
        </div>
      )}
      {pdfBuffer && <ReportPreview arrayBuffer={pdfBuffer} onClose={() => setPdfBuffer(null)} onDownload={downloadPdf} onShare={sharePdf} />}

      <button className="btn danger block" style={{ marginTop: 24 }} onClick={handleDelete}>Supprimer ce rapport</button>
    </div>
  );
}

function FieldReportHeaderForm({ rapport, onSave, onCancel }: { rapport: { nom: string; typeTravaux: string | null; observation: string | null; lieu: string | null }; onSave: (input: { nom: string; typeTravaux: string | null; observation: string | null; lieu: string | null }) => void; onCancel: () => void }) {
  const [nom, setNom] = useState(rapport.nom);
  const [typeTravaux, setTypeTravaux] = useState(rapport.typeTravaux ?? "");
  const [lieu, setLieu] = useState(rapport.lieu ?? "");
  const [observation, setObservation] = useState(rapport.observation ?? "");

  return (
    <div className="card">
      <div className="field">
        <label>Nom du rapport</label>
        <input value={nom} onChange={(e) => setNom(e.target.value)} />
      </div>
      <div className="field">
        <label>Type de travaux</label>
        <AutocompleteInput field="rapportTerrain.typeTravaux" value={typeTravaux} onChange={setTypeTravaux} />
      </div>
      <div className="field">
        <label>Lieu</label>
        <AutocompleteInput field="rapportTerrain.lieu" value={lieu} onChange={setLieu} />
      </div>
      <div className="field">
        <label>Observation générale</label>
        <AutocompleteInput field="rapportTerrain.observation" value={observation} onChange={setObservation} multiline rows={3} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn" onClick={() => onSave({ nom: nom.trim() || rapport.nom, typeTravaux: typeTravaux.trim() || null, lieu: lieu.trim() || null, observation: observation.trim() || null })}>Enregistrer</button>
        <button className="btn secondary" onClick={onCancel}>Annuler</button>
      </div>
    </div>
  );
}
