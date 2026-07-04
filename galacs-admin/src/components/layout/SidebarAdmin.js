import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Logo from '../../assets/images/1.png';
import { useAuth } from '../../contexts/AuthContext';
import { getAdminProfile, callModel } from '../../services/odooApi';

// ── Read tracking (same key as AdminNotification) ─────────────────────────────
const LS_KEY     = 'galacs_admin_read_notif_ids';
const getReadIds = () => { try { return new Set(JSON.parse(localStorage.getItem(LS_KEY) || '[]')); } catch { return new Set(); } };

const SidebarAdmin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();

  const [adminName, setAdminName]     = useState('ADMIN');
  const [avatarImage, setAvatarImage] = useState(null);

  // ── Live badge counts ──────────────────────────────────────────────────────
  const [enchereCount, setEnchereCount]   = useState(0); // open auctions
  const [leadCount, setLeadCount]         = useState(0); // total active leads
  const [venteCount, setVenteCount]       = useState(0); // pending validation
  const [agentCount, setAgentCount]       = useState(0); // active agents
  const [unreadCount, setUnreadCount]     = useState(0); // unread notifications

  // ── Load admin profile ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    getAdminProfile()
      .then((data) => {
        const fullName  = data.name || '';
        const cleanName = fullName.includes(',')
          ? fullName.split(',').slice(1).join(',').trim()
          : fullName;
        setAdminName(cleanName || 'ADMIN');
        if (data.image_1920) {
          setAvatarImage(`data:image/png;base64,${data.image_1920}`);
        }
      })
      .catch(() => {});
  }, [user]);

  // ── Load badge counts ──────────────────────────────────────────────────────
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [encheres, leads, ventes, agents, notifs] = await Promise.all([
          // Open auctions
          callModel('galacs.enchere', 'search_count', [[['state', '=', 'open']]]),
          // Active leads (not won/lost)
          callModel('crm.lead', 'search_count', [[['active', '=', true], ['galacs_stage', 'not in', ['won', 'lost']]]]),
          // Ventes pending admin validation
          callModel('galacs.vente', 'search_count', [[['state', '=', 'pending_admin']]]),
          // Active agents in group 20
          callModel('res.users', 'search_count', [[['active', '=', true], ['groups_id', 'in', [20]]]]),
          // All notifications (to compute unread)
          callModel('galacs.notification', 'search_read',
            [[['event_type', 'not in', ['auction_won', 'sale_validated', 'sale_rejected']]]],
            { fields: ['id'], limit: 200 }
          ),
        ]);

        setEnchereCount(encheres || 0);
        setLeadCount(leads || 0);
        setVenteCount(ventes || 0);
        setAgentCount(agents || 0);

        // Compute unread from localStorage
        const readIds = getReadIds();
        const unread  = (Array.isArray(notifs) ? notifs : [])
          .filter(n => !readIds.has(n.id)).length;
        setUnreadCount(unread);

      } catch (err) {
        console.error('Sidebar counts error:', err);
      }
    };

    fetchCounts();
    // Refresh every 60s so badges stay live without a full page reload
    const interval = setInterval(fetchCounts, 60000);
    return () => clearInterval(interval);
  }, []);

  // ── Also refresh unread count when localStorage changes (mark-as-read) ────
  useEffect(() => {
    const onStorage = () => {
      callModel('galacs.notification', 'search_read',
        [[['event_type', 'not in', ['auction_won', 'sale_validated', 'sale_rejected']]]],
        { fields: ['id'], limit: 200 }
      ).then(notifs => {
        const readIds = getReadIds();
        setUnreadCount((Array.isArray(notifs) ? notifs : []).filter(n => !readIds.has(n.id)).length);
      }).catch(() => {});
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // ── Routing ────────────────────────────────────────────────────────────────
  const routeMap = {
    'p-dashboard':   '/tableau-de-bord',
    'p-rapports':    '/analyse',
    'p-encheres':    '/enchere',
    'p-leads':       '/gestion-leads',
    'p-ventes':      '/ventes',
    'p-agents':      '/agents',
    'p-new-agent':   '/agents/ajouter-agent',
    'p-commissions': '/commissions',
    'p-notifs':      '/notification',
    'p-param':       '/parametre',
  };

  const isActive = (pageId) => {
    const path = routeMap[pageId];
    return path ? location.pathname === path : false;
  };
  const goTo = (pageId) => navigate(routeMap[pageId]);

  // ── Badge helper ───────────────────────────────────────────────────────────
  const Badge = ({ count, color }) => {
    if (!count || count === 0) return null;
    return (
      <span className={`ni-badge ${color}`}>
        {count > 99 ? '99+' : count}
      </span>
    );
  };

  return (
    <div id="sidebar">
      <div className="sidebar-logo">
        <img src={Logo} alt="Galacs Logo" width="30" height="30" style={{ objectFit: 'contain' }} />
        <div>
          <div className="logo-txt" style={{
            background: 'linear-gradient(90deg, rgba(0,24,51,1) 0%, rgba(102,33,114,1) 25%, rgba(255,103,31,1) 50%, rgba(141,33,102,1) 75%, rgba(0,24,51,1) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>GALACS.IO</div>
          <div className="logo-sub-txt">Panneau d'administration</div>
        </div>
      </div>

      {/* Admin pill */}
      <div className="admin-pill" onClick={() => goTo('p-param')}>
        <div className="adm-av" style={{ overflow: 'hidden' }}>
          {avatarImage
            ? <img src={avatarImage} alt="avatar"
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            : '👨‍💼'}
        </div>
        <div>
          <div className="adm-name">{adminName}</div>
          <div className="adm-role">🛡️ Administrateur</div>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: '14px' }}>⚙️</span>
      </div>

      <div className="nav-scroll">
        <div className="nav-label">Vue d'ensemble</div>
        <div className={`ni ${isActive('p-dashboard') ? 'active' : ''}`} onClick={() => goTo('p-dashboard')}>
          <svg className="ni-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          Tableau de bord
        </div>
        <div className={`ni ${isActive('p-rapports') ? 'active' : ''}`} onClick={() => goTo('p-rapports')}>
          <svg className="ni-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Rapports & Analytics
        </div>

        <div className="nav-label">Marché</div>
        <div className={`ni ${isActive('p-encheres') ? 'active' : ''}`} onClick={() => goTo('p-encheres')}>
          <svg className="ni-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          Enchères
          <Badge count={enchereCount} color="orange" />
        </div>
        <div className={`ni ${isActive('p-leads') ? 'active' : ''}`} onClick={() => goTo('p-leads')}>
          <svg className="ni-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
          Gestion des Leads
          <Badge count={leadCount} color="purple" />
        </div>
        <div className={`ni ${isActive('p-ventes') ? 'active' : ''}`} onClick={() => goTo('p-ventes')}>
          <svg className="ni-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 11 12 14 22 4" />
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
          Validation Ventes
          <Badge count={venteCount} color="red" />
        </div>

        <div className="nav-label">Équipe</div>
        <div className={`ni ${isActive('p-agents') ? 'active' : ''}`} onClick={() => goTo('p-agents')}>
          <svg className="ni-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          Agents {agentCount > 0 ? `(${agentCount})` : ''}
        </div>
        <div className={`ni ${isActive('p-new-agent') ? 'active' : ''}`} onClick={() => goTo('p-new-agent')}>
          <svg className="ni-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
          Ajouter un agent
        </div>
        <div className={`ni ${isActive('p-commissions') ? 'active' : ''}`} onClick={() => goTo('p-commissions')}>
          <svg className="ni-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </svg>
          Commissions
        </div>

        <div className="nav-label">Système</div>
        <div className={`ni ${isActive('p-notifs') ? 'active' : ''}`} onClick={() => goTo('p-notifs')}>
          <svg className="ni-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          Notifications
          <Badge count={unreadCount} color="red" />
        </div>
        <div className={`ni ${isActive('p-param') ? 'active' : ''}`} onClick={() => goTo('p-param')}>
          <svg className="ni-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          Paramètres
        </div>
      </div>

      <div className="sb-bottom">
        <div className="ni logout" onClick={handleLogout}>
          <svg className="ni-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Déconnexion
        </div>
      </div>
    </div>
  );
};

export default SidebarAdmin;