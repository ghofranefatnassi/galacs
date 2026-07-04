import React, { useState, useEffect } from 'react';
import '../../assets/styles/style.css';
import './Crm.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { callModel } from '../../services/odooApi';

const EditContactComponent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const contactId = location.state?.contactId;

  // ── Form state ────────────────────────────────────────────────────────────
  const [alias, setAlias] = useState('');
  const [isAlias, setIsAlias] = useState(false);
  const [typeContact, setTypeContact] = useState('Acheteur potentiel');
  const [source, setSource] = useState('Contact direct');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [budget, setBudget] = useState('');
  const [typeBien, setTypeBien] = useState('appartement');
  const [horizon, setHorizon] = useState('3-6 mois');
  const [notes, setNotes] = useState('');
  const [temperature, setTemperature] = useState('');
  const [selectedZones, setSelectedZones] = useState([]);
  const [customZones, setCustomZones] = useState([]);

  // ── Conversion state ──────────────────────────────────────────────────────
  const [convertedToLead, setConvertedToLead] = useState(false);
  const [convertedLeadId, setConvertedLeadId] = useState(null);
  const [converting, setConverting] = useState(false);

  // ── Feedback state ────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const predefinedZones = ['Lyon', 'Bordeaux', 'Paris', 'Marseille', 'Nantes', 'Strasbourg'];

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
        "alias", "nom_encrypted", "telephone_encrypted", "email_encrypted",
        "linkedin_encrypted", "zone_chalandise", "type_bien",
        "notes_encrypted", "create_date",
        "converted_to_lead", "converted_lead_id",
      ],
    })
      .then(result => {
        const c = result[0];
        setAlias(c.nom_encrypted || c.alias || '');
        setIsAlias(!c.nom_encrypted);
        setPhone(c.telephone_encrypted || '');
        setEmail(c.email_encrypted || '');
        setLinkedin(c.linkedin_encrypted || '');
        setNotes(c.notes_encrypted || '');
        setTypeBien(c.type_bien || 'appartement');
        setConvertedToLead(c.converted_to_lead || false);
        setConvertedLeadId(c.converted_lead_id || null);

        // Parse zones
        if (c.zone_chalandise) {
          const zones = c.zone_chalandise.split(',').map(z => z.trim()).filter(Boolean);
          const custom = zones.filter(z => !predefinedZones.includes(z));
          setSelectedZones(zones);
          setCustomZones(custom);
        }
      })
      .catch(() => showToast('err', 'Impossible de charger le contact'))
      .finally(() => setLoading(false));
  }, [contactId]);

  // ── Convert to lead ───────────────────────────────────────────────────────
  const handleConvertToLead = async () => {
    if (!window.confirm("Convertir ce contact en lead d'enchère ? Le contact sera envoyé au pipeline de scoring IA.")) return;
    setConverting(true);
    try {
      const result = await callModel("galacs.contact.prive", "action_convert_to_lead", [[contactId]]);
      showToast('ok', 'Contact converti en lead avec succès');
      setConvertedToLead(true);
      const newLeadId = result?.res_id;
      if (newLeadId) {
        setConvertedLeadId([newLeadId, '']);
        setTimeout(() => {
          navigate('/leads/fichier_leads', { state: { leadId: newLeadId } });
        }, 800);
      }
    } catch (err) {
      showToast('err', err.message || 'Erreur lors de la conversion');
    } finally {
      setConverting(false);
    }
  };

  // ── Zones ─────────────────────────────────────────────────────────────────
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
    setSaving(true);
    setError('');
    try {
      await callModel("galacs.contact.prive", "write", [[contactId], {
        alias: alias.trim(),
        nom_encrypted: isAlias ? '' : alias.trim(),
        telephone_encrypted: phone,
        email_encrypted: email,
        linkedin_encrypted: linkedin,
        zone_chalandise: selectedZones.join(', '),
        type_bien: typeBien,
        notes_encrypted: notes,
      }]);
      navigate('/crm/contact_detail', { state: { contactId } });
    } catch (err) {
      setError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!window.confirm('Supprimer ce contact ? Cette action est irréversible.')) return;
    try {
      await callModel("galacs.contact.prive", "unlink", [[contactId]]);
      navigate('/crm');
    } catch {
      showToast('err', 'Erreur lors de la suppression');
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="page active" id="p-crm-edit">
      <div className="page-inner fade-in" style={{ textAlign: 'center', paddingTop: '80px', opacity: 0.5 }}>
        ⏳ Chargement du contact...
      </div>
    </div>
  );

  return (
    <div className="page active" id="p-crm-edit">
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

        <div className="edit-contact-header">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/crm')}>
            ← Retour
          </button>
          <h1 style={{ margin: 0 }}>Modifier le contact</h1>
          <span className="bdg edit-contact-badge">{alias || '—'}</span>
        </div>

        {!convertedToLead ? (
          <div style={{
            display: 'flex', justifyContent: 'flex-end', marginBottom: '16px',
          }}>
            <button className="btn btn-warning btn-sm"
              onClick={handleConvertToLead}
              disabled={converting}
              style={{ opacity: converting ? 0.7 : 1 }}>
              {converting ? '⏳ Conversion...' : "🏷 Convertir en lead d'enchère"}
            </button>
          </div>
        ) : (
          <div style={{
            display: 'flex', justifyContent: 'flex-end', marginBottom: '16px',
          }}>
            <span className="bdg bdg-ok" style={{ fontSize: '11px' }}>
              ✅ Déjà converti en lead
            </span>
          </div>
        )}

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

            <div className="edit-identity-preview">
              <div className="edit-identity-avatar">{getInitials(alias)}</div>
              <div className="edit-identity-info">
                <div className="edit-identity-name">
                  {alias || '—'}
                  {isAlias && <span className="alias-chip edit-identity-name-alias">alias</span>}
                </div>
                <div className="edit-identity-meta">{typeContact}</div>
              </div>
            </div>

            <div className="inp-group">
              <div className="inp-label">Nom / Alias <span style={{ color: 'var(--accent)' }}>*</span></div>
              <input className="inp" value={alias} onChange={e => setAlias(e.target.value)} />
              <div className="edit-alias-toggle">
                <label className="sw" style={{ transform: 'scale(0.85)', transformOrigin: 'left' }}>
                  <input type="checkbox" checked={isAlias} onChange={e => setIsAlias(e.target.checked)} />
                  <span className="sw-track"></span>
                </label>
                <span className="edit-alias-label">Mode alias — nom réel masqué</span>
              </div>
            </div>

            <div className="inp-group">
              <div className="inp-label">Type de contact</div>
              <select className="inp edit-select" value={typeContact} onChange={e => setTypeContact(e.target.value)}>
                <option>Acheteur potentiel</option>
                <option>Vendeur</option>
                <option>Investisseur</option>
                <option>Primo-accédant</option>
                <option>Autre</option>
              </select>
            </div>

            <div className="inp-group">
              <div className="inp-label">Source</div>
              <select className="inp edit-select" value={source} onChange={e => setSource(e.target.value)}>
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
              <input className="inp" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="inp-group">
              <div className="inp-label">Email</div>
              <input className="inp" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="inp-group" style={{ marginBottom: 0 }}>
              <div className="inp-label">LinkedIn</div>
              <input className="inp" value={linkedin} onChange={e => setLinkedin(e.target.value)} />
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
                <div className="edit-budget-wrapper">
                  <input className="inp edit-budget-input" type="number" value={budget}
                    onChange={e => setBudget(e.target.value)} />
                  <span className="edit-budget-currency">€</span>
                </div>
              </div>

              <div className="inp-group">
                <div className="inp-label">Type de bien</div>
                <select className="inp edit-select" value={typeBien} onChange={e => setTypeBien(e.target.value)}>
                  <option value="appartement">Appartement</option>
                  <option value="maison">Maison</option>
                  <option value="terrain">Terrain</option>
                  <option value="commercial">Local commercial</option>
                  <option value="autre">Autre</option>
                </select>
              </div>

              <div className="inp-group">
                <div className="inp-label">Horizon de projet</div>
                <select className="inp edit-select" value={horizon} onChange={e => setHorizon(e.target.value)}>
                  <option>Moins de 3 mois</option>
                  <option>3-6 mois</option>
                  <option>6-12 mois</option>
                  <option>Plus d'un an</option>
                  <option>Indéfini</option>
                </select>
              </div>

              <div className="inp-group" style={{ marginBottom: 0 }}>
                <div className="inp-label">Température</div>
                <div className="edit-temp-selector">
                  <div
                    className={'edit-temp-option ' + (temperature === 'hot' ? 'active' : 'inactive')}
                    onClick={() => setTemperature(temperature === 'hot' ? '' : 'hot')}>
                    🔥 Chaud
                  </div>
                  <div
                    className={'edit-temp-option ' + (temperature === 'warm' ? 'active' : 'inactive')}
                    onClick={() => setTemperature(temperature === 'warm' ? '' : 'warm')}>
                    🌡 Tiède
                  </div>
                  <div
                    className={'edit-temp-option ' + (temperature === 'cold' ? 'active' : 'inactive')}
                    onClick={() => setTemperature(temperature === 'cold' ? '' : 'cold')}>
                    ❄ Froid
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '14px' }}>📝 Notes</h3>
              <textarea className="inp"
                style={{ minHeight: '120px', resize: 'vertical', fontSize: '13px' }}
                value={notes} onChange={e => setNotes(e.target.value)} />
            </div>

            <div className="card danger-zone-card">
              <h3 className="danger-zone-title">⚠ Zone de danger</h3>
              <button className="btn btn-secondary btn-full danger-delete-btn" onClick={handleDelete}>
                🗑 Supprimer ce contact
              </button>
              <div className="danger-warning-text">
                Cette action est irréversible. Le contact sera définitivement supprimé.
              </div>
            </div>

            <div className="edit-form-actions">
              <button className="btn btn-secondary btn-full btn-full-center"
                onClick={() => navigate('/crm/contact_detail', { state: { contactId } })}>
                Annuler
              </button>
              <button className="btn btn-primary btn-full btn-full-center"
                onClick={handleSave} disabled={saving}
                style={{ opacity: saving ? 0.7 : 1 }}>
                {saving ? '⏳ Enregistrement...' : '✓ Enregistrer les modifications'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditContactComponent;
