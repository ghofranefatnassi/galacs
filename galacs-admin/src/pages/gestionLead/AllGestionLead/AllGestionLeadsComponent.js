import React, { useState, useEffect, useCallback } from 'react';
import '../../../assets/styles/style.css';
import './AllGestionLeads.css';
import { ExportConfirmModal } from '../../../components/common/CommonModals';
import CyberLeadModal from '../../../components/common/CyberLeadModal';
import { useNavigate } from 'react-router-dom';
import ReactDOM from 'react-dom';
import { callModel } from '../../../services/odooApi';

// ─── Relancer Confirm Modal ───────────────────────────────────────────────────
const RelancerConfirmModal = ({ isOpen, leadName, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return ReactDOM.createPortal(
    <div className="modal-overlay-crm" onClick={onCancel}>
      <div className="modal-container-crm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon-crm">
          <svg fill="currentColor" viewBox="0 0 20 20" width="48" height="48"
            style={{ fill: '#f59e0b' }} xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
              clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="modal-title-crm">Relancer le lead</h2>
        <p className="modal-message-crm">
          Êtes-vous sûr de vouloir relancer <strong>{leadName}</strong> ?<br />
          Une notification sera envoyée à l'agent et un email au prospect.
        </p>
        <div className="modal-actions-crm">
          <button className="modal-btn-crm modal-btn-cancel" onClick={onCancel}>Annuler</button>
          <button className="modal-btn-crm modal-btn-confirm" onClick={onConfirm}>Confirmer la relance</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── Success Toast ────────────────────────────────────────────────────────────
const SuccessToast = ({ message, visible, onClose }) => {
  if (!visible) return null;
  return ReactDOM.createPortal(
    <div className="toast-crm">
      <div className="toast-content-crm">
        <div className="toast-icon-crm">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth="2" stroke="currentColor" width="18" height="18">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <div>
          <p className="toast-title-crm">Relance envoyée</p>
          <p className="toast-desc-crm">{message}</p>
        </div>
        <button className="toast-close-crm" onClick={onClose}>✕</button>
      </div>
    </div>,
    document.body
  );
};

// ─── Score badge ──────────────────────────────────────────────────────────────
function ScoreBadge({ score, category }) {
  const color = category === 'hot' ? 'var(--red, #ef4444)'
    : category === 'warm' ? 'var(--orange)'
    : 'var(--muted)';
  return (
    <div className="leadsS4">
      <div className="leadsS5">
        <div className="leadsS6" style={{ width: `${score ?? 0}%` }} />
      </div>
      <span className="syn leadsS7" style={{ color }}>{score ?? '—'}%</span>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ statut }) {
  if (statut === 'live')      return <span className="bdg bdg-live"  style={{ fontSize: '10px' }}>⚡ Live</span>;
  if (statut === 'attribue')  return <span className="bdg bdg-ok"    style={{ fontSize: '10px' }}>✓ Attribué</span>;
  if (statut === 'pending')   return <span className="bdg bdg-warn"  style={{ fontSize: '10px' }}>⏳ En attente</span>;
  if (statut === 'froid')     return <span className="bdg bdg-cold"  style={{ fontSize: '10px' }}>❄ Froid</span>;
  if (statut === 'chaud')     return <span className="bdg bdg-hot"   style={{ fontSize: '10px' }}>🔥 Chaud</span>;
  if (statut === 'tiede')     return <span className="bdg bdg-warn"  style={{ fontSize: '10px' }}>🌡 Tiède</span>;
  return <span className="bdg" style={{ fontSize: '10px' }}>—</span>;
}

// ─── Main component ───────────────────────────────────────────────────────────
const AllGestionLeadsComponent = () => {
  const navigate = useNavigate();

  const [activeFilter,      setActiveFilter]      = useState(0);
  const [loading,           setLoading]           = useState(true);
  const [leads,             setLeads]             = useState([]);
  const [showExportModal,   setShowExportModal]   = useState(false);
  const [showDetailModal,   setShowDetailModal]   = useState(false);
  const [showRelancerModal, setShowRelancerModal] = useState(false);
  const [selectedLead,      setSelectedLead]      = useState(null);
  const [toast,             setToast]             = useState({ visible: false, message: '' });

  // ── Fetch all leads and enrich with IA score + enchere status ─────────────
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      // 1 — All external imports (leads)
      const imports = await callModel('galacs.external.import', 'search_read',
        [[]],
        { fields: ['id', 'lead_id', 'source', 'linkedin_url', 'email', 'create_date'] }
      );

      if (imports.length === 0) { setLeads([]); return; }

      const leadIds = imports.map(i => i.lead_id?.[0]).filter(Boolean);

      // 2 — CRM lead details (name, partner, budget…)
      const crmLeads = leadIds.length > 0
        ? await callModel('crm.lead', 'read', [leadIds], {
            fields: ['id', 'partner_name', 'name', 'expected_revenue', 'user_id', 'city', 'type_bien'],
          }).catch(() => [])
        : [];
      const crmMap = {};
      crmLeads.forEach(l => { crmMap[l.id] = l; });

      // 3 — Latest IA score per lead
      const iaLogs = await callModel('galacs.ia.log', 'search_read',
        [[['lead_id', 'in', leadIds]]],
        { fields: ['lead_id', 'score', 'category', 'create_date'] }
      );
      const iaMap = {};  // leadId → latest log
      iaLogs.forEach(log => {
        const lid = log.lead_id?.[0];
        if (!lid) return;
        if (!iaMap[lid] || new Date(log.create_date) > new Date(iaMap[lid].create_date)) {
          iaMap[lid] = log;
        }
      });

      // 4 — Open encheres to detect "live" leads
      const encheres = await callModel('galacs.enchere', 'search_read',
        [[['lead_id', 'in', leadIds]]],
        { fields: ['lead_id', 'state', 'winner_id', 'id'] }
      );
      // Keep latest enchere per lead
      const enchereMap = {};
      encheres.forEach(e => {
        const lid = e.lead_id?.[0];
        if (!lid) return;
        if (!enchereMap[lid]) enchereMap[lid] = e;
        // prefer open over anything
        else if (e.state === 'open') enchereMap[lid] = e;
      });

      // 5 — Ventes for "attribue" status
      const ventes = await callModel('galacs.vente', 'search_read',
        [[['lead_id', 'in', leadIds], ['state', 'in', ['draft', 'done']]]],
        { fields: ['lead_id', 'agent_id', 'prix_vente', 'state', 'reference_bien'] }
      );
      const venteMap = {};
      ventes.forEach(v => { venteMap[v.lead_id?.[0]] = v; });

      // 6 — Assemble enriched leads
      const enriched = imports.map(imp => {
        const lid    = imp.lead_id?.[0];
        const crm    = crmMap[lid]   || {};
        const ia     = iaMap[lid]    || {};
        const enc    = enchereMap[lid];
        const vente  = venteMap[lid];

        // Derive statut
        let statut = 'froid';
        if (enc?.state === 'open')                       statut = 'live';
        else if (enc?.state === 'pending')               statut = 'pending';
        else if (enc?.state === 'closed' || vente)       statut = 'attribue';
        else if (ia.category === 'hot')                  statut = 'chaud';
        else if (ia.category === 'warm')                 statut = 'tiede';

        // Agent: winner of enchere, or vente agent, or crm user
        const agentName = enc?.winner_id?.[1]
          || vente?.agent_id?.[1]
          || crm?.user_id?.[1]
          || 'Non attribué';

        return {
          id:          imp.id,
          lead_id:     lid,
          enchere_id:  enc?.id ?? null,
          vente_id:    vente?.id ?? null,
          prospect:    crm.partner_name || imp.lead_id?.[1] || `Lead #${imp.id}`,
          ref:         `#GL-${String(imp.id).padStart(4, '0')}`,
          bien:        [crm.city, crm.type_bien].filter(Boolean).join(' · ') || '—',
          budget:      crm.expected_revenue ?? null,
          score:       ia.score   ?? null,
          category:    ia.category ?? 'cold',
          statut,
          agent:       agentName,
          email:       imp.email  || '',
          linkedin:    imp.linkedin_url || '',
          source:      imp.source || '',
          create_date: imp.create_date,
          // Pass raw crm lead for CyberLeadModal
          _crm:        crm,
          _ia:         ia,
          _enc:        enc,
        };
      });

      // Sort: live first, then by score desc
      enriched.sort((a, b) => {
        if (a.statut === 'live' && b.statut !== 'live') return -1;
        if (b.statut === 'live' && a.statut !== 'live') return 1;
        return (b.score ?? 0) - (a.score ?? 0);
      });

      setLeads(enriched);
    } catch (err) {
      console.error('AllGestionLeads fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = (() => {
    switch (activeFilter) {
      case 1: return leads.filter(l => (l.score ?? 0) > 70);
      case 2: return leads.filter(l => l.statut === 'live');
      case 3: return leads.filter(l => (l.score ?? 0) > 40 && (l.score ?? 0) <= 70);
      case 4: return leads.filter(l => l.statut === 'attribue');
      case 5: return leads.filter(l => (l.score ?? 0) <= 40);
      default: return leads;
    }
  })();

  // ── Counts ────────────────────────────────────────────────────────────────
  const counts = {
    tous:      leads.length,
    chauds:    leads.filter(l => (l.score ?? 0) > 70).length,
    live:      leads.filter(l => l.statut === 'live').length,
    tiede:     leads.filter(l => (l.score ?? 0) > 40 && (l.score ?? 0) <= 70).length,
    attribues: leads.filter(l => l.statut === 'attribue').length,
    froids:    leads.filter(l => (l.score ?? 0) <= 40).length,
  };

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (filtered.length === 0) { alert('Aucune donnée à exporter.'); return; }
    const headers = ['Prospect', 'Référence', 'Bien', 'Budget (€)', 'Score IA (%)', 'Statut', 'Agent', 'Email', 'Source'];
    const rows = filtered.map(l => [
      l.prospect, l.ref, l.bien,
      l.budget ?? '',
      l.score  ?? '',
      l.statut, l.agent, l.email, l.source,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const tag = ['tous','chauds','live','tiede','attribues','froids'][activeFilter];
    link.setAttribute('download', `leads_${tag}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const showToastMessage = (msg) => {
    setToast({ visible: true, message: msg });
    setTimeout(() => setToast({ visible: false, message: '' }), 4000);
  };

  const confirmRelancer = async () => {
    if (!selectedLead) return;
    try {
      // Log a note on the CRM lead as a relance trace
      if (selectedLead.lead_id) {
        await callModel('crm.lead', 'message_post', [[selectedLead.lead_id]], {
          kwargs: {
            body: `Relance manuelle déclenchée depuis Galacs.io (admin).`,
            message_type: 'comment',
            subtype_xmlid: 'mail.mt_note',
          },
        }).catch(() => {}); // non-blocking
      }
      showToastMessage(`Relance envoyée à ${selectedLead.prospect}`);
    } catch (_) {
      showToastMessage(`Relance enregistrée pour ${selectedLead.prospect}`);
    } finally {
      setShowRelancerModal(false);
      setSelectedLead(null);
    }
  };

  // ── Subtitle ──────────────────────────────────────────────────────────────
  const subtitle = loading ? '…' : [
    `Tous ${counts.tous} leads`,
    counts.live      > 0 ? `${counts.live} en live`          : null,
    counts.attribues > 0 ? `${counts.attribues} attribués`   : null,
    counts.chauds    > 0 ? `${counts.chauds} chauds`         : null,
  ].filter(Boolean).join(' · ');

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page active" id="p-leads">
      <div className="pi fade-in">

        {/* Header */}
        <div className="leadsS1">
          <div>
            <h1>Gestion des Leads</h1>
            <p className="subtitle">{subtitle}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost" onClick={() => setShowExportModal(true)}>📥 Exporter CSV</button>
          </div>
        </div>

        {/* Filter tags */}
        <div className="leadsS2">
          {[
            { label: `Tous (${counts.tous})`,           idx: 0 },
            { label: `🔥 Chauds (${counts.chauds})`,    idx: 1 },
            { label: `⚡ Live (${counts.live})`,         idx: 2 },
            { label: `🌡 Tiède (${counts.tiede})`,       idx: 3 },
            { label: `✅ Attribués (${counts.attribues})`, idx: 4 },
            { label: `❄ Froids (${counts.froids})`,     idx: 5 },
          ].map(({ label, idx }) => (
            <div
              key={idx}
              className={`ftag ${activeFilter === idx ? 'on' : ''}`}
              onClick={() => setActiveFilter(idx)}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', opacity: 0.4, marginBottom: '12px' }}>⏳</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Chargement des leads…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
            Aucun lead dans cette catégorie.
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Prospect</th>
                  <th>Référence</th>
                  <th>Bien</th>
                  <th>Budget</th>
                  <th>Score IA</th>
                  <th>Statut</th>
                  <th>Agent</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => (
                  <tr key={lead.id}>
                    <td><div style={{ fontWeight: 600 }}>{lead.prospect}</div></td>
                    <td className="leadsS3">{lead.ref}</td>
                    <td style={{ fontSize: '12px' }}>{lead.bien}</td>
                    <td className="syn" style={{ fontWeight: 700 }}>
                      {lead.budget != null ? lead.budget.toLocaleString('fr-FR') + '€' : '—'}
                    </td>
                    <td>
                      <ScoreBadge score={lead.score} category={lead.category} />
                    </td>
                    <td>
                      <StatusBadge statut={lead.statut} />
                    </td>
                    <td style={{ fontSize: '12px' }}>{lead.agent}</td>
                    <td className="actions">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => { setSelectedLead(lead); setShowDetailModal(true); }}
                      >
                        Voir
                      </button>
                      {lead.statut === 'live' && (
                        <button
                          className="btn btn-gold btn-sm"
                          onClick={() => navigate('/enchere/enchere-detail', {
                            state: { enchereId: lead.enchere_id },
                          })}
                        >
                          Gérer
                        </button>
                      )}
                      {lead.statut === 'attribue' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => navigate('/ventes/dossier-vente', {
                            state: { venteId: lead.vente_id },
                          })}
                        >
                          Pipeline
                        </button>
                      )}
                      {(lead.statut === 'froid' || lead.statut === 'tiede') && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => { setSelectedLead(lead); setShowRelancerModal(true); }}
                        >
                          Relancer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Modals */}
      <ExportConfirmModal
        isOpen={showExportModal}
        onConfirm={() => { setShowExportModal(false); exportCSV(); }}
        onCancel={() => setShowExportModal(false)}
      />

      <CyberLeadModal
        isOpen={showDetailModal}
        lead={selectedLead}
        onClose={() => { setShowDetailModal(false); setSelectedLead(null); }}
      />

      <RelancerConfirmModal
        isOpen={showRelancerModal}
        leadName={selectedLead?.prospect}
        onConfirm={confirmRelancer}
        onCancel={() => { setShowRelancerModal(false); setSelectedLead(null); }}
      />

      <SuccessToast
        visible={toast.visible}
        message={toast.message}
        onClose={() => setToast({ visible: false, message: '' })}
      />
    </div>
  );
};

export default AllGestionLeadsComponent;