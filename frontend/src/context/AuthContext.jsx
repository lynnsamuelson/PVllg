import { createContext, useContext, useState } from "react";

// PLACEHOLDER AUTH: any email/password "logs in" and is remembered in localStorage.
// Replace login/signup/logout with real calls to the Django API when auth is built.
const STORAGE_KEY = "pvllg.user";
const AuthContext = createContext(null);

function loadUser() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser);

  const saveUser = (next) => {
    setUser(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage unavailable (private mode etc.) — stay logged in for this tab only.
    }
  };

  const login = async (email) => {
    const name = email.split("@")[0];
    saveUser({ name, email, joined: new Date().toISOString().slice(0, 10) });
  };
  const signup = async (name, email) => {
    saveUser({ name, email, joined: new Date().toISOString().slice(0, 10) });
  };
  const logout = () => saveUser(null);

  return <AuthContext.Provider value={{ user, login, signup, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
