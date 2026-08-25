import { FormEvent, useState } from "react";
import { useParams } from "react-router-dom";
import { CreateMaterielInput, MaterielDTO, UpdateMaterielInput, UserRole } from "@proactif-field/shared";
import { useChantierMateriel, useCreateMateriel, useDeleteMateriel, useUpdateMateriel } from "../../api/hooks";
import { useAuthStore } from "../../auth/store";
import { ApiError } from "../../api/client";
import AutocompleteInput from "../../components/AutocompleteInput";
import Icon from "../../components/Icon";

function formatQuantity(value: number | null): string {
  return value == null ? "—" : String(value);
}

function isOverrun(materiel: MaterielDTO): boolean {
  return materiel.quantitePrevue != null && materiel.quantiteUtilisee != null && materiel.quantiteUtilisee > materiel.quantitePrevue;
}

export default function ChantierMaterielPage() {
  const { chantierId } = useParams<{ chantierId: string }>();
  const { data: materiels, isLoading } = useChantierMateriel(chantierId);
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const createMateriel = useCreateMateriel(chantierId);
  const updateMateriel = useUpdateMateriel(chantierId);
  const deleteMateriel = useDeleteMateriel(chantierId);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MaterielDTO | null>(null);

  const overrunCount = (materiels ?? []).filter(isOverrun).length;

  async function saveUsage(materiel: MaterielDTO, input: UpdateMaterielInput) {
    await updateMateriel.mutateAsync({ id: materiel.id, input });
  }

  async function handleDelete(materiel: MaterielDTO) {
    if (!confirm(`Supprimer « ${materiel.designation} » ?`)) return;
    await deleteMateriel.mutateAsync(materiel.id);
  }

  return (
    <div className="page materiel-page">
      {isAdmin && (
        <button className="btn block" onClick={() => setShowForm((v) => !v)} style={{ marginBottom: 16 }}>
          {showForm ? "Annuler" : "+ Ajouter du matériel"}
        </button>
      )}

      {showForm && (
        <MaterielCreateForm
          onSubmit={async (input) => {
            await createMateriel.mutateAsync(input);
            setShowForm(false);
          }}
          submitting={createMateriel.isPending}
        />
      )}

      {isLoading && <p>Chargement…</p>}

      {materiels?.length === 0 && (
        <div className="upload-zone">
          <p>Aucun matériel renseigné pour ce chantier.</p>
          {isAdmin && (
            <p style={{ color: "var(--ink-muted)", fontSize: 13 }}>
              Ajoutez ce qui est prévu ou utilisé pour cette intervention — désignation, quantités, unité.
            </p>
          )}
        </div>
      )}

      {materiels && materiels.length > 0 && (
        <>
          {overrunCount > 0 && (
            <div className="materiel-overrun-banner">
              <Icon name="warning" size={16} /> {overrunCount} ligne{overrunCount > 1 ? "s" : ""} en dépassement de la quantité prévue.
            </div>
          )}

          <div className="materiel-table-wrap">
            <table className="materiel-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Désignation</th>
                  <th>Prévu</th>
                  <th>Utilisé</th>
                  <th>Unité</th>
                  <th>Commentaire</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {materiels.map((materiel) => (
                  <tr key={materiel.id} className={isOverrun(materiel) ? "overrun" : undefined}>
                    <td>{materiel.reference || "—"}</td>
                    <td>{materiel.designation}</td>
                    <td>{formatQuantity(materiel.quantitePrevue)}</td>
                    <td>
                      <UsageQuickEdit materiel={materiel} onSave={(input) => saveUsage(materiel, input)} />
                    </td>
                    <td>{materiel.unite || "—"}</td>
                    <td>{materiel.commentaire || "—"}</td>
                    {isAdmin && (
                      <td className="materiel-row-actions">
                        <button className="btn secondary" onClick={() => setEditing(materiel)}>Modifier</button>
                        <button className="btn danger" onClick={() => void handleDelete(materiel)}>Suppr.</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="materiel-cards">
            {materiels.map((materiel) => (
              <article key={materiel.id} className={`card materiel-card ${isOverrun(materiel) ? "overrun" : ""}`}>
                <header>
                  <strong>{materiel.designation}</strong>
                  {materiel.reference && <span className="materiel-reference">{materiel.reference}</span>}
                </header>
                <div className="materiel-card-quantities">
                  <span>Prévu <strong>{formatQuantity(materiel.quantitePrevue)}</strong> {materiel.unite || ""}</span>
                </div>
                <UsageQuickEdit materiel={materiel} onSave={(input) => saveUsage(materiel, input)} card />
                {isOverrun(materiel) && (
                  <small className="materiel-overrun-tag"><Icon name="warning" size={12} /> Dépassement de la quantité prévue</small>
                )}
                {isAdmin && (
                  <div className="materiel-card-actions">
                    <button className="btn secondary" onClick={() => setEditing(materiel)}>Modifier</button>
                    <button className="btn danger" onClick={() => void handleDelete(materiel)}>Supprimer</button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}

      {editing && isAdmin && (
        <MaterielEditSheet
          materiel={editing}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            await updateMateriel.mutateAsync({ id: editing.id, input });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

// The one thing both roles need fast: what was actually used, plus a short
// note if useful. Tapping "Utilisé" (table) or the value (card) opens this
// two-field inline editor — never the full administrative sheet.
function UsageQuickEdit({ materiel, onSave, card = false }: { materiel: MaterielDTO; onSave: (input: UpdateMaterielInput) => Promise<void>; card?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [quantite, setQuantite] = useState(materiel.quantiteUtilisee?.toString() ?? "");
  const [commentaire, setCommentaire] = useState(materiel.commentaire ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open() {
    setQuantite(materiel.quantiteUtilisee?.toString() ?? "");
    setCommentaire(materiel.commentaire ?? "");
    setError(null);
    setEditing(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({
        quantiteUtilisee: quantite.trim() === "" ? null : Number(quantite),
        commentaire: commentaire.trim() === "" ? null : commentaire.trim(),
      });
      setEditing(false);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Impossible d'enregistrer.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button type="button" className="materiel-usage-value" onClick={open}>
        {formatQuantity(materiel.quantiteUtilisee)}
        {card && ` ${materiel.unite || ""}`}
        <Icon name="more" size={12} />
      </button>
    );
  }

  return (
    <form className="materiel-quick-edit" onSubmit={save} onClick={(e) => e.stopPropagation()}>
      {error && <div className="error-banner">{error}</div>}
      <label>
        <span>Quantité utilisée{materiel.unite ? ` (${materiel.unite})` : ""}</span>
        <input type="number" step="any" min={0} value={quantite} onChange={(e) => setQuantite(e.target.value)} autoFocus />
      </label>
      <label>
        <span>Commentaire</span>
        <input type="text" value={commentaire} onChange={(e) => setCommentaire(e.target.value)} maxLength={1000} />
      </label>
      <div className="materiel-quick-edit-actions">
        <button type="button" className="btn secondary" onClick={() => setEditing(false)} disabled={saving}>Annuler</button>
        <button type="submit" className="btn" disabled={saving}>{saving ? "…" : "Enregistrer"}</button>
      </div>
    </form>
  );
}

function MaterielCreateForm({ onSubmit, submitting }: { onSubmit: (input: CreateMaterielInput) => Promise<void>; submitting: boolean }) {
  const [reference, setReference] = useState("");
  const [designation, setDesignation] = useState("");
  const [quantitePrevue, setQuantitePrevue] = useState("");
  const [quantiteUtilisee, setQuantiteUtilisee] = useState("");
  const [unite, setUnite] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!designation.trim()) return;
    try {
      await onSubmit({
        reference: reference.trim() || undefined,
        designation: designation.trim(),
        quantitePrevue: quantitePrevue.trim() === "" ? undefined : Number(quantitePrevue),
        quantiteUtilisee: quantiteUtilisee.trim() === "" ? undefined : Number(quantiteUtilisee),
        unite: unite.trim() || undefined,
        commentaire: commentaire.trim() || undefined,
      });
      setReference(""); setDesignation(""); setQuantitePrevue(""); setQuantiteUtilisee(""); setUnite(""); setCommentaire("");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Impossible d'ajouter ce matériel.");
    }
  }

  return (
    <form onSubmit={submit} className="card materiel-form">
      {error && <div className="error-banner">{error}</div>}
      <div className="field"><label>Référence (optionnel)</label><input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} /></div>
      <div className="field">
        <label>Désignation</label>
        <AutocompleteInput field="materiel.designation" value={designation} onChange={setDesignation} required />
      </div>
      <div className="materiel-form-quantities">
        <div className="field"><label>Quantité prévue</label><input type="number" step="any" min={0} value={quantitePrevue} onChange={(e) => setQuantitePrevue(e.target.value)} /></div>
        <div className="field"><label>Quantité utilisée</label><input type="number" step="any" min={0} value={quantiteUtilisee} onChange={(e) => setQuantiteUtilisee(e.target.value)} /></div>
        <div className="field">
          <label>Unité</label>
          <AutocompleteInput field="materiel.unite" value={unite} onChange={setUnite} placeholder="m, kg, unités…" />
        </div>
      </div>
      <div className="field"><label>Commentaire (optionnel)</label><textarea rows={2} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} maxLength={1000} /></div>
      <button className="btn block" type="submit" disabled={submitting}>{submitting ? "Ajout…" : "Ajouter"}</button>
    </form>
  );
}

function MaterielEditSheet({ materiel, onClose, onSave }: { materiel: MaterielDTO; onClose: () => void; onSave: (input: UpdateMaterielInput) => Promise<void> }) {
  const [reference, setReference] = useState(materiel.reference ?? "");
  const [designation, setDesignation] = useState(materiel.designation);
  const [quantitePrevue, setQuantitePrevue] = useState(materiel.quantitePrevue?.toString() ?? "");
  const [unite, setUnite] = useState(materiel.unite ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({
        reference: reference.trim() || null,
        designation: designation.trim(),
        quantitePrevue: quantitePrevue.trim() === "" ? null : Number(quantitePrevue),
        unite: unite.trim() || null,
      });
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Impossible d'enregistrer.");
      setSaving(false);
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <aside className="sheet" onClick={(event) => event.stopPropagation()} aria-labelledby="materiel-edit-title">
        <header className="sheet-header">
          <div><span className="section-title" style={{ margin: 0 }}>Matériel</span><h2 id="materiel-edit-title" style={{ margin: 0 }}>{materiel.designation}</h2></div>
          <button className="btn secondary" onClick={onClose}><Icon name="close" /> Fermer</button>
        </header>
        <form onSubmit={save}>
          {error && <div className="error-banner">{error}</div>}
          <div className="field"><label>Référence</label><input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} /></div>
          <div className="field">
            <label>Désignation</label>
            <AutocompleteInput field="materiel.designation" value={designation} onChange={setDesignation} required />
          </div>
          <div className="field"><label>Quantité prévue</label><input type="number" step="any" min={0} value={quantitePrevue} onChange={(e) => setQuantitePrevue(e.target.value)} /></div>
          <div className="field">
            <label>Unité</label>
            <AutocompleteInput field="materiel.unite" value={unite} onChange={setUnite} />
          </div>
          <button className="btn block" type="submit" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
        </form>
      </aside>
    </div>
  );
}
