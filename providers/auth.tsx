import { api } from '@/lib/api';
import { safeDel, safeGet, safeSet } from '@/lib/safe-store';
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

type User = { email: string } | null;

const TOKEN_KEY = 'auth_token';
const EMAIL_KEY = 'auth_email';
const REFRESH_KEY = 'auth_refresh_token';
const REMEMBER_KEY = 'auth_remember'; // 👈 nuevo

type AuthContextType = {
  isLoading: boolean;
  isSignedIn: boolean;
  user: User;
  token: string | null;
  refreshToken: string | null;
  signIn: (credentials: { email: string; password: string; remember?: boolean }) => Promise<any>;
  signOut: () => Promise<void>;
  register: (data: { email: string; password: string; role: string }) => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  getRefreshToken: () => Promise<string | null>;
  refreshAccessToken: () => Promise<string | null>;
  requestPasswordReset: (email: string) => Promise<any>;
  verifyResetCode: (data_user: { email: string; code: string }) => Promise<any>;
  resetPassword: (data_user: { email: string; resetToken: string; newPassword: string }) => Promise<any>;
  rehydrate: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function setAuthHeader(t?: string | null) {
  if (t) api.defaults.headers.common.Authorization = `Bearer ${t}`;
  else delete api.defaults.headers.common.Authorization;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setLoading] = useState(true);
  const [user, setUser] = useState<User>(null);
  const [token, setToken] = useState<string | null>(null);
  const [rToken, setRToken] = useState<string | null>(null);

  // ---- Cola simple para refresh concurrente ----
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const rehydrate = useCallback(async () => {
    setLoading(true);
    try {
      const [t, email, rt, remember] = await Promise.all([
        safeGet(TOKEN_KEY),
        safeGet(EMAIL_KEY),
        safeGet(REFRESH_KEY),
        safeGet(REMEMBER_KEY),
      ]);

      // Si no quisiste recordar, limpia en frío
      if (remember === 'false') {
        await Promise.all([safeDel(TOKEN_KEY), safeDel(EMAIL_KEY), safeDel(REFRESH_KEY)]);
        setAuthHeader(null);
        setToken(null);
        setRToken(null);
        setUser(null);
        return;
      }

      if (t) {
        setToken(t);
        setAuthHeader(t);
      }
      if (rt) setRToken(rt);
      if (email) setUser({ email });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    rehydrate();
  }, [rehydrate]);

  const signIn = async ({
    email,
    password,
    remember = true,
  }: {
    email: string;
    password: string;
    remember?: boolean;
  }) => {
    const response = (await api.post('/api/v1/auth/login', { email, password })).data;
    if (!response.status) {
      return response; // deja que la pantalla maneje errores backend
    }
    const data = response.data;
    const accessToken = data.accessToken;
    const refreshToken = data.refreshToken ?? null;
    const userEmail = data.user?.email ?? email;

    await Promise.all([
      safeSet(TOKEN_KEY, accessToken),
      safeSet(EMAIL_KEY, userEmail),
      safeSet(REMEMBER_KEY, remember ? 'true' : 'false'),
      refreshToken ? safeSet(REFRESH_KEY, refreshToken) : Promise.resolve(),
    ]);

    setToken(accessToken);
    setRToken(refreshToken);
    setUser({ email: userEmail });
    setAuthHeader(accessToken);

    return response;
  };

  const signOut = async () => {
    try {
      await api.post('/api/v1/auth/logout');
    } catch {
      // ignora errores de red
    } finally {
      await Promise.all([safeDel(TOKEN_KEY), safeDel(EMAIL_KEY), safeDel(REFRESH_KEY), safeDel(REMEMBER_KEY)]);
      setAuthHeader(null);
      setToken(null);
      setRToken(null);
      setUser(null);
    }
  };

  const register = async ({ email, password, role }: { email: string; password: string; role: string }) => {
    await api.post('/api/v1/auth/register', { email, password, role });
  };

  const getAccessToken = async () => {
    if (token) return token;
    const t = await safeGet(TOKEN_KEY);
    if (t && t !== token) {
      setToken(t);
      setAuthHeader(t);
    }
    return t;
    };

  const getRefreshToken = async () => {
    if (rToken) return rToken;
    const rt = await safeGet(REFRESH_KEY);
    if (rt && rt !== rToken) setRToken(rt);
    return rt;
  };

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    // Reutiliza una sola promesa para evitar múltiples refresh simultáneos
    if (!refreshPromiseRef.current) {
      refreshPromiseRef.current = (async () => {
        const rt = await getRefreshToken();
        if (!rt) return null;
        try {
          const { data } = await api.post<{ accessToken: string }>('/api/v1/auth/refresh-token', {
            refreshToken: rt,
          });
          const newAccess = data.accessToken;
          if (newAccess) {
            await safeSet(TOKEN_KEY, newAccess);
            setToken(newAccess);
            setAuthHeader(newAccess);
            return newAccess;
          }
          return null;
        } catch {
          // Refresh falló: cerrar sesión
          await Promise.all([safeDel(TOKEN_KEY), safeDel(EMAIL_KEY), safeDel(REFRESH_KEY)]);
          setAuthHeader(null);
          setToken(null);
          setRToken(null);
          setUser(null);
          return null;
        } finally {
          // libera la promesa para futuros intentos
          refreshPromiseRef.current = null;
        }
      })();
    }
    return refreshPromiseRef.current;
  }, [getRefreshToken]);

  // ---- Interceptores Axios: set header + refresh en 401 ----
  useEffect(() => {
    const reqId = api.interceptors.request.use((cfg) => {
      if (!cfg.headers) cfg.headers;
      // Si por alguna razón no está el header, colócalo
      if (token && !cfg.headers.Authorization) {
        cfg.headers.Authorization = `Bearer ${token}`;
      }
      return cfg;
    });

    const resId = api.interceptors.response.use(
      (r) => r,
      async (err) => {
        const original = err?.config;
        const status = err?.response?.status;

        // Evita intentar refrescar la propia llamada de refresh y evita bucle
        const isRefreshCall = original?.url?.includes('/auth/refresh-token');

        if (status === 401 && !original?._retry && !isRefreshCall) {
          original._retry = true;
          const newToken = await refreshAccessToken();
          if (newToken) {
            original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newToken}` };
            return api(original); // reintenta con el token fresco
          }
        }
        return Promise.reject(err);
      }
    );

    return () => {
      api.interceptors.request.eject(reqId);
      api.interceptors.response.eject(resId);
    };
  }, [token, refreshAccessToken]);

  // ---- Password flows de tu servicio actual ----
  const requestPasswordReset = (email: string) => import('@/services/auth-client').then(m => m.requestPasswordReset(email));
  const verifyResetCode = (data_user: { email: string; code: string }) =>
    import('@/services/auth-client').then(m => m.verifyResetCode(data_user));
  const resetPassword = (data_user: { email: string; resetToken: string; newPassword: string }) =>
    import('@/services/auth-client').then(m => m.resetPassword(data_user));

  const value = useMemo<AuthContextType>(
    () => ({
      isLoading,
      // 👇 importante: considera autenticado con solo tener token (el user puede cargar después)
      isSignedIn: !!token,
      user,
      token,
      refreshToken: rToken,
      signIn,
      signOut,
      register,
      getAccessToken,
      getRefreshToken,
      refreshAccessToken,
      requestPasswordReset,
      verifyResetCode,
      resetPassword,
      rehydrate,
    }),
    [isLoading, user, token, rToken, signIn, signOut, register, refreshAccessToken, rehydrate]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
