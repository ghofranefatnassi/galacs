import React, { useState } from 'react'
import '../../assets/styles/style.css'
import './Login.css'
import Logo from '../../assets/images/1.png'
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
const LoginComponent = () => {
  const navigate = useNavigate();
  const { login, loading, error } = useAuth(); // ← pulls handleLogin, loading, error from context
  const [email, setEmail] = useState("admin@galacs.fr");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    await login(email, password);       // context handles session + localStorage
    if (!error) navigate('/tableau-de-bord'); // only navigate on success
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="page active" id="p-login">
      <div className="pi">
        <div className="loginS1">
          <div className="loginS2"></div>
          <div className="loginS3">
            <div className="loginS4">
              <img src={Logo} alt="Galacs Logo" width="36" height="36" style={{ objectFit: 'contain' }} />
              <div>
                <div className="loginS5">GALACS.IO</div>
                <div className="loginS6">ADMINISTRATION</div>
              </div>
              <div className="loginS7">🛡️ Admin</div>
            </div>
            <h1 className="loginS8">Accès Administration</h1>
            <p className="loginS9">Connexion sécurisée · TLS 1.3 · Chiffrement AES-256</p>

            {error && (
              <div style={{
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.4)",
                color: "#fca5a5",
                borderRadius: "8px",
                padding: "10px 14px",
                marginBottom: "14px",
                fontSize: "13px",
              }}>
                ⚠️ {error}
              </div>
            )}

            <div style={{ marginBottom: "16px" }}>
              <div className="il">Email administrateur</div>
              <input
                className="inp loginS10"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
              />
            </div>
            <div style={{ marginBottom: "20px" }}>
              <div className="il">Mot de passe</div>
              <input
                className="inp loginS10"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                placeholder="••••••••••"
              />
            </div>

            <div className="loginS11">
              <span className="loginS12">Mot de passe oublié ?</span>
            </div>

            <button
              className="btn btn-gold btn-lg btn-full"
              onClick={handleLogin}
              disabled={loading}
              style={{ padding: '14px', opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? "⏳ Connexion en cours..." : "🛡️ Accéder à l'administration"}
            </button>

            <div className="loginS13">Accès restreint aux administrateurs autorisés</div>
          </div>
        </div>
        <div className="loginS14">
          <div className="loginS15"></div>
          <div className="loginS16">
            <div className="loginS17">
              <svg viewBox="0 0 180 180" fill="none" width="180" height="180" className="loginS18">
                <ellipse cx="90" cy="90" rx="80" ry="28" stroke="rgba(245,158,11,.25)" strokeWidth="1.5" strokeDasharray="6 4" />
              </svg>
              <div className="loginS19"><div className="loginS20">🛡️</div></div>
              <div className="loginS21">⚡</div>
              <div className="loginS22">📊</div>
            </div>
            <div className="loginS23">Contrôle total de la plateforme</div>
            <div className="loginS24">Gestion des enchères · Validation des ventes · Administration des agents · Rapports analytiques</div>
            <div className="loginS25">
              <div style={{ textAlign: 'center' }}><div className="loginS26">12</div><div className='loginS29'>Agents</div></div>
              <div style={{ textAlign: 'center' }}><div className="loginS27">84k€</div><div className='loginS29'>Commissions</div></div>
              <div style={{ textAlign: 'center' }}><div className="loginS28">147</div><div className='loginS29'>Leads</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginComponent;