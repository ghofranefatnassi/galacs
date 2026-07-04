import React, { useState, useEffect, useMemo } from 'react'
import '../../assets/styles/style.css'
import './Status.css'
import { useNavigate, useLocation } from 'react-router-dom'
import { updateLeadStage, logLeadNote, getCrmStages } from '../../services/odooApi'

// ─── Step → Odoo stage name mapping ──────────────────────────────────────────
// These keys are matched case-insensitively against your real crm.stage names.
// To verify run in Odoo shell: env['crm.stage'].search_read([], ['id','name'])
const STEP_TO_STAGE_NAME = {
  contact: 'New',
  rdv:     'Qualified',
  devis:   'Proposition',
  vente:   'Won',
}

const STAGE_NAME_TO_STEP = {
  'new':         'contact',
  'qualified':   'rdv',
  'proposition': 'devis',
  'won':         'vente',
}

function stageToStep(stageName) {
  if (!stageName) return 'contact'
  return STAGE_NAME_TO_STEP[stageName.toLowerCase()] ?? 'contact'
}

const STEPS_CONFIG = [
  { key: 'contact', icon: '📞', label: 'Contact établi',       sub: 'Premier échange réalisé' },
  { key: 'rdv',     icon: '📅', label: 'Rendez-vous planifié', sub: 'RDV physique ou visio'    },
  { key: 'devis',   icon: '📄', label: 'Devis envoyé',         sub: 'Offre commerciale transmise' },
  { key: 'vente',   icon: '🔒', label: 'Vente signée',         sub: 'Nécessite les 3 étapes précédentes', lockedUnless: 'devis' },
]

const STEPS = STEPS_CONFIG.map((s) => s.key)

