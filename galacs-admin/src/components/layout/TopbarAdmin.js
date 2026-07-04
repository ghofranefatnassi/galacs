import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../../assets/styles/style.css';
import { useAuth } from '../../contexts/AuthContext';
import { getAdminProfile } from '../../services/odooApi';
import { useActiveEncheres } from '../../hooks/useActiveEncheres'
const TopbarAdmin = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();

  const [avatarImage,    setAvatarImage]    = useState(null);
  const [adminInitials,  setAdminInitials]  = useState('AD');

  // ── Live auction data from Odoo ────────────────────────────────────────
  const { encheres, nextEnchere, timeLeft, loading: enchLoading } = useActiveEncheres();

  // Reference for the topbar enchere label:
  //   "3 enchères actives · GL-0047 : MM:SS"
  const leadLabel  = nextEnchere?.lead_id?.[1] || '';
  const countLabel = enchLoading
    ? '...'
    : `${encheres.length} enchère${encheres.length !== 1 ? 's' : ''} active${encheres.length !== 1 ? 's' : ''}`;
  const stripLabel = nextEnchere && timeLeft
    ? `${countLabel} · ${leadLabel} : `
    : countLabel;

  // ── Load admin profile ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    getAdminProfile()
      .then((data) => {
        const fullName  = data.name || '';
        const cleanName = fullName.includes(',')
          ? fullName.split(',').slice(1).join(',').trim()
          : fullName;

        const parts    = cleanName.trim().split(' ');
        const initials = parts.length >= 2
          ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
          : cleanName.slice(0, 2).toUpperCase();

        setAdminInitials(initials);
        if (data.image_1920) {
          setAvatarImage(`data:image/png;base64,${data.image_1920}`);
        }
      })
      .catch(() => {});
  }, [user]);

  // ── Page titles ────────────────────────────────────────────────────────
  const getTitle = () => {
    const titles = {
      '/tableau-de-bord':           'Tableau de bord',
      '/analyse':                   'Rapports & Analytics',
      '/enchere':                   'Enchères',
      '/enchere/enchere-detail':    'Détail Enchère',
      '/gestion-leads':             'Gestion des Leads',
      '/ventes':                    'Validation Ventes',
      '/ventes/dossier-vente':      'Dossier de Vente',
      '/agents':                    'Agents',
      '/agents/fichier-agent':      'Fiche Agent',
      '/agents/ajouter-agent':      'Créer un Agent',
      '/agents/modifier-agent':     'Modifier un Agent',
      '/commissions':               'Commissions',
      '/notification':              'Notifications',
      '/parametre':                 'Paramètres',
      '/parametre/parametre-admin': 'Modifier le compte administrateur',
    };
    return titles[location.pathname] || 'Administration';
  };

  return (
    <div id="topbar">
      <div className="topbar-l">
        <div className="topbar-title">{getTitle()}</div>
        <div className="topbar-badge">🛡️ ADMIN</div>
      </div>

      <div className="topbar-r">

        {/* Live auction strip */}
        <div
          className="live-strip"
          onClick={() => navigate('/enchere')}
          style={{ cursor: 'pointer' }}
        >
          <span className="ldot"></span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--orange)' }}>
            {stripLabel}
            {nextEnchere && timeLeft && (
              <span id="cd-top">{timeLeft}</span>
            )}
          </span>
        </div>

        {/* Notifications */}
        <div className="t-btn" onClick={() => navigate('/notification')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8090A8" strokeWidth="2">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          <span className="t-pip"></span>
        </div>

        {/* Avatar */}
        <div className="t-btn" onClick={() => navigate('/parametre')}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--gold), var(--gold2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Montserrat, sans-serif', fontSize: '10px', fontWeight: 800,
            color: '#000', overflow: 'hidden',
          }}>
            {avatarImage
              ? <img src={avatarImage} alt="avatar"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              : adminInitials}
          </div>
        </div>

      </div>
    </div>
  );
};

export default TopbarAdmin;