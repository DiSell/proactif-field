import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { UserRole } from "@proactif-field/shared";
import { useAuthStore } from "../auth/store";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

// Permanent sidebar on desktop, collapsible drawer on mobile — closed by
// default so the plan viewer keeps the full screen, per the "conserver le
// maximum d'espace pour le plan" requirement.
export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const isAdmin = user?.role === UserRole.ADMIN;

  const mainItems: NavItem[] = [{ to: "/", label: "Chantiers", icon: "🏗️", end: true }];
  if (isAdmin) mainItems.unshift({ to: "/dashboard", label: "Tableau de bord", icon: "📊" });

  const adminItems: NavItem[] = [
    { to: "/admin/users", label: "Utilisateurs", icon: "👥" },
    { to: "/admin/entreprise", label: "Entreprise", icon: "🏢" },
    { to: "/admin/parametres", label: "Paramètres", icon: "⚙️" },
    { to: "/reports", label: "Rapports", icon: "📄" },
  ];

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <div className="app-layout">
      <button className="sidebar-toggle" onClick={() => setMobileOpen(true)} aria-label="Ouvrir le menu">
        ☰
      </button>

      {mobileOpen && <div className="sidebar-backdrop" onClick={closeMobile} />}

      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-header">
          <img src="/logo-icon.svg" alt="" width={28} height={28} />
          <span>Proactif Field</span>
          <button className="sidebar-close" onClick={closeMobile} aria-label="Fermer le menu">
            ✕
          </button>
        </div>

        <nav className="sidebar-nav">
          {mainItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={closeMobile}
              className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link-active" : ""}`}
            >
              <span>{item.icon}</span> {item.label}
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
                  <span>{item.icon}</span> {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <button className="btn secondary sidebar-logout" onClick={() => clearAuth()}>
          {user?.name ?? "Déconnexion"} · Quitter
        </button>
      </aside>

      <div className="app-main">
        <Outlet />
      </div>
    </div>
  );
}
