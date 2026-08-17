import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useChantiers, useCreateChantier } from "../api/hooks";
import { useAuthStore } from "../auth/store";

export default function ChantiersListPage() {
  const { data: chantiers, isLoading } = useChantiers();
  const createChantier = useCreateChantier();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const user = useAuthStore((s) => s.user);

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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo-icon.svg" alt="" width={28} height={28} />
          <h1>Chantiers</h1>
        </div>
        <button className="btn secondary" onClick={() => clearAuth()}>
          {user?.name ?? "Déconnexion"}
        </button>
      </div>
      <div className="page">
        <button className="btn block" onClick={() => setShowForm((v) => !v)} style={{ marginBottom: 16 }}>
          {showForm ? "Annuler" : "+ Nouveau chantier"}
        </button>

        {showForm && (
          <form onSubmit={submit} className="card">
            <div className="field">
              <label>Nom du chantier</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>
            <div className="field">
              <label>Adresse (optionnel)</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} />
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
              <h3>{c.name}</h3>
              {c.address && <p>{c.address}</p>}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
