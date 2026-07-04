import React, { useState, useEffect } from 'react';
import '../../assets/styles/style.css';
import './Parametre.css';
import Logo from '../../assets/images/1.png';
import { useNavigate } from 'react-router-dom';
import Switch from '../../components/common/CosmicSwitch';
import { useAuth } from '../../contexts/AuthContext';
import { getAdminProfile } from '../../services/odooApi';

const ParametreComponent = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Real admin profile
  const [adminName, setAdminName] = useState('ADMIN');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [avatarImage, setAvatarImage] = useState(null);

  // Switches state
  const [scoringIa, setScoringIa] = useState(true);
  const [notificationsEmail, setNotificationsEmail] = useState(true);
  const [alertesVente, setAlertesVente] = useState(true);
  const [alertesPerformance, setAlertesPerformance] = useState(true);
  const [alerteFinEncheres, setAlerteFinEncheres] = useState(true);
  const [rapportsAuto, setRapportsAuto] = useState(true);
  const [twoFA, setTwoFA] = useState(true);

  // ── Load profile ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    getAdminProfile()
      .then((data) => {
        const fullName = data.name || '';
        const cleanName = fullName.includes(',')
          ? fullName.split(',').slice(1).join(',').trim()
          : fullName;

        const parts = cleanName.split(' ');
        const firstName = parts[0] || '';
        const lastName = parts.slice(1).join(' ') || '';

        setAdminName(cleanName || 'ADMIN');
        setAdminEmail(data.email || '');
        setAdminFirstName(firstName);
        setAdminLastName(lastName);

        if (data.image_1920) {
          setAvatarImage(`data:image/png;base64,${data.image_1920}`);
        }
      })
      .catch(() => {});
  }, [user]);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="page active" id="p-param">
      <div className="pi fade-in">
        <h1 style={{ marginBottom: '6px' }}>Paramètres de la plateforme</h1>
        <p className="subtitle">Configuration système · Sécurité · Administration</p>
        <div className="g2">
          <div className="paramsS1">
            <div className="card">
              <h3 style={{ marginBottom: '16px' }}>Compte administrateur</h3>
              <div className="paramsS2">
                <div className="adm-av paramsS3" style={{ overflow: 'hidden' }}>
                  {avatarImage
                    ? <img src={avatarImage} alt="avatar"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    : '👨‍💼'}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="syn paramsS4">{adminName || 'ADMIN'}</div>
                  <div className="paramsS5">{adminEmail}</div>
                  <div className="paramsS6">🛡️ Administrateur principal</div>
                </div>
                <button className="btn btn-gold btn-sm"
                  onClick={() => navigate('/parametre/parametre-admin')}>
                  Éditer
                </button>
              </div>
              <div className="g2" style={{ gap: '12px' }}>
                <div>
                  <div className="il">Prénom</div>
                  <input className="inp" value={adminFirstName} readOnly
                    style={{ opacity: 0.8 }} />
                </div>
                <div>
                  <div className="il">Nom</div>
                  <input className="inp" value={adminLastName} readOnly
                    style={{ opacity: 0.8 }} />
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '16px' }}>Règles de la plateforme</h3>
              <div className="paramsS7">
                <div className="param-row">
                  <div className="pi-icn paramsS8">⏱</div>
                  <div style={{ flex: 1 }}>
                    <div className="paramsS9">Durée des enchères</div>
                    <div className="paramsS10">Fenêtre d'enchère standard</div>
                  </div>
                  <div className="syn paramsS11">1h</div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8090A8" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
                <div className="param-row">
                  <div className="pi-icn paramsS17">💶</div>
                  <div style={{ flex: 1 }}>
                    <div className="paramsS9">Commission minimale</div>
                    <div className="paramsS10">Plancher d'enchère</div>
                  </div>
                  <div className="syn paramsS14">3.0%</div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8090A8" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
                <div className="param-row">
                  <div className="pi-icn paramsS12">⏰</div>
                  <div style={{ flex: 1 }}>
                    <div className="paramsS9">Délai suivi obligatoire</div>
                    <div className="paramsS10">Avant remise en enchère</div>
                  </div>
                  <div className="syn paramsS15">72h</div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8090A8" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
                <div className="param-row">
                  <div className="pi-icn paramsS16">🤖</div>
                  <div style={{ flex: 1 }}>
                    <div className="paramsS9">Scoring IA automatique</div>
                    <div className="paramsS13">Actif · Modèle v4.2 · Précision 94%</div>
                  </div>
                  <Switch checked={scoringIa} onChange={() => setScoringIa(!scoringIa)} />
                </div>
                <div className="param-row" style={{ border: 'none' }}>
                  <div className="pi-icn paramsS18">📧</div>
                  <div style={{ flex: 1 }}>
                    <div className="paramsS9">Notifications email automatiques</div>
                  </div>
                  <Switch checked={notificationsEmail} onChange={() => setNotificationsEmail(!notificationsEmail)} />
                </div>
              </div>
            </div>
          </div>

          <div className="paramS1">
            <div className="card">
              <h3 style={{ marginBottom: '16px' }}>Alertes administrateur</h3>
              <div className="paramsS7">
                <div className="param-row">
                  <div className="pi-icn paramsS16">💰</div>
                  <div style={{ flex: 1 }}>
                    <div className="paramsS9">Déclarations de vente</div>
                  </div>
                  <Switch checked={alertesVente} onChange={() => setAlertesVente(!alertesVente)} />
                </div>
                <div className="param-row">
                  <div className="pi-icn paramsS12">🚨</div>
                  <div style={{ flex: 1 }}>
                    <div className="paramsS9">Alertes performance agents</div>
                  </div>
                  <Switch checked={alertesPerformance} onChange={() => setAlertesPerformance(!alertesPerformance)} />
                </div>
                <div className="param-row">
                  <div className="pi-icn paramsS8">⚡</div>
                  <div style={{ flex: 1 }}>
                    <div className="paramsS9">Fin d'enchères imminente</div>
                  </div>
                  <Switch checked={alerteFinEncheres} onChange={() => setAlerteFinEncheres(!alerteFinEncheres)} />
                </div>
                <div className="param-row" style={{ border: 'none' }}>
                  <div className="pi-icn paramsS19">📊</div>
                  <div style={{ flex: 1 }}>
                    <div className="paramsS9">Rapports automatiques</div>
                  </div>
                  <Switch checked={rapportsAuto} onChange={() => setRapportsAuto(!rapportsAuto)} />
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '16px' }}>Sécurité & Conformité</h3>
              <div className="paramsS7">
                <div className="param-row">
                  <div className="pi-icn paramsS16">🌐</div>
                  <div style={{ flex: 1 }}>
                    <div className="paramsS9">Chiffrement AES-256</div>
                    <div className="paramsS13">Actif · Infomaniak Suisse 🇨🇭</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="param-row">
                  <div className="pi-icn paramsS8">📋</div>
                  <div style={{ flex: 1 }}>
                    <div className="paramsS9">Journaux d'audit</div>
                    <div className="paramsS10">Toutes les actions enregistrées</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8090A8" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
                <div className="param-row">
                  <div className="pi-icn paramsS20">🔑</div>
                  <div style={{ flex: 1 }}>
                    <div className="paramsS9">Gestion des accès</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8090A8" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
                <div className="param-row" style={{ border: 'none' }}>
                  <div className="pi-icn paramsS12">🛡</div>
                  <div style={{ flex: 1 }}>
                    <div className="paramsS9">Authentification 2FA admin</div>
                    <div className="paramsS13">Activée obligatoirement</div>
                  </div>
                  <Switch checked={twoFA} disabled={true} />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="paramsS21">
                <img src={Logo} alt="Galacs Logo" width="36" height="36"
                  style={{ objectFit: 'contain' }} />
                <div>
                  <div className="syn paramsS22">GALACS.IO</div>
                  <div className="paramsS10">Build 2026.03 · TLS 1.3 · RGPD ✓ · Infomaniak 🇨🇭</div>
                </div>
              </div>
              <button className="btn btn-ghost btn-full" style={{ padding: '11px' }}
                onClick={handleLogout}>
                🚪 Se déconnecter
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParametreComponent;