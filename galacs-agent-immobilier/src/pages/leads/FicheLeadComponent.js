import React, { useState, useEffect } from 'react'
import '../../assets/styles/style.css'
import './FicheLeads.css'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAgentAuth } from '../../contexts/AgentAuthContext'
import { callModel } from '../../services/odooApi'

// ── API helpers ───────────────────────────────────────────────────────────────

async function getLeadWithEnchere(leadId) {
  const [leads, encheres] = await Promise.all([
    callModel('crm.lead', 'read', [[leadId]], {
      fields: [
        'id', 'name', 'partner_name', 'email_from', 'phone',
        'expected_revenue', 'city', 'street', 'stage_id',
        'probability', 'date_deadline', 'description', 'create_date',
        'user_id',
      ],
    }),
    callModel('galacs.enchere', 'search_read',
      [[['lead_id', '=', leadId], ['state', '=', 'open']]],
      {
        fields: [
          'id', 'date_end', 'current_bid_percent', 'min_bid_percent',
          'bid_count', 'score_maturity', 'ia_category', 'zone_chalandise', 'state',
        ],
        limit: 1,
      }
    ),
  ])
  return { lead: leads[0] || null, enchere: encheres[0] || null }
}

async function getIaLog(leadId) {
  const logs = await callModel('galacs.ia.log', 'search_read',
    [[['lead_id', '=', leadId]]],
    { fields: ['score', 'category', 'justification', 'create_date'], order: 'create_date desc', limit: 1 }
  )
  return logs[0] || null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function categoryBadge(cat, score) {
  if (score >= 70 || cat === 'hot')  return { cls: 'bdg-hot',  label: '🔥 CHAUD' }
  if (score >= 40 || cat === 'warm') return { cls: 'bdg-warm', label: '🌡 TIÈDE' }
  return { cls: 'bdg-ok', label: '❄ FROID' }
}

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function maskPhone(phone) {
  if (!phone) return '+33 6 •• •• •• ••'
  return phone.slice(0, 6) + ' •• •• •• ••'
}

function maskEmail(email) {
  if (!email) return '••••@••••.com'
  const [local, domain] = email.split('@')
  return local.slice(0, 3) + '••••@' + (domain || '••')
}

function ScoreRing({ score, color = '#22C55E', size = 90 }) {
  const r = size * 0.4
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  return (
    <div className="cscore" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="cs-bg" cx={size/2} cy={size/2} r={r} />
        <circle
          className="cs-ring" cx={size/2} cy={size/2} r={r}
          stroke={color}
          strokeDasharray={circ.toFixed(1)}
          strokeDashoffset={offset.toFixed(1)}
        />
      </svg>
      <div className="cs-ctr">
        <span className="syn" style={{ fontSize: size * 0.27, fontWeight: '800', color }}>{score}</span>
        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>%</span>
      </div>
    </div>
  )
}

// ── Countdown hook ────────────────────────────────────────────────────────────

function useCountdown(dateEnd) {
  const [display, setDisplay] = useState('')
  useEffect(() => {
    if (!dateEnd) { setDisplay(''); return }
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(dateEnd) - Date.now()) / 1000))
      if (diff === 0) { setDisplay('Terminée'); return }
      const h = Math.floor(diff / 3600)
      const m = Math.floor((diff % 3600) / 60)
      const s = diff % 60
      setDisplay(
        h > 0
          ? `${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`
          : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      )
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [dateEnd])
  return display
}

// ── Component ─────────────────────────────────────────────────────────────────

