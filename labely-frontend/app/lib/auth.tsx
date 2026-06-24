"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  clearToken,
  getStoredUser,
  getToken,
  setStoredUser,
  setToken,
  StoredUser,
} from "./api";

type AuthContextValue = {
  user: StoredUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (firstName: string, lastName: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setTokenState(getToken());
    setUser(getStoredUser());
    setLoading(false);
  }, []);

  const persist = useCallback((resp: { token: string; email: string; firstName: string; lastName: string }) => {
    const u: StoredUser = {
      email: resp.email,
      firstName: resp.firstName,
      lastName: resp.lastName,
    };
    setToken(resp.token);
    setStoredUser(u);
    setTokenState(resp.token);
    setUser(u);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.auth.login(email, password);
      persist(res);
    },
    [persist],
  );

  const register = useCallback(
    async (firstName: string, lastName: string, email: string, password: string) => {
      const res = await api.auth.register(firstName, lastName, email, password);
      persist(res);
    },
    [persist],
  );

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
    setUser(null);
    router.push("/login");
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, loading, login, register, logout }),
    [user, token, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function useRequireAuth() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);
  return { user, loading };
}
