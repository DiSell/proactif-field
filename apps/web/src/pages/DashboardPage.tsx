import { BlocageStatut, ChantierStatut } from "@proactif-field/shared";
import { Link } from "react-router-dom";
import { useDashboard } from "../api/hooks";
import Icon, { IconName } from "../components/Icon";

const STATUS_LABELS: Record<ChantierStatut, string> = {
  [ChantierStatut.PREPARATION]: "Préparation",
  [ChantierStatut.PRET]: "Prêt",
  [ChantierStatut.EN_COURS]: "En cours",
  [ChantierStatut.BLOQUE]: "Bloqué",
  [ChantierStatut.TERMINE]: "Terminé",
  [ChantierStatut.CLOTURE]: "Clôturé",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function KpiCard({ label, value, note, icon, progress }: { label: string; value: string | number; note: string; icon: IconName; progress?: number }) {
  return (
    <article className="dashboard-kpi">
      <div className="dashboard-kpi-head"><span>{label}</span><span className="dashboard-kpi-icon"><Icon name={icon} /></span></div>
      <strong>{value}</strong>
      <small>{note}</small>
      {progress !== undefined && <div className="dashboard-progress" aria-label={`Progression globale : ${progress} %`}><span style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }} /></div>}
    </article>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading, isError } = useDashboard();

  return (
    <>
      <header className="topbar dashboard-topbar">
        <div><span className="dashboard-eyebrow">Pilotage</span><h1>Tableau de bord</h1></div>
        <Link className="dashboard-primary-action" to="/"><Icon name="plus" /> Nouveau chantier</Link>
      </header>

      <main className="page dashboard-page">
        {isLoading && <div className="dashboard-loading">Chargement du tableau de bord…</div>}
        {isError && <div className="error-banner">Le tableau de bord n'a pas pu être chargé.</div>}
        {stats && <>
          <section className="dashboard-kpis" aria-label="Indicateurs principaux">
            <KpiCard label="Chantiers" value={stats.chantierCount} note="Dossiers enregistrés" icon="chantier" />
            <KpiCard label="Points" value={stats.pointCount} note="Points recensés" icon="locate" />
            <KpiCard label="Points terminés" value={stats.pointCompleteCount} note={`Sur ${stats.pointCount} points`} icon="check" />
            <KpiCard label="Progression globale" value={`${stats.progressPercent}%`} note="Tous chantiers confondus" icon="dashboard" progress={stats.progressPercent} />
            <KpiCard label="Blocages ouverts" value={stats.openBlocageCount} note="Nécessitent une attention" icon="warning" />
          </section>

          <section className="dashboard-panel dashboard-blocages-panel">
            <div className="dashboard-panel-head"><div><span className="dashboard-eyebrow">Alertes terrain</span><h2>Blocages récents</h2></div></div>
            {stats.recentBlocages.length === 0 ? <div className="dashboard-empty"><Icon name="check" size={28} /><span>Aucun blocage signalé.</span></div> : <div className="dashboard-blockage-list">{stats.recentBlocages.map((blocage) => <Link key={blocage.id} to={`/chantiers/${blocage.chantierId}/blocages`}><span className={`priority ${blocage.priorite}`}>{blocage.priorite}</span><span><strong>{blocage.titre}</strong><small>Point {blocage.pointIdentifiant} · {blocage.createdByName}</small></span><span className={`blocage-status ${blocage.statut}`}>{blocage.statut === BlocageStatut.OUVERT ? "Ouvert" : "Résolu"}</span></Link>)}</div>}
          </section>

          <section className="dashboard-grid">
            <article className="dashboard-panel dashboard-sites-panel">
              <div className="dashboard-panel-head"><div><span className="dashboard-eyebrow">Portefeuille</span><h2>Derniers chantiers</h2></div><Link to="/">Voir tous</Link></div>
              {stats.recentChantiers.length === 0 ? <div className="dashboard-empty"><Icon name="chantier" size={28} /><span>Aucun chantier disponible.</span></div> :
                <div className="dashboard-site-list">{stats.recentChantiers.map((chantier) => (
                  <Link key={chantier.id} to={`/chantiers/${chantier.id}`} className="dashboard-site-row">
                    <span className="dashboard-site-main"><strong>{chantier.name}</strong><small>{chantier.reference}{chantier.address ? ` · ${chantier.address}` : ""}</small></span>
                    <span className={`dashboard-status ${chantier.statut}`}>{STATUS_LABELS[chantier.statut]}</span>
                    <time dateTime={chantier.updatedAt}>{formatDate(chantier.updatedAt)}</time>
                  </Link>
                ))}</div>}
            </article>

            <article className="dashboard-panel dashboard-reports-panel">
              <div className="dashboard-panel-head"><div><span className="dashboard-eyebrow">Documents</span><h2>Derniers rapports</h2></div><Link to="/reports">Voir tous</Link></div>
              {stats.recentReports.length === 0 ? <div className="dashboard-empty"><Icon name="report" size={28} /><span>Aucun rapport généré.</span></div> :
                <div className="dashboard-report-list">{stats.recentReports.map((report) => (
                  <div key={report.id} className="dashboard-report-row"><span className="dashboard-report-icon"><Icon name="report" /></span><span><strong>{report.chantierName}</strong><small>{formatDateTime(report.generatedAt)} · {report.generatedByName}</small></span></div>
                ))}</div>}
            </article>
          </section>

          <section className="dashboard-quick" aria-label="Actions rapides">
            <div><span className="dashboard-eyebrow">Accès direct</span><h2>Actions rapides</h2></div>
            <nav><Link to="/"><Icon name="plus" /> Créer un chantier</Link><Link to="/admin/users"><Icon name="users" /> Gérer les utilisateurs</Link><Link to="/reports"><Icon name="report" /> Consulter les rapports</Link></nav>
          </section>
        </>}
      </main>
    </>
  );
}
