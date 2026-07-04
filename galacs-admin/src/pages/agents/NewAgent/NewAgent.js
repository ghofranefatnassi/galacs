import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../../assets/styles/style.css';
import './NewAgent.css';
import { callModel } from '../../../services/odooApi';

// ── Group IDs (world-wild-web instance) ──────────────────────────────────────
const G_INTERNAL_USER        = 1;   // User types / Internal User
const G_SALES_OWN_DOCS       = 14;  // Sales / User: Own Documents Only
const G_TECHNICAL_FEATURES   = 7;   // Extra Rights / Technical Features
const G_EXPORT               = 8;   // Technical / Access to export feature
const G_NOTIFICATIONS        = 13;  // Technical / Receive notifications in Odoo
const G_MAIL_TEMPLATE_EDITOR = 12;  // Technical / Mail Template Editor
const G_SHOW_LEAD_MENU       = 17;  // Technical / Show Lead Menu
const G_CONTACT_CREATION     = 9;   // Extra Rights / Contact Creation
const G_MULTI_CURRENCIES     = 6;   // Extra Rights / Multi Currencies
const G_AGENT_IMMOBILIER     = 20;  // Galacs.io / Agent immobilier
// NOT included: G_RECURRING_REVENUES (18), G_MULTI_COMPANIES (5)

const AGENT_GROUPS = [
  [4, G_INTERNAL_USER],
  [4, G_SALES_OWN_DOCS],
  [4, G_TECHNICAL_FEATURES],
  [4, G_EXPORT],
  [4, G_NOTIFICATIONS],
  [4, G_MAIL_TEMPLATE_EDITOR],
  [4, G_SHOW_LEAD_MENU],
  [4, G_CONTACT_CREATION],
  [4, G_MULTI_CURRENCIES],
  [4, G_AGENT_IMMOBILIER],
];

