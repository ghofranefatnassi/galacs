import React, { useState, useEffect } from 'react';
import '../../../assets/styles/style.css';
import './FichierAgent.css';
import { useNavigate, useLocation } from 'react-router-dom';
import ReactDOM from 'react-dom';
import { callModel } from '../../../services/odooApi';


// Modals & Toast
const ConfirmActionModal = ({ isOpen, title, message, confirmText, cancelText, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return ReactDOM.createPortal(
    <div className="modal-overlay-crm" onClick={onCancel}>
      <div className="modal-container-crm" onClick={e => e.stopPropagation()}>
        <div className="modal-icon-crm alert-icon">
          <svg fill="currentColor" viewBox="0 0 20 20" width="48" height="48" style={{ fill: '#f59e0b' }}>
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="modal-title-crm">{title}</h2>
        <p className="modal-message-crm">{message}</p>
        <div className="modal-actions-crm">
          <button className="modal-btn-crm modal-btn-cancel" onClick={onCancel}>{cancelText || 'Annuler'}</button>
          <button className="modal-btn-crm modal-btn-confirm" onClick={onConfirm}>{confirmText || 'Confirmer'}</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const ContactMethodModal = ({ isOpen, onClose, onEmail, onLinkedIn, agentName, hasLinkedIn }) => {
  if (!isOpen) return null;
  return ReactDOM.createPortal(
    <div className="modal-overlay-crm" onClick={onClose}>
      <div className="modal-container-crm modal-small" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title-crm" style={{ marginBottom: '8px' }}>Contacter {agentName}</h2>
        <p className="modal-message-crm" style={{ marginBottom: '20px' }}>Choisissez un moyen de contact</p>
        <div className="modal-actions-crm" style={{ gap: '12px' }}>
          <button className="modal-btn-crm modal-btn-confirm" onClick={onEmail} style={{ background: '#3b82f6' }}>📧 Email</button>
          <button className="modal-btn-crm modal-btn-confirm" onClick={onLinkedIn} style={{ background: '#0077b5' }}>
            🔗 {hasLinkedIn ? 'LinkedIn' : 'Rechercher sur LinkedIn'}
          </button>
          <button className="modal-btn-crm modal-btn-cancel" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const PasswordResetModal = ({ isOpen, onClose, onChangePassword, agentName }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!newPassword || !confirmPassword) { setError('Veuillez remplir les deux champs'); return; }
    if (newPassword !== confirmPassword) { setError('Les mots de passe ne correspondent pas'); return; }
    if (newPassword.length < 6) { setError('Minimum 6 caractères'); return; }
    onChangePassword(newPassword);
    setNewPassword(''); setConfirmPassword(''); setError('');
  };

  return ReactDOM.createPortal(
    <div className="modal-overlay-crm" onClick={onClose}>
      <div className="modal-container-crm" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title-crm">Changer le mot de passe</h2>
        <p className="modal-message-crm">Définissez un nouveau mot de passe pour {agentName}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: '20px 0' }}>
          <input type="password" placeholder="Nouveau mot de passe" value={newPassword}
            onChange={e => setNewPassword(e.target.value)} className="password-input-crm" autoFocus />
          <input type="password" placeholder="Confirmer le mot de passe" value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)} className="password-input-crm" />
          {error && <div style={{ color: '#ef4444', fontSize: '12px' }}>{error}</div>}
        </div>
        <div className="modal-actions-crm">
          <button className="modal-btn-crm modal-btn-cancel" onClick={onClose}>Annuler</button>
          <button className="modal-btn-crm modal-btn-confirm" onClick={handleSubmit}>Changer mot de passe</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const SuccessToast = ({ message, visible, onClose }) => {
  if (!visible) return null;
  return ReactDOM.createPortal(
    <div className="toast-crm">
      <div className="toast-content-crm">
        <div className="toast-icon-crm">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" width="18" height="18">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <div>
          <p className="toast-title-crm">Succès</p>
          <p className="toast-desc-crm">{message}</p>
        </div>
        <button className="toast-close-crm" onClick={onClose}>✕</button>
      </div>
    </div>,
    document.body
  );
};

const ExportConfirmModal = ({ isOpen, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return ReactDOM.createPortal(
    <div className="modal-overlay-crm" onClick={onCancel}>
      <div className="modal-container-crm" onClick={e => e.stopPropagation()}>
        <div className="modal-icon-crm">
          <svg fill="currentColor" viewBox="0 0 20 20" width="48" height="48" style={{ fill: '#8B5CF6' }}>
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V4H6zm1 2h6v2H7V6zm0 4h6v2H7v-2z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="modal-title-crm">Exporter le rapport</h2>
        <p className="modal-message-crm">Le rapport complet sera généré au format PDF. Voulez-vous continuer ?</p>
        <div className="modal-actions-crm">
          <button className="modal-btn-crm modal-btn-cancel" onClick={onCancel}>Annuler</button>
          <button className="modal-btn-crm modal-btn-confirm" onClick={onConfirm}>Générer le PDF</button>
        </div>
      </div>
    </div>,
    document.body
  );
};
// Main Component
const FichierAgent = () => {
 const navigate = useNavigate();
   const location = useLocation();
   const agentId = location.state?.agentId;
 
   const [agent, setAgent] = useState(null);
   const [loading, setLoading] = useState(true);
   const [contactModalOpen, setContactModalOpen] = useState(false);
   const [pdfConfirmOpen, setPdfConfirmOpen] = useState(false);
   const [suspendConfirmOpen, setSuspendConfirmOpen] = useState(false);
   const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
   const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
   const [toast, setToast] = useState({ visible: false, message: '' });
 
   const showToast = (message) => {
     setToast({ visible: true, message });
     setTimeout(() => setToast({ visible: false, message: '' }), 4000);
   };
 
   // ── Load agent ────────────────────────────────────────────────────────────
   useEffect(() => {
     if (!agentId) {
       showToast('Agent introuvable');
       setTimeout(() => navigate('/agents'), 2000);
       return;
     }
 
     const loadAgent = async () => {
       try {
         const result = await callModel("res.users", "read", [[agentId]], {
           fields: ["name", "email", "phone", "image_1920", "active", "login_date", "galacs_linkedin_url", "galacs_zone_ids"],
         });
         const u = result[0];
 
         // Resolve the Many2many zone ids into display names
         let zoneNames = [];
         if (u.galacs_zone_ids && u.galacs_zone_ids.length) {
           const zones = await callModel("galacs.zone", "read", [u.galacs_zone_ids], { fields: ["name"] });
           zoneNames = zones.map(z => z.name);
         }
 
         const initials = u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
         const lastLogin = u.login_date
           ? new Date(u.login_date).toLocaleDateString('fr-FR', {
               day: '2-digit', month: 'long', year: 'numeric',
               hour: '2-digit', minute: '2-digit',
             })
           : '—';
 
         setAgent({
           id: u.id,
           name: u.name,
           email: u.email || '—',
           phone: u.phone || '—',
           linkedin: u.galacs_linkedin_url || null,
           zones: zoneNames,
           initials,
           avatar: u.image_1920 ? 'data:image/png;base64,' + u.image_1920 : null,
           active: u.active,
           lastLogin,
         });
       } catch {
         showToast('Impossible de charger la fiche agent');
       } finally {
         setLoading(false);
       }
     };
 
     loadAgent();
   }, [agentId]);
 
   // ── Actions ───────────────────────────────────────────────────────────────
   const handleContactEmail = () => {
     window.location.href = 'mailto:' + agent.email + '?subject=Contact%20depuis%20CRM';
     setContactModalOpen(false);
     showToast('Ouverture de votre client email...');
   };
 
   const handleContactLinkedIn = () => {
     const url = agent.linkedin ||
       'https://www.linkedin.com/search/results/people/?keywords=' + encodeURIComponent(agent.name);
     window.open(url, '_blank');
     setContactModalOpen(false);
     showToast('Redirection vers LinkedIn...');
   };
 
   const handleSuspendConfirm = async () => {
     try {
       await callModel("res.users", "write", [[agentId], { active: false }]);
       setSuspendConfirmOpen(false);
       showToast('Le compte de ' + agent.name + ' a été suspendu');
       setAgent(a => ({ ...a, active: false }));
     } catch {
       showToast('Erreur lors de la suspension');
     }
   };
 
   const handleResetConfirm = () => {
     setResetConfirmOpen(false);
     setResetPasswordModalOpen(true);
   };
 
   const handleFinalPasswordChange = async (newPassword) => {
     try {
       await callModel("res.users", "write", [[agentId], { password: newPassword }]);
       showToast('Mot de passe réinitialisé avec succès');
       setResetPasswordModalOpen(false);
     } catch {
       try {
         await callModel("res.users", "action_reset_password", [[agentId]]);
         showToast("Email de réinitialisation envoyé à l'agent");
         setResetPasswordModalOpen(false);
       } catch {
         showToast('Erreur lors de la réinitialisation');
       }
     }
   };
 
   // ── Export PDF (string concat — no template literals) ─────────────────────
   const exportPDF = () => {
     if (!agent) return;
     const printWindow = window.open('', '_blank');
 
     const linkedinRow = agent.linkedin
       ? '<div class="info-row"><span>LinkedIn</span><strong>' + agent.linkedin + '</strong></div>'
       : '';
     const linkedinInfo = agent.linkedin
       ? '<div class="agent-info">🔗 ' + agent.linkedin + '</div>'
       : '';
     const zonesRow = agent.zones && agent.zones.length
       ? '<div class="info-row"><span>Zones</span><strong>' + agent.zones.join(', ') + '</strong></div>'
       : '';
     const zonesInfo = agent.zones && agent.zones.length
       ? '<div class="agent-info">📍 ' + agent.zones.join(', ') + '</div>'
       : '';
     const statusBadge = agent.active ? '✅ Actif' : '⛔ Inactif';
     const statusText = agent.active ? 'Actif' : 'Inactif';
     const dateGenerated = new Date().toLocaleDateString('fr-FR');
     const timeGenerated = new Date().toLocaleTimeString('fr-FR');
 
     const html = '<!DOCTYPE html><html><head>'
       + '<title>Fiche Agent - ' + agent.name + '</title>'
       + '<meta charset="UTF-8">'
       + '<style>'
       + '* { margin: 0; padding: 0; box-sizing: border-box; }'
       + 'body { font-family: Segoe UI, Arial, sans-serif; padding: 2rem; background: white; color: #1f2937; }'
       + '.header { text-align: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 3px solid #8B5CF6; }'
       + 'h1 { color: #8B5CF6; font-size: 28px; margin-bottom: 8px; }'
       + '.subtitle { color: #6b7280; font-size: 14px; }'
       + '.date { color: #9ca3af; font-size: 12px; margin-top: 8px; }'
       + '.agent-card { background: linear-gradient(135deg, #f3f4f6, #e5e7eb); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; text-align: center; }'
       + '.agent-name { font-size: 24px; font-weight: bold; color: #1f2937; margin: 8px 0 4px; }'
       + '.agent-info { color: #6b7280; font-size: 13px; margin: 4px 0; }'
       + '.badge-container { display: flex; gap: 8px; justify-content: center; margin-top: 12px; }'
       + '.badge { padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; }'
       + '.badge-green { background: #d1fae5; color: #059669; }'
       + '.section { margin-bottom: 1.5rem; }'
       + '.section-title { font-size: 18px; font-weight: bold; color: #374151; margin-bottom: 12px; border-left: 4px solid #8B5CF6; padding-left: 12px; }'
       + '.info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }'
       + 'footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #9ca3af; }'
       + '</style></head><body>'
       + '<div class="header">'
       + '<h1>📄 Fiche Agent — ' + agent.name + '</h1>'
       + '<div class="subtitle">Rapport complet</div>'
       + '<div class="date">Généré le ' + dateGenerated + ' à ' + timeGenerated + '</div>'
       + '</div>'
       + '<div class="agent-card">'
       + '<div style="font-size:48px">👤</div>'
       + '<div class="agent-name">' + agent.name + '</div>'
       + '<div class="agent-info">✉️ ' + agent.email + '</div>'
       + '<div class="agent-info">📱 ' + agent.phone + '</div>'
       + linkedinInfo
       + zonesInfo
       + '<div class="badge-container"><span class="badge badge-green">' + statusBadge + '</span></div>'
       + '</div>'
       + '<div class="section">'
       + '<div class="section-title">📋 Informations du compte</div>'
       + '<div class="info-row"><span>Nom complet</span><strong>' + agent.name + '</strong></div>'
       + '<div class="info-row"><span>Email</span><strong>' + agent.email + '</strong></div>'
       + '<div class="info-row"><span>Téléphone</span><strong>' + agent.phone + '</strong></div>'
       + linkedinRow
       + zonesRow
       + '<div class="info-row"><span>Statut</span><strong>' + statusText + '</strong></div>'
       + '<div class="info-row"><span>Dernière connexion</span><strong>' + agent.lastLogin + '</strong></div>'
       + '</div>'
       + '<footer>'
       + '<p>Document généré depuis Galacs.io — Plateforme de gestion immobilière</p>'
       + '<p>Ce rapport est confidentiel et destiné à un usage interne uniquement.</p>'
       + '</footer></body></html>';
 
     printWindow.document.write(html);
     printWindow.document.close();
     printWindow.print();
     setPdfConfirmOpen(false);
     showToast('Rapport PDF généré avec succès !');
   };
 
   // ── Render ────────────────────────────────────────────────────────────────
   if (loading) return (
     <div className="page active" id="p-fiche-agent">
       <div className="pi fade-in" style={{ textAlign: 'center', paddingTop: '80px', opacity: 0.5 }}>
         ⏳ Chargement de la fiche agent...
       </div>
     </div>
   );
 
   if (!agent) return (
     <div className="page active" id="p-fiche-agent">
       <div className="pi fade-in" style={{ textAlign: 'center', paddingTop: '80px', color: '#fca5a5' }}>
         ⚠️ Agent introuvable
       </div>
     </div>
   );
 
   return (
     <div className="page active" id="p-fiche-agent">
       <div className="pi fade-in">
         <div className="fichAgentS1">
           <button className="btn btn-ghost btn-sm" onClick={() => navigate('/agents')}>← Retour</button>
           <h1 style={{ margin: 0 }}>Fiche Agent — {agent.name}</h1>
           <button className="btn btn-gold btn-sm"
             onClick={() => navigate('/agents/modifier-agent', { state: { agentId } })}>
             ✎ Modifier
           </button>
         </div>
 
         <div className="g2" style={{ marginBottom: '20px' }}>
           <div className='fichAgentS2'>
             <div className='fichAgentS3'>
               <div className='fichAgentS4'></div>
               <div className='fichAgentS5'>
                 {agent.avatar
                   ? <img src={agent.avatar} alt={agent.name}
                       style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                   : agent.initials}
                 <span className="fichAgentS6"></span>
               </div>
               <div className="syn fichAgentS7">{agent.name}</div>
               <div className='fichAgentS8'>{agent.email}</div>
               <div className='fichAgentS9'>{agent.phone}</div>
 
               {agent.linkedin && (
                 <a href={agent.linkedin} target="_blank" rel="noopener noreferrer"
                   style={{ display: 'flex', alignItems: 'center', gap: '6px',
                     color: '#0077b5', fontSize: '13px', marginTop: '6px', textDecoration: 'none' }}
                   onClick={e => e.stopPropagation()}>
                   🔗 LinkedIn
                 </a>
               )}
 
               {agent.zones && agent.zones.length > 0 && (
                 <div style={{
                   display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center',
                   marginTop: '10px',
                 }}>
                   {agent.zones.map((zoneName) => (
                     <span key={zoneName} className="ftag" style={{ fontSize: '11px', padding: '3px 10px' }}>
                       📍 {zoneName}
                     </span>
                   ))}
                 </div>
               )}
 
               <div className='fichAgentS10'>
                 <span className={'bdg bdg-' + (agent.active ? 'ok' : 'err')}>
                   {agent.active ? '✅ Actif' : '⛔ Inactif'}
                 </span>
               </div>
             </div>
 
             <div className="card">
               <h3 style={{ marginBottom: '14px' }}>Informations du compte</h3>
               <div className="fichAgentS13">
                 <span>Dernière connexion</span>
                 <span className="syn" style={{ fontSize: '12px' }}>{agent.lastLogin}</span>
               </div>
               <div className="fichAgentS13" style={{ marginTop: '8px' }}>
                 <span>Statut</span>
                 <span className={'bdg bdg-' + (agent.active ? 'ok' : 'err')} style={{ fontSize: '10px' }}>
                   {agent.active ? '✅ Actif' : '⛔ Inactif'}
                 </span>
               </div>
               {agent.linkedin && (
                 <div className="fichAgentS13" style={{ marginTop: '8px' }}>
                   <span>LinkedIn</span>
                   <a href={agent.linkedin} target="_blank" rel="noopener noreferrer"
                     style={{ color: '#0077b5', fontSize: '12px', textDecoration: 'none' }}>
                     🔗 Voir le profil
                   </a>
                 </div>
               )}
               {agent.zones && agent.zones.length > 0 && (
                 <div className="fichAgentS13" style={{ marginTop: '8px' }}>
                   <span>Zones</span>
                   <span className="syn" style={{ fontSize: '12px', textAlign: 'right', maxWidth: '160px' }}>
                     {agent.zones.join(', ')}
                   </span>
                 </div>
               )}
             </div>
           </div>
 
           <div className='fichAgentS2'>
             <div className="card">
               <h3 style={{ marginBottom: '12px' }}>Actions administrateur</h3>
               <div className="fichAgentS22">
                 <button className="btn btn-ghost" onClick={() => setContactModalOpen(true)}>
                   📧 Contacter
                 </button>
                 <button className="btn btn-gold" onClick={() => setPdfConfirmOpen(true)}>
                   📊 Rapport complet
                 </button>
                 <button className="btn btn-ghost" onClick={() => setResetConfirmOpen(true)}>
                   🔑 Réinitialiser MDP
                 </button>
                 <button className="btn btn-ko" onClick={() => setSuspendConfirmOpen(true)}
                   disabled={!agent.active}>
                   🚫 Suspendre le compte
                 </button>
               </div>
             </div>
           </div>
         </div>
       </div>
 
       <ContactMethodModal
         isOpen={contactModalOpen}
         onClose={() => setContactModalOpen(false)}
         onEmail={handleContactEmail}
         onLinkedIn={handleContactLinkedIn}
         agentName={agent.name}
         hasLinkedIn={!!agent.linkedin}
       />
       <ExportConfirmModal
         isOpen={pdfConfirmOpen}
         onConfirm={exportPDF}
         onCancel={() => setPdfConfirmOpen(false)}
       />
       <ConfirmActionModal
         isOpen={suspendConfirmOpen}
         title="Suspendre le compte"
         message={'Êtes-vous sûr de vouloir suspendre le compte de ' + agent.name + ' ? L\'agent ne pourra plus se connecter.'}
         confirmText="Suspendre"
         onConfirm={handleSuspendConfirm}
         onCancel={() => setSuspendConfirmOpen(false)}
       />
       <ConfirmActionModal
         isOpen={resetConfirmOpen}
         title="Réinitialisation du mot de passe"
         message="Confirmez la réinitialisation du mot de passe. Vous pourrez définir un nouveau mot de passe dans l'étape suivante."
         confirmText="Continuer"
         onConfirm={handleResetConfirm}
         onCancel={() => setResetConfirmOpen(false)}
       />
       <PasswordResetModal
         isOpen={resetPasswordModalOpen}
         onClose={() => setResetPasswordModalOpen(false)}
         onChangePassword={handleFinalPasswordChange}
         agentName={agent.name}
       />
       <SuccessToast
         visible={toast.visible}
         message={toast.message}
         onClose={() => setToast({ visible: false, message: '' })}
       />
     </div>
   );
 };

export default FichierAgent;