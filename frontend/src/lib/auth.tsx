import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { api } from "./api";
import type { AuthResponse, UserSummary } from "./types";

const STORAGE_KEY = "dbo-auth";

interface AuthContextValue {
  token: string | null;
  user: UserSummary | null;
  ready: boolean;
  login: (result: AuthResponse) => void;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserSummary | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      setReady(true);
      return;
    }
    const parsed = JSON.parse(saved) as { token: string; user: UserSummary };
    setToken(parsed.token);
    setUser(parsed.user);
    setReady(true);
  }, []);

  const login = (result: AuthResponse) => {
    setToken(result.access_token);
    setUser(result.user);
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: result.access_token, user: result.user }),
    );
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    window.localStorage.removeItem(STORAGE_KEY);
  };

  const refreshMe = async () => {
    if (!token) return;
    const me = await api.me(token);
    setUser(me);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user: me }));
  };

  const value = useMemo(
    () => ({
      token,
      user,
      ready,
      login,
      logout,
      refreshMe,
    }),
    [ready, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