const NewAgent = () => {
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [email, setEmail]         = useState('');
  const [linkedin, setLinkedin]   = useState('');
  const [phone, setPhone]         = useState('');
  const [address, setAddress]     = useState('');

  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoBase64, setPhotoBase64]   = useState(null);

  const [minCommission, setMinCommission] = useState(3.0);
  const [monthlyTarget, setMonthlyTarget] = useState(10000);
  const [radius, setRadius]               = useState(50);
  const [accessLevel, setAccessLevel]     = useState('agent');

  // ── Zones ─────────────────────────────────────────────────────────────────
  const [allZones, setAllZones]               = useState([]);
  const [selectedZoneIds, setSelectedZoneIds] = useState([]);
  const [isAddingZone, setIsAddingZone]       = useState(false);
  const [newZoneName, setNewZoneName]         = useState('');
  const [addingZoneLoading, setAddingZoneLoading] = useState(false);
  const [zoneError, setZoneError]             = useState('');

  // ── Feedback ──────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [toast, setToast]   = useState(null);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    callModel("galacs.zone", "search_read", [[]], { fields: ["id", "name"] })
      .then(setAllZones)
      .catch(() => setAllZones([]));
  }, []);

  // ── Zone helpers ──────────────────────────────────────────────────────────
  const toggleZone = (zoneId) => {
    setSelectedZoneIds(prev =>
      prev.includes(zoneId) ? prev.filter(id => id !== zoneId) : [...prev, zoneId]
    );
  };

  const handleAddZone = async () => {
    const name = newZoneName.trim();
    if (!name) { setIsAddingZone(false); return; }

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
    } catch {
      setZoneError("Impossible d'ajouter cette zone (droits insuffisants ou nom déjà pris)");
    } finally {
      setAddingZoneLoading(false);
    }
  };

  // ── Photo ─────────────────────────────────────────────────────────────────
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
      setPhotoBase64(reader.result.split(',')[1]);
    };
    reader.readAsDataURL(file);
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!firstName.trim()) e.firstName = 'Prénom requis';
    if (!lastName.trim())  e.lastName  = 'Nom requis';
    if (!email.trim())     e.email     = 'Email requis';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Email invalide';
    return e;
  };

  // ── Create ────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setSaving(true);

    try {
      const vals = {
        name:     (firstName.trim() + ' ' + lastName.trim()),
        login:    email.trim(),
        email:    email.trim(),
        password: crypto.randomUUID(),
        groups_id: AGENT_GROUPS,
        galacs_linkedin_url: linkedin.trim() || false,
        galacs_zone_ids: [[6, 0, selectedZoneIds]],
      };
      if (phone.trim())  vals.phone      = phone.trim();
      if (photoBase64)   vals.image_1920 = photoBase64;

      const newUserId = await callModel("res.users", "create", [vals]);

      // Write address on the auto-created partner if provided
      if (address.trim() && newUserId) {
        const userResult = await callModel("res.users", "read", [[newUserId]], {
          fields: ["partner_id"],
        });
        const partnerId = userResult[0]?.partner_id?.[0];
        if (partnerId) {
          const parts = address.split(',').map(s => s.trim());
          await callModel("res.partner", "write", [[partnerId], {
            street: parts[0] || address,
            city:   parts[1] || '',
          }]);
        }
      }
      // ── Send the invitation email so the agent can set their own password ──
try {
  await callModel("res.users", "action_reset_password", [[newUserId]]);
} catch (mailErr) {
  console.error('Invitation email error:', mailErr);
  showToast('err', "Agent créé, mais l'email d'invitation n'a pas pu être envoyé");
  setSaving(false);
  return; // stop here so the admin sees the warning, doesn't get redirected on a false "success"
}
      showToast('ok', `Agent "${firstName} ${lastName}" créé avec succès ! Un email d'invitation lui a été envoyé.`);
      setTimeout(() => navigate('/agents'), 1500);
    } catch (err) {
      console.error('Create error:', err);
      const msg = err.message || '';
      if (msg.includes('login') || msg.includes('unique')) {
        setErrors({ email: 'Cet email est déjà utilisé par un autre compte' });
      } else {
        showToast('err', msg || "Erreur lors de la création de l'agent");
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page active" id="p-new-agent">
      <div className="pi fade-in">

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

        <div className="newAgentS1">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/agents')}>
            ← Retour
          </button>
          <h1 style={{ margin: 0 }}>Créer un Agent</h1>
        </div>

        <div className="g2">
          {/* ── Left column ── */}
          <div className="newAgentS2">
            <div className="card">
              <h3 style={{ marginBottom: '16px' }}>Informations personnelles</h3>

              <div className="newAgentS3">
                <label htmlFor="photo-upload" className="newAgentS4"
                  style={{ cursor: 'pointer', overflow: 'hidden', position: 'relative' }}>
                  {photoPreview
                    ? <img src={photoPreview} alt="Aperçu"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : '+'}
                  <input id="photo-upload" type="file" accept="image/*"
                    style={{ display: 'none' }} onChange={handlePhotoChange} />
                </label>
                <div className="newAgentS5">
                  {photoPreview ? 'Changer la photo' : 'Ajouter une photo'}
                </div>
              </div>

              <div className="g2 newAgentS6">
                <div>
                  <div className="il">Prénom</div>
                  <input className={`inp ${errors.firstName ? 'inp-err' : ''}`}
                    placeholder="Prénom" value={firstName}
                    onChange={e => { setFirstName(e.target.value); setErrors(v => ({ ...v, firstName: '' })); }} />
                  {errors.firstName && <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>{errors.firstName}</div>}
                </div>
                <div>
                  <div className="il">Nom</div>
                  <input className={`inp ${errors.lastName ? 'inp-err' : ''}`}
                    placeholder="Nom" value={lastName}
                    onChange={e => { setLastName(e.target.value); setErrors(v => ({ ...v, lastName: '' })); }} />
                  {errors.lastName && <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>{errors.lastName}</div>}
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div className="il">Email professionnel</div>
                <input className={`inp ${errors.email ? 'inp-err' : ''}`}
                  type="email" placeholder="agent@galacs.fr" value={email}
                  onChange={e => { setEmail(e.target.value); setErrors(v => ({ ...v, email: '' })); }} />
                {errors.email && <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>{errors.email}</div>}
              </div>
              <div style={{ marginBottom: '12px' }}>
                <div className="il">LinkedIn</div>
                <input className="inp" type="url"
                  placeholder="https://www.linkedin.com/in/agent-n"
                  value={linkedin} onChange={e => setLinkedin(e.target.value)} />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div className="il">Téléphone</div>
                <input className="inp" type="tel"
                  placeholder="+33 6 00 00 00 00"
                  value={phone} onChange={e => setPhone(e.target.value)} />
              </div>

              <div>
                <div className="il">Adresse</div>
                <input className="inp" placeholder="Rue, Ville"
                  value={address} onChange={e => setAddress(e.target.value)} />
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '14px' }}>Niveau d'accès</h3>
              <div className="newAgentS7">
                {[
                  { key: 'agent',   icon: '🏠', label: 'Agent',   desc: 'Accès standard' },
                  { key: 'senior',  icon: '⭐', label: 'Senior',  desc: '+Analytics' },
                  { key: 'manager', icon: '🛡️', label: 'Manager', desc: '+Équipe' },
                ].map(({ key, icon, label, desc }) => (
                  <div key={key}
                    className={accessLevel === key ? 'newAgentS8' : 'newAgentS12'}
                    onClick={() => setAccessLevel(key)}>
                    <div className="newAgentS9">{icon}</div>
                    <div className={accessLevel === key ? 'newAgentS10' : 'newAgentS13'}>{label}</div>
                    <div className="newAgentS11">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right column ── */}
          <div className="newAgentS2">
            <div className="card">
              <h3 style={{ marginBottom: '14px' }}>Zones de travail</h3>
              <div className="newAgentS14">
                Sélectionner les zones où l'agent sera actif
              </div>
              <div className="newAgentS15">
                {allZones.map(zone => (
                  <div key={zone.id}
                    className={`ftag ${selectedZoneIds.includes(zone.id) ? 'on' : ''}`}
                    onClick={() => toggleZone(zone.id)}>
                    📍 {zone.name}
                  </div>
                ))}

                {isAddingZone ? (
                  <div className="ftag" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input autoFocus type="text" value={newZoneName}
                      onChange={e => setNewZoneName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleAddZone();
                        if (e.key === 'Escape') { setIsAddingZone(false); setNewZoneName(''); }
                      }}
                      placeholder="Nom de la zone..."
                      style={{ border: 'none', background: 'transparent', outline: 'none', width: '110px', fontSize: '13px' }}
                      disabled={addingZoneLoading} />
                    <span onClick={handleAddZone} style={{ cursor: 'pointer' }}>
                      {addingZoneLoading ? '⏳' : '✓'}
                    </span>
                    <span onClick={() => { setIsAddingZone(false); setNewZoneName(''); }} style={{ cursor: 'pointer' }}>
                      ✕
                    </span>
                  </div>
                ) : (
                  <div className="ftag newAgentS22" onClick={() => setIsAddingZone(true)}>
                    + Autre
                  </div>
                )}
              </div>
              {zoneError && (
                <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px' }}>{zoneError}</div>
              )}
              <div className="newAgentS16">
                <span>🗺</span>
                <div className="newAgentS17">Rayon de recherche</div>
                <span className="syn newAgentS18">{radius} km</span>
                <input type="range" min="10" max="200" value={radius}
                  className="newAgentS19"
                  onChange={e => setRadius(Number(e.target.value))} />
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '14px' }}>Paramètres de commission</h3>
              <div style={{ marginBottom: '12px' }}>
                <div className="il">Taux minimum autorisé (%)</div>
                <input className="inp" type="number" value={minCommission}
                  min="1" max="10" step="0.1"
                  onChange={e => setMinCommission(Number(e.target.value))} />
              </div>
              <div>
                <div className="il">Objectif mensuel (€)</div>
                <input className="inp" type="number" value={monthlyTarget}
                  placeholder="10 000"
                  onChange={e => setMonthlyTarget(Number(e.target.value))} />
              </div>
            </div>

            <div className="newAgentS23">
              <button className="btn btn-gold btn-lg newAgentS20"
                onClick={handleCreate} disabled={saving}
                style={{ opacity: saving ? 0.7 : 1 }}>
                {saving ? '⏳ Création en cours...' : '✓ Créer le compte agent'}
              </button>
              <button className="btn btn-ghost newAgentS21"
                onClick={() => navigate('/agents')} disabled={saving}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewAgent;
