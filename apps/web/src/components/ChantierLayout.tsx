import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useParams } from "react-router-dom";
import { UserRole } from "@proactif-field/shared";
import { useChantier, useMarkAssignmentSeen } from "../api/hooks";
import { useAuthStore } from "../auth/store";
import ChantierStatusBadge from "./ChantierStatusBadge";
import Icon from "./Icon";

function formatDate(value: string | null): string | null {
  return value ? new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : null;
}

export default function ChantierLayout() {
  const { chantierId } = useParams<{ chantierId: string }>();
  const { data: chantier } = useChantier(chantierId);
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === UserRole.ADMIN;
  const markSeen = useMarkAssignmentSeen(chantierId);
  const [actionsOpen, setActionsOpen] = useState(false);

  useEffect(() => {
    if (chantier?.isNewAssignment) markSeen.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chantier?.isNewAssignment]);

  const base = `/chantiers/${chantierId}`;
  const tabs = [
    { to: base, label: "Vue d'ensemble", end: true },
    { to: `${base}/documents`, label: "Documents" },
    { to: `${base}/plans`, label: "Plans" },
    { to: `${base}/points`, label: "Points" },
    { to: `${base}/materiel`, label: "Matériel" },
    { to: `${base}/equipe`, label: "Équipe" },
    { to: `${base}/blocages`, label: "Blocages" },
    { to: `${base}/rapports`, label: "Rapports" },
    { to: `${base}/historique`, label: "Historique" },
  ];

  const startDate = formatDate(chantier?.dateDebutPrevue ?? null);
  const endDate = formatDate(chantier?.dateFinPrevue ?? null);

  return (
    <div className="chantier-shell">
      <header className="chantier-header">
        <div className="chantier-header-top">
          <Link to="/" className="chantier-back" aria-label="Retour aux chantiers"><Icon name="back" /></Link>
          <div className="chantier-identity">
            <div className="chantier-reference-row"><span>{chantier?.reference ?? "Dossier chantier"}</span>{chantier && <ChantierStatusBadge statut={chantier.statut} />}</div>
            <h1>{chantier?.name ?? "Chargement…"}</h1>
          </div>
          {isAdmin && <div className="chantier-actions">
            <button onClick={() => setActionsOpen((open) => !open)} aria-expanded={actionsOpen}><Icon name="more" /> Actions</button>
            {actionsOpen && <div className="chantier-actions-menu">
              <Link to={`${base}/equipe`} onClick={() => setActionsOpen(false)}><Icon name="users" /> Gérer l'équipe</Link>
              <Link to={`${base}/documents`} onClick={() => setActionsOpen(false)}><Icon name="report" /> Ajouter un document</Link>
              <Link to={`${base}/plans`} onClick={() => setActionsOpen(false)}><Icon name="plus" /> Ajouter un plan</Link>
            </div>}
          </div>}
        </div>

        {chantier && <div className="chantier-header-meta">
          {chantier.client && <span><small>Client</small><strong>{chantier.client}</strong></span>}
          {chantier.responsableName && <span><small>Responsable</small><strong>{chantier.responsableName}</strong></span>}
          {(startDate || endDate) && <span><small>Dates</small><strong>{startDate ?? "—"} → {endDate ?? "—"}</strong></span>}
          {chantier.address && <span className="chantier-address"><small>Adresse</small><strong>{chantier.address}</strong></span>}
        </div>}
      </header>

      <nav className="chantier-tabs" aria-label="Navigation du chantier">
        {tabs.map((tab) => <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => `chantier-tab ${isActive ? "chantier-tab-active" : ""}`}>{tab.label}</NavLink>)}
      </nav>

      <div className="chantier-content"><Outlet /></div>
    </div>
  );
}
