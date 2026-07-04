import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import '../../assets/styles/style.css';
import './Analyse.css';
import { ExportConfirmModal } from "../../components/common/CommonModals";
import { callModel } from "../../services/odooApi";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// ── Month helpers ─────────────────────────────────────────────────────────────
const MONTHS_FR = ['Jan.', 'Fév.', 'Mars', 'Avr.', 'Mai', 'Juin',
                   'Juil.', 'Août', 'Sep.', 'Oct.', 'Nov.', 'Déc.'];

const getMonthRange = (year, month) => {
  const start = new Date(year, month, 1);
  const end   = new Date(year, month + 1, 0, 23, 59, 59);
  const fmt   = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
  return { start: fmt(start), end: fmt(end) };
};

const getLast6Months = () => {
  const result = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({ label: MONTHS_FR[d.getMonth()], year: d.getFullYear(), month: d.getMonth() });
  }
  return result;
};

const getLast3Months = () => {
  const result = [];
  const now = new Date();
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({ label: `${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`, year: d.getFullYear(), month: d.getMonth() });
  }
  return result;
};

// ── Gradient helpers ──────────────────────────────────────────────────────────
const getCommissionGradient = (ctx, chartArea, barIndex, total) => {
  const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
  if (barIndex === total - 1) {
    gradient.addColorStop(0, '#F59E0B');
    gradient.addColorStop(1, 'rgba(245,158,11,0.15)');
  } else if (barIndex >= total - 3) {
    gradient.addColorStop(0, '#7C3AED');
    gradient.addColorStop(1, 'rgba(124,58,237,0.15)');
  } else {
    gradient.addColorStop(0, '#8B5CF6');
    gradient.addColorStop(1, 'rgba(94,81,138,0.15)');
  }
  return gradient;
};

const getWeeklyGradient = (ctx, chartArea, barIndex, isLast) => {
  const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
  if (isLast) {
    gradient.addColorStop(0, 'rgba(34,197,94,0.2)');
    gradient.addColorStop(1, 'rgba(34,197,94,0.05)');
  } else {
    gradient.addColorStop(0, '#22C55E');
    gradient.addColorStop(1, 'rgba(34,197,94,0.15)');
  }
  return gradient;
};

