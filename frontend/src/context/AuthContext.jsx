import { createContext, useContext, useEffect, useState } from "react";
import * as api from "../api/client.js";

// Who is logged in. The session itself lives in Django (an HttpOnly cookie);
// on page load we ask the API who we are.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Session expired or logged out elsewhere: drop the user so ProtectedRoute sends them to /login.
    api.setUnauthorizedHandler(() => setUser(null));
    api
      .ensureCsrf()
      .then(api.getCurrentUser)
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => setUser(await api.login(email, password));
  const signup = async (name, email, password) => setUser(await api.signup(name, email, password));
  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
