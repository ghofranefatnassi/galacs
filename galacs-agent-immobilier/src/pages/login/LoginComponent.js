import React, { useState } from 'react';
import '../../assets/styles/style.css';
import './Login.css';
import Logo from '../../assets/images/1.png';
import { useNavigate } from 'react-router-dom';
import { useAgentAuth } from '../../contexts/AgentAuthContext';

const LoginComponent = () => {
  const navigate = useNavigate();
  const { login, loading, error } = useAgentAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    const success = await login(email, password);
    if (success) navigate('/tableau-de-bord');
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <>
      <div className="disLogin">
        <div className='loginMainDis'>
          <div className="loginS1">
            <div className="loginS2"></div>
            <div className="loginS3">
              <div className='loginS4'>
                <img className="galacLogoLogin" src={Logo} alt="Galacs Logo" />
                <div>
                  <div className='loginS5'>GALACS.IO</div>
                  <div className='loginS6'>AGENCE IMMOBILIÈRE</div>
                </div>
              </div>
              <h1 className="loginS7">Bon retour 👋</h1>
              <p className="loginS8">Connectez-vous à votre espace agent.</p>

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

              <div className="inp-group">
                <div className="inp-label">Email professionnel</div>
                <input
                  className="inp"
                  style={{ padding: '14px 18px', fontSize: '15px' }}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  placeholder="votre@email.fr"
                />
              </div>
              <div className="inp-group">
                <div className="inp-label">Mot de passe</div>
                <input
                  className="inp"
                  style={{ padding: '14px 18px', fontSize: '15px' }}
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  placeholder="••••••••••"
                />
              </div>

              <div className="loginS9">
                <span className="loginS10">Mot de passe oublié ?</span>
              </div>

              <button
                className="btn btn-primary btn-lg btn-full"
                onClick={handleLogin}
                disabled={loading}
                style={{ opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                {loading ? "⏳ Connexion..." : "Se connecter"}
              </button>

              <div className="login11">
                Pas encore de compte ? <span className="loginS12">Contacter l'administration</span>
              </div>
            </div>
          </div>

          {/* Right panel — untouched */}
          <div className="loginS13">
            <div className="loginS14"></div>
            <div className="loginS15">
              <div className="loginS16">
                <svg viewBox="0 0 200 200" fill="none" width="200" height="200" className="loginS17">
                  <ellipse cx="100" cy="100" rx="85" ry="32" stroke="rgba(124,58,237,.3)" strokeWidth="1.5" strokeDasharray="6 4" />
                </svg>
                <div className="loginS18"><div className="loginS19">🏠</div></div>
                <div className="loginS20">⚡</div>
                <div className="loginS21">🔥</div>
              </div>
              <div className="loginS22">Plateforme de leads IA</div>
              <div className="loginS23">Enchères en temps réel · Score IA prédictif · CRM confidentiel · Suivi pipeline intégré</div>
              <div className="loginS24">
                <div className="logins25"><div className="loginS26">87%</div><div className="logins27">Taux attribution</div></div>
                <div className="logins25"><div className='loginS28'>24j</div><div className="logins27">Délai moyen vente</div></div>
                <div className="logins25"><div className="loginS29">147</div><div className="logins27">Leads ce mois</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginComponent;