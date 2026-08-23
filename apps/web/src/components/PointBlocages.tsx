import { FormEvent, useState } from "react";
import { BlocagePriorite, BlocageStatut, PointDTO } from "@proactif-field/shared";
import { useCreateBlocage, usePointBlocages, useUpdateBlocage, useUploadBlocagePhoto } from "../api/hooks";
import { useFileObjectUrl } from "../api/files";
import AutocompleteInput from "./AutocompleteInput";
import Icon from "./Icon";

export default function PointBlocages({ planId, point }: { planId: string; point: PointDTO }) {
  const { data: blocages } = usePointBlocages(point.id);
  const createBlocage = useCreateBlocage(planId, point.id);
  const updateBlocage = useUpdateBlocage(planId);
  const uploadPhoto = useUploadBlocagePhoto(point.id);
  const [formOpen, setFormOpen] = useState(false);
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [priorite, setPriorite] = useState(BlocagePriorite.NORMALE);
  const [files, setFiles] = useState<File[]>([]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const created = await createBlocage.mutateAsync({ id: crypto.randomUUID(), titre, description, priorite });
    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      form.append("takenAt", new Date().toISOString());
      await uploadPhoto.mutateAsync({ blocageId: created.id, form });
    }
    setTitre(""); setDescription(""); setPriorite(BlocagePriorite.NORMALE); setFiles([]); setFormOpen(false);
  }

  const openBlocages = (blocages ?? []).filter((blocage) => blocage.statut === BlocageStatut.OUVERT);
  return <section className="point-blocages">
    <div className="point-blocages-head"><div><span>Blocages</span><strong>{openBlocages.length > 0 ? `${openBlocages.length} ouvert${openBlocages.length > 1 ? "s" : ""}` : "Aucun blocage ouvert"}</strong></div><button onClick={() => setFormOpen((open) => !open)}><Icon name={formOpen ? "close" : "warning"} /> {formOpen ? "Annuler" : "Signaler un blocage"}</button></div>
    {formOpen && <form className="blocage-create-form" onSubmit={submit}>
      <div className="field"><label>Titre / type</label><AutocompleteInput field="blocage.titre" value={titre} onChange={setTitre} placeholder="Décrire brièvement le problème" required /></div>
      <div className="field"><label>Priorité</label><select value={priorite} onChange={(event) => setPriorite(event.target.value as BlocagePriorite)}><option value={BlocagePriorite.FAIBLE}>Faible</option><option value={BlocagePriorite.NORMALE}>Normale</option><option value={BlocagePriorite.HAUTE}>Haute</option></select></div>
      <div className="field"><label>Description</label><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} required /></div>
      <div className="field"><label>Photos</label><input type="file" accept="image/*" capture="environment" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />{files.length > 0 && <small>{files.length} photo{files.length > 1 ? "s" : ""} sélectionnée{files.length > 1 ? "s" : ""}</small>}</div>
      <button className="btn block" disabled={createBlocage.isPending}>{createBlocage.isPending ? "Déclaration…" : "Déclarer le blocage"}</button>
    </form>}
    {(blocages ?? []).map((blocage) => <article key={blocage.id} className={`point-blocage-card ${blocage.statut}`}><div><span className={`priority ${blocage.priorite}`}>{blocage.priorite}</span><strong>{blocage.titre}</strong></div><p>{blocage.description}</p>{blocage.photos.length > 0 && <div className="blocage-photo-grid">{blocage.photos.map((photo) => <BlocagePhoto key={photo.id} photoId={photo.id} />)}</div>}{blocage.statut === BlocageStatut.OUVERT ? <button onClick={() => updateBlocage.mutate({ id: blocage.id, input: { statut: BlocageStatut.RESOLU } })}><Icon name="check" /> Marquer résolu</button> : <small>Résolu{blocage.resolvedByName ? ` par ${blocage.resolvedByName}` : ""}</small>}</article>)}
  </section>;
}

function BlocagePhoto({ photoId }: { photoId: string }) {
  const { url } = useFileObjectUrl("photos", photoId);
  if (!url) return <span className="blocage-photo-loading" />;
  return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Photo du blocage" /></a>;
}
