import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import { UserDTO, UserRole } from "@proactif-field/shared";
import { useCreateUser, useDeleteUser, useResendUserInvitation, useUpdateUser, useUsers } from "../api/hooks";
import { useAuthStore } from "../auth/store";
import { ApiError } from "../api/client";
import Icon from "../components/Icon";

const errorMessage = (reason: unknown, fallback: string) => reason instanceof ApiError ? reason.message : fallback;

export default function AdminUsersPage() {
  const { data: users, isLoading } = useUsers();
  const createUser = useCreateUser(); const updateUser = useUpdateUser(); const deleteUser = useDeleteUser(); const resendInvitation = useResendUserInvitation();
  const currentUser = useAuthStore((state) => state.user);
  const [showForm, setShowForm] = useState(false); const [selected, setSelected] = useState<UserDTO | null>(null);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [phone, setPhone] = useState(""); const [employerCompany, setEmployerCompany] = useState(""); const [role, setRole] = useState<UserRole>(UserRole.TECHNICIEN);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault(); setFeedback(null);
    try {
      await createUser.mutateAsync({ name, email, phone: phone || undefined, employerCompany: employerCompany || undefined, role });
      setName(""); setEmail(""); setPhone(""); setEmployerCompany(""); setRole(UserRole.TECHNICIEN); setShowForm(false);
      setFeedback({ type: "success", message: `Invitation envoyée à ${email}.` });
    } catch (reason) { setFeedback({ type: "error", message: errorMessage(reason, "Impossible d’envoyer l’invitation.") }); }
  }

  async function resend(user: UserDTO) {
    setFeedback(null);
    try { await resendInvitation.mutateAsync(user.id); setFeedback({ type: "success", message: `Invitation renvoyée à ${user.email}.` }); }
    catch (reason) { setFeedback({ type: "error", message: errorMessage(reason, "Impossible de renvoyer l’invitation.") }); }
  }

  const activeAdminCount = users?.filter((u) => u.role === UserRole.ADMIN && u.isActive).length ?? 0;
  const isLastActiveAdmin = (user: UserDTO) => user.role === UserRole.ADMIN && user.isActive && activeAdminCount <= 1;
  // Self-delete is only safe when nobody else depends on this account to
  // manage the organization — matches the backend rule in users/routes.ts.
  const activeUserCount = users?.filter((u) => u.isActive).length ?? 0;
  const canDeleteSelf = activeUserCount <= 1;

  async function removeUser(user: UserDTO) {
    if (!confirm(`Supprimer « ${user.name} » ?\n\nSon accès sera immédiatement révoqué.`)) return;
    setFeedback(null);
    try {
      await deleteUser.mutateAsync(user.id);
      if (selected?.id === user.id) setSelected(null);
      setFeedback({ type: "success", message: `Le compte de ${user.name} a été supprimé et son accès révoqué.` });
    } catch (reason) {
      setFeedback({ type: "error", message: errorMessage(reason, "Impossible de supprimer cet utilisateur.") });
    }
  }

  function openWithKeyboard(event: KeyboardEvent<HTMLElement>, user: UserDTO) {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(user); }
  }

  return <><div className="topbar"><h1>Utilisateurs</h1></div><div className="page users-page">
    <button className="btn block" onClick={() => setShowForm((value) => !value)} style={{ marginBottom: 16 }}>{showForm ? "Annuler" : "+ Inviter un utilisateur"}</button>
    {feedback && <div className={feedback.type === "error" ? "error-banner" : "success-banner"} role="status">{feedback.message}</div>}
    {showForm && <form onSubmit={submit} className="card user-invite-form"><div className="user-form-grid"><Field label="Nom *" value={name} onChange={setName} required /><Field label="E-mail *" value={email} onChange={setEmail} type="email" required /><Field label="Téléphone" value={phone} onChange={setPhone} type="tel" /><Field label="Entreprise employeuse" value={employerCompany} onChange={setEmployerCompany} /><label className="field"><span>Rôle</span><select value={role} onChange={(event) => setRole(event.target.value as UserRole)}><option value={UserRole.TECHNICIEN}>Technicien</option><option value={UserRole.ADMIN}>Administrateur</option></select></label></div><p>Le destinataire recevra un lien personnel valable 48 heures pour choisir son mot de passe.</p><button className="btn block" type="submit" disabled={createUser.isPending}>{createUser.isPending ? "Envoi en cours…" : "Envoyer l’invitation"}</button></form>}
    {isLoading && <p>Chargement…</p>}
    <div className="user-list">{users?.map((user) => <article key={user.id} className="card user-card user-card-clickable" role="button" tabIndex={0} aria-label={`Ouvrir la fiche de ${user.name}`} onKeyDown={(event) => openWithKeyboard(event, user)} onClick={() => setSelected(user)}><div className="user-card-person"><span className="account-avatar">{user.name.charAt(0).toUpperCase()}</span><div><h3>{user.name} {user.id === currentUser?.id && <small>(votre compte)</small>}</h3><p>{user.email}</p><small>{[user.phone, user.employerCompany].filter(Boolean).join(" · ") || "Informations professionnelles à compléter"}</small>{user.invitationPending && <span className="user-invite-status">Invitation en attente</span>}</div></div><div className="user-card-actions" onClick={(event) => event.stopPropagation()}>{user.invitationPending && <button className="btn secondary" disabled={resendInvitation.isPending} onClick={() => void resend(user)}>Relancer</button>}<span className={`user-role-badge ${user.role}`}>{user.role === UserRole.TECHNICIEN ? "Technicien" : "Administrateur"}</span><span className={`user-state ${user.isActive ? "active" : "inactive"}`}>{user.invitationPending ? "En attente" : user.isActive ? "Actif" : "Désactivé"}</span><button className="btn secondary" onClick={() => setSelected(user)}>Voir la fiche</button>{(user.id !== currentUser?.id || canDeleteSelf) && <button className="btn danger" disabled={deleteUser.isPending || (user.id !== currentUser?.id && isLastActiveAdmin(user))} title={user.id !== currentUser?.id && isLastActiveAdmin(user) ? "Impossible de supprimer le dernier administrateur actif" : undefined} onClick={() => void removeUser(user)}>{deleteUser.isPending ? "Suppression…" : "Supprimer"}</button>}</div></article>)}</div>
    {selected && <UserDetail user={selected} isSelf={selected.id === currentUser?.id} isLastActiveAdmin={isLastActiveAdmin(selected)} canDeleteSelf={canDeleteSelf} onClose={() => setSelected(null)} onUpdate={async (input) => { const updated = await updateUser.mutateAsync({ id: selected.id, input }); setSelected(updated); }} onDelete={async () => { await deleteUser.mutateAsync(selected.id); setSelected(null); setFeedback({ type: "success", message: "Le compte a été supprimé et son accès révoqué." }); }} />}
  </div></>;
}

