import { PointStatut, UserRole } from "@proactif-field/shared";
import { Link, useParams } from "react-router-dom";
import { useChantier, useChantierMateriel, useChantierPoints, useOrgReports, usePlans, useUsers } from "../../api/hooks";
import { useAuthStore } from "../../auth/store";
import Icon from "../../components/Icon";

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString("fr-FR", { dateStyle: "medium" }) : "—";
}

function planName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

export default function ChantierOverviewPage() {
  const { chantierId } = useParams<{ chantierId: string }>();
  const { data: chantier } = useChantier(chantierId);
  const { data: plans } = usePlans(chantierId);
  const { data: points } = useChantierPoints(chantierId);
  const { data: materiels } = useChantierMateriel(chantierId);
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === UserRole.ADMIN;
  const base = `/chantiers/${chantierId}`;

  if (!chantier) return <div className="page chantier-overview-page">Chargement…</div>;

  const totalPoints = points?.length ?? 0;
  const completedPoints = points?.filter((point) => point.statut === PointStatut.VERT).length ?? 0;
  const activePoints = points?.filter((point) => point.statut === PointStatut.ORANGE).length ?? 0;
  const pendingPoints = points?.filter((point) => point.statut === PointStatut.GRIS).length ?? 0;
  const progress = totalPoints === 0 ? 0 : Math.round((completedPoints / totalPoints) * 100);
  const openBlocages = points?.reduce((total, point) => total + point.openBlocageCount, 0) ?? 0;
  const materielCount = materiels?.length ?? 0;
  const materielOverruns = materiels?.filter((m) => m.quantitePrevue != null && m.quantiteUtilisee != null && m.quantiteUtilisee > m.quantitePrevue).length ?? 0;

  return (
    <main className="page chantier-overview-page">
      {!isAdmin && <section className="technician-launch"><div><span>Accès terrain</span><strong>Ouvrir le plan et continuer l'intervention</strong></div><Link to={`${base}/plans`}><Icon name="locate" /> Accéder au plan</Link></section>}

      <section className="chantier-overview-kpis">
        <article><span>Points</span><strong>{totalPoints}</strong><small>Total recensé</small></article>
        <article><span>Terminés</span><strong>{completedPoints}</strong><small>{progress}% du total</small></article>
        <article><span>En cours</span><strong>{activePoints}</strong><small>{pendingPoints} à faire</small></article>
        <article><span>Plans</span><strong>{plans?.length ?? 0}</strong><small>{chantier.assignedUserIds.length} technicien{chantier.assignedUserIds.length > 1 ? "s" : ""}</small></article>
        <article><span>Blocages ouverts</span><strong>{openBlocages}</strong><small>{openBlocages > 0 ? "Attention requise" : "Aucun blocage"}</small></article>
        {materielCount > 0 && <article><span>Matériel</span><strong>{materielCount}</strong><small>{materielOverruns > 0 ? `${materielOverruns} dépassement${materielOverruns > 1 ? "s" : ""}` : "ligne" + (materielCount > 1 ? "s" : "")}</small></article>}
      </section>

      <div className="chantier-overview-grid">
        <section className="dossier-panel dossier-information">
          <div className="dossier-panel-head"><div><span>Synthèse</span><h2>Informations principales</h2></div></div>
          <dl>
            <div><dt>Référence</dt><dd>{chantier.reference}</dd></div>
            <div><dt>Client</dt><dd>{chantier.client || "—"}</dd></div>
            <div><dt>Responsable</dt><dd>{chantier.responsableName || "—"}</dd></div>
            <div><dt>Entreprise exécutante</dt><dd>{chantier.entrepriseExecutante || "—"}</dd></div>
            <div><dt>Début prévu</dt><dd>{formatDate(chantier.dateDebutPrevue)}</dd></div>
            <div><dt>Fin prévue</dt><dd>{formatDate(chantier.dateFinPrevue)}</dd></div>
            <div className="wide"><dt>Adresse</dt><dd>{chantier.address || "—"}</dd></div>
            {chantier.description && <div className="wide"><dt>Description</dt><dd>{chantier.description}</dd></div>}
          </dl>
        </section>

        <section className="dossier-panel dossier-progress-panel">
          <div className="dossier-panel-head"><div><span>Terrain</span><h2>Avancement</h2></div><Link to={`${base}/points`}>Voir les points</Link></div>
          <div className="dossier-progress-content">
            <div className="dossier-progress-ring" style={{ background: `conic-gradient(#2167d5 ${progress}%, #e7edf5 0)` }}><span><strong>{progress}%</strong><small>terminé</small></span></div>
            <ul><li><span className="status-dot VERT" /> Terminés <strong>{completedPoints}</strong></li><li><span className="status-dot ORANGE" /> En cours <strong>{activePoints}</strong></li><li><span className="status-dot GRIS" /> À faire <strong>{pendingPoints}</strong></li></ul>
          </div>
        </section>
      </div>

      <section className="dossier-panel dossier-plans">
        <div className="dossier-panel-head"><div><span>Documents terrain</span><h2>Plans</h2></div><Link to={`${base}/plans`}>Voir tous</Link></div>
        {plans?.length === 0 ? <div className="dossier-empty"><Icon name="report" size={28} /> Aucun plan importé.</div> : <div className="dossier-plan-grid">{plans?.slice(0, 4).map((plan) => (
          <Link key={plan.id} to={`${base}/plans`} className="dossier-plan-card"><span className="dossier-plan-preview"><Icon name="report" size={30} /><small>{plan.fileType}</small></span><span><strong>{planName(plan.fileName)}</strong><small>{plan.fileName} · ajouté le {formatDate(plan.uploadedAt)}</small></span><Icon name="back" className="dossier-card-arrow" /></Link>
        ))}</div>}
      </section>

      {isAdmin && <AdminOverview chantierId={chantier.id} assignedIds={chantier.assignedUserIds} base={base} />}
    </main>
  );
}

function AdminOverview({ chantierId, assignedIds, base }: { chantierId: string; assignedIds: string[]; base: string }) {
  const { data: users } = useUsers();
  const { data: reports } = useOrgReports();
  const technicians = (users ?? []).filter((user) => assignedIds.includes(user.id));
  const chantierReports = (reports ?? []).filter((report) => report.chantierId === chantierId).slice(0, 3);

  return <div className="dossier-secondary-grid">
    <section className="dossier-panel"><div className="dossier-panel-head"><div><span>Affectations</span><h2>Équipe</h2></div><Link to={`${base}/equipe`}>Gérer</Link></div>{technicians.length === 0 ? <div className="dossier-empty"><Icon name="users" size={28} /> Aucun technicien affecté.</div> : <div className="dossier-team-list">{technicians.map((technician) => <div key={technician.id}><span>{technician.name.charAt(0).toUpperCase()}</span><p><strong>{technician.name}</strong><small>{technician.email}</small></p><em>Technicien</em></div>)}</div>}</section>
    <section className="dossier-panel"><div className="dossier-panel-head"><div><span>Production</span><h2>Derniers rapports</h2></div><Link to={`${base}/rapports`}>Ouvrir</Link></div>{chantierReports.length === 0 ? <div className="dossier-empty"><Icon name="report" size={28} /> Aucun rapport généré.</div> : <div className="dossier-report-list">{chantierReports.map((report) => <div key={report.id}><Icon name="report" /><span><strong>Rapport du {formatDate(report.generatedAt)}</strong><small>Généré par {report.generatedByName}</small></span></div>)}</div>}</section>
  </div>;
}
