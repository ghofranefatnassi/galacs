import { createContext, useContext, useState } from "react";
import { login, logout, checkIsAgent } from "../services/odooApi";

const AgentAuthContext = createContext(null);

const DB = "world-wild-web";

export function AgentAuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("agent_session");
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleLogin(username, password) {
    setLoading(true);
    setError(null);
    try {
      // Step 1 — authenticate with Odoo
      const session = await login(DB, username, password);

      // Step 2 — verify Agent Immobilier group
      const tempSession = { uid: session.uid };
      localStorage.setItem("agent_session", JSON.stringify(tempSession));

      const isAgent = await checkIsAgent();
      if (!isAgent) {
        await logout();
        localStorage.removeItem("agent_session");
        throw new Error("Accès refusé — réservé aux agents immobiliers");
      }

      // Step 3 — persist full session
      setUser(session);
      localStorage.setItem("agent_session", JSON.stringify(session));
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try { await logout(); } catch (_) {}
    finally {
      setUser(null);
      localStorage.removeItem("agent_session");
    }
  }

  return (
    <AgentAuthContext.Provider value={{ user, loading, error, login: handleLogin, logout: handleLogout }}>
      {children}
    </AgentAuthContext.Provider>
  );
}

export const useAgentAuth = () => useContext(AgentAuthContext);