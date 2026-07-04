import React, { useState, useEffect } from 'react';
import '../../assets/styles/style.css';
import './Parametres.css';
import { useNavigate } from 'react-router-dom';
import Switch from '../../components/common/CosmicSwitch';
import Loader from '../../components/common/Loader';
import { useAgentAuth } from '../../contexts/AgentAuthContext';
import { getAgentProfile, saveAgentProfile, changePassword, callModel } from '../../services/odooApi';

const EditProfileComponent = () => {
  const navigate = useNavigate();
  const { user } = useAgentAuth();

  // ── Profile state ─────────────────────────────────────────────────────────
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    linkedin: '',
    bio: '',
  });
  const [avatarImage, setAvatarImage] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // ── Zones state (now editable by agent) ───────────────────────────────────
  const [allZones, setAllZones] = useState([]); // [{id, name}] — full zone catalog
  const [selectedZoneIds, setSelectedZoneIds] = useState([]);
  const [isAddingZone, setIsAddingZone] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [addingZoneLoading, setAddingZoneLoading] = useState(false);
  const [zoneError, setZoneError] = useState('');

  // ── Password state ────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword]   = useState('');
  const [newPassword, setNewPassword]           = useState('');
  const [confirmPassword, setConfirmPassword]   = useState('');
  const [showCurrent, setShowCurrent]           = useState(false);
  const [showNew, setShowNew]                   = useState(false);
  const [showConfirm, setShowConfirm]           = useState(false);
  const [passwordError, setPasswordError]       = useState('');
  const [passwordSuccess, setPasswordSuccess]   = useState('');

  // ── Preferences state ─────────────────────────────────────────────────────
  const [notifEncheres, setNotifEncheres]   = useState(true);
  const [notifLeads, setNotifLeads]         = useState(true);
  const [notifPipeline, setNotifPipeline]   = useState(true);
  const [darkMode, setDarkMode]             = useState(true);
  const [soundEnabled, setSoundEnabled]     = useState(true);

  // ── Feedback state ────────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast]       = useState(null);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Zone helpers ──────────────────────────────────────────────────────────
  const toggleZone = (zoneId) => {
    setSelectedZoneIds(prev =>
      prev.includes(zoneId) ? prev.filter(id => id !== zoneId) : [...prev, zoneId]
    );
  };

  const handleAddZone = async () => {
    const name = newZoneName.trim();
    if (!name) { setIsAddingZone(false); return; }

    // Si la zone existe déjà (insensible à la casse), on la sélectionne simplement
    const existing = allZones.find(z => z.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!selectedZoneIds.includes(existing.id)) {
        setSelectedZoneIds(prev => [...prev, existing.id]);
      }
      setNewZoneName('');
      setIsAddingZone(false);
      return;
    }

    setAddingZoneLoading(true);
    setZoneError('');
    try {
      const newId = await callModel("galacs.zone", "create", [{ name }]);
      setAllZones(prev => [...prev, { id: newId, name }]);
      setSelectedZoneIds(prev => [...prev, newId]);
      setNewZoneName('');
      setIsAddingZone(false);
    } catch (err) {
      setZoneError("Impossible d'ajouter cette zone (droits insuffisants ou nom déjà pris)");
    } finally {
      setAddingZoneLoading(false);
    }
  };

  // ── Load profile + zones on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;

    const loadAll = async () => {
      try {
        // Step 1 — base profile (name, phone, email, image)
        const data = await getAgentProfile();
        const [firstName, ...rest] = (data.name || '').split(' ');
        setProfile({
          firstName: firstName || '',
          lastName:  rest.join(' ') || '',
          phone:     data.phone || '',
          email:     data.email || '',
          linkedin:  '',
          bio:       '',
        });
        if (data.image_1920) {
          setAvatarImage(`data:image/png;base64,${data.image_1920}`);
        }

        // Step 2 — fetch galacs_linkedin_url + galacs_zone_ids + zone catalog in parallel
        const [userExtra, zonesResult] = await Promise.all([
          callModel('res.users', 'read', [[user.uid]], {
            fields: ['galacs_linkedin_url', 'galacs_zone_ids'],
          }),
          callModel('galacs.zone', 'search_read', [[]], { fields: ['id', 'name'] }),
        ]);

        const u       = userExtra[0];
        const zoneIds = u.galacs_zone_ids || [];

        setAllZones(zonesResult);
        setSelectedZoneIds(zoneIds);
        setProfile(p => ({ ...p, linkedin: u.galacs_linkedin_url || '' }));

      } catch (err) {
        showToast('err', 'Impossible de charger le profil');
      } finally {
        setLoadingProfile(false);
      }
    };

    loadAll();
  }, [user]);

  // ── Password update ───────────────────────────────────────────────────────
  const handlePasswordChange = async () => {
    setPasswordError('');
    setPasswordSuccess('');
    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess('Mot de passe mis à jour avec succès');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err.message || 'Erreur lors du changement de mot de passe');
    }
  };

  // ── Save profile ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Step 1 — write partner fields (name, phone, image)
      const vals = {
        name:  `${profile.firstName} ${profile.lastName}`.trim(),
        phone: profile.phone,
      };
      if (avatarImage && avatarImage.startsWith('data:image')) {
        vals.image_1920 = avatarImage.split(',')[1];
      }
      await saveAgentProfile(user.uid, vals);

      // Step 2 — write galacs_linkedin_url + galacs_zone_ids on res.users
      await callModel('res.users', 'write', [[user.uid], {
        galacs_linkedin_url: profile.linkedin || false,
        galacs_zone_ids: [[6, 0, selectedZoneIds]],
      }]);

      showToast('ok', 'Profil sauvegardé avec succès');
      navigate('/parametres');
    } catch (err) {
      showToast('err', err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Avatar upload ─────────────────────────────────────────────────────────
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onloadend = () => setAvatarImage(reader.result);
    reader.readAsDataURL(file);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page active" id="p-profil-edit">
      <div className="page-inner fade-in">

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

        <div className="edit-profile-header">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/parametres')}>
            ← Retour
          </button>
          <h1 style={{ margin: 0 }}>Éditer mon profil</h1>
        </div>

        {loadingProfile ? (
          <div style={{ textAlign: 'center', padding: '60px', opacity: 0.5 }}>
            ⏳ Chargement du profil...
          </div>
        ) : (
          <div className="grid-2" style={{ alignItems: 'start', gap: '20px' }}>

            {/* ── Left column ── */}
            <div className="left-column">
              <div className="card photo-card">
                <label htmlFor="avatar-upload" style={{ cursor: 'pointer' }}>
                  <div className="avatar-large" style={{ overflow: 'hidden' }}>
                    {avatarImage
                      ? <img src={avatarImage} alt="avatar"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : `${profile.firstName?.[0] || ''}${profile.lastName?.[0] || ''}`}
                    <span className="online-dot"></span>
                  </div>
                </label>
                <input id="avatar-upload" type="file" accept="image/*"
                  style={{ display: 'none' }} onChange={handleAvatarChange} />
                <div className="agent-name">{profile.firstName} {profile.lastName}</div>
                <div className="agent-role">
                  Agent Immobilier
                  {allZones.filter(z => selectedZoneIds.includes(z.id)).length > 0 &&
                    ` · ${allZones.filter(z => selectedZoneIds.includes(z.id)).slice(0, 2).map(z => z.name).join(' & ')}`}
                </div>
                <button className="btn btn-secondary btn-sm change-photo-btn"
                  onClick={() => document.getElementById('avatar-upload').click()}>
                  📷 Changer la photo
                </button>
              </div>

              <div className="card">
                <h3 className="card-title">👤 Informations personnelles</h3>
                <div className="inp-group">
                  <div className="inp-label">Prénom</div>
                  <input className="inp" value={profile.firstName}
                    onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))} />
                </div>
                <div className="inp-group">
                  <div className="inp-label">Nom</div>
                  <input className="inp" value={profile.lastName}
                    onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))} />
                </div>
                <div className="inp-group">
                  <div className="inp-label">Téléphone professionnel</div>
                  <input className="inp" type="tel" value={profile.phone}
                    onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} />
                </div>
                <div className="inp-group readonly-group">
                  <div className="inp-label">Email professionnel</div>
                  <input className="inp readonly-input" type="email"
                    value={profile.email} disabled />
                  <div className="helper-text">
                    L'email ne peut pas être modifié. Contactez l'administration.
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="card-title">🌐 Profil public</h3>
                <div className="inp-group">
                  <div className="inp-label">LinkedIn</div>
                  <input className="inp"
                    placeholder="https://linkedin.com/in/..."
                    value={profile.linkedin}
                    onChange={e => setProfile(p => ({ ...p, linkedin: e.target.value }))} />
                </div>
                <div className="inp-group">
                  <div className="inp-label">Bio courte</div>
                  <textarea className="inp bio-textarea"
                    placeholder="Décrivez votre expertise en quelques mots..."
                    value={profile.bio}
                    onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* ── Right column ── */}
            <div className="right-column">

              {/* ── Zones — now editable by agent ── */}
              <div className="card">
                <h3 className="card-subtitle">📍 Mes zones de travail</h3>
                <div className="helper-text-light" style={{ marginBottom: '12px' }}>
                  Sélectionnez les zones sur lesquelles vous souhaitez recevoir des leads.
                </div>
                <div className="zone-chips">
                  {allZones.map(zone => (
                    <div key={zone.id}
                      className={'zone-chip ' + (selectedZoneIds.includes(zone.id) ? 'on' : '')}
                      onClick={() => toggleZone(zone.id)}>
                      📍 {zone.name}
                    </div>
                  ))}

                  {isAddingZone ? (
                    <div className="zone-chip" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        autoFocus
                        type="text"
                        value={newZoneName}
                        onChange={(e) => setNewZoneName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddZone();
                          if (e.key === 'Escape') { setIsAddingZone(false); setNewZoneName(''); }
                        }}
                        placeholder="Nom de la zone..."
                        style={{ border: 'none', background: 'transparent', outline: 'none', width: '110px', fontSize: '13px' }}
                        disabled={addingZoneLoading}
                      />
                      <span onClick={handleAddZone} style={{ cursor: 'pointer' }}>
                        {addingZoneLoading ? '⏳' : '✓'}
                      </span>
                      <span onClick={() => { setIsAddingZone(false); setNewZoneName(''); }} style={{ cursor: 'pointer' }}>
                        ✕
                      </span>
                    </div>
                  ) : (
                    <div className="zone-chip add-zone" onClick={() => setIsAddingZone(true)}>
                      + Ajouter
                    </div>
                  )}
                </div>
                {zoneError && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px' }}>{zoneError}</div>
                )}
                {allZones.length === 0 && !isAddingZone && (
                  <div style={{ opacity: 0.5, fontSize: '13px', marginTop: '8px' }}>
                    Aucune zone disponible — ajoutez-en une avec "+ Ajouter".
                  </div>
                )}
              </div>

              {/* ── Notification preferences ── */}
              <div className="card">
                <h3 className="card-subtitle">🔔 Préférences de notifications</h3>
                <div className="notif-list">
                  <div className="notif-item">
                    <div className="notif-icon notif-alert">⚡</div>
                    <div className="notif-label">Alertes enchères</div>
                    <Switch checked={notifEncheres} onChange={e => setNotifEncheres(e.target.checked)} />
                  </div>
                  <div className="notif-item">
                    <div className="notif-icon notif-lead">🔥</div>
                    <div className="notif-label">Nouveaux leads</div>
                    <Switch checked={notifLeads} onChange={e => setNotifLeads(e.target.checked)} />
                  </div>
                  <div className="notif-item">
                    <div className="notif-icon notif-pipeline">⏰</div>
                    <div className="notif-label">Rappels suivi pipeline</div>
                    <Switch checked={notifPipeline} onChange={e => setNotifPipeline(e.target.checked)} />
                  </div>
                </div>
              </div>

              {/* ── Appearance ── */}
              <div className="card">
                <h3 className="card-subtitle">🎨 Apparence</h3>
                <div className="appearance-item">
                  <div className="appearance-icon dark-mode-icon">🌙</div>
                  <div className="appearance-info">
                    <div className="appearance-label">Mode sombre</div>
                    <div className="appearance-desc">Économique sur écrans AMOLED</div>
                  </div>
                  <Switch checked={darkMode} onChange={e => setDarkMode(e.target.checked)} />
                </div>
                <div className="appearance-item">
                  <div className="appearance-icon sound-icon">🔊</div>
                  <div className="appearance-info">
                    <div className="appearance-label">Sons de notification</div>
                  </div>
                  <Switch checked={soundEnabled} onChange={e => setSoundEnabled(e.target.checked)} />
                </div>
              </div>

              {/* ── Password ── */}
              <div className="card password-card">
                <h3 className="card-subtitle">🔒 Changer le mot de passe</h3>
                <div className="password-section">
                  <div className="password-field">
                    <div className="inp-label">Mot de passe actuel</div>
                    <div className="password-input-wrapper">
                      <input type={showCurrent ? 'text' : 'password'} className="inp"
                        placeholder="Entrez votre mot de passe actuel"
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)} />
                      <span className="password-toggle-icon" onClick={() => setShowCurrent(!showCurrent)}>
                        {showCurrent ? '🙈' : '👁️'}
                      </span>
                    </div>
                  </div>
                  <div className="password-field">
                    <div className="inp-label">Nouveau mot de passe</div>
                    <div className="password-input-wrapper">
                      <input type={showNew ? 'text' : 'password'} className="inp"
                        placeholder="Au moins 6 caractères"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)} />
                      <span className="password-toggle-icon" onClick={() => setShowNew(!showNew)}>
                        {showNew ? '🙈' : '👁️'}
                      </span>
                    </div>
                  </div>
                  <div className="password-field">
                    <div className="inp-label">Confirmer le nouveau mot de passe</div>
                    <div className="password-input-wrapper">
                      <input type={showConfirm ? 'text' : 'password'} className="inp"
                        placeholder="Répétez le nouveau mot de passe"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)} />
                      <span className="password-toggle-icon" onClick={() => setShowConfirm(!showConfirm)}>
                        {showConfirm ? '🙈' : '👁️'}
                      </span>
                    </div>
                  </div>

                  {passwordError   && <div className="error-message">⚠️ {passwordError}</div>}
                  {passwordSuccess && <div style={{ color: '#86efac', fontSize: '13px', marginBottom: '8px' }}>✅ {passwordSuccess}</div>}

                  <button className="btn btn-primary btn-password-update"
                    onClick={handlePasswordChange}>
                    Mettre à jour le mot de passe
                  </button>
                </div>
              </div>

              {/* ── Actions ── */}
              <div className="form-actions">
                <button className="btn btn-secondary btn-full btn-full-center"
                  onClick={() => navigate('/parametres')}>
                  Annuler
                </button>
                <button className="btn btn-primary btn-full btn-full-center"
                  onClick={handleSave} disabled={isSaving}
                  style={{ opacity: isSaving ? 0.7 : 1 }}>
                  {isSaving ? '⏳ Sauvegarde...' : '✓ Sauvegarder'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {isSaving && (
        <div className="loader-overlay">
          <Loader />
        </div>
      )}
    </div>
  );
};

export default EditProfileComponent;
