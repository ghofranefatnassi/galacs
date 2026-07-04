import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAgentAuth } from './AgentAuthContext'
import { subscribeBus, getNotifications } from '../services/odooApi'

const NotificationContext = createContext(null)

const EVENT_CONFIG = {
  new_lead:       { icon: '🔥', title: 'Nouveau lead dans votre zone' },
  auction_start:  { icon: '⚡', title: 'Enchère démarrée' },
  new_bid:        { icon: '⚡', title: 'Surenchère détectée !' },
  auction_end:    { icon: '🏆', title: 'Enchère terminée' },
  auction_won:    { icon: '🏆', title: 'Enchère remportée !' },
  followup_72h:   { icon: '⏰', title: 'Rappel suivi obligatoire' },
  sale_validated: { icon: '✅', title: 'Vente validée !' },
  sale_rejected:  { icon: '❌', title: 'Vente rejetée' },
  no_bids:        { icon: '📭', title: 'Enchère sans mise' },
}

export function NotificationProvider({ children }) {
  const { user } = useAgentAuth()
  const uid = user?.uid

  const [unreadCount, setUnreadCount] = useState(0)
  const [toasts,      setToasts]      = useState([])

  // ── Load unread count on mount ────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return
    const readIds = new Set(JSON.parse(localStorage.getItem('galacs_read_notifs') || '[]'))
    getNotifications(uid, 50)
      .then((records) => {
        const unread = records.filter((r) => !readIds.has(`odoo-${r.id}`)).length
        setUnreadCount(unread)
      })
      .catch(() => {})
  }, [uid])

  // ── Show toast ────────────────────────────────────────────────────────────
  const showToast = useCallback((payload) => {
    const type = payload.type
    const cfg  = EVENT_CONFIG[type] || { icon: '📢', title: type }
    const id   = `toast-${Date.now()}`

    setToasts((prev) => [...prev, { id, icon: cfg.icon, title: cfg.title }])
    setUnreadCount((prev) => prev + 1)

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  // ── Real-time: longpolling in prod, 30s polling in dev ────────────────────
  useEffect(() => {
    if (!uid) return
    if (Notification.permission === 'default') Notification.requestPermission()

    if (process.env.NODE_ENV === 'production') {
      // Production: real longpolling via Odoo bus
      const stop = subscribeBus(uid, showToast)
      return () => stop()
    } else {
      // Dev: poll every 30s — proxy doesn't support long-lived connections
      const readIds = new Set(JSON.parse(localStorage.getItem('galacs_read_notifs') || '[]'))
      let lastCount = 0

      const interval = setInterval(() => {
        getNotifications(uid, 50)
          .then((records) => {
            const unread = records.filter((r) => !readIds.has(`odoo-${r.id}`)).length
            if (unread > lastCount) {
              const newOnes = records.slice(0, unread - lastCount)
              newOnes.forEach((r) => showToast({ type: r.event_type, ...r.payload }))
            }
            lastCount = unread
            setUnreadCount(unread)
          })
          .catch(() => {})
      }, 30000)

      return () => clearInterval(interval)
    }
  }, [uid, showToast])

  const resetUnread  = useCallback(() => setUnreadCount(0), [])
  const dismissToast = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), [])

  return (
    <NotificationContext.Provider value={{ unreadCount, toasts, resetUnread, dismissToast }}>
      {children}
    </NotificationContext.Provider>
  )
}

export const useNotifications = () => useContext(NotificationContext)