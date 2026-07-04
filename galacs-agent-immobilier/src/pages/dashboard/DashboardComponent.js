import React, { useState, useEffect } from 'react';
import '../../assets/styles/style.css';
import './Dashboard.css';
import { useNavigate } from 'react-router-dom';
import { useAgentAuth } from '../../contexts/AgentAuthContext';
import { useActiveEncheres } from '../../hooks/Useactiveencheres';
import {
  getActiveLeads,
  getVentesThisMonth,
  getCommissionsThisMonth,
  getPipelineLeads,
  getCrmStages,
} from '../../services/odooApi';

// ── Helpers ──────────────────────────────────────────────────────────────────

const getFormattedDate = () => {
  const date = new Date();
  const weekdays = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];
  return `${weekdays[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

function stageToStep(stageName = '') {
  const name = stageName.toLowerCase();
  if (name.includes('contact') || name.includes('nouveau') || name.includes('new'))  return 0;
  if (name.includes('rdv') || name.includes('rendez') || name.includes('qualif'))    return 1;
  if (name.includes('devis') || name.includes('proposi') || name.includes('offre'))  return 2;
  if (name.includes('vente') || name.includes('gagn') || name.includes('won'))       return 3;
  return 0;
}

const STEP_LABELS = ['Contact', 'RDV', 'Devis', 'Vente'];

function leadBadge(lead) {
  if (lead.probability === 100) return { cls: 'bdg-hot', label: '🎉 Vente !' };
  if (lead.date_deadline) {
    const daysLeft = Math.ceil((new Date(lead.date_deadline) - Date.now()) / 86400000);
    if (daysLeft <= 2) return { cls: 'bdg-warn', label: `⚠ J+${daysLeft}` };
  }
  return { cls: 'bdg-ok', label: '✓ À jour' };
}

function fmtCurrency(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')} k€`;
  return `${n}€`;
}

function categoryBadge(cat, score) {
  if (score >= 70 || cat === 'hot')  return { cls: 'bdg-hot',  label: '🔥 CHAUD' };
  if (score >= 40 || cat === 'warm') return { cls: 'bdg-warm', label: '🌡 TIÈDE' };
  return { cls: 'bdg-ok', label: '❄ FROID' };
}

function initials(name = '') {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

// ── Score ring SVG ────────────────────────────────────────────────────────────

function ScoreRing({ score, color = '#22C55E' }) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="cscore" style={{ width: '80px', height: '80px' }}>
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle className="cs-bg" cx="40" cy="40" r={r} />
        <circle
          className="cs-ring"
          cx="40" cy="40" r={r}
          stroke={color}
          strokeDasharray={circ.toFixed(1)}
          strokeDashoffset={offset.toFixed(1)}
        />
      </svg>
      <div className="cs-ctr">
        <span className="syn" style={{ fontSize: '22px', fontWeight: '800', color }}>
          {score}
        </span>
        <span className="dashS12">%</span>
      </div>
    </div>
  );
}

// ── Pipeline step row ─────────────────────────────────────────────────────────

