import { FormEvent, useState } from "react";
import { ApiError } from "../api/client";
import { useUpdateOwnProfile } from "../api/hooks";
import { useAuthStore } from "../auth/store";

export default function TechnicianAccountPage() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const setAuth = useAuthStore((state) => state.setAuth);
  const updateProfile = useUpdateOwnProfile();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [employerCompany, setEmployerCompany] = useState(user?.employerCompany ?? "");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      const updated = await updateProfile.mutateAsync({ name, phone: phone || null, employerCompany: employerCompany || null });
      if (token) setAuth(token, updated);
      setMessage("Votre profil a été mis à jour.");
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "Impossible de mettre à jour le profil.");
    }
  }

  return <><div className="topbar"><h1>Mon compte</h1></div><main className="page"><form className="card" style={{ maxWidth: 620 }} onSubmit={submit}>
    {message && <div className={updateProfile.isError ? "error-banner" : "success-banner"}>{message}</div>}
    <div className="field"><label>Nom</label><input value={name} onChange={(event) => setName(event.target.value)} required /></div>
    <div className="field"><label>Email</label><input value={user?.email ?? ""} disabled /><small>L’adresse email est gérée par votre administrateur.</small></div>
    <div className="field"><label>Téléphone</label><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
    <div className="field"><label>Entreprise / employeur</label><input value={employerCompany} onChange={(event) => setEmployerCompany(event.target.value)} /></div>
    <button className="btn" disabled={updateProfile.isPending}>{updateProfile.isPending ? "Enregistrement…" : "Enregistrer"}</button>
  </form></main></>;
}
