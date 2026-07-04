import React, { useState, useEffect, useCallback, useRef } from 'react'
import '../../assets/styles/style.css'
import './Notifications.css'
import { useNavigate } from 'react-router-dom'
import { useAgentAuth } from '../../contexts/AgentAuthContext'
import { getNotifications, subscribeBus } from '../../services/odooApi'

// ── Config ────────────────────────────────────────────────────────────────────
const EVENT_CONFIG = {
  new_lead:       { icon: '🔥', bg: 'rgba(239,68,68,.1)',   title: 'Nouveau lead dans votre zone' },
  auction_start:  { icon: '⚡', bg: 'rgba(245,158,11,.12)', title: 'Enchère démarrée' },
  new_bid:        { icon: '⚡', bg: 'rgba(245,158,11,.12)', title: 'Surenchère détectée !' },
  auction_end:    { icon: '🏆', bg: 'rgba(124,58,237,.12)', title: 'Enchère terminée' },
  auction_won:    { icon: '🏆', bg: 'rgba(124,58,237,.12)', title: 'Enchère remportée !' },
  followup_72h:   { icon: '⏰', bg: 'rgba(239,68,68,.1)',   title: 'Rappel suivi obligatoire' },
  sale_validated: { icon: '✅', bg: 'rgba(34,197,94,.1)',   title: 'Vente validée !' },
  sale_rejected:  { icon: '❌', bg: 'rgba(239,68,68,.1)',   title: 'Vente rejetée' },
  no_bids:        { icon: '📭', bg: 'rgba(107,114,128,.1)', title: 'Enchère sans mise' },
}

function buildMessage(type, payload) {
  if (!payload) return ''
  const p = typeof payload === 'string' ? JSON.parse(payload) : payload
  switch (type) {
    case 'new_lead':      return `Score ${p.score}%, zone ${p.zone}. Enchère dans 5 min.`
    case 'auction_start': return `${p.lead_name} — Zone ${p.zone}. Commission min. ${p.min_bid}%.`
    case 'new_bid':       return `Nouvelle mise à ${p.new_bid}% sur l'enchère #${p.enchere_id}.`
    case 'auction_won':   return `Remporté avec ${p.commission}% de commission. 72h pour contacter.`
    case 'followup_72h':  return `${p.lead_name} — Mise à jour de statut requise.`
    case 'sale_validated':return `Vente validée. Commission en cours de traitement.`
    case 'sale_rejected': return `Déclaration rejetée. Contactez l'administrateur.`
    default:              return typeof p === 'object' ? JSON.stringify(p) : String(p)
  }
}

function getRoute(type) {
  const routes = {
    new_lead: '/leads', auction_start: '/leads/enchère_live',
    new_bid: '/leads/enchère_live', auction_won: '/leads',
    followup_72h: '/pipeline', sale_validated: '/pipeline/declarer_vente',
    sale_rejected: '/pipeline/declarer_vente',
  }
  return routes[type] || '/notifications'
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000
  if (diff < 60)    return 'À l\'instant'
  if (diff < 3600)  return `Il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`
  return 'Hier'
}

