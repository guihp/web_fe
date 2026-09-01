import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { defaultModulosForCargo, defaultSecoesForCargo } from '../data/portalModules';
import {
  loginAs,
  refreshAuthUser,
  type AuthUser,
  type LoginTipo,
} from '../services/authService';
import { isPushSupported, subscribePush, unsubscribePush } from '../services/pushService';
import { isTipoUsuario } from '../utils/externalAccess';

const STORAGE_KEY = 'fe_web_auth_session';

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  login: (
    identifier: string,
    senha: string,
    remember: boolean,
    loginTipo?: LoginTipo,
  ) => Promise<void>;
  logout: () => void;
  updateUser: (partial: Partial<AuthUser>) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as AuthUser;
    const tipo = isTipoUsuario(parsed.tipo_usuario) ? parsed.tipo_usuario : 'interno';
    return {
      ...parsed,
      foto_perfil_url: parsed.foto_perfil_url ?? null,
      tipo_usuario: tipo,
      industria_id: parsed.industria_id ?? null,
      industria_nome: parsed.industria_nome ?? null,
      cliente_grupo: parsed.cliente_grupo ?? null,
      login_cnpj: parsed.login_cnpj ?? null,
      data_nascimento: parsed.data_nascimento
        ? String(parsed.data_nascimento).slice(0, 10)
        : null,
      somente_leitura: tipo === 'industria' || tipo === 'cliente',
      modulos_acesso:
        parsed.modulos_acesso?.length > 0
          ? parsed.modulos_acesso
          : defaultModulosForCargo(parsed.cargo),
      secoes_acesso:
        parsed.secoes_acesso?.length > 0
          ? parsed.secoes_acesso
          : defaultSecoesForCargo(parsed.cargo),
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const storedUser = readStoredUser();
      if (!storedUser) {
        if (!cancelled) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      // Atualiza sessão com dados frescos (ex.: data_nascimento para aniversário).
      const fresh = await refreshAuthUser(storedUser.id).catch(() => null);
      const nextUser = fresh ?? storedUser;

      if (cancelled) return;

      setUser(nextUser);
      setIsLoading(false);

      const payload = JSON.stringify(nextUser);
      if (localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, payload);
      } else if (sessionStorage.getItem(STORAGE_KEY)) {
        sessionStorage.setItem(STORAGE_KEY, payload);
      }

      if (isPushSupported() && Notification.permission === 'granted') {
        void subscribePush(nextUser.id);
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (
      identifier: string,
      senha: string,
      remember: boolean,
      loginTipo: LoginTipo = 'interno',
    ) => {
      const loggedUser = await loginAs(loginTipo, identifier, senha);
      const payload = JSON.stringify(loggedUser);

      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);

      if (remember) {
        localStorage.setItem(STORAGE_KEY, payload);
      } else {
        sessionStorage.setItem(STORAGE_KEY, payload);
      }

      setUser(loggedUser);

      if (isPushSupported() && Notification.permission === 'granted') {
        void subscribePush(loggedUser.id);
      }
    },
    [],
  );

  const logout = useCallback(() => {
    setUser((prev) => {
      if (prev) {
        void unsubscribePush(prev.id);
      }
      return null;
    });
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
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
    [user, isLoading, login, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
