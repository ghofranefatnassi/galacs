import React, { useState, useEffect, useCallback } from 'react'
import { useAgentAuth } from '../../contexts/AgentAuthContext'
import { callModel, getAgentProfile } from '../../services/odooApi'
import '../../assets/styles/style.css'
import './Profile.css'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const initials = (name = '') => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
const fmtEur   = (n) => Math.round(n || 0).toLocaleString('fr-FR') + '€'
const fmtDate  = (s) => s ? new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const monthName = () => new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

// ─── Badges définis côté frontend ────────────────────────────────────────────
const BADGE_DEFINITIONS = [
  { key: 'leads_10',     icon: '🔥', label: '10 leads gagnés',   minLeads: 10  },
  { key: 'top_q1',       icon: '⭐', label: 'Top Agent Q1',      minLeads: 0   },
  { key: 'premier_trim', icon: '🚀', label: 'Premier trimestre', minLeads: 0   },
  { key: 'ventes_20',    icon: '🎯', label: '20 ventes',         minVentes: 20 },
  { key: 'platine',      icon: '💎', label: 'Platine',           minVentes: 50 },
]

// ─── Commission states valides ────────────────────────────────────────────────
const COMMISSION_STATES = ['calculee', 'validated', 'paid']

// ─── Fetch toutes les données en parallèle ────────────────────────────────────
async function fetchAgentStats(uid) {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

  const [
    profile,
    activeLeads,
    ventesMonth,
    commissionsMonth,
    allCommissions,
    odoBadges,
    ranking,
    totalVentes,
  ] = await Promise.all([

    // Profil agent
    getAgentProfile(),

    // Leads actifs (hors won)
    callModel('crm.lead', 'search_read',
      [[['user_id', '=', uid], ['active', '=', true], ['probability', 'not in', [0, 100]]]],
      { fields: ['id'], limit: 100 }
    ),

    // Ventes du mois
    callModel('galacs.vente', 'search_read',
      [[['agent_id', '=', uid], ['date_signature', '>=', firstDay], ['state', 'in', ['validated', 'pending_admin']]]],
      { fields: ['id', 'lead_id', 'prix_vente', 'date_signature', 'state'], order: 'date_signature desc' }
    ),

    // Commissions du mois
    callModel('galacs.commission', 'search_read',
      [[['agent_id', '=', uid], ['create_date', '>=', firstDay], ['state', 'in', COMMISSION_STATES]]],
      { fields: ['montant_agent', 'state'] }
    ),

    // Historique commissions (10 dernières)
    callModel('galacs.commission', 'search_read',
      [[['agent_id', '=', uid], ['state', 'in', COMMISSION_STATES]]],
      { fields: ['id', 'montant_agent', 'lead_id', 'create_date', 'state', 'prix_vente'], order: 'create_date desc', limit: 10 }
    ),

    // Badges gamification Odoo
    callModel('galacs.badge.agent', 'search_read',
      [[['agent_id', '=', uid]]],
      { fields: ['badge_id', 'description'] }
    ).catch(() => []),

    // Classement agents
    callModel('res.users', 'search_read',
      [[['share', '=', false], ['active', '=', true]]],
      { fields: ['id', 'name', 'galacs_score_performance'], limit: 10, order: 'galacs_score_performance desc' }
    ).catch(() => []),

    // Total ventes all-time pour badges
    callModel('galacs.vente', 'search_read',
      [[['agent_id', '=', uid], ['state', 'in', ['validated', 'pending_admin', 'done']]]],
      { fields: ['id'] }
    ).catch(() => []),
  ])

  const commissionsMois = commissionsMonth.reduce((s, c) => s + (c.montant_agent || 0), 0)

  return {
    profile,
    activeLeads:    activeLeads.length,
    ventesMonth,
    commissionsMois,
    objectifMois:   20000,
    allCommissions,
    odoBadges,
    ranking,
    totalVentes:    totalVentes.length,
  }
}

