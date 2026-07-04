import React, { useState, useEffect } from 'react'
import '../../assets/styles/style.css'
import './Parametres.css'
import Logo from '../../assets/images/1.png'
import { useNavigate } from 'react-router-dom'
import Switch from '../../components/common/CosmicSwitch'
import { ConfirmDeleteModal, SuccessToast } from '../../components/common/DeleteModals'
import { useAgentAuth } from '../../contexts/AgentAuthContext'
import { getAgentProfile, saveAgentProfile, changePassword } from '../../services/odooApi'

const ParametresComponent = () => {
  const navigate = useNavigate()
  const { user, logout } = useAgentAuth()

  // ── Profile state ─────────────────────────────────────────────────────────
  const [profile, setProfile]       = useState(null)
  const [firstName, setFirstName]   = useState('')
  const [lastName, setLastName]     = useState('')
  const [phone, setPhone]           = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState(null)

  // ── Notification toggles (UI only — no Odoo model for this yet) ───────────
  const [notifEncheres,  setNotifEncheres]  = useState(true)
  const [notifLeads,     setNotifLeads]     = useState(true)
  const [notifPipeline,  setNotifPipeline]  = useState(true)
  const [notifBadges,    setNotifBadges]    = useState(true)
  const [notifAdmin,     setNotifAdmin]     = useState(false)

  // ── Security toggles (UI only) ────────────────────────────────────────────
  const [twoFactorEnabled,  setTwoFactorEnabled]  = useState(true)
  const [biometricEnabled,  setBiometricEnabled]  = useState(true)

  // ── Zones (UI only) ───────────────────────────────────────────────────────
  const allZones = ['Lyon', 'Bordeaux', 'Paris', 'Marseille', 'Nantes', 'Strasbourg']
  const [selectedZones, setSelectedZones] = useState(['Lyon', 'Bordeaux'])
  const [radius, setRadius] = useState(50)

  // ── Delete modal ──────────────────────────────────────────────────────────
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [toastVisible,    setToastVisible]    = useState(false)
  const [toastMessage,    setToastMessage]    = useState('')

  // ── Load profile on mount ─────────────────────────────────────────────────
  useEffect(() => {
    getAgentProfile()
      .then(p => {
        setProfile(p)
        const parts = (p.name || '').split(' ')
        setFirstName(parts[0] || '')
        setLastName(parts.slice(1).join(' ') || '')
        setPhone(p.phone || '')
      })
      .catch(err => console.warn('Profile load error:', err))
  }, [])

  // ── Save profile ──────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!user?.uid) return
    setProfileSaving(true)
    setProfileMsg(null)
    try {
      await saveAgentProfile(user.uid, {
        name: `${firstName} ${lastName}`.trim(),
        phone,
      })
      setProfileMsg({ type: 'ok', text: 'Profil mis à jour ✓' })
    } catch (err) {
      setProfileMsg({ type: 'err', text: err.message })
    } finally {
      setProfileSaving(false)
    }
  }

  const toggleZone = (zone) => {
    setSelectedZones(prev =>
      prev.includes(zone) ? prev.filter(z => z !== zone) : [...prev, zone]
    )
  }

  const confirmDeleteAccount = () => {
    setDeleteModalOpen(false)
    setToastMessage('Votre compte sera supprimé définitivement dans 30 jours.')
    setToastVisible(true)
    setTimeout(() => navigate('/'), 3000)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const displayName = profile?.name || user?.name || '—'
  const displayEmail = profile?.email || '—'
  const agentInitials = displayName.split(/[\s-]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')

  return (
    <div className="page active">
      <div className="page-inner fade-in">
        <h1 style={{ marginBottom: '6px' }}>Paramètres</h1>
        <p className="page-subtitle">Préférences, sécurité et confidentialité</p>

        <div className="grid-2">
          {/* ── Left column ── */}
          <div className="paraS1">
            <div className="card">
              <h3 style={{ marginBottom: '16px' }}>Compte</h3>
              <div className="paraS2">
                <div className="paraS3">
                  {agentInitials}<span className="paraS4"></span>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="syn paraS5">{displayName}</div>
                  <div className="paraS6">{displayEmail}</div>
                  <div className="paraS7">Agent</div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/parametres/edit-profile')}>
                  Éditer
                </button>
              </div>

              <div className="inp-group">
                <div className="inp-label">Prénom</div>
                <input className="inp" value={firstName} onChange={e => setFirstName(e.target.value)} />
              </div>
              <div className="inp-group">
                <div className="inp-label">Nom</div>
                <input className="inp" value={lastName} onChange={e => setLastName(e.target.value)} />
              </div>
              <div className="inp-group">
                <div className="inp-label">Téléphone</div>
                <input className="inp" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>

              {profileMsg && (
                <div style={{ fontSize: '13px', marginBottom: '10px', color: profileMsg.type === 'ok' ? 'var(--green)' : 'var(--red, #ef4444)' }}>
                  {profileMsg.text}
                </div>
              )}
              <button className="btn btn-primary btn-sm" onClick={handleSaveProfile} disabled={profileSaving}>
                {profileSaving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '14px' }}>Zones de travail</h3>
              <div className="paraS8">Leads visibles dans votre espace</div>
              <div className="paraS9">
                {allZones.map(zone => (
                  <div key={zone} className={`zone-chip ${selectedZones.includes(zone) ? 'on' : ''}`} onClick={() => toggleZone(zone)}>
                    📍 {zone}
                  </div>
                ))}
                <div className="zone-chip paraS10" onClick={() => alert('Ajouter zone personnalisée à venir')}>
                  + Ajouter
                </div>
              </div>
              <div className="paraS11">
                <span style={{ fontSize: '14px' }}>🗺</span>
                <div className="paraS12">Rayon de recherche</div>
                <span className="syn paraS13">{radius} km</span>
                <input type="range" min="10" max="200" value={radius} className="paraS14" onChange={e => setRadius(parseInt(e.target.value))} />
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '16px' }}>Confidentialité & Données</h3>
              <div className="paraS15">
                <div className="paraS16">
                  <div className="paraS17">🌐</div>
                  <div style={{ flex: 1 }}>
                    <div className="paraS18">Chiffrement AES-256</div>
                    <div className="paraS19">Actif · Infomaniak Suisse 🇨🇭</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <div className="paraS20">
                  <div className="paraS21">📋</div>
                  <div style={{ flex: 1 }}>
                    <div className="paraS18">Politique de confidentialité</div>
                    <div className="paraS22">RGPD conforme · Jan. 2026</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A96B0" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                </div>
                <div className="paraS23" onClick={() => setDeleteModalOpen(true)} style={{ cursor: 'pointer' }}>
                  <div className="paraS24">🗑</div>
                  <div style={{ flex: 1 }}>
                    <div className="paraS25">Supprimer mon compte</div>
                    <div className="paraS22">Action irréversible</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right column ── */}
          <div className="paraS26">
            <div className="card">
              <h3 style={{ marginBottom: '16px' }}>Notifications</h3>
              <div className="paraS27">
                <div className="paraS28"><div className="paraS29">⚡</div><div style={{flex:1}}><div className="paraS18">Alertes enchères</div><div className="paraS22">Surenchères et fins imminentes</div></div><Switch checked={notifEncheres} onChange={e => setNotifEncheres(e.target.checked)} /></div>
                <div className="paraS28"><div className="paraS17">🔥</div><div style={{flex:1}}><div className="paraS18">Nouveaux leads</div><div className="paraS22">Dans ma zone de travail</div></div><Switch checked={notifLeads} onChange={e => setNotifLeads(e.target.checked)} /></div>
                <div className="paraS28"><div className="paraS24">⏰</div><div style={{flex:1}}><div className="paraS18">Rappels suivi pipeline</div><div className="paraS22">Délai 72h obligatoire</div></div><Switch checked={notifPipeline} onChange={e => setNotifPipeline(e.target.checked)} /></div>
                <div className="paraS28"><div className="paraS30">🏆</div><div style={{flex:1}}><div className="paraS18">Badges & classement</div></div><Switch checked={notifBadges} onChange={e => setNotifBadges(e.target.checked)} /></div>
                <div className="paraS31"><div className="paraS32">📢</div><div style={{flex:1}}><div className="paraS18">Annonces admin</div></div><Switch checked={notifAdmin} onChange={e => setNotifAdmin(e.target.checked)} /></div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '16px' }}>Sécurité</h3>
              <div className="paraS27">
                <div className="paraS33">
                  <div className="paraS17">🔑</div>
                  <div style={{ flex: 1 }}>
                    <div className="paraS18">Changer le mot de passe</div>
                    <div className="paraS22">Via votre compte Odoo</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A96B0" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                </div>
                <div className="paraS28"><div className="paraS30">🛡</div><div style={{flex:1}}><div className="paraS18">Auth. à 2 facteurs</div><div className="paraS19">Gérée côté Odoo</div></div><Switch checked={twoFactorEnabled} onChange={e => setTwoFactorEnabled(e.target.checked)} /></div>
                <div className="paraS31"><div className="paraS32">👁</div><div style={{flex:1}}><div className="paraS18">Verrouillage biométrique</div></div><Switch checked={biometricEnabled} onChange={e => setBiometricEnabled(e.target.checked)} /></div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '14px' }}>À propos</h3>
              <div className="paraS34">
                <img src={Logo} alt="Galacs Logo" width="36" height="36" style={{ objectFit: 'contain' }} />
                <div>
                  <div className="syn paraS35">GALACS.IO</div>
                  <div className="paraS22">Build 2026.03 · TLS 1.3 · RGPD ✓</div>
                </div>
              </div>
              <div className="paraS36"><span className="paraS6">Hébergement</span><span className="paraS37">Infomaniak 🇨🇭</span></div>
              <div className="paraS36"><span className="paraS6">Chiffrement</span><span className="paraS38">TLS 1.3 + AES-256</span></div>
              <div className="paraS36"><span className="paraS6">Support</span><span className="paraS39">support@galacs.fr</span></div>
            </div>

            <button className="btn btn-secondary btn-full" style={{ padding: '12px' }} onClick={handleLogout}>
              🚪 Se déconnecter
            </button>
          </div>
        </div>
      </div>

      <ConfirmDeleteModal isOpen={deleteModalOpen} contactName="votre compte" onConfirm={confirmDeleteAccount} onCancel={() => setDeleteModalOpen(false)} />
      <SuccessToast visible={toastVisible} message={toastMessage} onClose={() => setToastVisible(false)} />
    </div>
  )
}

export default ParametresComponent