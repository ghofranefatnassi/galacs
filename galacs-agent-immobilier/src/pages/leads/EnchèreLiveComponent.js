import React, { useState, useEffect } from 'react'
import '../../assets/styles/style.css'
import './EnchèreLive.css'
import { useNavigate } from 'react-router-dom'
import { useAgentAuth } from '../../contexts/AgentAuthContext'
import { useActiveEncheres } from '../../hooks/Useactiveencheres'
import { callModel } from '../../services/odooApi'

// ── Place a bid ───────────────────────────────────────────────────────────────
// action_place_bid(self, agent_id, bid_percent) — positional args
async function placeBid(enchereId, bidPercent, agentId) {
  return callModel(
    'galacs.enchere',
    'action_place_bid',
    [[enchereId], agentId, bidPercent],
    {}
  )
}

// ── Fetch bids — only active (one per agent, highest wins) ───────────────────
async function getBids(enchereId) {
  return callModel(
    'galacs.enchere.bid',
    'search_read',
    [[['enchere_id', '=', enchereId], ['state', '=', 'active']]],
    {
      fields: ['agent_id', 'bid_percent', 'create_date', 'state'],
      order: 'bid_percent desc',
    }
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(name = '') {
  return name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function fmtCurrency(n) {
  return n ? n.toLocaleString('fr-FR') + '€' : '—'
}

// ── Component ─────────────────────────────────────────────────────────────────
const EnchèreLiveComponent = () => {
  const navigate = useNavigate()
  const { user } = useAgentAuth()

  const { encheres, nextEnchere, timeLeft, loading } = useActiveEncheres()

  const [selectedId, setSelectedId] = useState(null)
  const selected = encheres.find(e => e.id === selectedId) || nextEnchere

  const [bidValue, setBidValue] = useState(null)
  const [bids, setBids] = useState([])
  const [bidLoading, setBidLoading] = useState(false)
  const [bidError, setBidError] = useState(null)
  const [bidSuccess, setBidSuccess] = useState(false)
  const [selectedTimeLeft, setSelectedTimeLeft] = useState('')

  // ── Init bid value — must be > current + 0.1 per Odoo validation ──────────
  useEffect(() => {
    if (!selected) return
    const min = selected.min_bid_percent ?? 3.0
    const cur = selected.current_bid_percent ?? 0
    // Odoo requires: bid_percent >= max(current + 0.1, min_bid_percent)
    const nextMin = parseFloat((Math.max(cur + 0.1, min)).toFixed(1))
    setBidValue(nextMin)
    setBidSuccess(false)
    setBidError(null)
  }, [selected?.id])

  // ── Fetch bids ranking (refresh every 15s) ────────────────────────────────
  useEffect(() => {
    if (!selected) return
    let cancelled = false

    const fetchBids = () => {
      getBids(selected.id)
        .then(data => { if (!cancelled) setBids(data) })
        .catch(() => {})
    }

    fetchBids()
    const iv = setInterval(fetchBids, 15000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [selected?.id])

  // ── Countdown for selected enchere ────────────────────────────────────────
  useEffect(() => {
    if (!selected?.date_end) { setSelectedTimeLeft(''); return }
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(selected.date_end + 'Z') - Date.now()) / 1000))
      if (diff === 0) { setSelectedTimeLeft('Terminée'); return }
      const h = Math.floor(diff / 3600)
      const m = Math.floor((diff % 3600) / 60)
      const s = diff % 60
      setSelectedTimeLeft(
        h > 0
          ? h + 'h ' + String(m).padStart(2, '0') + 'm ' + String(s).padStart(2, '0') + 's'
          : String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
      )
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [selected?.id, selected?.date_end])

  // ── Bid controls ──────────────────────────────────────────────────────────
  const changeBid = (delta) => {
    if (bidValue === null) return
    const min = selected?.min_bid_percent ?? 3.0
    const cur = selected?.current_bid_percent ?? 0
    const floor = parseFloat((Math.max(cur + 0.1, min)).toFixed(1))
    setBidValue(prev => {
      const next = Math.round((prev + delta) * 10) / 10
      return Math.max(floor, Math.min(12.0, next))
    })
  }

  const handlePlaceBid = async () => {
    if (!selected || bidValue === null || !myUid) return
    setBidLoading(true)
    setBidError(null)
    setBidSuccess(false)
    try {
      await placeBid(selected.id, bidValue, myUid)
      setBidSuccess(true)
      // Refresh ranking immediately
      const fresh = await getBids(selected.id)
      setBids(fresh)
      // Update bid floor for next bid
      const min = selected.min_bid_percent ?? 3.0
      const newFloor = parseFloat((Math.max(bidValue + 0.1, min)).toFixed(1))
      setBidValue(newFloor)
    } catch (err) {
      setBidError(err.message || "Erreur lors de l'enchère")
    } finally {
      setBidLoading(false)
    }
  }

  const myUid = user?.uid
  const leadName = selected ? (Array.isArray(selected.lead_id) ? selected.lead_id[1] : '—') : '—'
  const score = selected?.score_maturity ?? 0
  const currentBid = selected?.current_bid_percent ?? selected?.min_bid_percent ?? 0
  const minBid = selected?.min_bid_percent ?? 3.0
  const bidCount = selected?.bid_count ?? bids.length
  const zone = selected?.zone_chalandise ?? '—'

  const myBid = bids.find(b => Array.isArray(b.agent_id) && b.agent_id[0] === myUid)
  const amLeader = bids.length > 0 && bids[0].agent_id?.[0] === myUid

  const estimatedCommission = bidValue
    ? Math.round((selected?.expected_revenue || 0) * bidValue / 100 * 0.7)
    : 0

  const otherEncheres = encheres.filter(e => e.id !== selected?.id)

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="page active">
      <div className="page-inner fade-in enchereLiveContainer">
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Chargement des enchères…
        </div>
      </div>
    </div>
  )

  // ── No active enchere ─────────────────────────────────────────────────────
  if (!selected) return (
    <div className="page active">
      <div className="page-inner fade-in enchereLiveContainer">
        <div className="enchereS1">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/leads')}>← Retour</button>
          <h1 style={{ margin: 0 }}>Enchère Live</h1>
        </div>
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Aucune enchère en cours pour le moment.
        </div>
      </div>
    </div>
  )

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="page active">
      <div className="page-inner fade-in enchereLiveContainer">
        <div className="enchereS1">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/leads')}>← Retour</button>
          <h1 style={{ margin: 0 }}>Enchère Live</h1>
          <span className="bdg bdg-live">🔴 En cours</span>
        </div>

        <div className="grid-2 enchereS2">

          {/* ── Left column ── */}
          <div className="enchereS3">
            <div className="enchereS4">
              <div className="enchereS5">
                <span className="enchereS6">🔴 ENCHÈRE EN COURS</span>
                <div style={{ textAlign: 'right' }}>
                  <div className="enchereS7">Temps restant</div>
                  <div className={'syn enchereS8' + (selectedTimeLeft === 'Terminée' ? ' enchereS8-ended' : '')}>
                    {selectedTimeLeft || '—'}
                  </div>
                </div>
              </div>
              <div className="syn enchereS9">{leadName}</div>
              <div className="enchereS10">📍 {zone}</div>
              <div className="enchereS11">
                <div className="enchereS12">
                  <div className="enchereS13">Score IA</div>
                  <div className="syn enchereS14">{score}%</div>
                </div>
                <div className="enchereS12">
                  <div className="enchereS13">Meilleure offre</div>
                  <div className="syn enchereS15">{currentBid ? currentBid + '%' : '—'}</div>
                </div>
                <div className="enchereS12">
                  <div className="enchereS13">Participants</div>
                  <div className="syn enchereS16">{bidCount}</div>
                </div>
                <div className="enchereS12">
                  <div className="enchereS13">Min. enchère</div>
                  <div className="syn enchereS16">{minBid}%</div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '14px' }}>Mon enchère</h3>

              {amLeader && (
                <div style={{ color: 'var(--green)', fontSize: '13px', marginBottom: '10px' }}>
                  👑 Vous êtes en tête !
                </div>
              )}
              {myBid && !amLeader && (
                <div style={{ color: 'var(--orange)', fontSize: '13px', marginBottom: '10px' }}>
                  ⚠ Vous êtes surenchéri — mise actuelle : {myBid.bid_percent}%
                </div>
              )}

              <div className="bid-ctrl" style={{ marginBottom: '14px' }}>
                <button className="bid-btn" onClick={() => changeBid(-0.1)}
                  disabled={bidLoading || selectedTimeLeft === 'Terminée'}>−</button>
                <div className="bid-display">
                  <div className="bid-num">{bidValue !== null ? bidValue.toFixed(1) : '…'}</div>
                  <div className="bid-unit">% de commission</div>
                </div>
                <button className="bid-btn" onClick={() => changeBid(0.1)}
                  disabled={bidLoading || selectedTimeLeft === 'Terminée'}>+</button>
              </div>

              {bidError && (
                <div style={{ color: 'var(--red, #ef4444)', fontSize: '13px', marginBottom: '10px' }}>
                  ⚠ {bidError}
                </div>
              )}
              {bidSuccess && (
                <div style={{ color: 'var(--green)', fontSize: '13px', marginBottom: '10px' }}>
                  ✅ Enchère placée avec succès !
                </div>
              )}

              <button
                className="btn btn-primary btn-full btn-lg"
                onClick={handlePlaceBid}
                disabled={bidLoading || bidValue === null || selectedTimeLeft === 'Terminée'}
                style={{ opacity: selectedTimeLeft === 'Terminée' ? 0.5 : 1 }}
              >
                {bidLoading ? 'Envoi…' : selectedTimeLeft === 'Terminée' ? '⛔ Enchère terminée' : '⚡ Placer cette enchère'}
              </button>

              {estimatedCommission > 0 && (
                <div className="enchereS17">
                  Commission estimée : <span className="enchereS18">{fmtCurrency(estimatedCommission)}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Right column ── */}
          <div className="card enchereRankingCard">
            <h3 style={{ marginBottom: '16px' }}>Classement des offres</h3>

            {bids.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '8px 0' }}>
                Aucune offre pour le moment
              </div>
            ) : bids.map((bid, idx) => {
              const agentName = Array.isArray(bid.agent_id) ? bid.agent_id[1] : 'Agent'
              const isMe = Array.isArray(bid.agent_id) && bid.agent_id[0] === myUid
              const isLeader = idx === 0
              return (
                <div key={bid.id || idx} className={'part-row' + (isLeader ? ' leader' : '')}>
                  <div className={'enchereS' + (19 + Math.min(idx, 6))}>{initials(agentName)}</div>
                  <div style={{ flex: 1 }}>
                    <div className="enchereS20">
                      {agentName} {isMe && <span className="enchereS7">(moi)</span>}
                    </div>
                  </div>
                  <div className={'syn ' + (isLeader ? 'enchereS22' : 'enchereS21')}>
                    {bid.bid_percent}%
                  </div>
                  {isLeader && <span style={{ fontSize: '16px' }}>👑</span>}
                </div>
              )
            })}

            {/* Other encheres */}
            {otherEncheres.length > 0 && (
              <div className="enchereS26">
                <h3 style={{ marginBottom: '12px' }}>Autres enchères disponibles</h3>
                <div className="enchereS27">
                  {otherEncheres.map(enc => {
                    const name = Array.isArray(enc.lead_id) ? enc.lead_id[1] : '—'
                    const sc = enc.score_maturity ?? 0
                    const isHot = sc >= 70
                    const cdDisplay = enc === nextEnchere ? timeLeft : '—'
                    return (
                      <div key={enc.id}
                        className={'lead-row ' + (isHot ? 'hot' : 'warm')}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedId(enc.id)}>
                        <div className="lav enchereS28">{initials(name)}</div>
                        <div className="linfo">
                          <div className="lname" style={{ fontSize: '13px' }}>{name}</div>
                          <div className="lmeta">{enc.zone_chalandise ?? '—'} · {sc}%</div>
                        </div>
                        <div className="enchereS7">⏱ {cdDisplay}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default EnchèreLiveComponent