// ── Composant ─────────────────────────────────────────────────────────────────
const NotificationsComponent = () => {
  const navigate = useNavigate()
  const { user } = useAgentAuth() // uid vient du contexte auth
  const uid = user?.uid

  const [notifications, setNotifications] = useState([])
  const [loading, setLoading]             = useState(true)
  const [readIds, setReadIds]             = useState(() => {
    const saved = localStorage.getItem('galacs_read_notifs')
    return saved ? new Set(JSON.parse(saved)) : new Set()
  })

  // ── Charger l'historique depuis Odoo au montage ───────────────────────────
  useEffect(() => {
    if (!uid) return
    setLoading(true)
    getNotifications(uid, 30)
      .then((records) => {
        setNotifications(records.map((r) => ({
          id: `odoo-${r.id}`,
          type: r.event_type,
          payload: r.payload,
          date: r.create_date,
          live: false,
        })))
      })
      .catch((e) => console.error('[Galacs] Erreur chargement notifs:', e))
      .finally(() => setLoading(false))
  }, [uid])

  // ── Écouter le bus Odoo en temps réel ─────────────────────────────────────
  const handleBusMessage = useCallback((payload) => {
    const type = payload.type
    const newNotif = {
      id: `live-${Date.now()}`,
      type,
      payload,
      date: new Date().toISOString(),
      live: true,
    }
    setNotifications((prev) => [newNotif, ...prev])

    // Notification navigateur native
    if (Notification.permission === 'granted') {
      const cfg = EVENT_CONFIG[type] || {}
      new Notification(`Galacs.io — ${cfg.title || type}`, {
        body: buildMessage(type, payload),
        icon: '/favicon.ico',
      })
    }
  }, [])

  useEffect(() => {
    if (!uid) return
    // Demander permission notifications navigateur
    if (Notification.permission === 'default') Notification.requestPermission()
    // S'abonner au bus
    const stop = subscribeBus(uid, handleBusMessage)
    return () => stop()
  }, [uid, handleBusMessage])

  // ── Marquer comme lu (local uniquement) ───────────────────────────────────
  const markRead = useCallback((id) => {
    setReadIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      localStorage.setItem('galacs_read_notifs', JSON.stringify([...next]))
      return next
    })
  }, [])

  const markAllRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set([...prev, ...notifications.map((n) => n.id)])
      localStorage.setItem('galacs_read_notifs', JSON.stringify([...next]))
      return next
    })
  }, [notifications])

  const handleClick = (notif) => {
    markRead(notif.id)
    navigate(getRoute(notif.type))
  }

  // ── Grouper par jour ──────────────────────────────────────────────────────
  const now = Date.now()
  const todayNotifs     = notifications.filter((n) => now - new Date(n.date) < 86400000)
  const yesterdayNotifs = notifications.filter((n) => {
    const d = now - new Date(n.date)
    return d >= 86400000 && d < 172800000
  })
  const olderNotifs = notifications.filter((n) => now - new Date(n.date) >= 172800000)

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length

  const renderNotif = (notif) => {
    const cfg  = EVENT_CONFIG[notif.type] || { icon: '📢', bg: 'rgba(107,114,128,.1)', title: notif.type }
    const read = readIds.has(notif.id)
    const msg  = buildMessage(notif.type, notif.payload)
    return (
      <div
        key={notif.id}
        className={`notif-item${read ? '' : ' unread'}${notif.live ? ' notif-live' : ''}`}
        onClick={() => handleClick(notif)}
      >
        <div className="notif-icon" style={{ background: cfg.bg }}>{cfg.icon}</div>
        <div style={{ flex: 1 }}>
          <div className="notifS3">{cfg.title}</div>
          <div className="notifS4">{msg}</div>
          <div className="notifS5">{timeAgo(notif.date)}</div>
        </div>
        {!read && <div className="unread-dot"></div>}
      </div>
    )
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="page active">
      <div className="page-inner fade-in">
        <div className="notifS1">
          <div>
            <h1>Notifications</h1>
            <p className="page-subtitle">
              {loading
                ? 'Chargement...'
                : unreadCount > 0
                  ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`
                  : 'Tout lu'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={markAllRead}>
              Tout marquer comme lu
            </button>
          )}
        </div>

        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Chargement des notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Aucune notification pour le moment
            </div>
          ) : (
            <>
              {todayNotifs.length > 0 && (
                <>
                  <div className="notifS2">Aujourd'hui</div>
                  {todayNotifs.map(renderNotif)}
                </>
              )}
              {yesterdayNotifs.length > 0 && (
                <>
                  <div className="notifS6">Hier</div>
                  {yesterdayNotifs.map(renderNotif)}
                </>
              )}
              {olderNotifs.length > 0 && (
                <>
                  <div className="notifS6">Plus ancien</div>
                  {olderNotifs.map(renderNotif)}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default NotificationsComponent