"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";

export type Role = "admin" | "technician" | "household";
export type User = { id: number; email: string; username: string; phone_number: string; role: Role; email_verified: boolean; is_active: boolean };

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: { email: string; username: string; phone_number: string; password: string; password_confirm: string }) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  updateProfile: (input: { username: string; phone_number: string }) => Promise<User>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const clear = useCallback(() => {
    localStorage.removeItem("lpg_access_token");
    localStorage.removeItem("lpg_refresh_token");
    setUser(null);
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!localStorage.getItem("lpg_access_token")) return setLoading(false);
      try { setUser((await api.get<User>("/users/me/")).data); } catch { clear(); }
      finally { setLoading(false); }
    };
    load();
    window.addEventListener("lpg:unauthorized", clear);
    return () => window.removeEventListener("lpg:unauthorized", clear);
  }, [clear]);

  const login = async (email: string, password: string) => {
    const { data } = await api.post<{ access: string; refresh: string; user: User }>("/auth/login/", { email, password });
    localStorage.setItem("lpg_access_token", data.access);
    localStorage.setItem("lpg_refresh_token", data.refresh);
    setUser(data.user);
    return data.user;
  };
  const register = async (input: Parameters<AuthContextValue["register"]>[0]) => { await api.post("/auth/register/", input); };
  const logout = async () => {
    const refresh = localStorage.getItem("lpg_refresh_token");
    try { if (refresh) await api.post("/auth/logout/", { refresh }); } finally { clear(); }
  };
  const updateProfile = async (input: { username: string; phone_number: string }) => {
    const { data } = await api.patch<User>("/users/me/", input); setUser(data); return data;
  };
  const deleteAccount = async () => {
    await api.delete("/users/me/");
    clear();
  };
  const value = { user, loading, login, register, logout, deleteAccount, updateProfile };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
