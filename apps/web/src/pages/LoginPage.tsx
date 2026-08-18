import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { UserDTO } from "@proactif-field/shared";
import { apiPostJson, ApiError } from "../api/client";
import { useAuthStore } from "../auth/store";

export default function LoginPage() {
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (token) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login" ? { email, password } : { email, password, name, organizationName };
      const res = await apiPostJson<{ token: string; user: UserDTO }>(path, body);
      setAuth(res.token, res.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="center-screen">
      <img src="/logo-icon.svg" alt="" width={72} height={72} />
      <h1>Proactif Field</h1>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 360 }}>
        {error && <div className="error-banner">{error}</div>}
        {mode === "register" && (
          <>
            <div className="field">
              <label>Nom</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Nom de l'entreprise</label>
              <input
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                required
              />
            </div>
          </>
        )}
        <div className="field">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label>Mot de passe</label>
          <div className="password-input">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              aria-pressed={showPassword}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>
        </div>
        <button className="btn block" type="submit" disabled={loading}>
          {mode === "login" ? "Se connecter" : "Créer le compte"}
        </button>
      </form>
      <button
        className="btn secondary"
        onClick={() => setMode(mode === "login" ? "register" : "login")}
      >
        {mode === "login" ? "Créer un compte" : "J'ai déjà un compte"}
      </button>
    </div>
  );
}