// ─── State label helper ───────────────────────────────────────────────────────
const stateLabel = (state) => {
  switch (state) {
    case 'paid':      return '✓ Payé'
    case 'validated': return '✓ Validé'
    case 'calculee':  return '🔄 Calculée'
    default:          return state
  }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skel = ({ h = 20, w = '100%', radius = 6 }) => (
  <div style={{ height: h, width: w, background: '#2a2a3a', borderRadius: radius, marginBottom: 8 }} />
)

// ─── Composant ────────────────────────────────────────────────────────────────
const ProfileComponent = () => {
  const { user } = useAgentAuth()
  const uid = user?.uid

  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    if (!uid) return
    setLoading(true)
    setError(null)
    try {
      setStats(await fetchAgentStats(uid))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [uid])

  useEffect(() => { load() }, [load])

  // ── Données dérivées ────────────────────────────────────────────────────────
  const profile     = stats?.profile
  const agentName   = profile?.name || user?.name || 'Agent'
  const agentZone   = profile?.galacs_zone || 'Lyon & Bordeaux'
  const commMois    = stats?.commissionsMois || 0
  const objectif    = stats?.objectifMois    || 20000
  const pct         = Math.min(100, Math.round((commMois / objectif) * 100))
  const ventesCount = stats?.ventesMonth?.length || 0
  const leadsActifs = stats?.activeLeads || 0
  const perfScore   = profile?.galacs_score_performance || 0
  const totalVentes = stats?.totalVentes || 0

  // Badges : earned si conditions remplies OU badge Odoo correspondant
  const earnedOdoo  = new Set((stats?.odoBadges || []).map(b => b.badge_id?.[1] || b.description))
  const badgeStatus = BADGE_DEFINITIONS.map(b => ({
    ...b,
    earned: earnedOdoo.has(b.label)
      || (b.minLeads  && leadsActifs  >= b.minLeads)
      || (b.minVentes && totalVentes  >= b.minVentes),
  }))

  // Classement — filtrer les users sans score
  const ranking = (stats?.ranking || []).filter(u => u.galacs_score_performance > 0).slice(0, 5)
  const myRank  = ranking.findIndex(u => u.id === uid)
  const rankMedals = ['🥇', '🥈', '🥉']

  if (error) return (
    <div className="page active">
      <div className="page-inner fade-in" style={{ textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <p style={{ color: 'var(--orange)' }}>{error}</p>
        <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={load}>Réessayer</button>
      </div>
    </div>
  )

  return (
    <div className="page active">
      <div className="page-inner fade-in">
        <h1 style={{ marginBottom: '6px' }}>Mon Profil</h1>
        <p className="page-subtitle">Tableau de chasse & performance</p>

        <div className="grid-2" style={{ marginBottom: '20px' }}>

          {/* ── Colonne gauche : identité ── */}
          <div className="profileS1">
            <div className="profileS2"></div>

            {loading ? (
              <>
                <Skel h={72} w={72} radius={36} />
                <Skel h={20} /><Skel h={14} /><Skel h={30} /><Skel h={50} />
              </>
            ) : (
              <>
                <div className="profileS3">
                  {profile?.image_1920
                    ? <img src={`data:image/png;base64,${profile.image_1920}`} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    : initials(agentName)
                  }
                  <span className="profileS4"></span>
                </div>

                <div className="syn profileS5">{agentName}</div>
                <div className="profileS6">Agent Immobilier · {agentZone}</div>

                <div className="profileS7">
                  {myRank === 0 && <span className="bdg bdg-won">🥇 #1 {agentZone.split('&')[0].trim()}</span>}
                  {myRank > 0 && myRank <= 2 && <span className="bdg bdg-won">{rankMedals[myRank]} #{myRank + 1} {agentZone.split('&')[0].trim()}</span>}
                  <span className="bdg bdg-ok">✅ Certifié</span>
                  {perfScore > 0 && <span className="bdg profileS8">⭐ {perfScore}% perf.</span>}
                </div>

                <div className="profileS9">
                  <div className="profileS10">
                    <span>Commissions {monthName()}</span>
                    <span className="syn profileS11">{fmtEur(commMois)} / {fmtEur(objectif)}</span>
                  </div>
                  <div className="pbar">
                    <div className="pfill" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Colonne droite ── */}
          <div className="profileS12">

            {/* Stats */}
            <div className="grid-3" style={{ gap: '12px' }}>
              {loading ? (
                [1, 2, 3].map(i => <div key={i} className="stat-card purple" style={{ padding: '16px' }}><Skel h={60} /></div>)
              ) : (
                <>
                  <div className="stat-card green" style={{ padding: '16px' }}>
                    <div className="profileS13">🎯</div>
                    <div className="stat-val profileS14">{leadsActifs}</div>
                    <div className="stat-lbl">Leads actifs</div>
                  </div>
                  <div className="stat-card orange" style={{ padding: '16px' }}>
                    <div className="profileS13">✅</div>
                    <div className="stat-val profileS15">{ventesCount}</div>
                    <div className="stat-lbl">Ventes {new Date().toLocaleDateString('fr-FR', { month: 'long' })}</div>
                  </div>
                  <div className="stat-card purple" style={{ padding: '16px' }}>
                    <div className="profileS13">🏆</div>
                    <div className="stat-val profileS16">
                      {commMois >= 1000 ? Math.round(commMois / 1000) + 'k€' : fmtEur(commMois)}
                    </div>
                    <div className="stat-lbl">Commission</div>
                  </div>
                </>
              )}
            </div>

            {/* Badges */}
            <div className="card">
              <h3 style={{ marginBottom: '14px' }}>🏆 Badges & Récompenses</h3>
              {loading ? <Skel h={40} /> : (
                <div className="profileS17">
                  {badgeStatus.map(b => (
                    <div key={b.key} className={`bchip ${b.earned ? 'on' : 'locked'}`}>
                      {b.icon} {b.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Classement */}
            <div className="card">
              <h3 style={{ marginBottom: '14px' }}>Classement {agentZone.split('&')[0].trim()}</h3>
              {loading ? (
                [1, 2, 3].map(i => <Skel key={i} h={48} />)
              ) : ranking.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>Classement non disponible</div>
              ) : ranking.map((agent, i) => {
                const isMe = agent.id === uid
                return (
                  <div key={agent.id} className="rank-row" style={{ background: isMe ? 'rgba(124,58,237,.06)' : 'transparent', borderRadius: isMe ? 8 : 0, padding: isMe ? '10px 8px' : undefined }}>
                    <div className={`rank-num ${i === 0 ? 'gold' : ''}`}>{rankMedals[i] || i + 1}</div>
                    <div className="profileS18" style={{ background: ['#7c3aed','#059669','#d97706','#dc2626','#0891b2'][i] || '#7c3aed' }}>
                      {initials(agent.name)}
                    </div>
                    <div className="profileS19">
                      <div className="profileS20">
                        {agent.name}
                        {isMe && <span className="profileS21"> (vous)</span>}
                      </div>
                    </div>
                    <div className="syn profileS22">{agent.galacs_score_performance || 0}%</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Historique commissions ── */}
        <div className="card">
          <div className="profile26">
            <h3>Historique des commissions</h3>
            {!loading && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{stats?.allCommissions?.length || 0} entrées</span>}
          </div>

          {loading ? <Skel h={120} /> : (stats?.allCommissions || []).length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
              Aucune commission enregistrée pour le moment.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Prospect</th>
                  <th>Prix de vente</th>
                  <th>Commission</th>
                  <th>Date</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {stats.allCommissions.map((c) => (
                  <tr key={c.id}>
                    <td>{c.lead_id?.[1] || `Commission #${c.id}`}</td>
                    <td className="syn" style={{ fontWeight: 700 }}>{fmtEur(c.prix_vente)}</td>
                    <td className="syn profile27">+{fmtEur(c.montant_agent)}</td>
                    <td style={{ color: 'var(--muted)' }}>{fmtDate(c.create_date)}</td>
                    <td>
                      <span className="bdg bdg-ok" style={{ fontSize: '10px' }}>
                        {stateLabel(c.state)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  )
}

export default ProfileComponent