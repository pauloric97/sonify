import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, getToken, setToken } from './api';
import type { User } from '../types';

interface AuthValue {
  user: User | null;
  loading: boolean;
  needsSetup: boolean;
  login: (email: string, password: string) => Promise<void>;
  setup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateMe: (patch: Record<string, unknown>) => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const status = await api<{ needsSetup: boolean }>('/auth/status');
        setNeedsSetup(status.needsSetup);
        if (!status.needsSetup && getToken()) {
          const me = await api<{ user: User }>('/auth/me');
          setUser(me.user);
        }
      } catch {
        setToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // A cor de destaque do perfil vira a variável CSS usada no app inteiro.
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', user?.accent || '#7c5cff');
  }, [user?.accent]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setToken(res.token);
    setUser(res.user);
  }, []);

  const setup = useCallback(async (name: string, email: string, password: string) => {
    const res = await api<{ token: string; user: User }>('/auth/setup', {
      method: 'POST',
      body: { name, email, password },
    });
    setToken(res.token);
    setUser(res.user);
    setNeedsSetup(false);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    location.href = '/login';
  }, []);

  const updateMe = useCallback(async (patch: Record<string, unknown>) => {
    const res = await api<{ user: User }>('/auth/me', { method: 'PATCH', body: patch });
    setUser(res.user);
  }, []);

  const value = useMemo(
    () => ({ user, loading, needsSetup, login, setup, logout, updateMe }),
    [user, loading, needsSetup, login, setup, logout, updateMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