// ── Component ─────────────────────────────────────────────────────────────────
const AnalyseComponent = () => {
  const MONTH_OPTS = getLast3Months();
  const [loading, setLoading]           = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(MONTH_OPTS[0].label);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [commissionsData, setCommissionsData] = useState({
    labels: getLast6Months().map(m => m.label),
    datasets: [{ label: 'Commissions (€)', data: [0,0,0,0,0,0], backgroundColor: '#8B5CF6', borderRadius: 8 }]
  });
  const [weeklySalesData, setWeeklySalesData] = useState({
    labels: ['Sem. 1', 'Sem. 2', 'Sem. 3', 'Sem. 4'],
    datasets: [{ label: 'Ventes', data: [0,0,0,null], backgroundColor: '#22C55E', borderRadius: 8 }]
  });
  const [kpis, setKpis] = useState({
    commissionsTotal: '0€', salesCount: 0, leads: 0, conversionRate: '0%',
    evolutionCommissions: '+0%', evolutionSales: '+0%',
    evolutionLeads: '+0%', evolutionConversion: '+0%',
  });
  const [kpiTable, setKpiTable] = useState([]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    try {
      const selectedMeta = MONTH_OPTS.find(m => m.label === selectedMonth) || MONTH_OPTS[0];
      const prevMeta     = { year: selectedMeta.month === 0 ? selectedMeta.year - 1 : selectedMeta.year,
                              month: selectedMeta.month === 0 ? 11 : selectedMeta.month - 1 };

      const { start: curStart, end: curEnd }   = getMonthRange(selectedMeta.year, selectedMeta.month);
      const { start: prevStart, end: prevEnd } = getMonthRange(prevMeta.year, prevMeta.month);

      // ── 1. Commissions chart (last 6 months) ──────────────────────────────
      const six = getLast6Months();
      const commissionsByMonth = await Promise.all(
        six.map(async (m) => {
          const { start, end } = getMonthRange(m.year, m.month);
          try {
            const recs = await callModel('galacs.commission', 'search_read',
              [[['create_date', '>=', start], ['create_date', '<=', end]]],
              { fields: ['montant_total'] }
            );
            return recs.reduce((s, r) => s + (r.montant_total || 0), 0);
          } catch { return 0; }
        })
      );

      setCommissionsData({
        labels: six.map(m => m.label),
        datasets: [{
          label: 'Commissions (€)',
          data: commissionsByMonth,
          backgroundColor: (context) => {
            const { chart, dataIndex } = context;
            const { ctx, chartArea } = chart;
            if (!chartArea) return '#8B5CF6';
            return getCommissionGradient(ctx, chartArea, dataIndex, six.length);
          },
          borderRadius: 8,
          barPercentage: 0.65,
          categoryPercentage: 0.8,
        }]
      });

      // ── 2. Weekly sales (commissions as proxy for validated sales) ─────────
      const weeklyCount = [0, 0, 0, 0];
      try {
        const monthlyComs = await callModel('galacs.commission', 'search_read',
          [[['create_date', '>=', curStart], ['create_date', '<=', curEnd]]],
          { fields: ['create_date'] }
        );
        monthlyComs.forEach(c => {
          const day  = new Date(c.create_date + 'Z').getDate();
          const week = Math.min(Math.floor((day - 1) / 7), 3);
          weeklyCount[week]++;
        });
      } catch {}

      const now = new Date();
      const isCurrentMonth = selectedMeta.year === now.getFullYear() && selectedMeta.month === now.getMonth();
      const currentWeek = isCurrentMonth ? Math.min(Math.floor((now.getDate() - 1) / 7), 3) : 3;

      setWeeklySalesData({
        labels: ['Sem. 1', 'Sem. 2', 'Sem. 3', 'Sem. 4'],
        datasets: [{
          label: 'Ventes',
          data: weeklyCount.map((v, i) => (isCurrentMonth && i > currentWeek) ? null : v),
          backgroundColor: (context) => {
            const { chart, dataIndex } = context;
            const { ctx, chartArea } = chart;
            if (!chartArea) return '#22C55E';
            return getWeeklyGradient(ctx, chartArea, dataIndex, isCurrentMonth && dataIndex === currentWeek);
          },
          borderWidth: (context) => (isCurrentMonth && context.dataIndex === currentWeek) ? 1 : 0,
          borderColor: 'rgba(245,158,11,0.5)',
          borderRadius: 8,
          barPercentage: 0.7,
          categoryPercentage: 0.85,
        }]
      });

      // ── 3. KPIs ───────────────────────────────────────────────────────────
      let curLeads = 0, prevLeads = 0, curSales = 0, prevSales = 0;
      let curTotal = 0, prevTotal = 0;

      try {
        curLeads = await callModel('crm.lead', 'search_count',
          [[['create_date', '>=', curStart], ['create_date', '<=', curEnd]]]);
        prevLeads = await callModel('crm.lead', 'search_count',
          [[['create_date', '>=', prevStart], ['create_date', '<=', prevEnd]]]);
      } catch {}

      try {
        // Use galacs.commission as proxy for validated sales
        const curComs = await callModel('galacs.commission', 'search_read',
          [[['create_date', '>=', curStart], ['create_date', '<=', curEnd]]],
          { fields: ['montant_total'] }
        );
        const prevComs = await callModel('galacs.commission', 'search_read',
          [[['create_date', '>=', prevStart], ['create_date', '<=', prevEnd]]],
          { fields: ['montant_total'] }
        );
        curSales  = curComs.length;
        prevSales = prevComs.length;
        curTotal  = curComs.reduce((s, c) => s + (c.montant_total || 0), 0);
        prevTotal = prevComs.reduce((s, c) => s + (c.montant_total || 0), 0);
      } catch {}

      const curConv  = curLeads  > 0 ? ((curSales  / curLeads)  * 100).toFixed(1) : '0';
      const prevConv = prevLeads > 0 ? ((prevSales / prevLeads) * 100).toFixed(1) : '0';
      const avgCom   = curSales  > 0 ? curTotal / curSales : 0;
      const prevAvg  = prevSales > 0 ? prevTotal / prevSales : 0;

      const pct = (cur, prev) => {
        if (!prev) return '+0%';
        const v = ((cur - prev) / prev * 100).toFixed(0);
        return v >= 0 ? `+${v}%` : `${v}%`;
      };

      let activeAgents = 0;
      try {
        activeAgents = await callModel('res.users', 'search_count',
          [[['active', '=', true], ['groups_id', 'in', [20]]]]);
      } catch {}

      setKpis({
        commissionsTotal: curTotal >= 1000 ? `${Math.round(curTotal / 1000)}k€` : `${Math.round(curTotal)}€`,
        salesCount: curSales,
        leads: curLeads,
        conversionRate: `${curConv}%`,
        evolutionCommissions: pct(curTotal, prevTotal),
        evolutionSales: pct(curSales, prevSales),
        evolutionLeads: pct(curLeads, prevLeads),
        evolutionConversion: (() => {
          const diff = (parseFloat(curConv) - parseFloat(prevConv)).toFixed(0);
          return diff >= 0 ? `+${diff}%` : `${diff}%`;
        })(),
      });

      setKpiTable([
        {
          metric: 'Leads entrants',
          mar: curLeads, feb: prevLeads,
          change: pct(curLeads, prevLeads),
          target: '120/mois',
          status: curLeads >= 120 ? 'Atteint' : 'En retard',
        },
        {
          metric: 'Taux conversion enchères',
          mar: `${curConv}%`, feb: `${prevConv}%`,
          change: (() => { const d = (parseFloat(curConv) - parseFloat(prevConv)).toFixed(0); return d >= 0 ? `+${d}%` : `${d}%`; })(),
          target: '70%',
          status: parseFloat(curConv) >= 70 ? 'Atteint' : 'En retard',
        },
        {
          metric: 'Commission moyenne / vente',
          mar: `${Math.round(avgCom).toLocaleString()}€`,
          feb: `${Math.round(prevAvg).toLocaleString()}€`,
          change: pct(avgCom, prevAvg),
          target: '2 000€',
          status: avgCom >= 2000 ? 'Atteint' : 'En retard',
        },
        {
          metric: 'Agents actifs',
          mar: `${activeAgents}`,
          feb: '—',
          change: 'stable',
          target: '12',
          status: activeAgents >= 12 ? 'Atteint' : 'En retard',
        },
        {
          metric: 'Commissions totales',
          mar: curTotal >= 1000 ? `${Math.round(curTotal / 1000)}k€` : `${Math.round(curTotal)}€`,
          feb: prevTotal >= 1000 ? `${Math.round(prevTotal / 1000)}k€` : `${Math.round(prevTotal)}€`,
          change: pct(curTotal, prevTotal),
          target: '80k€',
          status: curTotal >= 80000 ? 'Atteint' : 'En retard',
        },
      ]);

    } catch (err) {
      console.error('Analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedMonth]);

  // ── Export PDF ────────────────────────────────────────────────────────────
  const exportPDF = () => {
    const pw = window.open('', '_blank');
    if (!pw) return;
    pw.document.write(`
      <html><head>
        <title>Rapports Galacs.io - ${selectedMonth}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 2rem; }
          h1 { color: #8B5CF6; } h2 { color: #F59E0B; margin-top: 1.5rem; }
          table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          th { background: #f3f4f6; }
          .kpi-grid { display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 1rem; }
          .kpi-card { border: 1px solid #ddd; border-radius: 8px; padding: 1rem; min-width: 140px; background: #f9fafb; }
          .kpi-value { font-size: 1.8rem; font-weight: bold; color: #8B5CF6; }
          footer { margin-top: 2rem; font-size: 0.8rem; color: #6b7280; text-align: center; }
        </style>
      </head><body>
        <h1>📊 Rapports & Analytics — ${selectedMonth}</h1>
        <div class="kpi-grid">
          <div class="kpi-card"><div>Commissions</div><div class="kpi-value">${kpis.commissionsTotal}</div></div>
          <div class="kpi-card"><div>Ventes validées</div><div class="kpi-value">${kpis.salesCount}</div></div>
          <div class="kpi-card"><div>Leads entrants</div><div class="kpi-value">${kpis.leads}</div></div>
          <div class="kpi-card"><div>Taux conversion</div><div class="kpi-value">${kpis.conversionRate}</div></div>
        </div>
        <h2>📋 Indicateurs clés de performance</h2>
        <table>
          <thead><tr><th>Indicateur</th><th>${selectedMonth}</th><th>Mois précédent</th><th>Évolution</th><th>Objectif</th><th>Statut</th></tr></thead>
          <tbody>
            ${kpiTable.map(r => `
              <tr>
                <td>${r.metric}</td><td>${r.mar}</td><td>${r.feb}</td>
                <td>${r.change}</td><td>${r.target}</td><td>${r.status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <footer>Document généré depuis Galacs.io – Données sous réserve de validation.</footer>
      </body></html>
    `);
    pw.document.close();
    pw.print();
  };

  // ── Chart options ─────────────────────────────────────────────────────────
  const commissionsOptions = {
    responsive: true, maintainAspectRatio: true,
    animation: { duration: 1200, easing: 'easeOutQuart', delay: (c) => c.dataIndex * 150 },
    plugins: {
      tooltip: { callbacks: { label: (c) => `${c.raw.toLocaleString()} €` }, backgroundColor: 'rgba(0,0,0,0.8)', titleColor: '#F59E0B', bodyColor: '#fff' },
      legend: { display: false },
    },
    scales: {
      y: { grid: { color: 'rgba(255,255,255,0.08)' }, ticks: { callback: (v) => v.toLocaleString() + '€', color: '#9CA3AF' }, title: { display: true, text: 'Montant (€)', color: '#D1D5DB' } },
      x: { grid: { display: false }, ticks: { color: '#D1D5DB', font: { weight: '500' } } },
    },
  };

  const weeklySalesOptions = {
    responsive: true, maintainAspectRatio: true,
    animation: { duration: 1000, easing: 'easeOutQuart', delay: (c) => c.dataIndex * 120 },
    plugins: {
      tooltip: { callbacks: { label: (c) => c.raw === null ? 'Données non disponibles' : `${c.raw} ventes` } },
      legend: { display: false },
    },
    scales: {
      y: { grid: { color: 'rgba(255,255,255,0.08)' }, ticks: { stepSize: 5, color: '#9CA3AF' }, title: { display: true, text: 'Nombre de ventes', color: '#D1D5DB' }, min: 0 },
      x: { grid: { display: false }, ticks: { color: '#D1D5DB', font: { weight: '500' } } },
    },
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page active" id="p-rapports">
        <div className="pi" style={{ textAlign: 'center', paddingTop: '100px', opacity: 0.5 }}>
          ⏳ Chargement des données...
        </div>
      </div>
    );
  }

  return (
    <div className="page active" id="p-rapports">
      <div className="pi fade-in">
        <div className="gestionS1">
          <div>
            <h1>Rapports & Analytics</h1>
            <p className="subtitle">{selectedMonth} · Vue consolidée</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select className="inp gestionS2" value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}>
              {MONTH_OPTS.map(m => (
                <option key={m.label} value={m.label}>{m.label}</option>
              ))}
            </select>
            <button className="btn btn-gold" onClick={() => setShowConfirmModal(true)}>
              📥 Exporter PDF
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="g4" style={{ marginBottom: '22px' }}>
          <div className="kpi gold">
            <div className="kpi-icon">💶</div>
            <div className="kpi-val gestionS3">{kpis.commissionsTotal}</div>
            <div className="kpi-lbl">Commissions</div>
            <div className={`kpi-trend ${kpis.evolutionCommissions.includes('+') ? 'up' : 'dn'}`}>
              {kpis.evolutionCommissions}
            </div>
          </div>
          <div className="kpi green">
            <div className="kpi-icon">✅</div>
            <div className="kpi-val gestionS4">{kpis.salesCount}</div>
            <div className="kpi-lbl">Ventes</div>
            <div className={`kpi-trend ${kpis.evolutionSales.includes('+') ? 'up' : 'dn'}`}>
              {kpis.evolutionSales}
            </div>
          </div>
          <div className="kpi blue">
            <div className="kpi-icon">📋</div>
            <div className="kpi-val gestionS5">{kpis.leads}</div>
            <div className="kpi-lbl">Leads entrants</div>
            <div className={`kpi-trend ${kpis.evolutionLeads.includes('+') ? 'up' : 'dn'}`}>
              {kpis.evolutionLeads}
            </div>
          </div>
          <div className="kpi purple">
            <div className="kpi-icon">⚡</div>
            <div className="kpi-val gestionS6">{kpis.conversionRate}</div>
            <div className="kpi-lbl">Taux conversion</div>
            <div className={`kpi-trend ${kpis.evolutionConversion.includes('+') ? 'up' : 'dn'}`}>
              {kpis.evolutionConversion}
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="g2" style={{ marginBottom: '22px' }}>
          <div className="card-gold">
            <h3 style={{ marginBottom: '16px' }}>💶 Commissions — 6 derniers mois</h3>
            <div style={{ height: '260px', position: 'relative' }}>
              <Bar data={commissionsData} options={commissionsOptions} />
            </div>
          </div>
          <div className="card-gold">
            <h3 style={{ marginBottom: '16px' }}>✅ Ventes hebdomadaires — {selectedMonth}</h3>
            <div style={{ height: '260px', position: 'relative' }}>
              <Bar data={weeklySalesData} options={weeklySalesOptions} />
            </div>
          </div>
        </div>

        {/* KPI table */}
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>Indicateurs clés de performance</h3>
          <table className="tbl">
            <thead>
              <tr>
                <th>Indicateur</th>
                <th>{selectedMonth}</th>
                <th>Mois précédent</th>
                <th>Évolution</th>
                <th>Objectif</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {kpiTable.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.metric}</td>
                  <td className="syn gestionS19">{row.mar}</td>
                  <td className="gestionS13">{row.feb}</td>
                  <td className={row.change.includes('+') ? 'gestionS4' : row.change.includes('−') || row.change.includes('-') ? 'gestionS16' : 'gestionS13'}>
                    {row.change}
                  </td>
                  <td className="gestionS13">{row.target}</td>
                  <td>
                    {row.status === 'Atteint'
                      ? <span className="bdg bdg-ok"   style={{ fontSize: '10px' }}>✓ Atteint</span>
                      : row.status === 'En retard'
                      ? <span className="bdg bdg-warn" style={{ fontSize: '10px' }}>⚠ En retard</span>
                      : <span className="bdg"          style={{ fontSize: '10px' }}>{row.status}</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ExportConfirmModal
        isOpen={showConfirmModal}
        onConfirm={() => { setShowConfirmModal(false); exportPDF(); }}
        onCancel={() => setShowConfirmModal(false)}
      />
    </div>
  );
};

export default AnalyseComponent;
