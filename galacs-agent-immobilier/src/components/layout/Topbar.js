import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import '../../assets/styles/style.css'
import './Topbar.css'
import { useAgentAuth } from '../../contexts/AgentAuthContext'
import { useActiveEncheres } from '../../hooks/Useactiveencheres'
import { useNotifications } from '../../contexts/NotificationProvider'

function initials(name = '') {
  return name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

const getTitleFromPath = (path) => {
  const titleMap = {
    '/tableau-de-bord': 'Tableau de bord',
    '/leads': 'Leads & Enchères',
    '/leads/fichier_leads': 'Fiche Lead',
    '/leads/enchère_live': 'Enchère Live',
    '/pipeline': 'Mon Pipeline',
    '/pipeline/declarer_vente': 'Déclarer la Vente',
    '/pipeline/status': 'Mise à jour statut',
    '/crm': 'CRM Privé',
    '/crm/contact_detail': 'Fiche Contact',
    '/crm/nouvelle_contact': 'Nouveau Contact',
    '/crm/modifier-contact': 'Modifier Contact',
    '/notifications': 'Notifications',
    '/profile': 'Mon Profil',
    '/parametres': 'Paramètres',
    '/parametres/edit-profile': 'Éditer mon profil'
  }
  return titleMap[path] || 'Tableau de bord'
}

const Topbar = () => {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user }  = useAgentAuth()
  const { encheres, timeLeft } = useActiveEncheres()
  const { unreadCount, toasts, resetUnread, dismissToast } = useNotifications()

  const agentInitials  = initials(user?.name || '')
  const liveCount      = encheres.length
  const currentTitle   = getTitleFromPath(location.pathname)

  const handleNotifClick = () => {
    resetUnread()
    navigate('/notifications')
  }

  return (
    <>
      {/* ── Toasts ─────────────────────────────────────────────────────── */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast-item" onClick={() => { dismissToast(toast.id); navigate('/notifications') }}>
            <span className="toast-icon">{toast.icon}</span>
            <span className="toast-title">{toast.title}</span>
            <button className="toast-close" onClick={(e) => { e.stopPropagation(); dismissToast(toast.id) }}>×</button>
          </div>
        ))}
      </div>

      {/* ── Topbar ─────────────────────────────────────────────────────── */}
      <div id="topbar">
        <div className="topbar-title">{currentTitle}</div>
        <div className="topbar-right">
          {liveCount > 0 && (
            <div className="topbar-badge" onClick={() => navigate('/leads')}>
              <span className="live-dot"></span>
              {liveCount} enchère{liveCount > 1 ? 's' : ''} active{liveCount > 1 ? 's' : ''} ·
              <span id="cd-top" style={{ fontWeight: '700', marginLeft: '4px' }}>{timeLeft}</span>
            </div>
          )}

          {/* Cloche avec badge */}
          <div className="topbar-btn notif-bell" onClick={handleNotifClick}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A96B0" strokeWidth="2">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </div>

          <div className="topbar-btn" onClick={() => navigate('/profile')}>
            <div className="topS1">{agentInitials || '?'}</div>
          </div>
        </div>
      </div>
    </>
  )
}

export default Topbar