// ─── StatusComponent ──────────────────────────────────────────────────────────
const StatusComponent = () => {
  const navigate  = useNavigate()
  const location  = useLocation()

  const { lead, stages: passedStages = [] } = location.state ?? {}

  const initialStep = stageToStep(lead?.stage_id?.[1] ?? '')

  const [selectedStep, setSelectedStep] = useState(initialStep)
  const [note,         setNote]         = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState(null)

  // ── FIX 1: Load REAL stage IDs from Odoo instead of relying on hardcoded fallback
  const [stageMap, setStageMap] = useState({})   // { 'new': 5, 'qualified': 8, … }
  const [stagesLoading, setStagesLoading] = useState(true)

  useEffect(() => {
    async function loadStages() {
      try {
        // Use passed stages if available (PipelineComponent already fetched them)
        const source = passedStages.length > 0 ? passedStages : await getCrmStages()
        const map = {}
        source.forEach((s) => {
          map[s.name.toLowerCase()] = s.id
        })
        console.log('[StatusComponent] Stage map loaded:', map)
        setStageMap(map)
      } catch (err) {
        console.error('[StatusComponent] Failed to load stages:', err)
        setError('Impossible de charger les étapes CRM. Vérifiez la connexion Odoo.')
      } finally {
        setStagesLoading(false)
      }
    }
    loadStages()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── FIX 2: Lock logic uses currentIdx (lead's real stage), NOT selectedIdx
  // "Vente signée" should be unlocked if the lead is already at 'devis' or beyond,
  // regardless of what step is currently selected in the UI.
  const currentIdx  = STEPS.indexOf(initialStep)   // lead's real current step
  const selectedIdx = STEPS.indexOf(selectedStep)   // what user has clicked in UI

  const isUrgent = lead?.date_deadline &&
    (new Date(lead.date_deadline) - new Date()) / (1000 * 60 * 60 * 24) <= 2

  const initials = (lead?.partner_name || lead?.name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const handleConfirm = async () => {
    if (!selectedStep || !lead) return
    setError(null)
    setSubmitting(true)

    try {
      const targetStageName = STEP_TO_STAGE_NAME[selectedStep]
      if (!targetStageName) throw new Error(`Étape "${selectedStep}" sans mapping défini.`)

      // ── FIX 1: resolve stage ID from real Odoo data
      const stageId = stageMap[targetStageName.toLowerCase()]
      if (!stageId) {
        throw new Error(
          `Étape Odoo "${targetStageName}" introuvable.\n` +
          `Étapes disponibles : ${Object.keys(stageMap).join(', ')}\n` +
          `→ Mettez à jour STEP_TO_STAGE_NAME dans StatusComponent.js pour correspondre aux noms exacts dans votre Odoo.`
        )
      }

      console.log(`[StatusComponent] Updating lead ${lead.id} → stage "${targetStageName}" (id: ${stageId})`)
      const writeResult = await updateLeadStage(lead.id, stageId)
      console.log(`[StatusComponent] write() returned:`, writeResult)

      // Confirm persistence by re-reading the lead
      const { callModel: cm } = await import('../../services/odooApi')
      const check = await cm('crm.lead', 'read', [[lead.id]], { fields: ['stage_id'] })
      console.log(`[StatusComponent] Lead stage after write:`, check[0]?.stage_id)

      if (check[0]?.stage_id?.[0] !== stageId) {
        throw new Error(
          `Le stage n'a pas été sauvegardé (Odoo a retourné stage_id=${check[0]?.stage_id?.[0]} au lieu de ${stageId}).\n` +
          `Cause probable : Record Rule — le lead #${lead.id} n'appartient peut-être pas à votre utilisateur.\n` +
          `Vérifiez dans le shell : env['crm.lead'].browse(${lead.id}).user_id.name`
        )
      }

      // Note is non-blocking — don't let it prevent navigation
      if (note.trim()) {
        logLeadNote(lead.id, note.trim()).catch((e) =>
          console.warn('[StatusComponent] Note post failed (non-bloquant):', e.message)
        )
      }

      // Pass refresh:true so PipelineComponent re-fetches fresh data from Odoo
      navigate('/pipeline', { state: { refresh: true } })
    } catch (err) {
      setError(err.message || 'Erreur lors de la mise à jour.')
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

  if (stagesLoading) {
    return (
      <div className="page active">
        <div className="page-inner fade-in" style={{ textAlign: 'center', paddingTop: '60px' }}>
          <div style={{ fontSize: '24px', marginBottom: '12px' }}>⏳</div>
          <p style={{ color: 'var(--muted)' }}>Chargement des étapes…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page active">
      <div className="page-inner fade-in">
        <div className="statusS1">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/pipeline')}>
            ← Retour
          </button>
          <h1 style={{ margin: 0 }}>Mise à jour — {lead.partner_name || lead.name}</h1>
        </div>

        <div className="grid-2">
          {/* ── Left column ── */}
          <div className="statusS2">
            <div className="card">
              <div className="statusS3">
                <div className="statusS4">{initials}</div>
                <div>
                  <div className="syn statusS5">{lead.partner_name || lead.name}</div>
                  <div className="statusS6">
                    #{lead.id} · {lead.city || '—'} · Score {Math.round(lead.probability ?? 0)}%
                  </div>
                </div>
                <span className="bdg bdg-hot" style={{ marginLeft: 'auto' }}>🔥</span>
              </div>
              {isUrgent && (
                <div className="statusS7">⚠ Délai de mise à jour expirant bientôt</div>
              )}
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '16px' }}>Choisir le nouveau statut</h3>
              <div className="statusS8">
                {STEPS_CONFIG.map((s, i) => {
                  const isSelected = selectedStep === s.key
                  const isDone     = i < selectedIdx

                  // ── FIX 2: unlock "Vente" based on the lead's REAL current step
                  // If the lead is already at 'devis' or 'vente' in Odoo → unlock
                  const isLocked = s.lockedUnless
                    ? currentIdx < STEPS.indexOf(s.lockedUnless)
                    : false

                  if (isLocked) {
                    return (
                      <div key={s.key} className="statusS17">
                        <div className="statusS18" />
                        <span style={{ fontSize: '18px' }}>{s.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div className="statusS11">{s.label}</div>
                          <div className="statusS6">{s.sub}</div>
                        </div>
                        <span className="statusS19">Verrouillé</span>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={s.key}
                      className={isSelected ? 'statusS15' : 'statusS9'}
                      onClick={() => setSelectedStep(s.key)}
                    >
                      {isSelected ? (
                        <div className="statusS16">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      ) : (
                        <div className="statusS10">{isDone ? '✓' : ''}</div>
                      )}
                      <span style={{ fontSize: '18px' }}>{s.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div className="statusS11">{s.label}</div>
                        <div className="statusS12">{s.sub}</div>
                      </div>
                      {i < currentIdx && <span className="statusS13">Fait ✓</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── Right column ── */}
          <div className="statusS2">
            <div className="card">
              <h3 style={{ marginBottom: '12px' }}>Note de suivi</h3>
              <textarea
                className="inp"
                placeholder="Ex: Devis envoyé par email le 5 mars. Attente retour sous 48h…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            {/* Stage map debug info — remove in production */}
            {Object.keys(stageMap).length > 0 && (
              <div style={{ fontSize: '11px', color: 'var(--muted)', padding: '8px 12px', background: 'rgba(255,255,255,.03)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                Étapes Odoo détectées : {Object.entries(stageMap).map(([n, id]) => `${n} (id:${id})`).join(' · ')}
              </div>
            )}

            {error && (
              <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)', borderRadius: '10px', padding: '12px 14px', fontSize: '13px', color: 'var(--red)', whiteSpace: 'pre-wrap' }}>
                ⚠ {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-primary"
                style={{ flex: 2, padding: '13px' }}
                onClick={handleConfirm}
                disabled={!selectedStep || submitting || stagesLoading}
              >
                {submitting ? '⏳ Enregistrement…' : '✓ Confirmer la mise à jour'}
              </button>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, padding: '13px' }}
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

export default StatusComponent