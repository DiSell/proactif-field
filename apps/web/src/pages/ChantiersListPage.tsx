import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { UserRole } from "@proactif-field/shared";
import { useChantiers, useCreateChantier } from "../api/hooks";
import { useAuthStore } from "../auth/store";
import AutocompleteInput from "../components/AutocompleteInput";

export default function ChantiersListPage() {
  const { data: chantiers, isLoading } = useChantiers();
  const createChantier = useCreateChantier();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === UserRole.ADMIN;

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

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
        {isAdmin && (
          <button className="btn block" onClick={() => setShowForm((v) => !v)} style={{ marginBottom: 16 }}>
            {showForm ? "Annuler" : "+ Nouveau chantier"}
          </button>
        )}

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
        {chantiers?.length === 0 && <p>Aucun chantier pour le moment.</p>}
        {chantiers?.map((c) => (
          <Link key={c.id} to={`/chantiers/${c.id}`} className="card-link">
            <div className="card">
              <h3>
                {c.name} <span style={{ color: "#94a3b8", fontWeight: 400 }}>· {c.reference}</span>
              </h3>
              {c.address && <p>{c.address}</p>}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
