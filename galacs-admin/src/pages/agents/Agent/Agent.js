import React, { useState, useEffect } from 'react';
import '../../../assets/styles/style.css';
import './Agent.css';
import { useNavigate } from 'react-router-dom';
import { ExportConfirmModal, ExportFormatModal } from "../../../components/common/CommonModals";
import { callModel, getAgentImmobilierUsers } from '../../../services/odooApi';

const Agent = () => {
  const [activeFilter, setActiveFilter] = useState('Performance');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showFormatModal, setShowFormatModal]   = useState(false);
  const [agents, setAgents]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const navigate = useNavigate();

  // ── Load agents + commissions + leads ─────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const users = await getAgentImmobilierUsers();
        const ids   = users.map(u => u.id);
        if (ids.length === 0) { setAgents([]); return; }

        // Parallel: zones, commissions per agent, active leads per agent
        const [zoneLinks, allZones, allCommissions, allLeads] = await Promise.all([
          callModel("res.users", "read", [ids], { fields: ["id", "galacs_zone_ids"] }),
          callModel("galacs.zone", "search_read", [[]], { fields: ["id", "name"] }),
          callModel("galacs.commission", "search_read",
            [[["agent_id", "in", ids]]],
            { fields: ["agent_id", "montant_agent", "state"], limit: 1000 }
          ),
          callModel("crm.lead", "search_read",
            [[["user_id", "in", ids], ["galacs_stage", "not in", ["won", "lost"]]]],
            { fields: ["user_id"], limit: 2000 }
          ),
        ]);

        // ── Zone names per user ───────────────────────────────────────────
        const zoneNameById = Object.fromEntries(allZones.map(z => [z.id, z.name]));
        const zonesByUserId = Object.fromEntries(
          zoneLinks.map(z => [
            z.id,
            (z.galacs_zone_ids || []).map(zid => zoneNameById[zid]).filter(Boolean).join(', ') || '—',
          ])
        );

        // ── Commissions per agent ─────────────────────────────────────────
        // commission = total montant_agent (all time)
        // sales      = number of commission records (= validated sales)
        const commByAgent = {};
        allCommissions.forEach(c => {
          const aid = Array.isArray(c.agent_id) ? c.agent_id[0] : c.agent_id;
          if (!commByAgent[aid]) commByAgent[aid] = { total: 0, sales: 0 };
          commByAgent[aid].total += c.montant_agent || 0;
          commByAgent[aid].sales += 1;
        });

        // ── Active leads per agent ────────────────────────────────────────
        const leadsByAgent = {};
        allLeads.forEach(l => {
          const uid = Array.isArray(l.user_id) ? l.user_id[0] : l.user_id;
          if (uid) leadsByAgent[uid] = (leadsByAgent[uid] || 0) + 1;
        });

        // ── Merge ─────────────────────────────────────────────────────────
        const mapped = users.map((u, index) => {
          const comm        = commByAgent[u.id] || { total: 0, sales: 0 };
          const activeLeads = leadsByAgent[u.id] || 0;
          // Performance: commission / 20 000€ target, capped at 100%
          const performance = Math.min(100, Math.round(comm.total / 200));

          return {
            id:         u.id,
            rank:       index + 1,
            initials:   u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
            name:       u.name,
            email:      u.email || '—',
            phone:      u.phone || '—',
            avatar:     u.image_1920 ? `data:image/png;base64,${u.image_1920}` : null,
            active:     u.active,
            zones:      zonesByUserId[u.id] || '—',
            leads:      activeLeads,
            sales:      comm.sales,
            commission: Math.round(comm.total),
            performance,
            status:     u.active ? 'Actif' : 'Inactif',
            statusClass: u.active ? 'ok' : 'err',
          };
        });

        // Sort by commission desc (best performer first) for ranking
        mapped.sort((a, b) => b.commission - a.commission);
        setAgents(mapped);

      } catch (err) {
        console.error(err);
        setError('Impossible de charger les agents');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Filtered view ─────────────────────────────────────────────────────────
  const filteredAgents = (() => {
    if (activeFilter === 'Alerte')      return agents.filter(a => a.statusClass === 'warn');
    if (activeFilter === 'Zones')       return [...agents].sort((a, b) => a.zones.localeCompare(b.zones));
    if (activeFilter === 'Commissions') return [...agents].sort((a, b) => b.commission - a.commission);
    return agents; // Performance (default — already sorted by commission)
  })();

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['Rang', 'Agent', 'Email', 'Téléphone', 'Zones',
                     'Leads actifs', 'Ventes', 'Commission (€)', 'Performance (%)', 'Statut'];
    const rows = filteredAgents.map((a, i) => [
      i + 1, a.name, a.email, a.phone, a.zones,
      a.leads, a.sales, a.commission, a.performance, a.status,
    ]);
    const csv  = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href  = URL.createObjectURL(blob);
    link.setAttribute('download', 'agents_galacs.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Export PDF ────────────────────────────────────────────────────────────
  const exportPDF = () => {
    const pw = window.open('', '_blank');
    pw.document.write(`
      <html><head>
        <title>Gestion des Agents - Galacs.io</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 2rem; }
          h1 { color: #8B5CF6; }
          table { border-collapse: collapse; width: 100%; margin-top: 1.5rem; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 12px; }
          th { background-color: #f3f4f6; }
          .footer { margin-top: 2rem; font-size: 0.8rem; color: #6b7280; text-align: center; }
        </style>
      </head><body>
        <h1>📋 Gestion des Agents</h1>
        <p>${filteredAgents.length} agents · Galacs.io</p>
        <table>
          <thead>
            <tr>
              <th>Rang</th><th>Agent</th><th>Email</th><th>Zones</th>
              <th>Leads actifs</th><th>Ventes</th><th>Commission (€)</th>
              <th>Performance</th><th>Statut</th>
            </tr>
          </thead>
          <tbody>
            ${filteredAgents.map((a, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${a.name}</td>
                <td>${a.email}</td>
                <td>${a.zones}</td>
                <td>${a.leads}</td>
                <td>${a.sales}</td>
                <td>${a.commission.toLocaleString()}€</td>
                <td>${a.performance}%</td>
                <td>${a.status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer">Document généré depuis Galacs.io</div>
      </body></html>
    `);
    pw.document.close();
    pw.print();
  };

  const handleExportClick    = () => setShowConfirmModal(true);
  const handleConfirmExport  = () => { setShowConfirmModal(false); setShowFormatModal(true); };
  const handleFormatSelect   = (format) => {
    setShowFormatModal(false);
    if (format === 'csv') exportCSV();
    else if (format === 'pdf') exportPDF();
  };

  // ── Rank display ──────────────────────────────────────────────────────────
  const getRankDisplay = (index, statusClass) => {
    if (statusClass === 'err')  return '⛔';
    if (statusClass === 'warn') return '⚠️';
    if (index === 0) return '🥇 1';
    return String(index + 1);
  };
  const getRankClass = (index, statusClass) => {
    if (statusClass === 'err' || statusClass === 'warn') return 'agentS25';
    if (index === 0) return 'agentS5';
    return 'agentS18';
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page active" id="p-agents">
      <div className="pi fade-in">
        <div className="agentS1">
          <div>
            <h1>Gestion des Agents</h1>
            <p className="subtitle">
              {loading ? '...' : `${agents.length} agents · Groupe Agent Immobilier`}
            </p>
          </div>
          <div className="agentS2">
            <button className="btn btn-ghost" onClick={handleExportClick}>📥 Exporter</button>
            <button className="btn btn-gold" onClick={() => navigate('/agents/ajouter-agent')}>
              + Ajouter un agent
            </button>
          </div>
        </div>

        <div className="agentS3">
          {['Performance', 'Zones', 'Commissions', 'Alerte'].map(f => (
            <div key={f}
              className={`ftag ${activeFilter === f ? 'on' : ''}`}
              onClick={() => setActiveFilter(f)}>
              {f === 'Alerte'
                ? `⚠ En alerte (${agents.filter(a => a.statusClass === 'warn').length})`
                : f}
            </div>
          ))}
        </div>

        <div className="card agentS4">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
              ⏳ Chargement des agents...
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#fca5a5' }}>
              ⚠️ {error}
            </div>
          ) : filteredAgents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
              Aucun agent trouvé
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Rang</th>
                  <th>Agent</th>
                  <th>Zones</th>
                  <th>Leads actifs</th>
                  <th>Ventes</th>
                  <th>Commission</th>
                  <th>Performance</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAgents.map((agent, index) => (
                  <tr key={agent.id}
                    className={agent.statusClass === 'err' ? 'agentS33' : agent.statusClass === 'warn' ? 'agentS24' : ''}
                    style={{ cursor: 'default' }}>

                    <td className={`syn ${getRankClass(index, agent.statusClass)}`}>
                      {getRankDisplay(index, agent.statusClass)}
                    </td>

                    <td>
                      <div className="agentS6">
                        <div className="agentS7"
                          style={{ background: agent.avatar ? 'transparent' : undefined }}>
                          {agent.avatar
                            ? <img src={agent.avatar} alt={agent.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                            : agent.initials}
                        </div>
                        <div>
                          <div className="agentS8">{agent.name}</div>
                          <div className="agentS9">{agent.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="agentS10">{agent.zones}</td>

                    <td className="syn agentS11">{agent.leads}</td>

                    <td className={`syn ${agent.sales === 0 ? 'agentS28' : 'agentS12'}`}>
                      {agent.sales}
                    </td>

                    <td className={`syn ${agent.commission === 0 ? 'agentS36' : 'agentS13'}`}>
                      {agent.commission.toLocaleString()}€
                    </td>

                    <td>
                      <div className="agentS14">
                        <div className="agentS15">
                          <div style={{
                            height: '100%',
                            width: `${agent.performance}%`,
                            background: agent.performance >= 70 ? 'var(--ok)' : agent.performance >= 50 ? 'var(--warn)' : 'var(--err)',
                            borderRadius: '4px',
                            transition: 'width 0.6s ease',
                          }} />
                        </div>
                        <span className={`syn ${agent.performance >= 70 ? 'agentS17' : agent.performance >= 50 ? 'agentS21' : 'agentS38'}`}>
                          {agent.performance}%
                        </span>
                      </div>
                    </td>

                    <td>
                      <span className={`bdg bdg-${agent.statusClass}`} style={{ fontSize: '10px' }}>
                        {agent.statusClass === 'ok' ? '✅' : agent.statusClass === 'warn' ? '⚠' : '⛔'} {agent.status}
                      </span>
                    </td>

                    <td className="actions">
                      <button className="btn btn-ghost btn-sm"
                        onClick={() => navigate('/agents/fichier-agent', { state: { agentId: agent.id } })}>
                        Fiche
                      </button>
                      {agent.statusClass === 'err' ? (
                        <button className="btn btn-ko btn-sm">Suspendre</button>
                      ) : agent.statusClass === 'warn' ? (
                        <button className="btn btn-warning btn-sm agentS32">Contacter</button>
                      ) : (
                        <button className="btn btn-gold btn-sm"
                          onClick={() => navigate('/agents/modifier-agent', { state: { agentId: agent.id } })}>
                          ✎
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
        isOpen={showConfirmModal}
        onConfirm={handleConfirmExport}
        onCancel={() => setShowConfirmModal(false)}
      />
      <ExportFormatModal
        isOpen={showFormatModal}
        onSelect={handleFormatSelect}
        onCancel={() => setShowFormatModal(false)}
      />
    </div>
  );
};

export default Agent;
