import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChantierDTO, ChantierStatut, UserRole } from "@proactif-field/shared";
import { useChantiers, useCreateChantier } from "../api/hooks";
import { apiPostForm, apiPostJson, ApiError } from "../api/client";
import { useAuthStore } from "../auth/store";
import AutocompleteInput from "../components/AutocompleteInput";
import Icon from "../components/Icon";
import PushNotificationBanner from "../components/PushNotificationBanner";
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
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentCategory, setDocumentCategory] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [materielDesignation, setMaterielDesignation] = useState("");
  const [materielReference, setMaterielReference] = useState("");
  const [materielQuantitePrevue, setMaterielQuantitePrevue] = useState("");
  const [materielUnite, setMaterielUnite] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
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
    if (documentFile && (!documentCategory.trim() || !documentName.trim())) {
      setCreateError("Catégorie et nom sont requis pour joindre un document.");
      return;
    }
    const hasMaterielDetails = materielReference.trim() || materielQuantitePrevue.trim() || materielUnite.trim();
    if (hasMaterielDetails && !materielDesignation.trim()) {
      setCreateError("La désignation est requise pour ajouter une ligne de matériel.");
      return;
    }
    setCreateError(null);
    setCreating(true);
    try {
      const chantier = await createChantier.mutateAsync({ name, address: address || undefined });
      if (planFile) {
        const form = new FormData();
        form.append("file", planFile);
        await apiPostForm(`/api/chantiers/${chantier.id}/plans`, form);
      }
      if (documentFile) {
        const form = new FormData();
        form.append("file", documentFile);
        form.append("category", documentCategory);
        form.append("name", documentName);
        await apiPostForm(`/api/chantiers/${chantier.id}/documents`, form);
      }
      if (materielDesignation.trim()) {
        await apiPostJson(`/api/chantiers/${chantier.id}/materiel`, {
          designation: materielDesignation.trim(),
          reference: materielReference.trim() || undefined,
          quantitePrevue: materielQuantitePrevue.trim() === "" ? undefined : Number(materielQuantitePrevue),
          unite: materielUnite.trim() || undefined,
        });
      }
      setName("");
      setAddress("");
      setPlanFile(null);
      setDocumentFile(null);
      setDocumentCategory("");
      setDocumentName("");
      setMaterielDesignation("");
      setMaterielReference("");
      setMaterielQuantitePrevue("");
      setMaterielUnite("");
      setShowForm(false);
    } catch (reason) {
      setCreateError(reason instanceof ApiError ? reason.message : "Impossible de créer le chantier.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <h1>Chantiers</h1>
        <div style={{ width: 1 }} />
      </div>

      <div className="page">
        {!isAdmin && <PushNotificationBanner />}
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
            {createError && <div className="error-banner">{createError}</div>}
            <div className="field">
              <label>Nom du chantier</label>
              <AutocompleteInput field="chantier.name" value={name} onChange={setName} required autoFocus />
            </div>
            <div className="field">
              <label>Adresse (optionnel)</label>
              <AutocompleteInput field="chantier.address" value={address} onChange={setAddress} />
            </div>
            <div className="field">
              <label>Plan initial (optionnel)</label>
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.svg" onChange={(e) => setPlanFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="field">
              <label>Document initial (optionnel)</label>
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.txt" onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)} />
            </div>
            {documentFile && (
              <div className="creation-subfields">
                <div className="field">
                  <label>Catégorie</label>
                  <AutocompleteInput field="document.category" value={documentCategory} onChange={setDocumentCategory} placeholder="ex: Plans, Sécurité…" required />
                </div>
                <div className="field">
                  <label>Nom du document</label>
                  <AutocompleteInput field="document.name" value={documentName} onChange={setDocumentName} required />
                </div>
              </div>
            )}
            <div className="field">
              <label>Matériel initial (optionnel)</label>
              <AutocompleteInput field="materiel.designation" value={materielDesignation} onChange={setMaterielDesignation} placeholder="Désignation" />
            </div>
            {materielDesignation.trim() && (
              <div className="creation-subfields">
                <div className="field"><label>Référence</label><input value={materielReference} onChange={(e) => setMaterielReference(e.target.value)} maxLength={100} /></div>
                <div className="field"><label>Quantité prévue</label><input type="number" step="any" min={0} value={materielQuantitePrevue} onChange={(e) => setMaterielQuantitePrevue(e.target.value)} /></div>
                <div className="field"><label>Unité</label><AutocompleteInput field="materiel.unite" value={materielUnite} onChange={setMaterielUnite} placeholder="m, kg, unités…" /></div>
              </div>
            )}
            <small style={{ color: "var(--ink-muted)" }}>Vous pourrez ajouter d’autres plans, documents et matériel une fois le chantier créé.</small>
            <button className="btn block" type="submit" disabled={creating}>
              {creating ? "Création…" : "Créer"}
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
