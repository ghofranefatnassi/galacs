import { createContext, useContext, useState } from "react";
import { login, logout, checkIsAdmin } from "../services/odooApi";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("odoo_session");
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const DB = "world-wild-web"; // ← your Odoo DB name

  async function handleLogin(username, password) {
  setLoading(true);
  setError(null);
  try {
    // Clear any stale session first
    localStorage.removeItem("odoo_session");

    // Step 1 — authenticate
    const session = await login(DB, username, password);

    // Step 2 — store temp session so checkIsAdmin can read uid
    localStorage.setItem("odoo_session", JSON.stringify({ uid: session.uid }));

    // Step 3 — verify Galacs.io/Administrateur group (id=21)
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) {
      await logout();
      localStorage.removeItem("odoo_session");
      throw new Error("Accès refusé — réservé aux administrateurs Galacs.io");
    }

    // Step 4 — persist full session
    setUser(session);
    localStorage.setItem("odoo_session", JSON.stringify(session));
    return true;
  } catch (err) {
    setError(err.message);
    localStorage.removeItem("odoo_session"); // ← always clean up on any error
    return false;
  } finally {
    setLoading(false);
  }
}

  async function handleLogout() {
    try {
      await logout();
    } catch (_) {
      // session may already be expired, ignore
    } finally {
      setUser(null);
      localStorage.removeItem("odoo_session");
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, login: handleLogin, logout: handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);