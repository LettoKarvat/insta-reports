// src/services/api.ts
import axios, { AxiosError } from "axios";

/* =============================
 * BASE URL
 * ============================= */
const ENV_BASE = import.meta.env?.VITE_API_URL;
const FALLBACK_NGROK = "https://13f5e81e5201.ngrok-free.app"; // opcional
const baseURL =
  (ENV_BASE && ENV_BASE.trim() !== "" ? ENV_BASE : FALLBACK_NGROK) ||
  "http://localhost:5000";

/** Detecta host ngrok (.app | .dev | .io) */
function isNgrokHost(url: string): boolean {
  try {
    const hostname = new URL(url, window.location.origin).hostname;
    return /\.ngrok(?:-free)?\.(app|dev|io)$/i.test(hostname);
  } catch {
    return false;
  }
}
const isNgrok = isNgrokHost(baseURL);

/* =============================
 * KEYS (se já usa sessão local)
 * ============================= */
export const TOKEN_KEY = "token";
export const USER_KEY = "user";

/* =============================
 * Helpers JWT
 * ============================= */
export function parseJwt(token: string) {
  try {
    const base64 = token.split(".")[1];
    const json = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(
      decodeURIComponent(
        json
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      )
    );
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string) {
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return true;
  return Date.now() >= payload.exp * 1000;
}

/* =============================
 * Cliente Axios
 * ============================= */
const api = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    ...(isNgrok ? { "ngrok-skip-browser-warning": "true" } : {}),
  },
});

// REQUEST: injeta header ngrok e Bearer (se existir)
api.interceptors.request.use(
  (config) => {
    if (isNgrok) {
      (config.headers ??= {})["ngrok-skip-browser-warning"] = "true";
    }

    // opcional: injeta Bearer do seu auth local
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      if (isTokenExpired(token)) {
        // limpa sessão e força login
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        // cancela a request atual
        return Promise.reject(new axios.Cancel("Token expirado"));
      }
      (config.headers ??= {}).Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// RESPONSE: trata 401 e HTML (banner do ngrok)
api.interceptors.response.use(
  (response) => {
    const ct = (response?.headers?.["content-type"] || "").toLowerCase();
    if (ct.includes("text/html")) {
      const err = new Error(
        "Resposta HTML recebida onde JSON era esperado (possível aviso do ngrok)."
      ) as Error & { code?: string };
      err.code = "NGROK_HTML_WARNING";
      throw err;
    }
    return response;
  },
  (error: AxiosError | any) => {
    const status = error?.response?.status;

    if (status === 401) {
      // sessão inválida → limpa e redireciona
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    // Normaliza mensagem de erro
    const message =
      error?.response?.data?.message || error?.message || "Erro de conexão";

    return Promise.reject({ ...error, message, status });
  }
);

export default api;
