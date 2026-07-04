import React, { useState, useEffect } from 'react';
import '../../assets/styles/style.css';
import './Crm.css';
import { useNavigate } from 'react-router-dom';
import { ConfirmDeleteModal, SuccessToast } from '../../components/common/DeleteModals';
import { callModel } from '../../services/odooApi';
import { useAgentAuth } from '../../contexts/AgentAuthContext';

const CrmComponent = () => {
  const navigate = useNavigate();
  const { user } = useAgentAuth();

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentContact, setCurrentContact] = useState({ name: '', id: null });
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // ── Load contacts ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    loadContacts();
  }, [user]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      // Only load contacts belonging to the logged-in agent
      const result = await callModel("galacs.contact.prive", "search_read",
        [[["agent_id", "=", user.uid]]],
        {
          fields: [
            "alias", "nom_encrypted", "telephone_encrypted", "email_encrypted",
            "zone_chalandise", "type_bien", "converted_to_lead",
            "converted_lead_id", "create_date",
          ],
          order: "create_date desc",
        }
      );
      setContacts(result);
    } catch (err) {
      console.error('CRM load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDeleteClick = (contactName, contactId) => {
    setCurrentContact({ name: contactName, id: contactId });
    setModalOpen(true);
  };

  const confirmDelete = async () => {
    try {
      await callModel("galacs.contact.prive", "unlink", [[currentContact.id]]);
      setContacts(prev => prev.filter(c => c.id !== currentContact.id));
      setToastMessage('Le contact a été supprimé avec succès.');
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 3000);
    } catch {
      setToastMessage('Erreur lors de la suppression.');
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 3000);
    } finally {
      setModalOpen(false);
      setCurrentContact({ name: '', id: null });
    }
  };

  const cancelDelete = () => {
    setModalOpen(false);
    setCurrentContact({ name: '', id: null });
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const getAvatarClass = (i) => {
    const classes = ['crmS7', 'crmS8', 'crmS9', 'crmS10'];
    return classes[i % classes.length];
  };

  const timeSince = (d) => {
    if (!d) return '—';
    const diff = Math.floor((new Date() - new Date(d)) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "aujourd'hui";
    if (diff === 1) return 'il y a 1j';
    if (diff < 7) return 'il y a ' + diff + 'j';
    if (diff < 14) return 'il y a 1sem';
    return 'il y a ' + Math.floor(diff / 7) + 'sem';
  };

  const getSubtitle = (c) => {
    const parts = [];
    if (c.type_bien) parts.push(c.type_bien);
    if (c.zone_chalandise) parts.push(c.zone_chalandise);
    if (c.converted_to_lead) parts.push('✅ Converti en lead');
    return parts.join(' · ') || 'Contact privé';
  };

  const getDisplayName = (c) => c.nom_encrypted || c.alias || 'Contact';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page active" id="p-crm">
      <div className="page-inner fade-in">
        <div className="crmS1">
          <div>
            <h1>CRM Privé</h1>
            <p className="page-subtitle">
              Contacts confidentiels — non accessibles à l'administration
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/crm/nouvelle_contact')}>
            + Ajouter un contact
          </button>
        </div>

        <div className="crmS2">
          <span style={{ fontSize: '18px' }}>🔒</span>
          <div className="crmS3">
            Espace totalement confidentiel. Aucun administrateur ne peut accéder à ces contacts. Utilisez un
            <span className="crmS4"> alias </span>
            à la place du nom réel pour une protection maximale. Chiffrement AES-256.
          </div>
        </div>

        <div className="crmS5">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
              ⏳ Chargement des contacts...
            </div>
          ) : contacts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
              Aucun contact privé pour le moment.
            </div>
          ) : contacts.map((c, i) => (
            <div key={c.id} className="crm-row">
              <div
                className={'crmS6 ' + getAvatarClass(i)}
                onClick={() => navigate('/crm/contact_detail', { state: { contactId: c.id } })}
                style={{ cursor: 'pointer' }}
              >
                {getInitials(getDisplayName(c))}
              </div>
              <div style={{ flex: 1 }}>
                <div className="crmS11">
                  {getDisplayName(c)}
                  {c.alias && c.nom_encrypted && (
                    <span className="alias-chip">alias</span>
                  )}
                  {c.converted_to_lead && (
                    <span className="bdg bdg-ok" style={{ fontSize: '10px', marginLeft: '6px' }}>✅ Lead</span>
                  )}
                </div>
                <div className="crmS12">{getSubtitle(c)}</div>
              </div>
              <div className="crmS13">{timeSince(c.create_date)}</div>
              {!c.converted_to_lead && (
                <button className="btn btn-secondary btn-sm"
                  onClick={() => navigate('/leads/enchère_live', { state: { contactId: c.id } })}>
                  → Enchère
                </button>
              )}
              <button className="btn btn-secondary btn-sm"
                onClick={() => navigate('/crm/modifier-contact', { state: { contactId: c.id } })}>
                ✎
              </button>
              <button className="btn btn-danger btn-sm" style={{ marginLeft: '8px' }}
                onClick={() => handleDeleteClick(getDisplayName(c), c.id)}>
                🗑
              </button>
            </div>
          ))}
        </div>

        <div
          className="crmS14"
          onClick={() => navigate('/crm/nouvelle_contact')}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,.04)'}
          onMouseLeave={e => e.currentTarget.style.background = ''}
        >
          <div className="crmS15">+</div>
          <div>
            <div className="crmS16">Ajouter un contact privé</div>
            <div className="crmS12">Visible uniquement par vous</div>
          </div>
        </div>

        <ConfirmDeleteModal
          isOpen={modalOpen}
          contactName={currentContact.name}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />

        <SuccessToast
          visible={toastVisible}
          message={toastMessage}
          onClose={() => setToastVisible(false)}
        />
      </div>
    </div>
  );
};

export default CrmComponent;