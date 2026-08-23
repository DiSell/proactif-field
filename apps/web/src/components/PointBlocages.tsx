import { FormEvent, useState } from "react";
import { BlocagePhotoRole, BlocagePriorite, BlocageStatut, PointDTO } from "@proactif-field/shared";
import { useCreateBlocage, usePointBlocages, useUpdateBlocage, useUploadBlocagePhoto } from "../api/hooks";
import { useFileObjectUrl } from "../api/files";
import { getCurrentPositionSafe } from "../utils/geolocation";
import AutocompleteInput from "./AutocompleteInput";
import Icon from "./Icon";

interface Props { planId: string; point: PointDTO; blockageStart?: { x: number; y: number; gps: { lat: number; lng: number; accuracy: number } | null } | null; onPickBlockageStart?: () => void; }

export default function PointBlocages({ planId, point, blockageStart, onPickBlockageStart }: Props) {
  const { data: blocages } = usePointBlocages(point.id);
  const createBlocage = useCreateBlocage(planId, point.id);
  const updateBlocage = useUpdateBlocage(planId);
  const uploadPhoto = useUploadBlocagePhoto(point.id);
  const [formOpen, setFormOpen] = useState(false);
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [priorite, setPriorite] = useState(BlocagePriorite.NORMALE);
  const [startFiles, setStartFiles] = useState<File[]>([]);
  const [blockageFiles, setBlockageFiles] = useState<File[]>([]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!blockageStart) return;
    const endGps = await getCurrentPositionSafe();
    const created = await createBlocage.mutateAsync({ id: crypto.randomUUID(), titre, description, priorite, startX: blockageStart.x, startY: blockageStart.y, endX: point.x, endY: point.y, startGpsLat: blockageStart.gps?.lat ?? null, startGpsLng: blockageStart.gps?.lng ?? null, startGpsAccuracy: blockageStart.gps?.accuracy ?? null, endGpsLat: endGps?.lat ?? null, endGpsLng: endGps?.lng ?? null, endGpsAccuracy: endGps?.accuracy ?? null });
    for (const [file, role] of [...startFiles.map((file) => [file, BlocagePhotoRole.DEPART] as const), ...blockageFiles.map((file) => [file, BlocagePhotoRole.BLOCAGE] as const)]) {
      const form = new FormData(); form.append("file", file); form.append("takenAt", new Date().toISOString()); form.append("blocageRole", role);
      const gps = role === BlocagePhotoRole.DEPART ? blockageStart.gps : endGps;
      if (gps) { form.append("gpsLat", String(gps.lat)); form.append("gpsLng", String(gps.lng)); form.append("gpsAccuracy", String(gps.accuracy)); }
      await uploadPhoto.mutateAsync({ blocageId: created.id, form });
    }
    setTitre(""); setDescription(""); setPriorite(BlocagePriorite.NORMALE); setStartFiles([]); setBlockageFiles([]); setFormOpen(false);
  }

  const openBlocages = (blocages ?? []).filter((blocage) => blocage.statut === BlocageStatut.OUVERT);
  return <section className="point-blocages">
    <div className="point-blocages-head"><div><span>Blocages</span><strong>{openBlocages.length > 0 ? `${openBlocages.length} ouvert${openBlocages.length > 1 ? "s" : ""}` : "Aucun blocage ouvert"}</strong></div><button onClick={() => setFormOpen((open) => !open)}><Icon name={formOpen ? "close" : "warning"} /> {formOpen ? "Annuler" : "Signaler un blocage"}</button></div>
    {formOpen && <form className="blocage-create-form" onSubmit={submit}>
      <div className="field"><label>Titre / type</label><AutocompleteInput field="blocage.titre" value={titre} onChange={setTitre} placeholder="Décrire brièvement le problème" required /></div>
      <div className="field"><label>Priorité</label><select value={priorite} onChange={(event) => setPriorite(event.target.value as BlocagePriorite)}><option value={BlocagePriorite.FAIBLE}>Faible</option><option value={BlocagePriorite.NORMALE}>Normale</option><option value={BlocagePriorite.HAUTE}>Haute</option></select></div>
      <div className="field"><label>Description</label><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} required /></div>
      <div className="blocage-route-picker"><button type="button" className="btn secondary block" onClick={onPickBlockageStart}><Icon name="target" /> {blockageStart ? "Modifier le départ A" : "Placer le départ A sur le plan"}</button>{blockageStart && <small>Départ enregistré{blockageStart.gps ? ` · GPS ±${Math.round(blockageStart.gps.accuracy)} m` : " · sans GPS"}</small>}<div className="blocage-route-summary"><span>A · Départ</span><span>→</span><strong>✕ · Point bloquant</strong></div></div>
      <div className="field"><label>Photos du départ A</label><input type="file" accept="image/*" capture="environment" multiple onChange={(event) => setStartFiles(Array.from(event.target.files ?? []))} />{startFiles.length > 0 && <small>{startFiles.length} photo{startFiles.length > 1 ? "s" : ""}</small>}</div>
      <div className="field"><label>Photos du point bloquant</label><input type="file" accept="image/*" capture="environment" multiple onChange={(event) => setBlockageFiles(Array.from(event.target.files ?? []))} />{blockageFiles.length > 0 && <small>{blockageFiles.length} photo{blockageFiles.length > 1 ? "s" : ""}</small>}</div>
      <button className="btn block" disabled={createBlocage.isPending || !blockageStart}>{createBlocage.isPending ? "Déclaration…" : blockageStart ? "Déclarer le blocage" : "Placez d’abord le départ A"}</button>
    </form>}
    {(blocages ?? []).map((blocage) => <article key={blocage.id} className={`point-blocage-card ${blocage.statut}`}><div><span className={`priority ${blocage.priorite}`}>{blocage.priorite}</span><strong>{blocage.titre}</strong></div><p>{blocage.description}</p>{blocage.distanceMeters != null && <p className="blocage-measure">Distance GPS : <strong>{blocage.distanceMeters.toFixed(1)} m</strong></p>}<BlocageGallery title="Départ A" photos={blocage.photos.filter((photo) => photo.blocageRole === BlocagePhotoRole.DEPART)} /><BlocageGallery title="Point bloquant ✕" photos={blocage.photos.filter((photo) => photo.blocageRole !== BlocagePhotoRole.DEPART)} />{blocage.statut === BlocageStatut.OUVERT ? <button onClick={() => updateBlocage.mutate({ id: blocage.id, input: { statut: BlocageStatut.RESOLU } })}><Icon name="check" /> Marquer résolu</button> : <small>Résolu{blocage.resolvedByName ? ` par ${blocage.resolvedByName}` : ""}</small>}</article>)}
  </section>;
}

function BlocageGallery({ title, photos }: { title: string; photos: { id: string }[] }) {
  if (photos.length === 0) return null;
  return <div><small className="blocage-gallery-title">{title}</small><div className="blocage-photo-grid">{photos.map((photo) => <BlocagePhoto key={photo.id} photoId={photo.id} />)}</div></div>;
}

function BlocagePhoto({ photoId }: { photoId: string }) {
  const { url } = useFileObjectUrl("photos", photoId);
  if (!url) return <span className="blocage-photo-loading" />;
  return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Photo du blocage" /></a>;
}
