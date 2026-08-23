import { useState } from "react";
import { BlocageDTO, BlocageStatut } from "@proactif-field/shared";
import { useParams } from "react-router-dom";
import { useChantierBlocages, useUpdateBlocage } from "../../api/hooks";
import { useFileObjectUrl } from "../../api/files";
import Icon from "../../components/Icon";

type Filter = "TOUS" | BlocageStatut;

export default function ChantierBlocagesPage() {
  const { chantierId } = useParams<{ chantierId: string }>();
  const [filter, setFilter] = useState<Filter>(BlocageStatut.OUVERT);
  const [selected, setSelected] = useState<BlocageDTO | null>(null);
  const { data: blocages, isLoading } = useChantierBlocages(chantierId, filter === "TOUS" ? undefined : filter);
  const updateBlocage = useUpdateBlocage(undefined, chantierId);

  return <main className="page blocages-page">
    <div className="blocages-page-head"><div><span>Suivi terrain</span><h2>Blocages et anomalies</h2></div><div className="blocage-filters">{([BlocageStatut.OUVERT, BlocageStatut.RESOLU, "TOUS"] as Filter[]).map((value) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "TOUS" ? "Tous" : value === BlocageStatut.OUVERT ? "Ouverts" : "Résolus"}</button>)}</div></div>
    {isLoading && <p>Chargement…</p>}
    {blocages?.length === 0 && <div className="dossier-empty"><Icon name="check" size={30} /> Aucun blocage dans cette vue.</div>}
    <div className="blocage-list">{blocages?.map((blocage) => <button key={blocage.id} className="blocage-list-row" onClick={() => setSelected(blocage)}><span className={`priority ${blocage.priorite}`}>{blocage.priorite}</span><span><strong>{blocage.titre}</strong><small>Point {blocage.pointIdentifiant} · {blocage.createdByName}</small></span><p>{blocage.description}</p><time>{new Date(blocage.createdAt).toLocaleDateString("fr-FR")}</time><span className={`blocage-status ${blocage.statut}`}>{blocage.statut === BlocageStatut.OUVERT ? "Ouvert" : "Résolu"}</span></button>)}</div>
    {selected && <div className="sheet-overlay" onClick={() => setSelected(null)}><article className="sheet blocage-detail" onClick={(event) => event.stopPropagation()}><header><div><span>Point {selected.pointIdentifiant}</span><h2>{selected.titre}</h2></div><button onClick={() => setSelected(null)}><Icon name="close" /></button></header><div className="blocage-detail-meta"><span className={`priority ${selected.priorite}`}>{selected.priorite}</span><span className={`blocage-status ${selected.statut}`}>{selected.statut}</span><span>{new Date(selected.createdAt).toLocaleString("fr-FR")}</span><span>{selected.createdByName}</span></div><p>{selected.description}</p>{selected.photos.length > 0 && <div className="blocage-detail-photos">{selected.photos.map((photo) => <DetailPhoto key={photo.id} id={photo.id} />)}</div>}{selected.statut === BlocageStatut.OUVERT && <button className="btn block" onClick={async () => { const updated = await updateBlocage.mutateAsync({ id: selected.id, input: { statut: BlocageStatut.RESOLU } }); setSelected(updated); }}><Icon name="check" /> Marquer comme résolu</button>}{selected.resolvedAt && <small>Résolu le {new Date(selected.resolvedAt).toLocaleString("fr-FR")}{selected.resolvedByName ? ` par ${selected.resolvedByName}` : ""}</small>}</article></div>}
  </main>;
}

function DetailPhoto({ id }: { id: string }) {
  const { url } = useFileObjectUrl("photos", id);
  return url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Photo du blocage" /></a> : <span />;
}
