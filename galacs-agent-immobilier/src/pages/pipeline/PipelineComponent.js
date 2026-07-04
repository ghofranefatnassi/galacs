import React, { useEffect, useState, useCallback } from 'react'
import '../../assets/styles/style.css'
import './Pipeline.css'
import { useNavigate, useLocation } from 'react-router-dom'
import { getPipelineLeads, getCrmStages } from '../../services/odooApi'

// ─── Stage mapping ────────────────────────────────────────────────────────────
const STAGE_NAME_TO_STEP = {
  'new':         'contact',
  'qualified':   'rdv',
  'proposition': 'devis',
  'won':         'vente',
}

const STEPS = ['contact', 'rdv', 'devis', 'vente']

function stageToStep(stageName) {
  if (!stageName) return 'contact'
  return STAGE_NAME_TO_STEP[stageName.toLowerCase()] ?? 'contact'
}

function stepIndex(step) {
  return STEPS.indexOf(step)
}

// ─── LeadCard ────────────────────────────────────────────────────────────────
function LeadCard({ lead, currentStep, onUpdate, onDeclarer }) {
  const idx = stepIndex(currentStep)
  const isWon = currentStep === 'vente'
  const isUrgent = lead.date_deadline && !isWon &&
    (new Date(lead.date_deadline) - new Date()) / (1000 * 60 * 60 * 24) <= 2

  const cardClass = isWon
    ? 'piplineS11'
    : isUrgent
    ? 'piplineS3'
    : 'piplineS9'

  const initials = (lead.partner_name || lead.name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const handleCardClick = () => {
    if (isWon) onDeclarer(lead)
    else onUpdate(lead)
  }

  return (
    <div className={cardClass} onClick={handleCardClick}>
      <div className="piplineS4">
        <div>
          <div className="syn piplineS5">{lead.partner_name || lead.name}</div>
          <div className="piplineS6">
            #{lead.id} · {lead.city || '—'} · Score IA {Math.round(lead.probability ?? 0)}%
          </div>
        </div>
        <div className="piplineS7">
          {isWon && <span className="bdg bdg-hot">🎉 Vente !</span>}
          {isUrgent && !isWon && <span className="bdg bdg-warn">⚠ Urgent</span>}
          {!isWon && !isUrgent && <span className="bdg bdg-ok">✓ À jour</span>}

          {isWon ? (
            <button
              className="btn btn-success btn-sm"
              onClick={(e) => { e.stopPropagation(); onDeclarer(lead) }}
            >
              📎 Déclarer la vente
            </button>
          ) : (
            <button
              className={`btn btn-sm ${isUrgent ? 'btn-warning' : 'btn-secondary'}`}
              onClick={(e) => { e.stopPropagation(); onUpdate(lead) }}
            >
              Mettre à jour
            </button>
          )}
        </div>
      </div>

      <div className="step-row">
        {STEPS.map((step, i) => {
          const done    = i < idx
          const current = i === idx
          const stepClass = done ? 'step done' : current ? 'step curr' : 'step'
          const dot = done || isWon ? '✓' : current ? '●' : ''
          const labels = ['Contact', 'RDV', 'Devis', 'Vente']
          return (
            <div key={step} className={isWon ? 'step won' : stepClass}>
              <div className="step-dot">{isWon ? '✓' : dot}</div>
              <div className="step-lbl">{labels[i]}</div>
            </div>
          )
        })}
      </div>

      {isUrgent && !isWon && (
        <div className="piplineS8">
          ⚠ Délai de mise à jour expirant — sans action, le lead repart aux enchères
        </div>
      )}
      {!isWon && !isUrgent && currentStep === 'rdv' && lead.date_deadline && (
        <div className="piplineS10">
          📅 RDV prévu le {new Date(lead.date_deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      )}
      {!isWon && currentStep === 'contact' && (
        <div className="piplineS12">📞 Premier contact obligatoire sous 72h</div>
      )}
    </div>
  )
}

// ─── PipelineComponent ────────────────────────────────────────────────────────
const PipelineComponent = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const [leads,      setLeads]      = useState([])
  const [stages,     setStages]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  // ── FIX: explicit refresh counter so a manual reload is always possible
  const [refreshKey, setRefreshKey] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [leadsData, stagesData] = await Promise.all([
        getPipelineLeads(),
        getCrmStages(),
      ])
      setLeads(leadsData)
      setStages(stagesData)
    } catch (err) {
      setError(err.message || 'Impossible de charger le pipeline.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Re-fetch on:
  //  1. First mount
  //  2. Coming back from StatusComponent with { refresh: true } in location.state
  //  3. Manual refresh via refreshKey
  useEffect(() => {
    load()
  }, [load, refreshKey, location.state?.refresh])

  // Clear the refresh flag from history so it doesn't re-trigger on unrelated nav
  useEffect(() => {
    if (location.state?.refresh) {
      navigate('/pipeline', { replace: true, state: {} })
    }
  }, [location.state?.refresh]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpdate = (lead) => {
    navigate('/pipeline/status', { state: { lead, stages } })
  }

  const handleDeclarer = (lead) => {
    navigate('/pipeline/declarer_vente', { state: { lead } })
  }

  const urgentCount = leads.filter((l) => {
    const step = stageToStep(l.stage_id?.[1] ?? '')
    if (step === 'vente') return false
    return l.date_deadline &&
      (new Date(l.date_deadline) - new Date()) / (1000 * 60 * 60 * 24) <= 2
  }).length

  if (loading) {
    return (
      <div className="page active">
        <div className="page-inner fade-in" style={{ textAlign: 'center', paddingTop: '60px' }}>
          <div style={{ fontSize: '24px', marginBottom: '12px' }}>⏳</div>
          <p style={{ color: 'var(--muted)' }}>Chargement du pipeline…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page active">
        <div className="page-inner fade-in">
          <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)', borderRadius: '12px', padding: '20px', color: 'var(--red)' }}>
            ⚠ {error}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page active">
      <div className="page-inner fade-in">
        <div className="piplineS1">
          <div>
            <h1>Mon Pipeline</h1>
            <p className="page-subtitle">{leads.length} lead{leads.length !== 1 ? 's' : ''} en cours de suivi</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {urgentCount > 0 && (
              <span className="bdg bdg-warn">
                ⚠ {urgentCount} lead{urgentCount > 1 ? 's' : ''} urgent{urgentCount > 1 ? 's' : ''}
              </span>
            )}
            {/* Manual refresh button */}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setRefreshKey((k) => k + 1)}
              title="Rafraîchir"
            >
              ↻
            </button>
          </div>
        </div>

        {leads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
            <p>Aucun lead actif pour l'instant.</p>
          </div>
        ) : (
          <div className="piplineS2">
            {leads.map((lead) => {
              const stageName   = lead.stage_id?.[1] ?? ''
              const currentStep = stageToStep(stageName)
              return (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  currentStep={currentStep}
                  onUpdate={handleUpdate}
                  onDeclarer={handleDeclarer}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default PipelineComponent