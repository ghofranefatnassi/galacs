import React, { useState, useEffect, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import '../../assets/styles/style.css';
import './Dashboard.css';
import { ExportConfirmModal, ExportFormatModal } from '../../components/common/CommonModals';
import { callModel } from '../../services/odooApi';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

// ── Module-level helpers ──────────────────────────────────────────────────────
const formatCurrency = (n) => {
  if (n >= 1000) return Math.round(n / 1000) + 'k€';
  return n + '€';
};

const formatDate = (d) => d
  ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  : '—';

const rankIcon = (i) => ['🥇', '🥈', '🥉', '4️⃣'][i] ?? '—';

// ── Component ─────────────────────────────────────────────────────────────────
const DashboardComponent = () => {
  const navigate = useNavigate();

  // ── State ─────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    leads: 0,
    activeAuctions: 0,
    pendingVentes: 0,
    totalCommissions: 0,
  });
  const [topAgents,          setTopAgents]          = useState([]);
  const [pendingVentes,      setPendingVentes]      = useState([]);
  const [activeEnchere,      setActiveEnchere]      = useState(null);
  const [donutData,          setDonutData]          = useState({ hot: 0, warm: 0, cold: 0 });
  const [monthlyCommissions, setMonthlyCommissions] = useState([0, 0, 0, 0, 0, 0]);
  const [timeLeft,           setTimeLeft]           = useState('');
  const [showExportConfirm,  setShowExportConfirm]  = useState(false);
  const [showExportFormat,   setShowExportFormat]   = useState(false);
  const [toast,              setToast]              = useState(null);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Load all data ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 1 — Total leads
      const leadsCount = await callModel('galacs.external.import', 'search_count', [[]]);

      // 2 — Active auctions
      const encheres = await callModel('galacs.enchere', 'search_read',
        [[['state', '=', 'open']]],
        { fields: ['lead_id', 'zone_chalandise', 'ia_category', 'score_maturity', 'current_bid_percent', 'bid_count', 'date_end', 'winner_id'] }
      );

      // 3 — Pending ventes (all, for badge + card list)
      const ventes = await callModel('galacs.vente', 'search_read',
        [[['state', '=', 'draft']]],
        {
          fields: ['lead_id', 'agent_id', 'prix_vente', 'date_signature', 'reference_bien', 'create_date'],
          order: 'create_date desc',
        }
      );

      // 4 — Commissions
      const commissions = await callModel('galacs.commission', 'search_read',
        [[]],
        { fields: ['montant_total', 'montant_agent', 'agent_id', 'create_date', 'state'] }
      );

      const totalComm = commissions.reduce((sum, c) => sum + (c.montant_total || 0), 0);

      // Monthly breakdown — last 6 months
      const now = new Date();
      const monthly = [0, 0, 0, 0, 0, 0];
      commissions.forEach(c => {
        if (!c.create_date) return;
        const d = new Date(c.create_date);
        for (let i = 0; i < 6; i++) {
          const target = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
          if (d.getFullYear() === target.getFullYear() && d.getMonth() === target.getMonth()) {
            monthly[i] += c.montant_total || 0;
          }
        }
      });
      setMonthlyCommissions(monthly);

      // 5 — IA logs hot/warm/cold
      const iaLogs = await callModel('galacs.ia.log', 'search_read',
        [[]],
        { fields: ['lead_id', 'category', 'score', 'create_date'] }
      );

      const latestPerLead = {};
      iaLogs.forEach(log => {
        const lid = log.lead_id?.[0];
        if (!lid) return;
        if (!latestPerLead[lid] || new Date(log.create_date) > new Date(latestPerLead[lid].create_date)) {
          latestPerLead[lid] = log;
        }
      });

      let hot = 0, warm = 0, cold = 0;
      Object.values(latestPerLead).forEach(log => {
        if (log.category === 'hot') hot++;
        else if (log.category === 'warm') warm++;
        else cold++;
      });
      setDonutData({ hot, warm, cold });

      // 6 — Top agents by commission
      const agentCommMap = {};
      commissions.forEach(c => {
        const aid  = c.agent_id?.[0];
        const aname = c.agent_id?.[1];
        if (!aid) return;
        if (!agentCommMap[aid]) agentCommMap[aid] = { id: aid, name: aname, total: 0, count: 0 };
        agentCommMap[aid].total += c.montant_agent || 0;
        agentCommMap[aid].count++;
      });

      const sortedAgents = Object.values(agentCommMap)
        .sort((a, b) => b.total - a.total)
        .slice(0, 4);

      if (sortedAgents.length > 0) {
        const userIds = sortedAgents.map(a => a.id);
        const users = await callModel('res.users', 'read', [userIds], { fields: ['image_1920', 'name'] });
        const avatarMap = {};
        users.forEach(u => { avatarMap[u.id] = u.image_1920; });
        sortedAgents.forEach(a => {
          a.avatar   = avatarMap[a.id] ? 'data:image/png;base64,' + avatarMap[a.id] : null;
          a.initials = a.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
        });
      }

      // Fallback to group 20 if no commissions
      let agentsList = sortedAgents;
      if (agentsList.length === 0) {
        const groups = await callModel('res.groups', 'read', [[20]], { fields: ['users'] });
        const userIds = groups[0]?.users || [];
        if (userIds.length > 0) {
          const users = await callModel('res.users', 'read', [userIds.slice(0, 4)], {
            fields: ['name', 'image_1920'],
          });
          agentsList = users.map(u => ({
            id:       u.id,
            name:     u.name,
            initials: u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
            avatar:   u.image_1920 ? 'data:image/png;base64,' + u.image_1920 : null,
            total:    0,
            count:    0,
          }));
        }
      }

      setKpis({
        leads:            leadsCount,
        activeAuctions:   encheres.length,
        pendingVentes:    ventes.length,
        totalCommissions: totalComm,
      });
      setTopAgents(agentsList);
      setPendingVentes(ventes.slice(0, 3)); // show up to 3 on dashboard
      setActiveEnchere(encheres[0] || null);

    } catch (err) {
      console.error('Dashboard load error:', err);
      showToast('err', 'Erreur lors du chargement du tableau de bord');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Countdown timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeEnchere?.date_end) return;

    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(activeEnchere.date_end) - new Date()) / 1000));
      if (diff === 0) { setTimeLeft('Terminée'); return; }
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setTimeLeft(h > 0
        ? h + 'h ' + String(m).padStart(2, '0') + 'm ' + String(s).padStart(2, '0') + 's'
        : String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
      );
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [activeEnchere]);

  // ── Vente actions (dashboard quick-actions) ───────────────────────────────
  const handleQuickValidate = useCallback(async (e, venteId) => {
    e.stopPropagation();
    try {
      await callModel('galacs.vente', 'write', [[venteId], { state: 'validated' }]);
      showToast('ok', 'Vente validée');
      load();
    } catch {
      showToast('err', 'Erreur lors de la validation');
    }
  }, [load]);

  const handleQuickReject = useCallback(async (e, venteId) => {
    e.stopPropagation();
    if (!window.confirm('Rejeter cette vente ?')) return;
    try {
      await callModel('galacs.vente', 'write', [[venteId], { state: 'rejected' }]);
      showToast('ok', 'Vente rejetée');
      load();
    } catch {
      showToast('err', 'Erreur lors du rejet');
    }
  }, [load]);

  const handleOpenDossier = useCallback((e, venteId) => {
    e.stopPropagation();
    navigate('/ventes/dossier-vente', { state: { venteId } });
  }, [navigate]);

  // ── Chart config ──────────────────────────────────────────────────────────
  const now = new Date();
  const monthLabels = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return d.toLocaleDateString('fr-FR', { month: 'short' });
  });

  const getBarGradient = (ctx, chartArea, idx) => {
    const g = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
    if (idx === 5) {
      g.addColorStop(0, '#F59E0B'); g.addColorStop(1, 'rgba(245,158,11,0.2)');
    } else if (idx >= 3) {
      g.addColorStop(0, '#7C3AED'); g.addColorStop(1, 'rgba(124,58,237,0.2)');
    } else {
      g.addColorStop(0, '#8B5CF6'); g.addColorStop(1, 'rgba(94,81,138,0.2)');
    }
    return g;
  };

  const barData = {
    labels: monthLabels,
    datasets: [{
      label: 'Commissions (€)',
      data: monthlyCommissions,
      backgroundColor: ({ chart, dataIndex }) => {
        const { ctx, chartArea } = chart;
        if (!chartArea) return '#8B5CF6';
        return getBarGradient(ctx, chartArea, dataIndex);
      },
      borderRadius: 8,
      barPercentage: 0.65,
      categoryPercentage: 0.8,
    }],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: true,
    animation: { duration: 1200, easing: 'easeOutQuart', delay: (c) => c.dataIndex * 150 },
    plugins: {
      tooltip: {
        callbacks: { label: (c) => c.raw.toLocaleString() + ' €' },
        backgroundColor: 'rgba(0,0,0,0.8)',
        titleColor: '#F59E0B',
        bodyColor: '#fff',
      },
      legend: { display: false },
    },
    scales: {
      y: {
        grid: { color: 'rgba(255,255,255,0.08)' },
        ticks: { callback: (v) => v.toLocaleString() + '€', color: '#9CA3AF' },
        title: { display: true, text: 'Montant (€)', color: '#D1D5DB' },
      },
      x: {
        grid: { display: false },
        ticks: { color: '#D1D5DB', font: { weight: '500' } },
      },
    },
  };

  const total    = donutData.hot + donutData.warm + donutData.cold || 1;
  const hotPct   = Math.round((donutData.hot  / total) * 100);
  const warmPct  = Math.round((donutData.warm / total) * 100);
  const coldPct  = 100 - hotPct - warmPct;

  const donutChartData = {
    labels: ['Chauds (' + hotPct + '%)', 'Tièdes (' + warmPct + '%)', 'Froids (' + coldPct + '%)'],
    datasets: [{
      data: [donutData.hot || 1, donutData.warm || 1, donutData.cold || 1],
      backgroundColor: ['#22C55E', '#F59E0B', '#EF4444'],
      borderWidth: 0,
      cutout: '65%',
      radius: '90%',
      hoverOffset: 8,
    }],
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: true,
    animation: { animateRotate: true, animateScale: true, duration: 1400, easing: 'easeOutBounce' },
    plugins: {
      tooltip: { callbacks: { label: (c) => c.label + ': ' + c.raw + ' leads' } },
      legend: {
        position: 'bottom',
        labels: {
          color: '#D1D5DB',
          font: { size: 11, weight: '500' },
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 14,
        },
      },
    },
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ['Tableau de bord Galacs.io'],
      [''],
      ['Indicateurs clés'],
      ['Leads total',        kpis.leads],
      ['Enchères actives',   kpis.activeAuctions],
      ['Ventes à valider',   kpis.pendingVentes],
      ['Total commissions',  kpis.totalCommissions + '€'],
      [''],
      ['Leads par catégorie IA'],
      ['Chauds', donutData.hot],
      ['Tièdes', donutData.warm],
      ['Froids', donutData.cold],
      [''],
      ['Commissions mensuelles'],
      ['Mois', 'Montant (€)'],
      ...monthLabels.map((m, i) => [m, monthlyCommissions[i]]),
    ];
    const csv  = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href  = URL.createObjectURL(blob);
    link.setAttribute('download', 'dashboard_galacs.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    const printWindow = window.open('', '_blank');
    const tableRows   = monthLabels.map((m, i) =>
      '<tr><td>' + m + '</td><td>' + (monthlyCommissions[i] || 0).toLocaleString() + ' €</td></tr>'
    ).join('');

    const html = `<!DOCTYPE html><html><head>
      <title>Dashboard Galacs.io</title><meta charset="UTF-8">
      <style>
        body{font-family:Arial,sans-serif;padding:2rem}
        h1{color:#8B5CF6}h2{margin-top:1.5rem;color:#F59E0B}
        table{border-collapse:collapse;width:100%;margin-top:1rem}
        th,td{border:1px solid #ccc;padding:8px;text-align:left}
        th{background:#f3f4f6}
        .kpi-grid{display:flex;gap:1rem;flex-wrap:wrap;margin-top:1rem}
        .kpi-card{border:1px solid #ddd;border-radius:8px;padding:1rem;min-width:150px;background:#f9fafb}
        .kpi-value{font-size:1.8rem;font-weight:bold;color:#8B5CF6}
        footer{margin-top:2rem;font-size:.8rem;color:#6b7280;text-align:center}
      </style></head><body>
      <h1>📊 Tableau de bord Galacs.io</h1>
      <p>Généré le ${new Date().toLocaleDateString('fr-FR')}</p>
      <h2>Indicateurs clés</h2>
      <div class="kpi-grid">
        <div class="kpi-card"><div>Leads total</div><div class="kpi-value">${kpis.leads}</div></div>
        <div class="kpi-card"><div>Enchères actives</div><div class="kpi-value">${kpis.activeAuctions}</div></div>
        <div class="kpi-card"><div>Ventes à valider</div><div class="kpi-value">${kpis.pendingVentes}</div></div>
        <div class="kpi-card"><div>Total commissions</div><div class="kpi-value">${kpis.totalCommissions.toLocaleString()} €</div></div>
      </div>
      <h2>Leads par catégorie IA</h2>
      <table><thead><tr><th>Catégorie</th><th>Nombre</th></tr></thead><tbody>
        <tr><td>🔥 Chauds</td><td>${donutData.hot}</td></tr>
        <tr><td>🟡 Tièdes</td><td>${donutData.warm}</td></tr>
        <tr><td>❄️ Froids</td><td>${donutData.cold}</td></tr>
      </tbody></table>
      <h2>💰 Commissions mensuelles</h2>
      <table><thead><tr><th>Mois</th><th>Montant (€)</th></tr></thead>
      <tbody>${tableRows}</tbody></table>
      <footer>Document généré depuis Galacs.io – Données en temps réel.</footer>
      </body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const handleExportClick   = () => setShowExportConfirm(true);
  const handleConfirmExport = () => { setShowExportConfirm(false); setShowExportFormat(true); };
  const handleFormatSelect  = (format) => {
    setShowExportFormat(false);
    if (format === 'csv') exportCSV();
    else if (format === 'pdf') exportPDF();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page active">
      <div className="pi fade-in">

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', top: 20, right: 20, zIndex: 9999,
            padding: '12px 20px', borderRadius: '10px', fontSize: '14px',
            background: toast.type === 'ok' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            border: '1px solid ' + (toast.type === 'ok' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'),
            color: toast.type === 'ok' ? '#86efac' : '#fca5a5',
          }}>
            {toast.type === 'ok' ? '✅' : '⚠️'} {toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="dashS1">
          <div>
            <h1>Tableau De Bord Administrateur</h1>
            <p className="subtitle">
              {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              {' · Vue d\'ensemble de la plateforme'}
            </p>
          </div>
          <div className="dashS2">
            <button className="btn btn-ghost" onClick={handleExportClick}>📥 Exporter</button>
            <button className="btn btn-gold" onClick={() => navigate('/analyse')}>📊 Rapports détaillés</button>
          </div>
        </div>

        {/* Live enchère banner */}
        <div className="dashS3">
          <div className="dashS4">⚡</div>
          <div style={{ flex: 1 }} onClick={() => navigate('/enchere')}>
            <div className="dashS5">
              {loading ? '...' : kpis.activeAuctions + ' enchères actives'}
              {activeEnchere && (
                ' · ' + (activeEnchere.lead_id?.[1] || 'Lead') +
                ' · Zone: ' + (activeEnchere.zone_chalandise || '—') +
                ' · ' + (activeEnchere.ia_category || '—') +
                ' · Score: ' + (activeEnchere.score_maturity || 0) + '%' +
                ' · Offre max: ' + (activeEnchere.current_bid_percent || 0) + '%' +
                ' · ' + (activeEnchere.bid_count || 0) + ' mises'
              )}
            </div>
            <div className="dashS6">
              {activeEnchere && timeLeft ? (
                <span>
                  {'⏱ Ferme dans '}
                  <span style={{ color: 'var(--orange)', fontWeight: 700 }}>{timeLeft}</span>
                  {' · Cliquer pour gérer les enchères'}
                </span>
              ) : (
                'Cliquer pour gérer les enchères en temps réel'
              )}
            </div>
          </div>
          <div className="dashS7">
            <span className="bdg bdg-warn">
              {loading ? '...' : kpis.pendingVentes + ' ventes à valider'}
            </span>
            <button className="btn btn-gold btn-sm" onClick={() => navigate('/ventes')}>Valider →</button>
          </div>
        </div>

        {/* KPIs */}
        <div className="g4" style={{ marginBottom: '22px' }}>
          <div className="kpi gold">
            <div className="kpi-icon">📋</div>
            <div className="kpi-val dashS8">{loading ? '...' : kpis.leads}</div>
            <div className="kpi-lbl">Leads importés</div>
            <div className="kpi-trend up">Base Waalaxy</div>
          </div>
          <div className="kpi green">
            <div className="kpi-icon">⚡</div>
            <div className="kpi-val dashS9">{loading ? '...' : kpis.activeAuctions}</div>
            <div className="kpi-lbl">Enchères live</div>
            <div className="kpi-trend live">● En cours</div>
          </div>
          <div className="kpi blue">
            <div className="kpi-icon">✅</div>
            <div className="kpi-val dashS10">{loading ? '...' : kpis.pendingVentes}</div>
            <div className="kpi-lbl">Ventes à valider</div>
            <div className="kpi-trend up">En attente</div>
          </div>
          <div className="kpi purple">
            <div className="kpi-icon">💶</div>
            <div className="kpi-val dashS11">{loading ? '...' : formatCurrency(kpis.totalCommissions)}</div>
            <div className="kpi-lbl">Commissions</div>
            <div className="kpi-trend up">Total cumulé</div>
          </div>
        </div>

        <div className="g2" style={{ marginBottom: '22px' }}>

          {/* Ventes à valider */}
          <div className="card">
            <div className="dashS12">
              <h3>⚠ Ventes à valider</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="bdg bdg-pend">
                  {loading ? '...' : kpis.pendingVentes + ' en attente'}
                </span>
                {kpis.pendingVentes > 3 && (
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate('/ventes')}>
                    Voir tout →
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px', opacity: 0.5 }}>⏳ Chargement...</div>
            ) : pendingVentes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', opacity: 0.5 }}>✅ Aucune vente en attente</div>
            ) : pendingVentes.map((v, i) => (
              <div
                key={v.id}
                className={i === 0 ? 'dashS13' : 'dashS18'}
                onClick={() => navigate('/ventes/dossier-vente', { state: { venteId: v.id } })}
                style={{ cursor: 'pointer' }}
              >
                <div className="dashS14">
                  <div>
                    <div className="syn dashS15">{v.lead_id?.[1] || 'Lead —'}</div>
                    <div className="dashS16">
                      {(v.agent_id?.[1] || '—') +
                       ' · ' + (v.reference_bien || '—') +
                       ' · ' + formatDate(v.create_date)}
                    </div>
                  </div>
                  <div className="syn dashS17">
                    {v.prix_vente ? v.prix_vente.toLocaleString('fr-FR') + '€' : '—'}
                  </div>
                </div>
                <div className="dashS2">
                  <button
                    className="btn btn-ok btn-sm"
                    onClick={(e) => handleQuickValidate(e, v.id)}
                  >
                    ✓ Valider
                  </button>
                  <button
                    className="btn btn-ko btn-sm"
                    onClick={(e) => handleQuickReject(e, v.id)}
                  >
                    ✕ Rejeter
                  </button>
                  <button
                    className="btn btn-nu btn-sm"
                    onClick={(e) => handleOpenDossier(e, v.id)}
                  >
                    📄 Détail
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Top Agents */}
          <div className="card">
            <div className="dashS12">
              <h3>🏆 Top Agents</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/agents')}>Voir tout →</button>
            </div>
            <div className="dash19">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '20px', opacity: 0.5 }}>⏳ Chargement...</div>
              ) : topAgents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', opacity: 0.5 }}>Aucun agent trouvé</div>
              ) : topAgents.map((agent, i) => (
                <div
                  key={agent.id}
                  className={'ag-row' + (i === 3 ? ' dashS32' : '')}
                  onClick={() => navigate('/agents/fichier-agent', { state: { agentId: agent.id } })}
                >
                  <div className={i === 0 ? 'dash20' : i === 3 ? 'dashS34' : 'dashS27'}>
                    {rankIcon(i)}
                  </div>
                  <div
                    className={'ag-av ' + (i === 0 ? 'dashS21' : i === 1 ? 'dashS28' : i === 2 ? 'dashS31' : 'dashS35')}
                    style={{ overflow: 'hidden' }}
                  >
                    {agent.avatar
                      ? <img src={agent.avatar} alt={agent.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : agent.initials}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="dashS22">{agent.name}</div>
                    <div className={i === 3 ? 'dashS36' : 'dashS23'}>
                      {agent.count + ' vente' + (agent.count !== 1 ? 's' : '') + ' · ' + formatCurrency(agent.total)}
                    </div>
                    <div className="perf-bar dashS24">
                      <div className={'perf-fill ' + (i === 0 ? 'dashS25' : i === 1 ? 'dashS29' : i === 2 ? 'dashS33' : 'dashS37')}></div>
                    </div>
                  </div>
                  <div className={'syn ' + (i === 0 ? 'dash26' : i === 3 ? 'dashS38' : 'dashS30')}>
                    {formatCurrency(agent.total)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="g3">
          <div className="card-gold dashS39">
            <h3 style={{ marginBottom: '16px' }}>💶 Commissions — 6 derniers mois</h3>
            <div style={{ height: '260px', position: 'relative' }}>
              <Bar data={barData} options={barOptions} />
            </div>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: '16px' }}>Répartition leads par IA</h3>
            <div style={{ maxWidth: '280px', margin: '0 auto' }}>
              <Doughnut data={donutChartData} options={donutOptions} />
            </div>
            <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px', opacity: 0.6 }}>
              {'Total: ' + (donutData.hot + donutData.warm + donutData.cold) + ' leads scorés'}
            </div>
          </div>
        </div>

      </div>

      <ExportConfirmModal
        isOpen={showExportConfirm}
        onConfirm={handleConfirmExport}
        onCancel={() => setShowExportConfirm(false)}
      />
      <ExportFormatModal
        isOpen={showExportFormat}
        onSelect={handleFormatSelect}
        onCancel={() => setShowExportFormat(false)}
      />
    </div>
  );
};

export default DashboardComponent;