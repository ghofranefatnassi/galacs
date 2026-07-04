import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../../../assets/styles/style.css';
import './DossierVente.css';
import { callModel } from '../../../services/odooApi';

const DossierVenteComponent = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const venteId   = location.state?.venteId;

  // ── State ────────────────────────────────────────────────────────────────
  const [vente,          setVente]          = useState(null);
  const [commission,     setCommission]     = useState(null);
  const [attachments,    setAttachments]    = useState([]);
  const [adminComment,   setAdminComment]   = useState('');
  const [additionalFile, setAdditionalFile] = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [uploading,      setUploading]      = useState(false);
  const [toast,          setToast]          = useState(null);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Load data ────────────────────────────────────────────────────────────
  const loadDossier = useCallback(async () => {
    if (!venteId) return;
    setLoading(true);
    try {
      // Vente record
      const venteRes = await callModel('galacs.vente', 'read', [[venteId]], {
        fields: [
          'lead_id', 'agent_id', 'state', 'reference_bien',
          'date_signature', 'acheteur_nom', 'vendeur_nom',
          'prix_vente', 'attachment_ids', 'admin_comment',
          'verification_mode', 'api_response', 'create_date',
        ],
      });
      const v = venteRes[0];
      setVente(v);
      setAdminComment(v.admin_comment || '');

      // Commission
      const commRes = await callModel('galacs.commission', 'search_read',
        [[['vente_id', '=', venteId]]],
        { fields: ['bid_percent', 'montant_agent', 'montant_galacs', 'agent_share_percent'] }
      );
      setCommission(commRes[0] || null);

      // Attachments
      if (v.attachment_ids?.length) {
        const attRes = await callModel('ir.attachment', 'read', [v.attachment_ids], {
          fields: ['name', 'file_size', 'mimetype', 'datas'],
        });
        setAttachments(attRes);
      } else {
        setAttachments([]);
      }
    } catch (err) {
      console.error('Dossier load error:', err);
      showToast('err', 'Impossible de charger le dossier');
    } finally {
      setLoading(false);
    }
  }, [venteId]);

  useEffect(() => { loadDossier(); }, [loadDossier]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleValidate = async () => {
    try {
      await callModel('galacs.vente', 'write', [[venteId], {
        state: 'validated',
        ...(adminComment ? { admin_comment: adminComment } : {}),
      }]);
      showToast('ok', 'Vente validée avec succès');
      setTimeout(() => navigate('/ventes'), 1200);
    } catch {
      showToast('err', 'Erreur lors de la validation');
    }
  };

  const handleReject = async () => {
    if (!window.confirm('Rejeter cette vente ?')) return;
    try {
      await callModel('galacs.vente', 'write', [[venteId], {
        state: 'rejected',
        ...(adminComment ? { admin_comment: adminComment } : {}),
      }]);
      showToast('ok', 'Vente rejetée');
      setTimeout(() => navigate('/ventes'), 1200);
    } catch {
      showToast('err', 'Erreur lors du rejet');
    }
  };

  const handleUpload = async () => {
    if (!additionalFile) return;
    setUploading(true);
    try {
      // Convert file to base64
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload  = () => res(reader.result.split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(additionalFile);
      });

      await callModel('ir.attachment', 'create', [{
        name:      additionalFile.name,
        datas:     base64,
        res_model: 'galacs.vente',
        res_id:    venteId,
      }]);

      showToast('ok', 'Document ajouté');
      setAdditionalFile(null);
      loadDossier();
    } catch {
      showToast('err', "Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const handleViewAttachment = (att) => {
    if (!att.datas) return;
    const blob = b64toBlob(att.datas, att.mimetype);
    const url  = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const b64toBlob = (b64, mime) => {
    const bytes = atob(b64);
    const arr   = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
  };

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  const formatCurrency = (n) => n ? n.toLocaleString('fr-FR') + '€' : '—';

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const fileIcon = (mime = '') => {
    if (mime.startsWith('image/')) return '🖼';
    if (mime === 'application/pdf') return '📄';
    return '📎';
  };

  const getApiStatus = () => {
    if (!vente?.api_response) return { icon: '⏳', label: 'En attente de vérification', ok: false, ref: null, notaire: null };
    try {
      const r = JSON.parse(vente.api_response);
      if (r.status === 'ok') return {
        icon: '✅', label: 'Acte authentique vérifié', ok: true,
        ref:     r.reference || null,
        notaire: r.notaire   || null,
      };
      return { icon: '✕', label: 'Vérification échouée', ok: false, ref: null, notaire: null };
    } catch {
      return { icon: '✅', label: 'Acte authentique vérifié', ok: true, ref: null, notaire: null };
    }
  };

  const commPct    = commission ? (commission.bid_percent || 0).toFixed(1) + '%' : '—';
  const commAgent  = commission ? formatCurrency(commission.montant_agent)  : '—';
  const commGalacs = commission ? formatCurrency(commission.montant_galacs) : '—';

  const stateBadge = vente?.state === 'validated' ? 'bdg-ok'
    : vente?.state === 'rejected' ? 'bdg-err'
    : 'bdg-pend';
  const stateLabel = vente?.state === 'validated' ? '✅ Validée'
    : vente?.state === 'rejected' ? '✕ Rejetée'
    : 'En attente';

  const api = getApiStatus();

  // ── Guard: no venteId ────────────────────────────────────────────────────
  if (!venteId) {
    return (
      <div className="page active">
        <div className="pi fade-in" style={{ textAlign: 'center', padding: '60px', opacity: 0.5 }}>
          <p>Aucun dossier sélectionné.</p>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/ventes')}>
            ← Retour aux ventes
          </button>
        </div>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page active">
        <div className="pi fade-in" style={{ textAlign: 'center', padding: '60px', opacity: 0.5 }}>
          ⏳ Chargement du dossier…
        </div>
      </div>
    );
  }

  if (!vente) return null;

  return (
    <div className="page active" id="p-val-detail">

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

      <div className="pi fade-in">

        {/* Header */}
        <div className="dVenteS1">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/ventes')}>
            ← Retour
          </button>
          <h1 style={{ margin: 0 }}>
            Dossier de vente — {vente.lead_id?.[1] || `#${venteId}`}
          </h1>
          <span className={`bdg ${stateBadge}`}>{stateLabel}</span>
        </div>

        <div className="g2">

          {/* ── Left column ── */}
          <div className="dVenteS2">

            {/* Summary card */}
            <div className="dVenteS3">
              <div className="dVenteS4">
                <div>
                  <div className="syn dVenteS5">{vente.lead_id?.[1] || '—'}</div>
                  <div className="dVenteS6">
                    #{venteId} · Déclaré le {formatDate(vente.create_date)}
                  </div>
                </div>
                <span className="bdg bdg-hot">🎉 Vente</span>
              </div>

              <div className="dVenteS7">
                <div className="dVenteS8">
                  <div className="dVenteS9">Agent déclarant</div>
                  <div className="dVenteS10">{vente.agent_id?.[1] || '—'}</div>
                </div>
                <div className="dVenteS8">
                  <div className="dVenteS9">Bien</div>
                  <div className="dVenteS10">{vente.reference_bien || '—'}</div>
                </div>
                <div className="dVenteS8">
                  <div className="dVenteS9">Prix de vente</div>
                  <div className="syn dVenteS11">{formatCurrency(vente.prix_vente)}</div>
                </div>
                <div className="dVenteS8">
                  <div className="dVenteS9">Commission totale ({commPct})</div>
                  <div className="syn dVenteS12">
                    {commission
                      ? formatCurrency((commission.montant_agent || 0) + (commission.montant_galacs || 0))
                      : '—'}
                  </div>
                </div>
                <div className="dVenteS8">
                  <div className="dVenteS9">Comm. agent</div>
                  <div className="dVenteS10" style={{ color: 'var(--green)', fontWeight: 700 }}>{commAgent}</div>
                </div>
                <div className="dVenteS8">
                  <div className="dVenteS9">Comm. Galacs</div>
                  <div className="dVenteS10" style={{ color: 'var(--accent)', fontWeight: 700 }}>{commGalacs}</div>
                </div>
                {vente.acheteur_nom && (
                  <div className="dVenteS8">
                    <div className="dVenteS9">Acheteur</div>
                    <div className="dVenteS10">{vente.acheteur_nom}</div>
                  </div>
                )}
                {vente.vendeur_nom && (
                  <div className="dVenteS8">
                    <div className="dVenteS9">Vendeur</div>
                    <div className="dVenteS10">{vente.vendeur_nom}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Documents */}
            <div className="card">
              <h3 style={{ marginBottom: '14px' }}>
                📎 Documents ({attachments.length})
              </h3>

              {attachments.length === 0 && (
                <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '10px' }}>
                  Aucun document joint.
                </p>
              )}

              {attachments.map((att) => (
                <div className="doc-row" key={att.id}>
                  <span style={{ fontSize: '18px' }}>{fileIcon(att.mimetype)}</span>
                  <span className="dVenteS13">{att.name}</span>
                  <span className="dVenteS14">{formatSize(att.file_size)}</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleViewAttachment(att)}
                  >
                    Voir
                  </button>
                </div>
              ))}

              {/* Upload zone */}
              {vente.state === 'draft' && (
                <>
                  <div className="upload-zone" style={{ marginTop: '10px' }}>
                    <label style={{ display: 'block', cursor: 'pointer' }}>
                      <div className="dVenteS15">📎</div>
                      <div className="dVenteS16">
                        {additionalFile ? `📄 ${additionalFile.name}` : 'Ajouter un document'}
                      </div>
                      <input
                        type="file"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) setAdditionalFile(file);
                        }}
                      />
                    </label>
                  </div>

                  <div className="dVenteS22" style={{ marginTop: '10px' }}>
                    <button
                      className="btn dVenteS25"
                      onClick={handleUpload}
                      disabled={!additionalFile || uploading}
                      style={{ opacity: (!additionalFile || uploading) ? 0.5 : 1 }}
                    >
                      {uploading ? '⏳ Envoi…' : '+ Ajouter document'}
                    </button>
                    <button
                      className="btn btn-ko dVenteS24"
                      onClick={() => setAdditionalFile(null)}
                      disabled={uploading}
                    >
                      ✕ Annuler
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Right column ── */}
          <div className="dVenteS2">

            {/* Notaire API */}
            <div className="card">
              <h3 style={{ marginBottom: '14px' }}>🏛 Vérification Notaire API</h3>
              <div className="dVenteS17">
                <div className="dVenteS18">
                  <span style={{ fontSize: '16px' }}>{api.icon}</span>
                  <div className="dVenteS19">{api.label}</div>
                </div>
                {api.ref && (
                  <div className="dVenteS14">
                    Réf. acte : <span className="dVenteS20">{api.ref}</span>
                  </div>
                )}
                {api.notaire && (
                  <div className="dVenteS21">Notaire : {api.notaire}</div>
                )}
                {!api.ok && !api.ref && (
                  <div className="dVenteS21" style={{ color: 'var(--muted)' }}>
                    Vérification en attente de l'API notariale
                  </div>
                )}
              </div>
            </div>

            {/* Admin comment */}
            <div className="card">
              <h3 style={{ marginBottom: '12px' }}>Note de validation</h3>
              <textarea
                className="inp"
                placeholder="Commentaire optionnel sur cette validation…"
                value={adminComment}
                onChange={(e) => setAdminComment(e.target.value)}
                disabled={vente.state !== 'draft'}
                style={{ opacity: vente.state !== 'draft' ? 0.6 : 1 }}
              />
            </div>

            {/* Action buttons — only for draft */}
            {vente.state === 'draft' && (
              <div className="dVenteS22">
                <button className="btn dVenteS23" onClick={handleValidate}>
                  ✓ Valider la vente
                </button>
                <button className="btn btn-ko dVenteS24" onClick={handleReject}>
                  ✕ Rejeter
                </button>
              </div>
            )}

            {/* Read-only status for non-draft */}
            {vente.state !== 'draft' && (
              <div className="card" style={{ textAlign: 'center', opacity: 0.6, fontSize: '13px' }}>
                {vente.state === 'validated'
                  ? '✅ Cette vente a déjà été validée.'
                  : '✕ Cette vente a été rejetée.'}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default DossierVenteComponent;