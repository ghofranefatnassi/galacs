import React, { useState, useEffect } from 'react';
import '../../assets/styles/style.css';
import './Crm.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { callModel } from '../../services/odooApi';

const ContactDetailComponent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const contactId = location.state?.contactId;

  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Load contact ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!contactId) {
      showToast('err', 'Contact introuvable');
      setTimeout(() => navigate('/crm'), 2000);
      return;
    }

    callModel("galacs.contact.prive", "read", [[contactId]], {
      fields: [
        "alias", "agent_id", "zone_chalandise", "type_bien",
        "nom_encrypted", "telephone_encrypted", "email_encrypted",
        "linkedin_encrypted", "notes_encrypted",
        "converted_to_lead", "converted_lead_id",
        "create_date", "write_date",
      ],
    })
      .then(result => {
        const c = result[0];
        setContact(c);
        setNote(c.notes_encrypted || '');
      })
      .catch(() => showToast('err', 'Impossible de charger le contact'))
      .finally(() => setLoading(false));
  }, [contactId]);

  // ── Save note ─────────────────────────────────────────────────────────────
  const handleSaveNote = async () => {
    setSavingNote(true);
    try {
      await callModel("galacs.contact.prive", "write", [[contactId], {
        notes_encrypted: note,
      }]);
      showToast('ok', 'Note sauvegardée');
    } catch {
      showToast('err', 'Erreur lors de la sauvegarde');
    } finally {
      setSavingNote(false);
    }
  };

  // ── Delete contact ────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!window.confirm('Supprimer ce contact ? Cette action est irréversible.')) return;
    try {
      await callModel("galacs.contact.prive", "unlink", [[contactId]]);
      showToast('ok', 'Contact supprimé');
      setTimeout(() => navigate('/crm'), 1000);
    } catch {
      showToast('err', 'Erreur lors de la suppression');
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  const daysSince = (d) => {
    if (!d) return '';
    const diff = Math.floor((new Date() - new Date(d)) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "Ajouté aujourd'hui";
    if (diff === 1) return 'Ajouté il y a 1 jour';
    return 'Ajouté il y a ' + diff + ' jours';
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="page active" id="p-crm-detail">
      <div className="page-inner fade-in" style={{ textAlign: 'center', paddingTop: '80px', opacity: 0.5 }}>
        ⏳ Chargement du contact...
      </div>
    </div>
  );

  if (!contact) return (
    <div className="page active" id="p-crm-detail">
      <div className="page-inner fade-in" style={{ textAlign: 'center', paddingTop: '80px', color: '#fca5a5' }}>
        ⚠️ Contact introuvable
      </div>
    </div>
  );

  const name = contact.nom_encrypted || contact.alias || '—';
  const initials = getInitials(name);
  const phone = contact.telephone_encrypted || null;
  const email = contact.email_encrypted || null;
  const linkedin = contact.linkedin_encrypted || null;
  const isConverted = contact.converted_to_lead;

  return (
    <div className="page active" id="p-crm-detail">
      <div className="page-inner fade-in">

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

        <div className="crm-detail-header">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/crm')}>
            ← Retour
          </button>
          <h1 style={{ margin: 0 }}>Fiche Contact</h1>
          <div className="crm-detail-actions">
            <button className="btn btn-secondary btn-sm"
              onClick={() => navigate('/crm/modifier-contact', { state: { contactId } })}>
              ✎ Modifier
            </button>
            {!isConverted && (
              <button className="btn btn-primary btn-sm"
                onClick={() => navigate('/leads/enchère_live', { state: { contactId } })}>
                → Envoyer aux enchères
              </button>
            )}
            {isConverted && (
              <span className="bdg bdg-ok" style={{ fontSize: '11px' }}>
                ✅ Converti en lead
              </span>
            )}
          </div>
        </div>

        <div className="grid-2" style={{ alignItems: 'start' }}>

          {/* ── Left column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            <div className="identity-card">
              <div className="identity-card-bg" />
              <div className="identity-avatar">
                {initials}
                <span className="alias-chip alias-chip-absolute">alias</span>
              </div>
              <div className="identity-name">{name}</div>
              <div className="identity-type">
                Contact privé · CRM Privé 🔒
              </div>
              <div className="identity-badges">
                <span className="bdg badge-alias">Alias</span>
                {isConverted && <span className="bdg bdg-ok">✅ Lead</span>}
              </div>
              <div className="identity-meta">
                {daysSince(contact.create_date)} · Dernière modif. {formatDate(contact.write_date)}
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '16px' }}>📞 Coordonnées</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                {phone && (
                  <div className="contact-row">
                    <div className="contact-icon contact-icon-phone">📱</div>
                    <div style={{ flex: 1 }}>
                      <div className="contact-label">Téléphone</div>
                      <div className="contact-value">{phone}</div>
                    </div>
                    <a href={'tel:' + phone} className="contact-action">Appeler</a>
                  </div>
                )}

                {email && (
                  <div className="contact-row">
                    <div className="contact-icon contact-icon-email">✉️</div>
                    <div style={{ flex: 1 }}>
                      <div className="contact-label">Email</div>
                      <div className="contact-value">{email}</div>
                    </div>
                    <a href={'mailto:' + email} className="contact-action">Envoyer</a>
                  </div>
                )}

                {linkedin && (
                  <div className="contact-row">
                    <div className="contact-icon contact-icon-linkedin">🔗</div>
                    <div style={{ flex: 1 }}>
                      <div className="contact-label">LinkedIn</div>
                      <div className="contact-value" style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                        {linkedin.replace('https://www.linkedin.com/in/', '')}
                      </div>
                    </div>
                    <a href={linkedin} target="_blank" rel="noopener noreferrer"
                      className="contact-action contact-action-linkedin">
                      Voir profil
                    </a>
                  </div>
                )}

                {!phone && !email && !linkedin && (
                  <div style={{ opacity: 0.5, fontSize: '13px' }}>Aucune coordonnée renseignée</div>
                )}
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '14px' }}>⚡ Actions rapides</h3>
              <div className="quick-actions">
                {!isConverted && (
                  <button className="btn btn-primary btn-full"
                    onClick={() => navigate('/leads/enchère_live', { state: { contactId } })}>
                    🏷 Envoyer aux enchères
                  </button>
                )}
                <button className="btn btn-secondary btn-full"
                  onClick={() => document.querySelector('.notes-textarea')?.focus()}>
                  📝 Ajouter une note
                </button>
                <button className="btn btn-secondary btn-full btn-danger-outline"
                  onClick={handleDelete}>
                  🗑 Supprimer le contact
                </button>
              </div>
            </div>
          </div>

          {/* ── Right column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            <div className="card">
              <h3 style={{ marginBottom: '16px' }}>🏠 Profil du contact</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="profile-row">
                  <span className="profile-label">Alias</span>
                  <span className="profile-value">{contact.alias || '—'}</span>
                </div>
                <div className="profile-row">
                  <span className="profile-label">Zone ciblée</span>
                  <span className="profile-value">{contact.zone_chalandise || '—'}</span>
                </div>
                <div className="profile-row">
                  <span className="profile-label">Type de bien</span>
                  <span className="profile-value">{contact.type_bien || '—'}</span>
                </div>
                <div className="profile-row">
                  <span className="profile-label">Agent</span>
                  <span className="profile-value">{contact.agent_id?.[1] || '—'}</span>
                </div>
                <div className="profile-row">
                  <span className="profile-label">Ajouté le</span>
                  <span className="profile-value">{formatDate(contact.create_date)}</span>
                </div>
                <div className="profile-row-last">
                  <span className="profile-label">Statut lead</span>
                  <span className="profile-value">
                    {isConverted
                      ? '✅ Converti — ' + (contact.converted_lead_id?.[1] || '—')
                      : '⏳ Pas encore converti'}
                  </span>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '14px' }}>📝 Notes personnelles</h3>
              <div className="notes-text" style={{ marginBottom: '12px', opacity: 0.8, fontSize: '13px' }}>
                {contact.notes_encrypted || 'Aucune note pour ce contact.'}
              </div>
              <textarea
                className="inp notes-textarea"
                placeholder="Ajouter ou modifier une note..."
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={4}
              />
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '8px', opacity: savingNote ? 0.7 : 1 }}
                onClick={handleSaveNote}
                disabled={savingNote}>
                {savingNote ? '⏳ Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '14px' }}>📅 Historique</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {isConverted && (
                  <div className="history-item">
                    <div className="history-dot history-dot-green" />
                    <div>
                      <div className="history-title">Converti en lead</div>
                      <div className="history-desc">Lead: {contact.converted_lead_id?.[1] || '—'}</div>
                      <div className="history-date">{formatDate(contact.write_date)}</div>
                    </div>
                  </div>
                )}
                <div className="history-item">
                  <div className="history-dot history-dot-muted" />
                  <div>
                    <div className="history-title">Contact ajouté au CRM</div>
                    <div className="history-desc">Par {contact.create_uid?.[1] || '—'}</div>
                    <div className="history-date">{formatDate(contact.create_date)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactDetailComponent;