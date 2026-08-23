import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChantierDTO, ChantierStatut, UserRole } from "@proactif-field/shared";
import { useChantiers, useCreateChantier } from "../api/hooks";
import { useAuthStore } from "../auth/store";
import AutocompleteInput from "../components/AutocompleteInput";
import Icon from "../components/Icon";
import { getSnapshots } from "../offline/db";

type Filter = "TOUS" | "EN_COURS" | "TERMINE";
const isFinished = (c: ChantierDTO) => [ChantierStatut.TERMINE, ChantierStatut.CLOTURE].includes(c.statut);
const isStarted = (c: ChantierDTO) => [ChantierStatut.EN_COURS, ChantierStatut.BLOQUE].includes(c.statut);

export default function ChantiersListPage() {
  const navigate = useNavigate();
  const { data: chantiers, isLoading } = useChantiers();
  const createChantier = useCreateChantier();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === UserRole.ADMIN;

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("TOUS");
  const [offlineIds, setOfflineIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!user || isAdmin) return;
    const refresh = () => void getSnapshots(user.id).then((snapshots) => setOfflineIds(new Set(snapshots.map((snapshot) => snapshot.chantier.id))));
    refresh();
    const interval = window.setInterval(refresh, 1500);
    return () => clearInterval(interval);
  }, [user, isAdmin, chantiers]);
  const visible = (chantiers ?? []).filter((c) => {
    const matchesText = `${c.name} ${c.reference} ${c.address ?? ""}`.toLowerCase().includes(search.toLowerCase());
    return matchesText && (filter === "TOUS" || (filter === "TERMINE" ? isFinished(c) : isStarted(c)));
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createChantier.mutateAsync({ name, address: address || undefined });
    setName("");
    setAddress("");
    setShowForm(false);
  }

  return (
    <>
      <div className="topbar">
        <h1>Chantiers</h1>
        <div style={{ width: 1 }} />
      </div>

      <div className="page">
        <div className="chantier-tools">
          <label className="search-field"><Icon name="search" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un chantier" aria-label="Rechercher un chantier" /></label>
          <button className="btn secondary filter-button" aria-label="Filtrer"><Icon name="filter" /></button>
        </div>
        <div className="filter-chips">
          <button className={filter === "TOUS" ? "active" : ""} onClick={() => setFilter("TOUS")}>Tous · {chantiers?.length ?? 0}</button>
          <button className={filter === "EN_COURS" ? "active" : ""} onClick={() => setFilter("EN_COURS")}><span className="status-dot ORANGE" /> En cours · {(chantiers ?? []).filter(isStarted).length}</button>
          <button className={filter === "TERMINE" ? "active" : ""} onClick={() => setFilter("TERMINE")}><span className="status-dot VERT" /> Terminés · {(chantiers ?? []).filter(isFinished).length}</button>
        </div>

        {showForm && (
          <form onSubmit={submit} className="card">
            <div className="field">
              <label>Nom du chantier</label>
              <AutocompleteInput field="chantier.name" value={name} onChange={setName} required autoFocus />
            </div>
            <div className="field">
              <label>Adresse (optionnel)</label>
              <AutocompleteInput field="chantier.address" value={address} onChange={setAddress} />
            </div>
            <button className="btn block" type="submit" disabled={createChantier.isPending}>
              Créer
            </button>
          </form>
        )}

        {isLoading && <p>Chargement…</p>}
        {chantiers?.length === 0 && <div className="empty-state"><Icon name="chantier" size={40} /><p>Aucun chantier pour le moment.</p>{isAdmin && <button className="btn" onClick={() => setShowForm(true)}><Icon name="plus" /> Créer un chantier</button>}</div>}
        {visible.map((c) => (
          <Link key={c.id} to={`/chantiers/${c.id}`} className="card-link">
            <div className={`card chantier-card ${isFinished(c) ? "finished" : isStarted(c) ? "started" : "pending"}`}>
              <div className="chantier-card-title"><h3>{c.name}</h3><span className="reference-chip">{c.reference}</span></div>
              {c.address && <p>{c.address}</p>}
              <div className="segmented-progress" aria-label={isFinished(c) ? "Chantier terminé" : isStarted(c) ? "Chantier en cours" : "Chantier non démarré"}><span className="VERT"/><span className="ORANGE"/><span className="GRIS"/></div>
              <div className="chantier-card-meta"><strong>{isFinished(c) ? "Terminé" : isStarted(c) ? "En cours" : "Non démarré"}</strong><span>Mis à jour le {new Date(c.updatedAt).toLocaleDateString("fr-FR")}</span></div>
              {!isAdmin && <div className="offline-availability">{offlineIds.has(c.id) ? "Disponible hors ligne" : navigator.onLine ? "Synchronisation en cours" : "Non disponible hors ligne"}</div>}
              {isAdmin && <button className="assign-cta" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/chantiers/${c.id}/equipe`); }}><Icon name="users" /> Affecter aux techniciens</button>}
              {c.isNewAssignment && <span className="badge-new">Nouveau</span>}
            </div>
          </Link>
        ))}
        {isAdmin && <div className="sticky-create"><button className="btn block" onClick={() => setShowForm((v) => !v)}><Icon name={showForm ? "close" : "plus"} />{showForm ? "Annuler" : "Nouveau chantier"}</button></div>}
      </div>
    </>
  );
}
