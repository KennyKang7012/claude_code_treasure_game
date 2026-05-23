import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiFetch } from '@/lib/api';

// ─── 型別定義 ───────────────────────────────────────────────
export interface AuthUser {
  id: number;
  username: string;
}

type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'guest';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  playAsGuest: () => void;
}

// ─── Context ────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

// ─── JWT payload 解碼（不驗簽，僅讀取 payload）───────────────
function decodeJwtPayload(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.id && payload.username) {
      return { id: payload.id, username: payload.username };
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Provider ───────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // 初始化：從 localStorage 還原登入狀態
  useEffect(() => {
    const stored = localStorage.getItem('auth_token');
    if (stored) {
      const decoded = decodeJwtPayload(stored);
      if (decoded) {
        setToken(stored);
        setUser(decoded);
        setStatus('authenticated');
        return;
      }
      // Token 格式有誤，清除
      localStorage.removeItem('auth_token');
    }
    setStatus('unauthenticated');
  }, []);

  // 登入
  const login = async (username: string, password: string) => {
    const res = await apiFetch<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    localStorage.setItem('auth_token', res.token);
    setToken(res.token);
    setUser(res.user);
    setStatus('authenticated');
  };

  // 註冊
  const register = async (username: string, password: string) => {
    const res = await apiFetch<{ token: string; user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    localStorage.setItem('auth_token', res.token);
    setToken(res.token);
    setUser(res.user);
    setStatus('authenticated');
  };

  // 登出
  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
    setStatus('unauthenticated');
  };

  // 訪客模式
  const playAsGuest = () => {
    setToken(null);
    setUser(null);
    setStatus('guest');
  };

  return (
    <AuthContext.Provider value={{ status, user, token, login, register, logout, playAsGuest }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必須在 AuthProvider 內使用');
  return ctx;
}
