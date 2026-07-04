import React, { useState, useEffect } from 'react';
import '../../assets/styles/style.css';
import './Commissions.css';
import { ExportConfirmModal } from "../../components/common/CommonModals";
import { callModel } from '../../services/odooApi';

const Commissions = () => {
  const [activeMonth, setActiveMonth] = useState(null);
  const [months, setMonths] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [kpis, setKpis] = useState({ total: 0, galacsPart: 0, agentsPart: 0, salesCount: 0 });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [pendingExport, setPendingExport] = useState(null);

  // ── Fetch all validated commissions from Odoo ──────────────────────────────
  useEffect(() => {
    fetchCommissions();
  }, []);

  async function fetchCommissions() {
    setLoading(true);
    try {
      const records = await callModel(
        'galacs.commission',
        'search_read',
        [[['state', 'in', ['calculee', 'versee']]]],
        {
          fields: [
            'id', 'vente_id', 'lead_id', 'agent_id',
            'prix_vente', 'bid_percent',
            'montant_total', 'montant_agent', 'montant_galacs',
            'agent_share_percent', 'galacs_share_percent',
            'state', 'create_date'
          ],
          order: 'create_date desc',
          limit: 200,
        }
      );

      // Group by month
      const grouped = {};
      records.forEach(r => {
        const d = new Date(r.create_date);
        const label = d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
          .replace('.', '.')
          .replace(/^\w/, c => c.toUpperCase());
        if (!grouped[label]) grouped[label] = [];
        grouped[label].push(r);
      });

      const monthList = Object.keys(grouped);
      setMonths(monthList);

      if (monthList.length > 0) {
        setActiveMonth(monthList[0]);
        updateKpis(grouped[monthList[0]]);
        setCommissions(grouped[monthList[0]]);
      }

      // store grouped for tab switching
      window._galacs_commissions_grouped = grouped;
    } catch (err) {
      console.error('Commissions fetch error:', err);
    } finally {
      setLoading(false);
    }
  }

  function updateKpis(list) {
    const total = list.reduce((s, r) => s + (r.montant_total || 0), 0);
    const galacsPart = list.reduce((s, r) => s + (r.montant_galacs || 0), 0);
    const agentsPart = list.reduce((s, r) => s + (r.montant_agent || 0), 0);
    setKpis({ total, galacsPart, agentsPart, salesCount: list.length });
  }

  function switchMonth(month) {
    setActiveMonth(month);
    const grouped = window._galacs_commissions_grouped || {};
    const list = grouped[month] || [];
    setCommissions(list);
    updateKpis(list);
  }

  async function markVersee(commId) {
    try {
      await callModel('galacs.commission', 'action_marquer_versee', [[commId]]);
      fetchCommissions();
    } catch (err) {
      console.error('Mark versee error:', err);
    }
  }

  // ── Exports ────────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['Prospect', 'Agent', 'Prix vente (€)', 'Taux (%)', 'Comm. agent (€)', 'Comm. Galacs (€)', 'Date', 'Statut'];
    const rows = commissions.map(r => [
      Array.isArray(r.lead_id) ? r.lead_id[1] : r.lead_id || '—',
      Array.isArray(r.agent_id) ? r.agent_id[1] : r.agent_id || '—',
      r.prix_vente?.toFixed(2),
      r.bid_percent?.toFixed(2),
      r.montant_agent?.toFixed(2),
      r.montant_galacs?.toFixed(2),
      new Date(r.create_date).toLocaleDateString('fr-FR'),
      r.state === 'versee' ? 'Payé' : 'En attente',
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `commissions_${activeMonth?.replace(' ', '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Commissions ${activeMonth} - Galacs.io</title>
      <style>
        body{font-family:Arial,sans-serif;padding:2rem}
        h1{color:#8B5CF6}
        table{border-collapse:collapse;width:100%;margin-top:1.5rem}
        th,td{border:1px solid #ccc;padding:8px;text-align:left}
        th{background:#f3f4f6}
        .kpi-grid{display:flex;gap:1rem;margin-bottom:2rem}
        .kpi-card{border:1px solid #ddd;border-radius:8px;padding:1rem;background:#f9fafb}
        .footer{margin-top:2rem;font-size:.8rem;text-align:center}
      </style></head><body>
      <h1>📊 Commissions - ${activeMonth}</h1>
      <div class="kpi-grid">
        <div class="kpi-card"><strong>Total</strong><br/>${kpis.total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}€</div>
        <div class="kpi-card"><strong>Part Galacs.io</strong><br/>${kpis.galacsPart.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}€</div>
        <div class="kpi-card"><strong>Part agents</strong><br/>${kpis.agentsPart.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}€</div>
        <div class="kpi-card"><strong>Ventes validées</strong><br/>${kpis.salesCount}</div>
      </div>
      <table>
        <thead><tr><th>Prospect</th><th>Agent</th><th>Prix vente</th><th>Taux</th><th>Comm. agent</th><th>Comm. Galacs</th><th>Date</th><th>Statut</th></tr></thead>
        <tbody>
          ${commissions.map(r => `<tr>
            <td>${Array.isArray(r.lead_id) ? r.lead_id[1] : '—'}</td>
            <td>${Array.isArray(r.agent_id) ? r.agent_id[1] : '—'}</td>
            <td>${r.prix_vente?.toLocaleString('fr-FR')}€</td>
            <td>${r.bid_percent?.toFixed(2)}%</td>
            <td>${r.montant_agent?.toLocaleString('fr-FR')}€</td>
            <td>${r.montant_galacs?.toLocaleString('fr-FR')}€</td>
            <td>${new Date(r.create_date).toLocaleDateString('fr-FR')}</td>
            <td>${r.state === 'versee' ? 'Payé' : 'En attente'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div class="footer">Document généré depuis Galacs.io – Données sous réserve de validation.</div>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const handleExportClick = (type) => { setPendingExport(type); setShowModal(true); };
  const handleConfirmExport = () => {
    setShowModal(false);
    if (pendingExport === 'csv') exportCSV();
    else if (pendingExport === 'pdf') exportPDF();
    setPendingExport(null);
  };

  const getStatusBadge = (state) => {
    if (state === 'versee') return <span className="bdg bdg-ok" style={{ fontSize: '10px' }}>✓ Payé</span>;
    return <span className="bdg bdg-pend" style={{ fontSize: '10px' }}>⏳ En attente</span>;
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="page active" id="p-commissions">
      <div className="pi fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
        <p style={{ color: '#94a3b8' }}>Chargement des commissions...</p>
      </div>
    </div>
  );

  return (
    <div className="page active" id="p-commissions">
      <div className="pi fade-in">
        <div className="page-head">
          <div>
            <h1>Gestion des Commissions</h1>
            <p className="subtitle">Calcul automatique · galacs_commissions · Export PDF / CSV</p>
          </div>
          <div className="commissionS1">
            <button className="btn btn-gold btn-sm" onClick={() => handleExportClick('csv')}>📥 CSV</button>
            <button className="btn btn-brand" onClick={() => handleExportClick('pdf')}>📄 Export PDF</button>
          </div>
        </div>

        {/* KPIs */}
        <div className="g4" style={{ marginBottom: '20px' }}>
          <div className="kpi orange">
            <div className="kpi-icon">💶</div>
            <div className="kpi-val commissionS2">{kpis.total.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€</div>
            <div className="kpi-lbl">Total {activeMonth?.split(' ')[0]}</div>
          </div>
          <div className="kpi green">
            <div className="kpi-icon">🏢</div>
            <div className="kpi-val commissionS3">{kpis.galacsPart.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€</div>
            <div className="kpi-lbl">Part Galacs.io (30%)</div>
          </div>
          <div className="kpi purple">
            <div className="kpi-icon">👥</div>
            <div className="kpi-val" style={{ color: '#c084fc' }}>{kpis.agentsPart.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€</div>
            <div className="kpi-lbl">Part agents (70%)</div>
          </div>
          <div className="kpi blue">
            <div className="kpi-icon">✅</div>
            <div className="kpi-val commissionS4">{kpis.salesCount}</div>
            <div className="kpi-lbl">Ventes validées</div>
          </div>
        </div>

        {/* Table */}
        <div className="card card-p" style={{ overflow: 'hidden' }}>
          <div className="commissionS5">
            <h3>Historique des commissions — {activeMonth}</h3>
            <div className="ftabs" style={{ margin: 0 }}>
              {months.map(m => (
                <div
                  key={m}
                  className={`ftab ${activeMonth === m ? 'on' : ''}`}
                  onClick={() => switchMonth(m)}
                >
                  {m}
                </div>
              ))}
              {months.length === 0 && <span style={{ color: '#94a3b8', fontSize: '13px' }}>Aucun mois disponible</span>}
            </div>
          </div>

          {commissions.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
              Aucune commission pour cette période.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Prospect</th>
                  <th>Agent</th>
                  <th>Prix vente</th>
                  <th>Taux (%)</th>
                  <th>Comm. agent</th>
                  <th>Comm. Galacs</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((r) => (
                  <tr key={r.id}>
                    <td className="commissionS6">
                      {Array.isArray(r.lead_id) ? r.lead_id[1] : '—'}
                    </td>
                    <td>{Array.isArray(r.agent_id) ? r.agent_id[1] : '—'}</td>
                    <td className="syn commissionS7">
                      {r.prix_vente?.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€
                    </td>
                    <td>{r.bid_percent?.toFixed(2)}%</td>
                    <td className="syn commissionS8 commissionS3">
                      +{r.montant_agent?.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€
                    </td>
                    <td className="syn commissionS8 commissionS2">
                      +{r.montant_galacs?.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€
                    </td>
                    <td className="commissionS10">
                      {new Date(r.create_date).toLocaleDateString('fr-FR')}
                    </td>
                    <td>{getStatusBadge(r.state)}</td>
                    <td>
                      {r.state === 'calculee' && (
                        <button
                          className="btn btn-sm btn-gold"
                          style={{ fontSize: '11px', padding: '2px 8px' }}
                          onClick={() => markVersee(r.id)}
                        >
                          Marquer versée
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ExportConfirmModal
        isOpen={showModal}
        onConfirm={handleConfirmExport}
        onCancel={() => { setShowModal(false); setPendingExport(null); }}
      />
    </div>
  );
};

export default Commissions;
