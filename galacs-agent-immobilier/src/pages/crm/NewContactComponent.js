import React, { useState } from 'react';
import '../../assets/styles/style.css';
import './Crm.css';
import { useNavigate } from 'react-router-dom';
import { callModel } from '../../services/odooApi';
import { useAgentAuth } from '../../contexts/AgentAuthContext';

const NewContactComponent = () => {
  const navigate = useNavigate();
  const { user } = useAgentAuth();

  // ── Form state ────────────────────────────────────────────────────────────
  const [alias, setAlias] = useState('');
  const [isAlias, setIsAlias] = useState(false);
  const [typeContact, setTypeContact] = useState('Acheteur potentiel');
  const [source, setSource] = useState('Contact direct');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [budget, setBudget] = useState('');
  const [typeBien, setTypeBien] = useState('Appartement');
  const [horizon, setHorizon] = useState('3-6 mois');
  const [notes, setNotes] = useState('');
  const [temperature, setTemperature] = useState('');

  // ── Zones state ───────────────────────────────────────────────────────────
  const predefinedZones = ['Lyon', 'Bordeaux', 'Paris', 'Marseille', 'Nantes', 'Strasbourg'];
  const [selectedZones, setSelectedZones] = useState([]);
  const [customZones, setCustomZones] = useState([]);

  // ── Feedback state ────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const toggleZone = (zone) => {
    setSelectedZones(prev =>
      prev.includes(zone) ? prev.filter(z => z !== zone) : [...prev, zone]
    );
  };

  const addCustomZone = () => {
    const newZone = prompt('Entrez le nom de la zone (ex: Toulouse Centre)');
    if (newZone && newZone.trim() && !predefinedZones.includes(newZone.trim()) && !customZones.includes(newZone.trim())) {
      setCustomZones(prev => [...prev, newZone.trim()]);
      setSelectedZones(prev => [...prev, newZone.trim()]);
    }
  };

  const removeCustomZone = (zone) => {
    setCustomZones(prev => prev.filter(z => z !== zone));
    setSelectedZones(prev => prev.filter(z => z !== zone));
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!alias.trim()) {
      setError('Le nom / alias est obligatoire');
      return;
    }
    if (!user?.uid) {
      setError('Session expirée — veuillez vous reconnecter');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const vals = {
        agent_id: user.uid,
        alias: alias.trim(),
        nom_encrypted: isAlias ? '' : alias.trim(),
        telephone_encrypted: phone,
        email_encrypted: email,
        linkedin_encrypted: linkedin,
        zone_chalandise: selectedZones.join(', '),
        type_bien: typeBien,
        notes_encrypted: notes,
      };

      await callModel("galacs.contact.prive", "create", [vals]);
      navigate('/crm');
    } catch (err) {
      setError(err.message || 'Erreur lors de la création du contact');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page active" id="p-crm-add">
      <div className="page-inner fade-in">
        <div className="crm-add-header">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/crm')}>
            ← Retour
          </button>
          <h1 style={{ margin: 0 }}>Ajouter un contact</h1>
        </div>

        <div className="crm-add-security-banner">
          <span className="crm-add-security-icon">🔒</span>
          <div className="crm-add-security-text">
            Ce contact sera visible <span className="crm-add-security-highlight">uniquement par vous</span>. Utilisez un{' '}
            <span className="crm-add-security-accent">alias</span> à la place du nom réel pour une protection maximale. Chiffrement AES-256.
          </div>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)',
            color: '#fca5a5', borderRadius: '8px', padding: '10px 14px',
            marginBottom: '16px', fontSize: '13px',
          }}>
            ⚠️ {error}
          </div>
        )}

        <div className="grid-2" style={{ alignItems: 'start', gap: '20px' }}>

          {/* ── Left column ── */}
          <div className="card">
            <h3 style={{ marginBottom: '18px' }}>👤 Identité</h3>

            {/* Live preview */}
            <div className="identity-preview">
              <div className="identity-preview-avatar">
                {getInitials(alias) || '?'}
              </div>
              <div className="identity-preview-info">
                <div className="identity-preview-name">{alias || 'Nouveau contact'}</div>
                <div className="identity-preview-hint">
                  {isAlias ? '🔒 Mode alias activé' : 'Les initiales s\'afficheront automatiquement'}
                </div>
              </div>
            </div>

            <div className="inp-group">
              <div className="inp-label">
                Nom / Alias <span style={{ color: 'var(--accent)' }}>*</span>
              </div>
              <input className="inp" placeholder="Ex : Michel R. ou Alias-Lyon-7"
                value={alias} onChange={e => setAlias(e.target.value)} />
              <div className="alias-toggle-wrapper">
                <label className="sw sw-scale">
                  <input type="checkbox" checked={isAlias} onChange={e => setIsAlias(e.target.checked)} />
                  <span className="sw-track"></span>
                </label>
                <span className="alias-toggle-label">Mode alias — nom réel masqué</span>
              </div>
            </div>

            <div className="inp-group">
              <div className="inp-label">
                Type de contact <span style={{ color: 'var(--accent)' }}>*</span>
              </div>
              <select className="inp select-inp" value={typeContact} onChange={e => setTypeContact(e.target.value)}>
                <option>Acheteur potentiel</option>
                <option>Vendeur</option>
                <option>Investisseur</option>
                <option>Primo-accédant</option>
                <option>Autre</option>
              </select>
            </div>

            <div className="inp-group">
              <div className="inp-label">Source</div>
              <select className="inp select-inp" value={source} onChange={e => setSource(e.target.value)}>
                <option>Contact direct</option>
                <option>Salon immobilier</option>
                <option>Réseau personnel</option>
                <option>LinkedIn</option>
                <option>Recommandation</option>
                <option>Autre</option>
              </select>
            </div>

            <h3 style={{ marginBottom: '14px', marginTop: '4px' }}>📞 Coordonnées</h3>
            <div className="inp-group">
              <div className="inp-label">Téléphone</div>
              <input className="inp" type="tel" placeholder="+33 6 00 00 00 00"
                value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="inp-group">
              <div className="inp-label">Email</div>
              <input className="inp" type="email" placeholder="contact@email.com"
                value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="inp-group" style={{ marginBottom: 0 }}>
              <div className="inp-label">LinkedIn</div>
              <input className="inp" placeholder="https://linkedin.com/in/..."
                value={linkedin} onChange={e => setLinkedin(e.target.value)} />
            </div>
          </div>

          {/* ── Right column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card">
              <h3 style={{ marginBottom: '18px' }}>🏠 Profil d'achat</h3>

              <div className="inp-group">
                <div className="inp-label">Zone cible</div>
                <div className="paraS8">Sélectionnez les secteurs qui intéressent le prospect</div>
                <div className="paraS9">
                  {predefinedZones.map(zone => (
                    <div key={zone}
                      className={'zone-chip ' + (selectedZones.includes(zone) ? 'on' : '')}
                      onClick={() => toggleZone(zone)}>
                      📍 {zone}
                    </div>
                  ))}
                  {customZones.map(zone => (
                    <div key={zone}
                      className={'zone-chip ' + (selectedZones.includes(zone) ? 'on' : '')}
                      onClick={() => toggleZone(zone)}
                      onDoubleClick={() => removeCustomZone(zone)}
                      title="Double-cliquer pour supprimer">
                      📍 {zone}
                    </div>
                  ))}
                  <div className="zone-chip add-zone" onClick={addCustomZone}>+ Ajouter</div>
                </div>
              </div>

              <div className="inp-group">
                <div className="inp-label">Budget estimé</div>
                <div className="budget-input-wrapper">
                  <input className="inp budget-input" type="number" placeholder="350000"
                    value={budget} onChange={e => setBudget(e.target.value)} />
                  <span className="budget-currency">€</span>
                </div>
              </div>

              <div className="inp-group">
                <div className="inp-label">Type de bien</div>
                <select className="inp select-inp" value={typeBien} onChange={e => setTypeBien(e.target.value)}>
                  <option value="appartement">Appartement</option>
                  <option value="maison">Maison</option>
                  <option value="terrain">Terrain</option>
                  <option value="commercial">Local commercial</option>
                  <option value="autre">Autre</option>
                </select>
              </div>

              <div className="inp-group">
                <div className="inp-label">Horizon de projet</div>
                <select className="inp select-inp" value={horizon} onChange={e => setHorizon(e.target.value)}>
                  <option>Moins de 3 mois</option>
                  <option>3-6 mois</option>
                  <option>6-12 mois</option>
                  <option>Plus d'un an</option>
                  <option>Indéfini</option>
                </select>
              </div>

              <div className="inp-group" style={{ marginBottom: 0 }}>
                <div className="inp-label">Température du lead</div>
                <div className="temp-selector">
                  <div
                    className={'temp-option hot ' + (temperature === 'hot' ? 'selected' : '')}
                    onClick={() => setTemperature(temperature === 'hot' ? '' : 'hot')}
                    style={{ opacity: temperature && temperature !== 'hot' ? 0.4 : 1 }}>
                    🔥 Chaud
                  </div>
                  <div
                    className={'temp-option warm ' + (temperature === 'warm' ? 'selected' : '')}
                    onClick={() => setTemperature(temperature === 'warm' ? '' : 'warm')}
                    style={{ opacity: temperature && temperature !== 'warm' ? 0.4 : 1 }}>
                    🌡 Tiède
                  </div>
                  <div
                    className={'temp-option cold ' + (temperature === 'cold' ? 'selected' : '')}
                    onClick={() => setTemperature(temperature === 'cold' ? '' : 'cold')}
                    style={{ opacity: temperature && temperature !== 'cold' ? 0.4 : 1 }}>
                    ❄ Froid
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '14px' }}>📝 Notes</h3>
              <textarea className="inp notes-textarea-crm"
                placeholder="Motivations, préférences, remarques importantes..."
                value={notes} onChange={e => setNotes(e.target.value)} />
            </div>

            <div className="form-actions">
              <button className="btn btn-secondary btn-full btn-full-center"
                onClick={() => navigate('/crm')}>
                Annuler
              </button>
              <button className="btn btn-primary btn-full btn-full-center"
                onClick={handleSave} disabled={saving}
                style={{ opacity: saving ? 0.7 : 1 }}>
                {saving ? '⏳ Enregistrement...' : '✓ Enregistrer le contact'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewContactComponent;