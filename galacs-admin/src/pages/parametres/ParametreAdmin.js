import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../assets/styles/style.css';
import './Parametre.css';
import Switch from '../../components/common/CosmicSwitch';
import { useAuth } from '../../contexts/AuthContext';
import { getAdminProfile, saveAdminProfile, changePassword } from '../../services/odooApi';

const ParametreAdmin = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { user } = useAuth();

  // Profile state
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    lang: 'Français',
    tz: 'Europe/Paris (UTC+1)',
  });
  const [avatarImage, setAvatarImage] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Password state
  const [passwords, setPasswords] = useState({
    current: '',
    next: '',
    confirm: '',
  });

  // Preferences state
  const [auditLogs, setAuditLogs] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const twoFAEnabled = true;

  // Feedback state
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Load profile on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    getAdminProfile()
      .then((data) => {
        console.log('Profile data from Odoo:', data);

        // Strip company prefix if present e.g. "YourCompany, John Doe" → "John Doe"
        const fullName = data.name || '';
        const cleanName = fullName.includes(',')
          ? fullName.split(',').slice(1).join(',').trim()
          : fullName;

        const parts = cleanName.split(' ');
        const firstName = parts[0] || '';
        const lastName = parts.slice(1).join(' ') || '';

        setProfile({
          firstName,
          lastName,
          email: data.email || '',
          phone: data.phone || '',
          company: data.company_id?.[1] || '',
          lang: data.lang === 'fr_FR' ? 'Français' : 'English',
          tz: data.tz || 'Europe/Paris (UTC+1)',
        });

        if (data.image_1920) {
          setAvatarImage(`data:image/png;base64,${data.image_1920}`);
        }
      })
      .catch(() => showToast('err', 'Impossible de charger le profil'))
      .finally(() => setLoadingProfile(false));
  }, [user]);

  // ── Avatar ─────────────────────────────────────────────────────────────────
  const handleAvatarClick = () => fileInputRef.current.click();

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setAvatarImage(reader.result);
      reader.readAsDataURL(file);
    } else {
      alert('Veuillez sélectionner une image valide (JPEG, PNG, etc.)');
    }
  };

  // ── Save handler ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const uid = user?.uid;

      const vals = {
        name:  `${profile.firstName} ${profile.lastName}`.trim(),
        email: profile.email,
        phone: profile.phone,
        lang:  profile.lang === 'Français' ? 'fr_FR' : 'en_US',
        tz:    profile.tz.split(' ')[0],
      };

      if (avatarImage && avatarImage.startsWith('data:image')) {
        vals.image_1920 = avatarImage.split(',')[1];
      }

      await saveAdminProfile(uid, vals);

      if (passwords.current && passwords.next) {
        if (passwords.next !== passwords.confirm) {
          showToast('err', 'Les mots de passe ne correspondent pas');
          setSaving(false);
          return;
        }
        if (passwords.next.length < 12) {
          showToast('err', 'Minimum 12 caractères requis');
          setSaving(false);
          return;
        }
        await changePassword(passwords.current, passwords.next);
        setPasswords({ current: '', next: '', confirm: '' });
      }

      showToast('ok', 'Modifications enregistrées');
      navigate('/parametre');
    } catch (err) {
      showToast('err', err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="page active" id="p-edit-param">
      <div className="pi fade-in">

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', top: 20, right: 20, zIndex: 9999,
            padding: '12px 20px', borderRadius: '10px', fontSize: '14px',
            background: toast.type === 'ok' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${toast.type === 'ok' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
            color: toast.type === 'ok' ? '#86efac' : '#fca5a5',
          }}>
            {toast.type === 'ok' ? '✅' : '⚠️'} {toast.msg}
          </div>
        )}

        <div className="paramsS23">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/parametre')}>
            ← Retour
          </button>
          <h1 style={{ margin: 0 }}>Modifier le compte administrateur</h1>
        </div>

        {loadingProfile ? (
          <div style={{ textAlign: 'center', padding: '60px', opacity: 0.5 }}>
            ⏳ Chargement du profil...
          </div>
        ) : (
          <div className="g2">
            {/* ── Left column ── */}
            <div className="paramsS1">
              <div className="card">
                <h3 style={{ marginBottom: '16px' }}>Informations du compte</h3>

                <div className="paramsS24" onClick={handleAvatarClick} style={{ cursor: 'pointer' }}>
                  <div className="paramsS25">
                    {avatarImage
                      ? <img src={avatarImage} alt="Avatar"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : '👨‍💼'}
                  </div>
                  <div className="paramsS26">✎</div>
                </div>
                <input type="file" accept="image/*" ref={fileInputRef}
                  style={{ display: 'none' }} onChange={handleFileChange} />

                <div className="g2 paramsS27">
                  <div>
                    <div className="il">Prénom</div>
                    <input className="inp" value={profile.firstName}
                      onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))} />
                  </div>
                  <div>
                    <div className="il">Nom</div>
                    <input className="inp" value={profile.lastName}
                      onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))} />
                  </div>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <div className="il">Email administrateur</div>
                  <input className="inp" type="email" value={profile.email}
                    onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <div className="il">Téléphone (MFA)</div>
                  <input className="inp" type="tel" value={profile.phone}
                    onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} />
                </div>
                <div>
                  <div className="il">Entreprise</div>
                  <input className="inp" value={profile.company} readOnly
                    style={{ opacity: 0.6, cursor: 'not-allowed' }} />
                </div>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: '14px' }}>Sécurité du compte</h3>
                <div style={{ marginBottom: '14px' }}>
                  <div className="il">Mot de passe actuel</div>
                  <input className="inp" type="password" placeholder="••••••••••"
                    value={passwords.current}
                    onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))} />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <div className="il">Nouveau mot de passe</div>
                  <input className="inp" type="password" placeholder="Minimum 12 caractères"
                    value={passwords.next}
                    onChange={e => setPasswords(p => ({ ...p, next: e.target.value }))} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <div className="il">Confirmer le nouveau mot de passe</div>
                  <input className="inp" type="password" placeholder="Confirmer"
                    value={passwords.confirm}
                    onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))} />
                </div>
                <div className="paramsS28">
                  🔒 Politique : min. 12 caractères · majuscule · chiffre · caractère spécial
                </div>
              </div>
            </div>

            {/* ── Right column ── */}
            <div className="paramsS1">
              <div className="card">
                <h3 style={{ marginBottom: '16px' }}>Authentification & Accès</h3>
                <div className="paramsS29">
                  <div className="param-row">
                    <div className="pi-icn" style={{ background: 'rgba(245,158,11,.1)' }}>🛡</div>
                    <div style={{ flex: 1 }}>
                      <div className="paramsS30">Authentification 2FA (MFA)</div>
                      <div className="paramsS31">Activée obligatoirement · SMS +33 6 ••• 42</div>
                    </div>
                    <Switch checked={twoFAEnabled} disabled={true} />
                  </div>
                  <div className="param-row">
                    <div className="pi-icn" style={{ background: 'rgba(59,130,246,.1)' }}>📋</div>
                    <div style={{ flex: 1 }}>
                      <div className="paramsS30">Journaux d'audit personnels</div>
                      <div className="paramsS32">Recevoir un rapport hebdomadaire de mes actions</div>
                    </div>
                    <Switch checked={auditLogs} onChange={() => setAuditLogs(!auditLogs)} />
                  </div>
                  <div className="param-row" style={{ border: 'none' }}>
                    <div className="pi-icn" style={{ background: 'rgba(124,58,237,.1)' }}>🔔</div>
                    <div style={{ flex: 1 }}>
                      <div className="paramsS30">Notifications par email</div>
                      <div className="paramsS32">Alertes critiques plateforme par email</div>
                    </div>
                    <Switch checked={emailAlerts} onChange={() => setEmailAlerts(!emailAlerts)} />
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: '14px' }}>Sessions actives</h3>
                <div className="paramsS33">
                  <div className="paramsS34">
                    <div className="paramsS35">💻</div>
                    <div style={{ flex: 1 }}>
                      <div className="paramsS36">
                        Chrome · macOS <span className="paramsS37">Session actuelle</span>
                      </div>
                      <div className="paramsS32">
                        Session ID: {user?.session_id?.slice(0, 12)}…
                      </div>
                    </div>
                  </div>
                </div>
                <button className="btn btn-ko paramsS40" onClick={async () => {
                  await fetch('/web/session/destroy', { method: 'POST', credentials: 'include' });
                  navigate('/');
                }}>
                  🚪 Déconnecter toutes les sessions
                </button>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: '14px' }}>Préférences d'affichage</h3>
                <div style={{ marginBottom: '12px' }}>
                  <div className="il">Langue de l'interface</div>
                  <select className="inp" value={profile.lang}
                    onChange={e => setProfile(p => ({ ...p, lang: e.target.value }))}>
                    <option>Français</option>
                    <option>English</option>
                  </select>
                </div>
                <div>
                  <div className="il">Fuseau horaire</div>
                  <select className="inp" value={profile.tz}
                    onChange={e => setProfile(p => ({ ...p, tz: e.target.value }))}>
                    <option>Europe/Paris (UTC+1)</option>
                    <option>Europe/London (UTC+0)</option>
                    <option>America/New_York (UTC-5)</option>
                  </select>
                </div>
              </div>

              <div className="paramsS41">
                <button
                  className="btn btn-gold btn-lg paramsS42"
                  onClick={handleSave}
                  disabled={saving}
                  style={{ opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? '⏳ Enregistrement...' : '💾 Enregistrer les modifications'}
                </button>
                <button className="btn btn-ghost paramsS43" onClick={() => navigate('/parametre')}>
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParametreAdmin;