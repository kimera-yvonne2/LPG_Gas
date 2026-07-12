import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1",
  timeout: 10_000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("lpg_access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(undefined, async (error) => {
  const config = error.config as (typeof error.config & { _retried?: boolean }) | undefined;
  if (error.response?.status !== 401 || !config || config._retried || typeof window === "undefined") {
    return Promise.reject(error);
  }
  const refresh = window.localStorage.getItem("lpg_refresh_token");
  if (!refresh) return Promise.reject(error);
  config._retried = true;
  try {
    const { data } = await axios.post(`${api.defaults.baseURL}/auth/token/refresh/`, { refresh });
    window.localStorage.setItem("lpg_access_token", data.access);
    if (data.refresh) window.localStorage.setItem("lpg_refresh_token", data.refresh);
    config.headers.Authorization = `Bearer ${data.access}`;
    return api(config);
  } catch {
    window.localStorage.removeItem("lpg_access_token");
    window.localStorage.removeItem("lpg_refresh_token");
    window.dispatchEvent(new Event("lpg:unauthorized"));
    return Promise.reject(error);
  }
});
