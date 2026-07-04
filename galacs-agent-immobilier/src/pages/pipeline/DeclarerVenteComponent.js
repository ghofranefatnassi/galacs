import React, { useState } from 'react'
import '../../assets/styles/style.css'
import './DeclarerVente.css'
import { useNavigate, useLocation } from 'react-router-dom'
import { declarerVente, callModel } from '../../services/odooApi'

const isPdf = (type) => type === 'application/pdf' || type === 'pdf'

const COMMISSION_PCT  = 4.9
const AGENT_SHARE_PCT = 70

const DeclarerVenteComponent = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const { lead } = location.state ?? {}

  const [prixVente,     setPrixVente]     = useState(lead?.expected_revenue ?? 0)
  const [documents,     setDocuments]     = useState([])
  const [signatureDate, setSignatureDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [acheteurNom,   setAcheteurNom]   = useState('')
  const [vendeurNom,    setVendeurNom]    = useState('')
  const [submitting,    setSubmitting]    = useState(false)
  const [error,         setError]         = useState(null)

  const commissionTotal = (prixVente * COMMISSION_PCT) / 100
  const commissionAgent = (commissionTotal * AGENT_SHARE_PCT) / 100

  // ── File handling ─────────────────────────────────────────────────────────
  const addFiles = (fileList) => {
    setError(null)
    const added = []
    Array.from(fileList).forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        setError(`Le fichier "${file.name}" dépasse 10 MB`)
        return
      }
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
      if (!validTypes.includes(file.type)) {
        setError(`Format invalide pour "${file.name}". Utilisez PDF, JPG ou PNG.`)
        return
      }
      const size = file.size < 1024 * 1024
        ? `${(file.size / 1024).toFixed(1)} KB`
        : `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      added.push({ id: Date.now() + Math.random(), name: file.name, size, type: file.type, file })
    })
    if (added.length) setDocuments((prev) => [...prev, ...added])
  }

  const handleFileInput = (e) => { addFiles(e.target.files); e.target.value = '' }
  const handleDragOver  = (e) => {
    e.preventDefault()
    e.currentTarget.style.background  = 'rgba(124,58,237,.1)'
    e.currentTarget.style.borderColor = 'var(--accent)'
  }
  const handleDragLeave = (e) => {
    e.currentTarget.style.background  = 'rgba(124,58,237,.03)'
    e.currentTarget.style.borderColor = 'rgba(124,58,237,.35)'
  }
  const handleDrop = (e) => {
    e.preventDefault(); handleDragLeave(e); addFiles(e.dataTransfer.files)
  }
  const removeDocument = (id) => setDocuments((prev) => prev.filter((d) => d.id !== id))

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError(null)
    if (!lead)                  { setError('Lead introuvable. Retournez au pipeline.'); return }
    if (!signatureDate)         { setError('Veuillez renseigner la date de signature.'); return }
    if (!prixVente || prixVente <= 0) { setError('Veuillez renseigner le prix de vente.'); return }
    if (documents.length === 0) { setError('Veuillez ajouter au moins un document justificatif.'); return }

    setSubmitting(true)
    try {
      // Sync galacs_stage → 'won' before creating the vente
      // This satisfies the backend constraint which checks galacs_stage
      await callModel('crm.lead', 'write', [[lead.id], { galacs_stage: 'won' }])

      await declarerVente(
        {
          lead_id:        lead.id,
          date_signature: signatureDate,
          reference_bien: [lead.street, lead.city].filter(Boolean).join(', '),
          acheteur_nom:   acheteurNom,
          vendeur_nom:    vendeurNom,
          prix_vente:     prixVente,
        },
        documents.map((d) => d.file)
      )
      navigate('/tableau-de-bord')
    } catch (err) {
      setError(err.message || 'Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setSubmitting(false)
    }
  }

  // Guard
  if (!lead) {
    return (
      <div className="page active">
        <div className="page-inner fade-in">
          <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)', borderRadius: '12px', padding: '20px', color: 'var(--red)' }}>
            ⚠ Aucun lead sélectionné.{' '}
            <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/pipeline')}>
              Retour au pipeline
            </span>
          </div>
        </div>
      </div>
    )
  }

  const address = [lead.street, lead.city].filter(Boolean).join(', ') || '—'

  return (
    <div className="page active">
      <div className="page-inner fade-in">
        <div className="dvS1">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/pipeline')}>← Retour</button>
          <h1 style={{ margin: 0 }}>Déclarer la Vente</h1>
        </div>

        <div className="grid-2">
          {/* ── Left column ── */}
          <div className="dvS2">
            <div className="card">
              <h3 style={{ marginBottom: '14px' }}>Progression</h3>
              <div className="step-row">
                <div className="step won"><div className="step-dot">✓</div><div className="step-lbl">Contact</div></div>
                <div className="step won"><div className="step-dot">✓</div><div className="step-lbl">RDV</div></div>
                <div className="step won"><div className="step-dot">✓</div><div className="step-lbl">Devis</div></div>
                <div className="step curr"><div className="step-dot">★</div><div className="step-lbl" style={{ color: 'var(--orange)' }}>Vente</div></div>
              </div>
            </div>

            <div className="dvS3">
              <div className="dvS4">
                <div>
                  <div className="syn dvS5">{lead.partner_name || lead.name}</div>
                  <div className="dvS6">#{lead.id} · {lead.city || '—'}</div>
                </div>
                <span className="bdg bdg-hot">🎉 Vente !</span>
              </div>
              <div className="dvS7">
                <div className="dvS8">
                  <div className="dvS9">Adresse du bien</div>
                  <div className="dvS10">{address}</div>
                </div>
                <div className="dvS8">
                  <div className="dvS9">Prix de vente</div>
                  <div className="syn dvS11">
                    {prixVente > 0 ? prixVente.toLocaleString('fr-FR') + ' €' : '—'}
                  </div>
                </div>
              </div>
            </div>

            <div className="dvS12">
              <div className="dvS13">APERÇU COMMISSION ({COMMISSION_PCT}%)</div>
              <div className="dvS14">
                <span className="syn dvS15">
                  {commissionAgent.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                </span>
                <span className="dvS16">net estimé</span>
              </div>
              <div className="dvS17">Répartition : Agent {AGENT_SHARE_PCT}% · GALACS.IO {100 - AGENT_SHARE_PCT}%</div>
            </div>
          </div>

          {/* ── Right column ── */}
          <div className="dvS2">
            <div className="card">
              <h3 style={{ marginBottom: '12px' }}>Informations de vente</h3>

              <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
                Prix de vente (€)
              </label>
              <input
                className="inp"
                type="number"
                min="0"
                placeholder="Ex : 250000"
                value={prixVente || ''}
                onChange={(e) => setPrixVente(parseFloat(e.target.value) || 0)}
                style={{ marginBottom: '12px' }}
              />

              <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
                Date de signature
              </label>
              <input
                className="inp"
                type="date"
                value={signatureDate}
                onChange={(e) => setSignatureDate(e.target.value)}
                style={{ marginBottom: '12px' }}
              />

              <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
                Nom de l'acheteur
              </label>
              <input
                className="inp"
                type="text"
                placeholder="Ex : Jean Dupont"
                value={acheteurNom}
                onChange={(e) => setAcheteurNom(e.target.value)}
                style={{ marginBottom: '12px' }}
              />

              <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
                Nom du vendeur
              </label>
              <input
                className="inp"
                type="text"
                placeholder="Ex : Marie Martin"
                value={vendeurNom}
                onChange={(e) => setVendeurNom(e.target.value)}
              />
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '12px' }}>📎 Pièces justificatives</h3>

              {documents.map((doc) => (
                <div key={doc.id} className="doc-item">
                  <span style={{ fontSize: '18px' }}>{isPdf(doc.type) ? '📄' : '🖼'}</span>
                  <span className="dvS18">{doc.name}</span>
                  <span className="dvS17">{doc.size}</span>
                  <span className="dvS19" onClick={() => removeDocument(doc.id)}>✕</span>
                </div>
              ))}

              <div
                className="upload-zone"
                onClick={() => document.getElementById('fileInput').click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="dvS20">📎</div>
                <div className="dvS21">Ajouter un document</div>
                <div className="dvS17">PDF, JPG, PNG — max 10 MB</div>
                <input
                  id="fileInput"
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  style={{ display: 'none' }}
                  onChange={handleFileInput}
                />
              </div>

              {documents.length === 0 && (
                <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--orange)', textAlign: 'center' }}>
                  ⚠️ Au moins un document est requis
                </div>
              )}
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)', borderRadius: '10px', padding: '12px 14px', fontSize: '13px', color: 'var(--red)' }}>
                ⚠ {error}
              </div>
            )}

            <div className="dvS22">
              <button
                className="btn dvS23"
                onClick={handleSubmit}
                disabled={documents.length === 0 || submitting}
              >
                {submitting ? '⏳ Envoi en cours…' : '📤 Soumettre la déclaration'}
              </button>
              <button
                className="btn btn-secondary dvS24"
                onClick={() => navigate('/pipeline')}
                disabled={submitting}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DeclarerVenteComponent