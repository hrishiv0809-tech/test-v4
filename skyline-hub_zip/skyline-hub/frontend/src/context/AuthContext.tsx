import * as React from 'react';
import { toast } from 'sonner';
import { apiErrorMessage, getToken, setToken } from '@/api/client';
import { authApi, type LoginInput, type SignupInput } from '@/api/auth';
import type { Role, User } from '@/api/types';

const USER_KEY = 'skyline_user';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<User>;
  signup: (input: SignupInput) => Promise<User>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
  isStaff: boolean;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function cacheUser(user: User | null): void {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* storage disabled — memory only */
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [user, setUser] = React.useState<User | null>(() => (getToken() ? readCachedUser() : null));
  const [loading, setLoading] = React.useState<boolean>(Boolean(getToken()));

  const refreshMe = React.useCallback(async (): Promise<void> => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await authApi.me();
      setUser(me);
      cacheUser(me);
    } catch {
      setUser(null);
      cacheUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const login = React.useCallback(async (input: LoginInput): Promise<User> => {
    const res = await authApi.login(input);
    setToken(res.access_token);
    setUser(res.user);
    cacheUser(res.user);
    return res.user;
  }, []);

  const signup = React.useCallback(async (input: SignupInput): Promise<User> => {
    const res = await authApi.signup(input);
    setToken(res.access_token);
    setUser(res.user);
    cacheUser(res.user);
    return res.user;
  }, []);

  const logout = React.useCallback((): void => {
    setToken(null);
    cacheUser(null);
    setUser(null);
    toast.success('Signed out');
  }, []);

  const hasRole = React.useCallback(
    (...roles: Role[]): boolean => (user ? roles.includes(user.role) : false),
    [user],
  );

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login,
      signup,
      logout,
      refreshMe,
      hasRole,
      isStaff: Boolean(user && (user.role === 'ADMIN' || user.role === 'TREASURER')),
    }),
    [user, loading, login, signup, logout, refreshMe, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Convenience wrapper: runs an async action and surfaces API errors as toasts. */
export function useAction(): <T>(fn: () => Promise<T>, opts?: { success?: string }) => Promise<T | undefined> {
  return React.useCallback(async <T,>(fn: () => Promise<T>, opts?: { success?: string }): Promise<T | undefined> => {
    try {
      const result = await fn();
      if (opts?.success) toast.success(opts.success);
      return result;
    } catch (error) {
      toast.error(apiErrorMessage(error));
      return undefined;
    }
  }, []);
}
