import { FormEvent, useState } from "react";
import { UserRole } from "@proactif-field/shared";
import { useCreateUser, useResendUserInvitation, useUpdateUser, useUsers } from "../api/hooks";
import { useAuthStore } from "../auth/store";
import { ApiError } from "../api/client";

export default function AdminUsersPage() {
  const { data: users, isLoading } = useUsers(); const createUser = useCreateUser(); const updateUser = useUpdateUser(); const resendInvitation = useResendUserInvitation();
  const currentUser = useAuthStore((state) => state.user);
  const [showForm, setShowForm] = useState(false); const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [role, setRole] = useState<UserRole>(UserRole.TECHNICIEN); const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) { event.preventDefault(); setError(null); try { await createUser.mutateAsync({ name, email, role }); setName(""); setEmail(""); setRole(UserRole.TECHNICIEN); setShowForm(false); } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Erreur lors de l’envoi"); } }
  return <><div className="topbar"><h1>Utilisateurs</h1></div><div className="page">
    <button className="btn block" onClick={() => setShowForm((value) => !value)} style={{ marginBottom: 16 }}>{showForm ? "Annuler" : "+ Inviter un utilisateur"}</button>
    {showForm && <form onSubmit={submit} className="card">{error && <div className="error-banner">{error}</div>}<div className="field"><label>Nom</label><input value={name} onChange={(event) => setName(event.target.value)} required autoFocus /></div><div className="field"><label>Email</label><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div><div className="field"><label>Rôle</label><select value={role} onChange={(event) => setRole(event.target.value as UserRole)}><option value={UserRole.TECHNICIEN}>Technicien</option><option value={UserRole.ADMIN}>Admin</option></select></div><p>Le destinataire recevra un lien personnel valable 48 heures pour choisir son mot de passe.</p><button className="btn block" type="submit" disabled={createUser.isPending}>{createUser.isPending ? "Envoi…" : "Envoyer l’invitation"}</button></form>}
    {isLoading && <p>Chargement…</p>}
    {users?.map((user) => <div key={user.id} className="card user-card"><div><h3>{user.name} {user.id === currentUser?.id && <span style={{ color: "var(--ink-muted)" }}>(vous)</span>}</h3><p>{user.email}</p>{user.invitationPending && <p><strong>Invitation en attente</strong></p>}</div><div className="user-card-actions">{user.invitationPending && <button className="btn secondary" onClick={() => resendInvitation.mutate(user.id)} disabled={resendInvitation.isPending}>Renvoyer l’invitation</button>}<select value={user.role} disabled={user.id === currentUser?.id} onChange={(event) => updateUser.mutate({ id: user.id, input: { role: event.target.value as UserRole } })}><option value={UserRole.TECHNICIEN}>Technicien</option><option value={UserRole.ADMIN}>Admin</option></select><button className={`btn secondary ${user.isActive ? "" : "danger"}`} disabled={user.id === currentUser?.id || user.invitationPending} onClick={() => updateUser.mutate({ id: user.id, input: { isActive: !user.isActive } })}>{user.invitationPending ? "En attente" : user.isActive ? "Actif" : "Désactivé"}</button></div></div>)}
  </div></>;
}