const FicheLeadComponent = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAgentAuth()

  // leadId passed via navigate('/leads/fichier_leads', { state: { leadId } })
  const leadId = location.state?.leadId || null

  const [lead,    setLead]    = useState(null)
  const [enchere, setEnchere] = useState(null)
  const [iaLog,   setIaLog]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // Is this lead won by current agent?
  const isWon = lead?.probability === 100

  const timeLeft = useCountdown(enchere?.date_end)

  useEffect(() => {
    if (!leadId) { setLoading(false); return }
    let cancelled = false
    Promise.all([getLeadWithEnchere(leadId), getIaLog(leadId)])
      .then(([{ lead: l, enchere: e }, ia]) => {
        if (cancelled) return
        setLead(l)
        setEnchere(e)
        setIaLog(ia)
      })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [leadId])

  if (loading) {
    return (
      <div className="page active">
        <div className="page-inner fade-in">
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Chargement…
          </div>
        </div>
      </div>
    )
  }

  if (error || !lead) {
    return (
      <div className="page active">
        <div className="page-inner fade-in">
          <div className="fleadsS1">
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/leads')}>← Retour</button>
          </div>
          <div style={{ padding: '32px', color: 'var(--text-muted)' }}>
            {error || 'Lead introuvable. Passez un ?id= dans l\'URL.'}
          </div>
        </div>
      </div>
    )
  }

  const score    = iaLog?.score ?? lead.probability ?? 0
  const category = iaLog?.category ?? (score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'cold')
  const badge    = categoryBadge(category, score)
  const name     = lead.partner_name || lead.name || '—'
  const ref      = `GL-${String(lead.id).padStart(4, '0')}`

  const currentBid = enchere?.current_bid_percent ?? enchere?.min_bid_percent ?? '—'
  const minBid     = enchere?.min_bid_percent ?? '—'
  const bidCount   = enchere?.bid_count ?? 0

  return (
    <div className="page active">
      <div className="page-inner fade-in">

        {/* ── Header ── */}
        <div className="fleadsS1">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/leads')}>← Retour</button>
          <h1 style={{ margin: 0 }}>{name}</h1>
          <span className={`bdg ${badge.cls}`}>{badge.label}</span>
          {enchere && (
            <span className="bdg bdg-live" style={{ marginLeft: 'auto' }}>⚡ Enchère active</span>
          )}
        </div>

        <div className="grid-2" style={{ marginBottom: '20px' }}>

          {/* ── Lead info ── */}
          <div className="fleadsS2">
            <div className="fleadsS3">
              <div>
                <div className="syn" style={{ fontSize: '24px', fontWeight: '800', marginBottom: '5px' }}>{name}</div>
                <div className="fleadsS4">#{ref} · Créé le {fmtDate(lead.create_date)}</div>
              </div>
              <ScoreRing score={score} size={90} />
            </div>
            <div className="fleadsS5">
              <div className="fleadsS6">
                <div className="fleadsS7">Zone</div>
                <div className="syn" style={{ fontSize: '14px', fontWeight: '700' }}>
                  {enchere?.zone_chalandise || lead.city || '—'}
                </div>
              </div>
              <div className="fleadsS6">
                <div className="fleadsS7">Budget</div>
                <div className="syn" style={{ fontSize: '14px', fontWeight: '700', color: 'var(--green)' }}>
                  {lead.expected_revenue ? lead.expected_revenue.toLocaleString('fr-FR') + '€' : '—'}
                </div>
              </div>
              <div className="fleadsS6">
                <div className="fleadsS7">Étape</div>
                <div className="syn" style={{ fontSize: '14px', fontWeight: '700' }}>
                  {Array.isArray(lead.stage_id) ? lead.stage_id[1] : '—'}
                </div>
              </div>
              <div className="fleadsS6">
                <div className="fleadsS7">Deadline</div>
                <div className="syn" style={{ fontSize: '14px', fontWeight: '700', color: 'var(--orange)' }}>
                  {fmtDate(lead.date_deadline)}
                </div>
              </div>
              <div className="fleadsS6">
                <div className="fleadsS7">Agent</div>
                <div className="syn" style={{ fontSize: '14px', fontWeight: '700' }}>
                  {Array.isArray(lead.user_id) ? lead.user_id[1] : '—'}
                </div>
              </div>
              <div className="fleadsS6">
                <div className="fleadsS7">Score IA</div>
                <div className="syn" style={{ fontSize: '14px', fontWeight: '700' }}>{score}%</div>
              </div>
            </div>
          </div>

          {/* ── Right col: contact + enchere ── */}
          <div className="fleadsS8">
            {/* Contact card — masked until won */}
            <div className="card" style={{ opacity: isWon ? 1 : 0.6 }}>
              {!isWon && (
                <div className="fleadsS9">
                  <span style={{ fontSize: '16px' }}>🔒</span>
                  <span className="syn" style={{ fontSize: '14px', fontWeight: '700' }}>
                    Contact — Visible après attribution
                  </span>
                </div>
              )}
              <div className="fleadsS10">
                <div style={{ fontSize: '14px' }}>📱</div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Téléphone</div>
                  <div style={{ fontSize: '14px', fontWeight: '500', letterSpacing: '.1em' }}>
                    {isWon ? (lead.phone || '—') : maskPhone(lead.phone)}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '14px' }}>
                <div style={{ fontSize: '14px' }}>✉️</div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Email</div>
                  <div style={{ fontSize: '14px', fontWeight: '500' }}>
                    {isWon ? (lead.email_from || '—') : maskEmail(lead.email_from)}
                  </div>
                </div>
              </div>
            </div>

            {/* Enchere widget */}
            {enchere ? (
              <div className="fleadsS11">
                <div className="fleadsS12">
                  <div>
                    <div className="fleadsS12">Temps restant</div>
                    <div className="syn fleadsS13">{timeLeft || '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="fleadsS12">Meilleure offre</div>
                    <div className="syn fleadsS13">{currentBid !== '—' ? `${currentBid}%` : '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="fleadsS12">Participants</div>
                    <div className="syn fleadsS14">{bidCount}</div>
                  </div>
                </div>
                <button
                  className="btn btn-primary btn-full"
                  style={{ padding: '13px' }}
                  onClick={() => navigate('/leads/enchère_live', { state: { auctionId: enchere.id, leadId } })}
                >
                  ⚡ Participer à l'enchère
                </button>
              </div>
            ) : (
              <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '14px' }}>
                Aucune enchère active pour ce lead.
              </div>
            )}
          </div>
        </div>

        {/* ── IA Analysis ── */}
        <div className="card">
          <h3 style={{ marginBottom: '12px' }}>📝 Analyse IA</h3>
          <p style={{ color: 'var(--muted)', lineHeight: 1.7, fontSize: '14px' }}>
            {iaLog?.justification || lead.description || 'Aucune analyse IA disponible pour ce lead.'}
          </p>
        </div>

      </div>
    </div>
  )
}

export default FicheLeadComponent