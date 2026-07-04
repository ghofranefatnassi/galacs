import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../../../assets/styles/style.css';
import './UpdateAgent.css';
import Switch from '../../../components/common/CosmicSwitch';
import { callModel } from '../../../services/odooApi';

const UpdateAgent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const agentId = location.state?.agentId;
  const fileInputRef = useRef(null);

  // ── Profile state ─────────────────────────────────────────────────────────
  const [partnerId, setPartnerId] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [initials, setInitials] = useState('');
  const [lastLogin, setLastLogin] = useState('—');

  // ── Access / status state ─────────────────────────────────────────────────
  const [accessLevel, setAccessLevel] = useState('agent');
  const [isActive, setIsActive] = useState(true);
  const [isMFAEnabled, setIsMFAEnabled] = useState(false);

  // ── Zones state (galacs.zone) ────────────────────────────────────────────
  const [allZones, setAllZones] = useState([]); // [{id, name}]
  const [selectedZoneIds, setSelectedZoneIds] = useState([]);
  const [isAddingZone, setIsAddingZone] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [addingZoneLoading, setAddingZoneLoading] = useState(false);
  const [zoneError, setZoneError] = useState('');
  const [radius, setRadius] = useState(50);

  // ── Commission state ──────────────────────────────────────────────────────
  const [minCommissionRate, setMinCommissionRate] = useState(3.0);
  const [monthlyTarget, setMonthlyTarget] = useState(20000);
  const [agentCommissionSplit, setAgentCommissionSplit] = useState(70);

  // ── Feedback state ────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

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

  // ── Load agent on mount ───────────────────────────────────────────────────
  useEffect(() => {
    if (!agentId) {
      showToast('err', 'Agent introuvable — retour à la liste');
      setTimeout(() => navigate('/agents'), 2000);
      return;
    }

    const loadAgent = async () => {
      try {
        // Step 1 — get user + partner_id + linkedin + zones, and the zone catalog, in parallel
        const [userResult, zonesResult] = await Promise.all([
          callModel("res.users", "read", [[agentId]], {
            fields: ["name", "active", "login_date", "partner_id", "galacs_linkedin_url", "galacs_zone_ids"],
          }),
          callModel("galacs.zone", "search_read", [[]], { fields: ["id", "name"] }),
        ]);
        const u = userResult[0];
        setAllZones(zonesResult);
        setSelectedZoneIds(u.galacs_zone_ids || []);

        // Step 2 — get contact info from res.partner
        const pId = u.partner_id?.[0];
        setPartnerId(pId);

        let name = u.name;
        let partnerEmail = '';
        let partnerPhone = '';
        let image = null;

        if (pId) {
          const partnerResult = await callModel("res.partner", "read", [[pId]], {
            fields: ["name", "email", "phone", "image_1920", "street", "city"],
          });
          const p = partnerResult[0];
          name = p.name || u.name;
          partnerEmail = p.email || '';
          partnerPhone = p.phone || '';
          image = p.image_1920 || null;
          setAddress([p.street, p.city].filter(Boolean).join(', '));
        }

        const parts = name.split(' ');
        const fn = parts[0] || '';
        const ln = parts.slice(1).join(' ') || '';
        setFirstName(fn);
        setLastName(ln);
        setEmail(partnerEmail);
        setPhone(partnerPhone);
        setLinkedin(u.galacs_linkedin_url || '');
        setIsActive(u.active);
        setInitials(((fn[0] || '') + (ln[0] || '')).toUpperCase());

        if (image) setAvatar('data:image/png;base64,' + image);

        if (u.login_date) {
          setLastLogin(new Date(u.login_date).toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          }));
        }
      } catch (err) {
        showToast('err', "Impossible de charger l'agent");
      } finally {
        setLoading(false);
      }
    };

    loadAgent();
  }, [agentId]);

  // ── Avatar upload ─────────────────────────────────────────────────────────
  const handleAvatarClick = () => fileInputRef.current?.click();
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setAvatar(reader.result);
      reader.readAsDataURL(file);
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      // Step 1 — write contact fields on res.partner
      if (partnerId) {
        const partnerVals = {
          name: (firstName + ' ' + lastName).trim(),
          email,
          phone,
        };
        if (avatar && avatar.startsWith('data:image')) {
          partnerVals.image_1920 = avatar.split(',')[1];
        }
        await callModel("res.partner", "write", [[partnerId], partnerVals]);
      }

      // Step 2 — write user-specific fields on res.users
      await callModel("res.users", "write", [[agentId], {
        active: isActive,
        galacs_linkedin_url: linkedin,
        galacs_zone_ids: [[6, 0, selectedZoneIds]],
      }]);

      showToast('ok', 'Agent mis à jour avec succès');
      setTimeout(() => navigate('/agents/fichier-agent', { state: { agentId } }), 1200);
    } catch (err) {
      console.error('Save error:', err);
      showToast('err', err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // ── Suspend ───────────────────────────────────────────────────────────────
  const handleSuspend = async () => {
    if (!window.confirm('Suspendre le compte de ' + firstName + ' ' + lastName + ' ?')) return;
    try {
      await callModel("res.users", "write", [[agentId], { active: false }]);
      showToast('ok', 'Compte suspendu');
      setTimeout(() => navigate('/agents'), 1200);
    } catch {
      showToast('err', 'Erreur lors de la suspension');
    }
  };

  // ── Delete (archive) ──────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!window.confirm('Archiver définitivement le compte de ' + firstName + ' ' + lastName + ' ?')) return;
    try {
      await callModel("res.users", "write", [[agentId], { active: false }]);
      showToast('ok', 'Compte archivé');
      setTimeout(() => navigate('/agents'), 1200);
    } catch {
      showToast('err', "Erreur lors de l'archivage");
    }
  };

  // ── Reset password ────────────────────────────────────────────────────────
  const handleResetPassword = async () => {
    try {
      await callModel("res.users", "action_reset_password", [[agentId]]);
      showToast('ok', "Email de réinitialisation envoyé à l'agent");
    } catch {
      showToast('err', 'Erreur lors de la réinitialisation');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page active" id="p-edit-agent">
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

        <div className='editAgentS1'>
          <button className="btn btn-ghost btn-sm"
            onClick={() => navigate('/agents/fichier-agent', { state: { agentId } })}>
            ← Retour
          </button>
          <h1 style={{ margin: 0 }}>
            {loading ? 'Chargement...' : 'Modifier l\'agent — ' + firstName + ' ' + lastName}
          </h1>
          <span className={'bdg bdg-' + (isActive ? 'ok' : 'err')} style={{ marginLeft: 'auto' }}>
            {isActive ? '✅ Actif' : '⛔ Inactif'}
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', opacity: 0.5 }}>
            ⏳ Chargement de l'agent...
          </div>
        ) : (
          <div className="g2">
            {/* ── Left column ── */}
            <div className='editAgentS2'>
              <div className="card">
                <h3 style={{ marginBottom: '16px' }}>Informations personnelles</h3>

                <div className='editAgentS3' onClick={handleAvatarClick} style={{ cursor: 'pointer' }}>
                  <div className='editAgentS4' style={{ overflow: 'hidden' }}>
                    {avatar
                      ? <img src={avatar} alt="avatar"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : initials}
                    <span className='editAgentS5'></span>
                  </div>
                  <div className='editAgentS6'>✎</div>
                </div>
                <input type="file" accept="image/*" ref={fileInputRef}
                  style={{ display: 'none' }} onChange={handleFileChange} />
                <div className='editAgentS7'>Cliquer sur ✎ pour changer la photo</div>

                <div className="g2 editAgentS8">
                  <div>
                    <div className="il">Prénom</div>
                    <input className="inp" value={firstName} onChange={e => setFirstName(e.target.value)} />
                  </div>
                  <div>
                    <div className="il">Nom</div>
                    <input className="inp" value={lastName} onChange={e => setLastName(e.target.value)} />
                  </div>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <div className="il">Email professionnel</div>
                  <input className="inp" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <div className="il">LinkedIn</div>
                  <input className="inp" value={linkedin}
                    onChange={e => setLinkedin(e.target.value)}
                    placeholder="https://linkedin.com/in/..." />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <div className="il">Téléphone</div>
                  <input className="inp" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
                <div>
                  <div className="il">Adresse</div>
                  <input className="inp" value={address} onChange={e => setAddress(e.target.value)} />
                </div>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: '14px' }}>Niveau d'accès</h3>
                <div className="editAgentS9">
                  {[
                    { key: 'agent', icon: '🏠', label: 'Agent', desc: 'Accès standard' },
                    { key: 'senior', icon: '⭐', label: 'Senior', desc: '+Analytics' },
                    { key: 'manager', icon: '🛡️', label: 'Manager', desc: '+Équipe' },
                  ].map(({ key, icon, label, desc }) => (
                    <div key={key}
                      className={accessLevel === key ? 'editAgentS10' : 'editAgentS14'}
                      onClick={() => setAccessLevel(key)}>
                      <div className="editAgentS11">{icon}</div>
                      <div className={accessLevel === key ? 'editAgentS12' : 'editAgentS15'}>{label}</div>
                      <div className="editAgentS13">{desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: '14px' }}>Statut du compte</h3>
                <div className="editAgentS16">
                  <div className="param-row">
                    <div className="pi-icn" style={{ background: 'rgba(34,197,94,.1)' }}>✅</div>
                    <div style={{ flex: 1 }}>
                      <div className="editAgentS17">Compte actif</div>
                      <div className="editAgentS18">L'agent peut se connecter et accéder aux leads</div>
                    </div>
                    <Switch checked={isActive} onChange={() => setIsActive(!isActive)} />
                  </div>
                  <div className="param-row" style={{ border: 'none' }}>
                    <div className="pi-icn" style={{ background: 'rgba(124,58,237,.1)' }}>🛡</div>
                    <div style={{ flex: 1 }}>
                      <div className="editAgentS17">Authentification MFA</div>
                      <div className="editAgentS18">Obligatoire pour les agents senior/manager</div>
                    </div>
                    <Switch checked={isMFAEnabled} onChange={() => setIsMFAEnabled(!isMFAEnabled)} />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right column ── */}
            <div className='editAgentS2'>
              <div className="card">
                <h3 style={{ marginBottom: '14px' }}>Zones de travail</h3>
                <div className="editAgentS19">Zones actives — les leads disponibles sont filtrés selon ces zones</div>
                <div className="editAgentS20">
                  {allZones.map(zone => (
                    <div key={zone.id}
                      className={'ftag ' + (selectedZoneIds.includes(zone.id) ? 'on' : '')}
                      onClick={() => toggleZone(zone.id)}>
                      📍 {zone.name}
                    </div>
                  ))}

                  {isAddingZone ? (
                    <div className="ftag" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                    <div className="ftag editAgentS25" onClick={() => setIsAddingZone(true)}>
                      + Autre
                    </div>
                  )}
                </div>
                {zoneError && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px' }}>{zoneError}</div>
                )}
                <div className="editAgentS21">
                  <span>🗺</span>
                  <div className="editAgentS22">Rayon de recherche</div>
                  <span className="syn editAgentS23">{radius} km</span>
                  <input type="range" min="10" max="200" value={radius}
                    className="editAgentS24"
                    onChange={e => setRadius(parseInt(e.target.value))} />
                </div>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: '14px' }}>Paramètres de commission</h3>
                <div style={{ marginBottom: '12px' }}>
                  <div className="il">Taux minimum autorisé (%)</div>
                  <input className="inp" type="number" value={minCommissionRate}
                    onChange={e => setMinCommissionRate(parseFloat(e.target.value))}
                    min="1" max="15" step="0.1" />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <div className="il">Objectif mensuel (€)</div>
                  <input className="inp" type="number" value={monthlyTarget}
                    onChange={e => setMonthlyTarget(parseInt(e.target.value))} />
                </div>
                <div>
                  <div className="il">Répartition commission agent (%)</div>
                  <input className="inp" type="number" value={agentCommissionSplit}
                    onChange={e => setAgentCommissionSplit(parseInt(e.target.value))}
                    min="50" max="90" />
                </div>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: '14px' }}>Sécurité</h3>
                <div className="editAgentS26">
                  <button className="btn btn-ghost editAgentS27" onClick={handleResetPassword}>
                    🔑 Réinitialiser le mot de passe
                  </button>
                  <button className="btn btn-ghost editAgentS27"
                    onClick={() => showToast('ok', 'MFA reconfiguration — à implémenter')}>
                    📱 Reconfigurer MFA
                  </button>
                </div>
                <div className="editAgentS28">
                  Dernière connexion : <strong style={{ color: 'var(--white)' }}>{lastLogin}</strong>
                </div>
              </div>

              <div className="editAgentS29">
                <button className="btn btn-gold btn-lg editAgentS30"
                  onClick={handleSave} disabled={saving}
                  style={{ opacity: saving ? 0.7 : 1 }}>
                  {saving ? '⏳ Enregistrement...' : '💾 Enregistrer les modifications'}
                </button>
                <button className="btn btn-ghost editAgentS31"
                  onClick={() => navigate('/agents/fichier-agent', { state: { agentId } })}>
                  Annuler
                </button>
              </div>

              <div className="editAgentS32">
                <div className="editAgentS33">Zone dangereuse</div>
                <div className="editAgentS34">
                  <button className="btn btn-ko editAgentS27" onClick={handleSuspend}>
                    🚫 Suspendre le compte
                  </button>
                  <button className="btn btn-ko editAgentS27" onClick={handleDelete}>
                    🗑 Archiver le compte
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UpdateAgent;
