import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { UserRole } from "@proactif-field/shared";
import { useAuthStore } from "../auth/store";
import Icon, { IconName } from "./Icon";
import { enablePushNotifications, pushIsEnabled, pushSupported } from "../pushNotifications";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
}

// Permanent sidebar on desktop, collapsible drawer on mobile — closed by
// default so the plan viewer keeps the full screen, per the "conserver le
// maximum d'espace pour le plan" requirement.
export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushMessage, setPushMessage] = useState("");
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const isAdmin = user?.role === UserRole.ADMIN;
  const isTechnician = user?.role === UserRole.TECHNICIEN;
  const isTerrainRoute = /^\/chantiers\/[^/]+\/plans/.test(location.pathname);

  const mainItems: NavItem[] = [{ to: "/", label: isTechnician ? "Mes chantiers" : "Chantiers", icon: "chantier", end: true }];
  if (isAdmin) mainItems.unshift({ to: "/dashboard", label: "Tableau de bord", icon: "dashboard" });
  if (isTechnician) mainItems.push(
    { to: "/historique", label: "Historique", icon: "report" },
    { to: "/mon-compte", label: "Mon compte", icon: "settings" },
  );

  const adminItems: NavItem[] = [
    { to: "/admin/users", label: "Utilisateurs", icon: "users" },
    { to: "/admin/entreprise", label: "Entreprise", icon: "building" },
    { to: "/admin/parametres", label: "Paramètres", icon: "settings" },
    { to: "/reports", label: "Rapports", icon: "report" },
  ];

  function closeMobile() {
    setMobileOpen(false);
    setAccountOpen(false);
  }

  useEffect(() => {
    closeMobile();
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && closeMobile();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  useEffect(() => { if (isTechnician && pushSupported()) void pushIsEnabled().then(setPushEnabled); }, [isTechnician]);

  async function activatePush() {
    setPushMessage("Activation…");
    try {
      const result = await enablePushNotifications();
      setPushEnabled(result === "enabled");
      setPushMessage(result === "enabled" ? "Notifications activées" : result === "denied" ? "Autorisation refusée" : "Notifications non configurées");
    } catch {
      setPushMessage("Activation impossible");
    }
  }

  return (
    <div className={`app-layout ${isAdmin ? "admin-layout" : "technician-layout"} ${isTerrainRoute ? "terrain-layout" : ""}`}>
      <button className="sidebar-toggle" onClick={() => setMobileOpen(true)} aria-label="Ouvrir le menu" aria-expanded={mobileOpen}>
        <Icon name="menu" />
      </button>

      {mobileOpen && <div className="sidebar-backdrop" onClick={closeMobile} aria-hidden="true" />}

      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`} aria-label={isAdmin ? "Navigation principale" : "Espace technicien"}>
        <div className="sidebar-header">
          <img src="/logo-icon.svg" alt="" width={28} height={28} />
          <div className="sidebar-brand"><span>Proactif</span><strong>Field</strong></div>
          <button className="sidebar-close" onClick={closeMobile} aria-label="Fermer le menu">
            <Icon name="close" />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Navigation">
          {isTechnician && <div className="sidebar-context"><span>Espace terrain</span><strong>Mes interventions</strong></div>}
          {mainItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={closeMobile}
              className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link-active" : ""}`}
            >
              <Icon name={item.icon} /> {item.label}
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div className="sidebar-section">Administration</div>
              {adminItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={closeMobile}
                  className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link-active" : ""}`}
                >
                  <Icon name={item.icon} /> {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="sidebar-account">
          <button className="account-trigger" onClick={() => setAccountOpen((open) => !open)} aria-expanded={accountOpen}>
            <span className="account-avatar">{user?.name?.trim().charAt(0).toUpperCase() || "U"}</span>
            <span className="account-copy"><strong>{user?.name ?? "Utilisateur"}</strong><small>{isAdmin ? "Responsable / Admin" : "Technicien terrain"}</small></span>
            <Icon name="more" />
          </button>
          {accountOpen && <div className="account-menu"><span>{user?.email}</span>{isTechnician && <NavLink className="account-menu-link" to="/mon-compte" onClick={closeMobile}>Mon compte</NavLink>}{isTechnician && !pushEnabled && <button onClick={() => void activatePush()}>Activer les notifications</button>}{isTechnician && pushMessage && <small>{pushMessage}</small>}<button onClick={() => clearAuth()}>Se déconnecter</button></div>}
        </div>
      </aside>

      <div className="app-main">
        <Outlet />
      </div>
    </div>
  );
}
