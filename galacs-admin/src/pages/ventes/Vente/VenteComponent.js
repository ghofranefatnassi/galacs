import React, { useState, useEffect } from 'react';
import '../../../assets/styles/style.css';
import './Vente.css';
import { useNavigate } from 'react-router-dom';
import { callModel } from '../../../services/odooApi';

const VenteComponent = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);

  const [ventesEnAttente, setVentesEnAttente] = useState([]);
  const [ventesValidees, setVentesValidees] = useState([]);
  const [ventesRejetees, setVentesRejetees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Load ventes ───────────────────────────────────────────────────────────
  useEffect(() => {
    loadVentes();
  }, []);

  const loadVentes = async () => {
    setLoading(true);
    try {
      const all = await callModel("galacs.vente", "search_read",
        [[]],
        {
          fields: [
            "lead_id", "agent_id", "state", "reference_bien",
            "date_signature", "acheteur_nom", "vendeur_nom",
            "prix_vente", "attachment_ids", "admin_comment",
            "verification_mode", "api_response", "create_date",
          ],
          order: "create_date desc",
        }
      );

      // Also load commissions for each vente
      const commissions = await callModel("galacs.commission", "search_read",
        [[]],
        { fields: ["vente_id", "bid_percent", "montant_agent", "montant_galacs", "agent_share_percent"] }
      );

      const commMap = {};
      commissions.forEach(c => {
        if (c.vente_id?.[0]) commMap[c.vente_id[0]] = c;
      });

      const enriched = all.map(v => ({ ...v, commission: commMap[v.id] || null }));

      setVentesEnAttente(enriched.filter(v => v.state === 'pending_admin'));
      setVentesValidees(enriched.filter(v => v.state === 'validated'));
      setVentesRejetees(enriched.filter(v => v.state === 'rejected'));
    } catch (err) {
      console.error('Ventes load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleValidate = async (e, venteId) => {
    e.stopPropagation();
    try {
      await callModel("galacs.vente", "action_validate", [[venteId]]);
      showToast('ok', 'Vente validée avec succès');
      loadVentes();
    } catch (err) {
      showToast('err', err.message || 'Erreur lors de la validation');
    }
  };

  const handleReject = async (e, venteId) => {
    e.stopPropagation();
    if (!window.confirm('Rejeter cette vente ?')) return;
    try {
      await callModel("galacs.vente", "action_reject", [[venteId]]);
      showToast('ok', 'Vente rejetée');
      loadVentes();
    } catch (err) {
      showToast('err', err.message || 'Erreur lors du rejet');
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  const formatCurrency = (n) => n ? n.toLocaleString('fr-FR') + '€' : '—';

  const getCommissionPct = (v) => {
    if (!v.commission) return '—';
    return (v.commission.bid_percent || 0).toFixed(1) + '%';
  };

  const getAgentComm = (v) => {
    if (!v.commission) return '—';
    return '+' + (v.commission.montant_agent || 0).toLocaleString('fr-FR') + '€';
  };

  const getGalacsComm = (v) => {
    if (!v.commission) return '—';
    return '+' + (v.commission.montant_galacs || 0).toLocaleString('fr-FR') + '€';
  };

  const getApiStatus = (v) => {
    if (!v.api_response) return '⏳ En attente';
    try {
      const r = JSON.parse(v.api_response);
      return r.status === 'ok' ? '✓ Validé' : '✕ Erreur';
    } catch {
      return '✓ Validé';
    }
  };

  // ── Vente card ────────────────────────────────────────────────────────────
  const VenteCard = ({ v, showActions = false }) => (
    <div className="venteS3" onClick={() => navigate('/ventes/dossier-vente', { state: { venteId: v.id } })}>
      <div className="venteS4">
        <div>
          <div className="syn venteS5">
            {v.lead_id?.[1] || 'Lead —'}
            <span className={'bdg venteS6 ' + (
              v.state === 'pending_admin' ? 'bdg-pend' :
              v.state === 'validated' ? 'bdg-ok' : 'bdg-err'
            )}>
              {v.state === 'pending_admin' ? 'En attente' : v.state === 'validated' ? '✅ Validée' : '✕ Rejetée'}
            </span>
          </div>
          <div className="venteS7">
            {'Agent : ' + (v.agent_id?.[1] || '—') +
             (v.reference_bien ? ' · ' + v.reference_bien : '') +
             ' · Déclaré le ' + formatDate(v.create_date)}
          </div>
        </div>
        <div className="syn venteS8">{formatCurrency(v.prix_vente)}</div>
      </div>

      <div className="venteS9">
        <div className="venteS10">
          <div className="venteS11">{'Comm. agent (' + getCommissionPct(v) + ')'}</div>
          <div className="syn venteS12">{getAgentComm(v)}</div>
        </div>
        <div className="venteS10">
          <div className="venteS11">Comm. Galacs</div>
          <div className="syn venteS13">{getGalacsComm(v)}</div>
        </div>
        <div className="venteS10">
          <div className="venteS11">Documents</div>
          <div className="venteS14">
            {'📎 ' + (v.attachment_ids?.length || 0) + ' fichier' + (v.attachment_ids?.length !== 1 ? 's' : '')}
          </div>
        </div>
        <div className="venteS15">
          <div className="venteS11">Notaire API</div>
          <div className="venteS16">{getApiStatus(v)}</div>
        </div>
      </div>

      {showActions && (
        <div className="venteS17">
          <button className="btn btn-ok venteS18" onClick={(e) => handleValidate(e, v.id)}>
            ✓ Valider la vente
          </button>
          <button className="btn btn-ko venteS18" onClick={(e) => handleReject(e, v.id)}>
            ✕ Rejeter
          </button>
          <button className="btn btn-nu venteS18"
            onClick={(e) => { e.stopPropagation(); navigate('/ventes/dossier-vente', { state: { venteId: v.id } }); }}>
            📄 Voir le dossier complet
          </button>
        </div>
      )}

      {v.admin_comment && (
        <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', fontSize: '12px', opacity: 0.7 }}>
          💬 {v.admin_comment}
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    if (loading) return (
      <div style={{ textAlign: 'center', padding: '60px', opacity: 0.5 }}>
        ⏳ Chargement des ventes...
      </div>
    );

    if (activeTab === 0) {
      return ventesEnAttente.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
          ✅ Aucune vente en attente de validation
        </div>
      ) : (
        <div className="venteS2">
          {ventesEnAttente.map(v => <VenteCard key={v.id} v={v} showActions={true} />)}
        </div>
      );
    }

    if (activeTab === 1) {
      return ventesValidees.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
          Aucune vente validée
        </div>
      ) : (
        <div className="venteS2">
          {ventesValidees.map(v => <VenteCard key={v.id} v={v} showActions={false} />)}
        </div>
      );
    }

    return ventesRejetees.length === 0 ? (
      <div className="card" style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
        Aucune vente rejetée
      </div>
    ) : (
      <div className="venteS2">
        {ventesRejetees.map(v => <VenteCard key={v.id} v={v} showActions={false} />)}
      </div>
    );
  };

  return (
    <div className="page active" id="p-ventes">
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

        <div className="venteS1">
          <div>
            <h1>Validation des Ventes</h1>
            <p className="subtitle">
              {activeTab === 0 && (ventesEnAttente.length + ' déclarations en attente · ' + ventesValidees.length + ' validées')}
              {activeTab === 1 && ('Validées · ' + ventesValidees.length + ' au total')}
              {activeTab === 2 && ('Rejetées · ' + ventesRejetees.length + ' au total')}
            </p>
          </div>
        </div>

        <div className="ftabs" style={{ width: 'auto' }}>
          <div className={'ftab ' + (activeTab === 0 ? 'on' : '')} onClick={() => setActiveTab(0)}>
            {'En attente (' + ventesEnAttente.length + ')'}
          </div>
          <div className={'ftab ' + (activeTab === 1 ? 'on' : '')} onClick={() => setActiveTab(1)}>
            {'Validées (' + ventesValidees.length + ')'}
          </div>
          <div className={'ftab ' + (activeTab === 2 ? 'on' : '')} onClick={() => setActiveTab(2)}>
            {'Rejetées (' + ventesRejetees.length + ')'}
          </div>
        </div>

        {renderContent()}
      </div>
    </div>
  );
};

export default VenteComponent;
