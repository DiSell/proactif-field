import { FormEvent, useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { UserDTO } from "@proactif-field/shared";
import { apiGet, apiPostJson, ApiError } from "../api/client";
import { useAuthStore } from "../auth/store";

export default function ActivateAccountPage() {
  const { token } = useParams<{ token: string }>(); const setAuth = useAuthStore((state) => state.setAuth);
  const [invitation, setInvitation] = useState<{ name: string; email: string; organizationName: string } | null>(null);
  const [password, setPassword] = useState(""); const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [done, setDone] = useState(false);
  useEffect(() => { if (!token) return; apiGet<{ invitation: { name: string; email: string; organizationName: string } }>(`/api/auth/invitations/${encodeURIComponent(token)}`).then((result) => setInvitation(result.invitation)).catch((reason) => setError(reason instanceof ApiError ? reason.message : "Invitation indisponible")).finally(() => setLoading(false)); }, [token]);
  async function submit(event: FormEvent) { event.preventDefault(); setError(null); if (password !== confirmPassword) { setError("Les mots de passe ne correspondent pas"); return; } try { const result = await apiPostJson<{ token: string; user: UserDTO }>(`/api/auth/invitations/${encodeURIComponent(token!)}/accept`, { password }); setAuth(result.token, result.user); setDone(true); } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Activation impossible"); } }
  if (done) return <Navigate to="/" replace />;
  return <main className="center-screen"><div className="card activation-card"><img src="/logo-icon.svg" width="48" height="48" alt="" /><h1>Activez votre accès</h1>{loading ? <p>Vérification de l’invitation…</p> : invitation ? <><p><strong>{invitation.name}</strong>, vous rejoignez {invitation.organizationName}.</p>{error && <div className="error-banner">{error}</div>}<form onSubmit={submit}><div className="field"><label>Votre mot de passe</label><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete="new-password" required /></div><div className="field"><label>Confirmer le mot de passe</label><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} autoComplete="new-password" required /></div><button className="btn block">Activer mon compte</button></form></> : <div className="error-banner">{error ?? "Invitation invalide ou expirée"}</div>}</div></main>;
}
