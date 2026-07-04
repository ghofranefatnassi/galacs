import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import "../../assets/styles/style.css"
import Logo from '../../assets/images/1.png'
import { useAgentAuth } from '../../contexts/AgentAuthContext'

function initials(name = '') {
  return name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

const Sidebar = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAgentAuth()

  const agentName  = user?.name  || 'Agent'
  const agentEmail = user?.username || ''
  const agentCity  = user?.tz || ''
  const agentInitials = initials(agentName)

  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', path: '/tableau-de-bord', icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ) },
    { id: 'leads', label: 'Leads & Enchères', path: '/leads', badge: '3', icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ) },
    { id: 'pipeline', label: 'Mon Pipeline', path: '/pipeline', dot: true, icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ) }
  ]

  const toolItems = [
    { id: 'crm', label: 'CRM Privé', path: '/crm', lock: true, icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ) },
    { id: 'notifications', label: 'Notifications', path: '/notifications', badge: '3', icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ) }
  ]

  const accountItems = [
    { id: 'profile', label: 'Mon Profil', path: '/profile', icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ) },
    { id: 'settings', label: 'Paramètres', path: '/parametres', icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ) }
  ]

  const isActive = (path) => location.pathname === path

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <div id="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">
          <img src={Logo} alt="Galacs Logo" width="30" height="30" style={{ objectFit: 'contain' }} />
        </div>
        <div>
          <div className="logo-text" style={{
            background: 'linear-gradient(90deg, rgba(0,24,51,1) 0%, rgba(102,33,114,1) 25%, rgba(255,103,31,1) 50%, rgba(141,33,102,1) 75%, rgba(0,24,51,1) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>GALACS.IO</div>
          <div className="logo-sub">Espace Agent</div>
        </div>
      </div>

      <div className="agent-card" onClick={() => navigate('/profile')}>
        <div className="ag-av">{agentInitials}</div>
        <div>
          <div className="ag-name">{agentName}</div>
          <div className="ag-role">Agent{agentCity ? ` · ${agentCity}` : ''}</div>
        </div>
      </div>

      <div className="nav-section">
        <div className="nav-label">Principal</div>
        {navItems.map(item => (
          <div key={item.id} className={`nav-item ${isActive(item.path) ? 'active' : ''}`} onClick={() => navigate(item.path)}>
            {item.icon}
            {item.label}
            {item.badge && <span className="nav-badge">{item.badge}</span>}
            {item.dot && <span className="nav-dot"></span>}
          </div>
        ))}

        <div className="nav-label">Outils</div>
        {toolItems.map(item => (
          <div key={item.id} className={`nav-item ${isActive(item.path) ? 'active' : ''}`} onClick={() => navigate(item.path)}>
            {item.icon}
            {item.label}
            {item.lock && (
              <svg className="nav-icon" style={{ marginLeft: 'auto', width: '13px', height: '13px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            )}
            {item.badge && <span className="nav-badge">{item.badge}</span>}
          </div>
        ))}

        <div className="nav-label">Compte</div>
        {accountItems.map(item => (
          <div key={item.id} className={`nav-item ${isActive(item.path) ? 'active' : ''}`} onClick={() => navigate(item.path)}>
            {item.icon}
            {item.label}
          </div>
        ))}
      </div>

      <div className="sidebar-bottom">
        <div className="nav-item logout" onClick={handleLogout}>
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Déconnexion
        </div>
      </div>
    </div>
  )
}

export default Sidebar