function UserDetail({ user, isSelf, isLastActiveAdmin, canDeleteSelf, onClose, onUpdate, onDelete }: { user: UserDTO; isSelf: boolean; isLastActiveAdmin: boolean; canDeleteSelf: boolean; onClose: () => void; onUpdate: (input: { name?: string; phone?: string | null; employerCompany?: string | null; role?: UserRole; isActive?: boolean }) => Promise<void>; onDelete: () => Promise<void> }) {
  const [name, setName] = useState(user.name); const [phone, setPhone] = useState(user.phone ?? ""); const [company, setCompany] = useState(user.employerCompany ?? ""); const [role, setRole] = useState(user.role);
  const [action, setAction] = useState<"save" | "status" | "delete" | null>(null); const [error, setError] = useState<string | null>(null); const [saved, setSaved] = useState(false); const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = name.trim() !== user.name || phone.trim() !== (user.phone ?? "") || company.trim() !== (user.employerCompany ?? "") || role !== user.role;

  useEffect(() => { setName(user.name); setPhone(user.phone ?? ""); setCompany(user.employerCompany ?? ""); setRole(user.role); setError(null); setSaved(false); setConfirmDelete(false); }, [user]);
  async function run(kind: "save" | "status" | "delete", operation: () => Promise<void>, fallback: string) { setAction(kind); setError(null); setSaved(false); try { await operation(); if (kind === "save") setSaved(true); } catch (reason) { setError(errorMessage(reason, fallback)); } finally { setAction(null); } }
  function save(event: FormEvent) { event.preventDefault(); void run("save", () => onUpdate({ name: name.trim(), phone: phone.trim() || null, employerCompany: company.trim() || null, role }), "Impossible d’enregistrer la fiche."); }

  return <div className="sheet-overlay" onClick={onClose}><aside className="sheet user-detail" onClick={(event) => event.stopPropagation()} aria-labelledby="user-detail-title">
    <header><div><span>Fiche utilisateur</span><h2 id="user-detail-title">{user.name}</h2></div><button onClick={onClose} aria-label="Fermer"><Icon name="close" /></button></header>
    {isSelf && <div className="user-self-notice"><strong>Votre compte administrateur</strong><span>{canDeleteSelf ? "Vous ne pouvez pas modifier votre rôle ni désactiver ce compte. Comme vous êtes le seul utilisateur restant de l’entreprise, vous pouvez toutefois le supprimer." : "Pour éviter de perdre l’accès à l’entreprise, vous ne pouvez pas modifier votre rôle, désactiver ou supprimer ce compte."}</span></div>}
    {error && <div className="error-banner" role="alert">{error}</div>}{saved && <div className="success-banner" role="status">Fiche enregistrée.</div>}
    <form onSubmit={save}><section className="user-detail-section"><h3>Informations professionnelles</h3><Field label="Nom" value={name} onChange={setName} required /><Field label="Téléphone" value={phone} onChange={setPhone} type="tel" /><Field label="Entreprise employeuse" value={company} onChange={setCompany} /></section><section className="user-detail-section"><h3>Accès au compte</h3><Field label="E-mail de connexion" value={user.email} onChange={() => undefined} type="email" disabled /><label className="field"><span>Rôle</span><select value={role} disabled={isSelf} title={isSelf ? "Le rôle de votre propre compte est protégé" : undefined} onChange={(event) => setRole(event.target.value as UserRole)}><option value={UserRole.TECHNICIEN}>Technicien</option><option value={UserRole.ADMIN}>Administrateur</option></select></label><dl className="user-detail-meta"><div><dt>État</dt><dd>{user.invitationPending ? "Invitation en attente" : user.isActive ? "Compte actif" : "Compte désactivé"}</dd></div><div><dt>Créé le</dt><dd>{new Date(user.createdAt).toLocaleDateString("fr-FR")}</dd></div></dl></section><button className="btn block" disabled={!dirty || action !== null}>{action === "save" ? "Enregistrement…" : dirty ? "Enregistrer les modifications" : "Aucune modification"}</button></form>
    <section className="user-danger-zone"><h3>Gestion de l’accès</h3><p>Désactiver conserve la fiche. Supprimer révoque l’accès et anonymise le compte ; les rapports existants restent conservés.</p>{!user.invitationPending && <button className="btn secondary block" disabled={isSelf || action !== null} title={isSelf ? "Action impossible sur votre propre compte" : undefined} onClick={() => void run("status", () => onUpdate({ isActive: !user.isActive }), "Impossible de modifier l’état du compte.")}>{action === "status" ? "Traitement…" : user.isActive ? "Désactiver temporairement l’accès" : "Réactiver l’accès"}</button>}{!confirmDelete ? <button className="btn danger block" disabled={(isSelf && !canDeleteSelf) || (!isSelf && isLastActiveAdmin) || action !== null} title={isSelf && !canDeleteSelf ? "Impossible tant que d’autres utilisateurs actifs existent dans l’entreprise" : !isSelf && isLastActiveAdmin ? "Impossible de supprimer le dernier administrateur actif" : undefined} onClick={() => setConfirmDelete(true)}>Supprimer et anonymiser le compte</button> : <div className="user-delete-confirm"><strong>Confirmer la suppression de {user.name} ?</strong><span>Cette personne perdra immédiatement son accès.</span><div><button className="btn secondary" disabled={action !== null} onClick={() => setConfirmDelete(false)}>Annuler</button><button className="btn danger" disabled={action !== null} onClick={() => void run("delete", onDelete, "Impossible de supprimer le compte.")}>{action === "delete" ? "Suppression…" : "Oui, supprimer"}</button></div></div>}</section>
  </aside></div>;
}

function Field({ label, value, onChange, type = "text", required = false, disabled = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; disabled?: boolean }) { return <label className="field"><span>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} disabled={disabled} /></label>; }