function PipelineSteps({ currentStep, won = false }) {
  return (
    <div className="step-row" style={{ margin: 0 }}>
      {STEP_LABELS.map((lbl, i) => {
        const isDone = !won && i < currentStep;
        const isCurr = !won && i === currentStep;
        const cls = won ? 'won' : isDone ? 'done' : isCurr ? 'curr' : '';
        const dot = won || isDone ? '✓' : isCurr ? '●' : '';
        return (
          <div key={lbl} className={`step ${cls}`}>
            <div className="step-dot">{dot}</div>
            <div className="step-lbl">{lbl}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const DashboardComponent = () => {
  const navigate = useNavigate();
  const { user } = useAgentAuth();

  const { encheres, nextEnchere, timeLeft } = useActiveEncheres();

  const [activeLeads,   setActiveLeads]   = useState([]);
  const [ventesCount,   setVentesCount]   = useState(null);
  const [commissions,   setCommissions]   = useState(null);
  const [pipelineLeads, setPipelineLeads] = useState([]);
  const [stages,        setStages]        = useState([]);
  const [statsLoading,  setStatsLoading]  = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      getActiveLeads(),
      getVentesThisMonth(),
      getCommissionsThisMonth(),
      getPipelineLeads(),   // replaces getRecentPipelineLeads
      getCrmStages(),
    ]).then(([leadsR, ventesR, commR, pipeR, stagesR]) => {
      if (cancelled) return;
      if (leadsR.status   === 'fulfilled') setActiveLeads(leadsR.value);
      if (ventesR.status  === 'fulfilled') setVentesCount(ventesR.value.length);
      if (commR.status    === 'fulfilled') setCommissions(commR.value);
      if (pipeR.status    === 'fulfilled') setPipelineLeads(pipeR.value.slice(0, 3)); // show 3 most recent
      if (stagesR.status  === 'fulfilled') setStages(stagesR.value);
      setStatsLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const agentName     = user?.name?.split(' ')[0] ?? 'Agent';
  const formattedDate = getFormattedDate();
  const liveCount     = encheres.length;
  const leadsCount    = activeLeads.length;

  const nextLead     = nextEnchere?.lead_id;
  const nextLeadName = Array.isArray(nextLead) ? nextLead[1] : '—';
  const nextScore    = nextEnchere?.score_maturity ?? 0;
  const nextBid      = nextEnchere?.current_bid_percent ?? nextEnchere?.min_bid_percent ?? 0;
  const nextBidCount = nextEnchere?.bid_count ?? 0;
  const nextZone     = nextEnchere?.zone_chalandise ?? '';

  const displayLeads = encheres.length > 0 ? encheres : [];

  // Navigate to Status passing the lead + stages in router state
  const goToStatus = (lead) => {
    navigate('/pipeline/status', { state: { lead, stages } });
  };

  // Navigate to DeclarerVente passing the lead in router state
  const goToDeclarer = (lead) => {
    navigate('/pipeline/declarer_vente', { state: { lead } });
  };

  return (
    <>
      <div className="page active">
        <div className="page-inner fade-in">

          {/* ── Header ── */}
          <div className="dashS1">
            <div>
              <h1>Bonjour, {agentName} 👋</h1>
              <p className="page-subtitle">{formattedDate}</p>
            </div>
            <div className="dashS2">
              <button className="btn btn-secondary" onClick={() => navigate('/leads')}>
                Voir les leads
              </button>
              <button className="btn btn-primary" onClick={() => navigate('/leads')}>
                ⚡ Enchérir maintenant
              </button>
            </div>
          </div>

          {/* ── Live banner ── */}
          {nextEnchere && (
            <div onClick={() => navigate('/leads/enchère_live')} className="dashS3">
              <div className="dashS4">⚡</div>
              <div style={{ flex: 1 }}>
                <div className="dashS5">
                  Enchère en cours — {nextLeadName} · {nextZone} · ferme dans{' '}
                  <span id="cd-dash">{timeLeft}</span>
                </div>
                <div className="dashS6">
                  Score IA : {nextScore}% · Meilleure offre actuelle : {nextBid}% · {nextBidCount} participants
                </div>
              </div>
              <button className="btn btn-warning btn-sm">Participer →</button>
            </div>
          )}

          {/* ── Stat cards ── */}
          <div className="grid-4" style={{ marginBottom: '24px' }}>
            <div className="stat-card green">
              <div className="stat-icon">🎯</div>
              <div className="stat-val" style={{ color: 'var(--accent)' }}>
                {statsLoading ? '…' : leadsCount}
              </div>
              <div className="stat-lbl">Leads actifs</div>
              <div className="stat-trend up">↑ +2 cette semaine</div>
            </div>
            <div className="stat-card orange">
              <div className="stat-icon">⚡</div>
              <div className="stat-val" style={{ color: 'var(--orange)' }}>{liveCount}</div>
              <div className="stat-lbl">Enchères live</div>
              <div className="stat-trend live">● En cours</div>
            </div>
            <div className="stat-card purple">
              <div className="stat-icon">✅</div>
              <div className="stat-val" style={{ color: 'var(--green)' }}>
                {statsLoading ? '…' : ventesCount ?? 0}
              </div>
              <div className="stat-lbl">Ventes ce mois</div>
              <div className="stat-trend up">↑ +12%</div>
            </div>
            <div className="stat-card blue">
              <div className="stat-icon">💶</div>
              <div className="stat-val" style={{ fontSize: '22px', color: '#a78bfa' }}>
                {statsLoading ? '…' : commissions != null ? fmtCurrency(commissions) : '—'}
              </div>
              <div className="stat-lbl">Commissions ce mois</div>
              <div className="stat-trend up">↑ +18%</div>
            </div>
          </div>

          {/* ── Main 2-col grid ── */}
          <div className="grid-2" style={{ marginBottom: '24px' }}>

            {/* Live enchere hero card */}
            <div className="dashS7" onClick={() => navigate('/leads/enchère_live')}>
              <div className="dashS8"></div>
              <div className="dashS9">
                <span className="dash10">🔴 ENCHÈRE LIVE</span>
                <span className="syn" style={{ fontSize: '18px', fontWeight: '800', color: 'var(--orange)' }} id="cd-hero">
                  {nextEnchere ? `⏱ ${timeLeft}` : '—'}
                </span>
              </div>

              {nextEnchere ? (
                <>
                  <div className="dashS11">
                    <ScoreRing score={nextScore} color="#22C55E" />
                    <div>
                      <div className="syn" style={{ fontSize: '22px', fontWeight: '800', marginBottom: '5px' }}>
                        {nextLeadName}
                      </div>
                      <div className="dashS13">📍 {nextZone}</div>
                      <span className={`bdg ${categoryBadge(nextEnchere.ia_category, nextScore).cls}`}>
                        {categoryBadge(nextEnchere.ia_category, nextScore).label}
                      </span>
                    </div>
                  </div>
                  <div className="dashS14">
                    <span className="dashS15">Meilleure offre</span>
                    <span className="syn" style={{ fontSize: '24px', fontWeight: '800', color: 'var(--orange)' }}>
                      {nextBid}%
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ padding: '24px 0', color: 'var(--text-muted)', textAlign: 'center' }}>
                  Aucune enchère en cours
                </div>
              )}

              <button
                className="btn btn-primary btn-full"
                onClick={e => { e.stopPropagation(); navigate('/leads/enchère_live'); }}
              >
                ⚡ Surenchérir
              </button>
            </div>

            {/* Pipeline récent */}
            <div className="card">
              <div className="dashS9">
                <h3>Pipeline récent</h3>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/pipeline')}>
                  Voir tout
                </button>
              </div>

              {statsLoading ? (
                <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Chargement…</div>
              ) : pipelineLeads.length === 0 ? (
                <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Aucun lead récent</div>
              ) : (
                pipelineLeads.map((lead, idx) => {
                  const stageName = lead.stage_id?.[1] ?? '';
                  const step      = stageToStep(stageName);
                  const won       = lead.probability === 100;
                  const badge     = leadBadge(lead);
                  const rowCls    = ['dashS16', 'dashS19', 'dashS20'][idx] ?? 'dashS16';

                  return (
                    <div
                      key={lead.id}
                      className={rowCls}
                      onClick={() => won ? goToDeclarer(lead) : goToStatus(lead)}
                    >
                      <div className="dashS17">
                        <span className="dashS18">{lead.partner_name || lead.name}</span>
                        <span className={`bdg ${badge.cls}`} style={{ fontSize: '10px' }}>
                          {badge.label}
                        </span>
                      </div>
                      <PipelineSteps currentStep={step} won={won} />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Leads disponibles ── */}
          <div className="card">
            <div className="dashS9">
              <h3>Leads disponibles</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/leads')}>
                Voir tous les leads →
              </button>
            </div>
            <div className="dashS21">
              {displayLeads.length === 0 ? (
                <div style={{ padding: '16px', color: 'var(--text-muted)' }}>
                  Aucun lead en enchère actuellement
                </div>
              ) : (
                displayLeads.map(enc => {
                  const leadName = Array.isArray(enc.lead_id) ? enc.lead_id[1] : '—';
                  const score    = enc.score_maturity ?? 0;
                  const { cls: bdgCls, label: bdgLabel } = categoryBadge(enc.ia_category, score);
                  const isHot    = score >= 70;
                  const rowCls   = `lead-row ${isHot ? 'hot' : 'warm'}`;
                  const btnCls   = `btn ${isHot ? 'btn-primary' : 'btn-secondary'} btn-sm`;
                  const bid      = enc.current_bid_percent ?? enc.min_bid_percent ?? 0;

                  return (
                    <div key={enc.id} className={rowCls} onClick={() => navigate('/leads/fichier_leads')}>
                      <div className="lav">{initials(leadName)}</div>
                      <div className="linfo">
                        <div className="lname">{leadName}</div>
                        <div className="lmeta">📍 {enc.zone_chalandise ?? '—'} · Offre min : {bid}%</div>
                      </div>
                      <span className={`bdg ${bdgCls}`}>{bdgLabel}</span>
                      <div className="syn" style={{ fontSize: '18px', fontWeight: '800', color: 'var(--green)', width: '52px', textAlign: 'right' }}>
                        {score}%
                      </div>
                      <div className="dash23">⏱ {enc === nextEnchere ? timeLeft : '—'}</div>
                      <button
                        className={btnCls}
                        onClick={e => { e.stopPropagation(); navigate('/leads/enchère_live'); }}
                      >
                        Enchérir
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default DashboardComponent;