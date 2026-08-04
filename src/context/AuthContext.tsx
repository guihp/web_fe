import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { loginWithCpf, type AuthUser } from '../services/authService';

const STORAGE_KEY = 'fe_web_auth_session';

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  login: (cpf: string, senha: string, remember: boolean) => Promise<void>;
  logout: () => void;
  updateUser: (partial: Partial<AuthUser>) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as AuthUser;
    return { ...parsed, foto_perfil_url: parsed.foto_perfil_url ?? null };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setUser(readStoredUser());
    setIsLoading(false);
  }, []);

  const login = useCallback(async (cpf: string, senha: string, remember: boolean) => {
    const loggedUser = await loginWithCpf(cpf, senha);
    const payload = JSON.stringify(loggedUser);

    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);

    if (remember) {
      localStorage.setItem(STORAGE_KEY, payload);
    } else {
      sessionStorage.setItem(STORAGE_KEY, payload);
    }

    setUser(loggedUser);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const updateUser = useCallback((partial: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };

      if (localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } else if (sessionStorage.getItem(STORAGE_KEY)) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }

      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, logout, updateUser }),
    [user, isLoading, login, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
