import { FormEvent, useState } from "react";
import { UserRole } from "@proactif-field/shared";
import { useCreateUser, useUpdateUser, useUsers } from "../api/hooks";
import { useAuthStore } from "../auth/store";
import { ApiError } from "../api/client";

export default function AdminUsersPage() {
  const { data: users, isLoading } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const currentUser = useAuthStore((s) => s.user);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.TECHNICIEN);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createUser.mutateAsync({ name, email, password, role });
      setName("");
      setEmail("");
      setPassword("");
      setRole(UserRole.TECHNICIEN);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de la création");
    }
  }

  return (
    <>
      <div className="topbar">
        <h1>Utilisateurs</h1>
      </div>

      <div className="page">
        <button className="btn block" onClick={() => setShowForm((v) => !v)} style={{ marginBottom: 16 }}>
          {showForm ? "Annuler" : "+ Ajouter un utilisateur"}
        </button>

        {showForm && (
          <form onSubmit={submit} className="card">
            {error && <div className="error-banner">{error}</div>}
            <div className="field">
              <label>Nom</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label>Mot de passe initial</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <div className="field">
              <label>Rôle</label>
              <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                <option value={UserRole.TECHNICIEN}>Technicien</option>
                <option value={UserRole.ADMIN}>Admin</option>
              </select>
            </div>
            <button className="btn block" type="submit" disabled={createUser.isPending}>
              Créer
            </button>
          </form>
        )}

        {isLoading && <p>Chargement…</p>}
        {users?.map((u) => (
          <div key={u.id} className="card user-card">
            <div>
              <h3>
                {u.name} {u.id === currentUser?.id && <span style={{ color: "#94a3b8" }}>(vous)</span>}
              </h3>
              <p>{u.email}</p>
            </div>
            <div className="user-card-actions">
              <select
                value={u.role}
                disabled={u.id === currentUser?.id}
                onChange={(e) =>
                  updateUser.mutate({ id: u.id, input: { role: e.target.value as UserRole } })
                }
              >
                <option value={UserRole.TECHNICIEN}>Technicien</option>
                <option value={UserRole.ADMIN}>Admin</option>
              </select>
              <button
                className={`btn secondary ${u.isActive ? "" : "danger"}`}
                disabled={u.id === currentUser?.id}
                onClick={() => updateUser.mutate({ id: u.id, input: { isActive: !u.isActive } })}
              >
                {u.isActive ? "Actif" : "Désactivé"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
