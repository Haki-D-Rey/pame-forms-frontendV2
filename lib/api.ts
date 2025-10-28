// src/lib/api.ts
import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from './config';

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    skipAuth?: boolean;
    _noRefresh?: boolean;
    _retry?: boolean;
  }
}

type AttachOpts = {
  getAccessToken: () => Promise<string | null> | string | null;
  refreshAccessToken?: () => Promise<string | null>;   // ← ahora opcional
  onUnauthorized?: () => Promise<void> | void;
  excludePaths?: RegExp;
  disableRefresh?: boolean;                             // ← NUEVO
};

export function attachAuthInterceptors(instance: AxiosInstance, opts: AttachOpts) {
  const exclude = opts.excludePaths ?? /(\/auth\/login|\/auth\/refresh-token|\/auth\/logout)$/i;

  const reqId = instance.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    if (config.skipAuth || exclude.test(config.url ?? '')) return config;

    try {
      const token = await opts.getAccessToken();
      console.log(token);
      if (token) {
        config.headers = config.headers ?? {};
        (config.headers as any).Authorization = `Bearer ${token}`;
      }
    } catch { /* noop */ }

    return config;
  });

  let isRefreshing = false;
  let queue: {
    resolve: (v?: unknown) => void;
    reject: (r?: unknown) => void;
    config: InternalAxiosRequestConfig;
  }[] = [];

  const flush = async (error: unknown, token: string | null) => {
    queue.forEach(({ resolve, reject, config }) => {
      if (error) return reject(error);
      config.headers = config.headers ?? {};
      if (token) (config.headers as any).Authorization = `Bearer ${token}`;
      resolve(instance(config));
    });
    queue = [];
  };

  const resId = instance.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {


      const original = error.config as InternalAxiosRequestConfig | undefined;
      const status = error.response?.status;

      console.log(original);
      console.log(status);
      // Público o sin config → no tocar
      if (!original || original.skipAuth || (original.url && exclude.test(original.url))) {
        return Promise.reject(error);
      }

      // ====> SIN REFRESH: 401 ⇒ signOut + redirect
      if (opts.disableRefresh) {
        if (status === 401) {
          if (opts.onUnauthorized) await opts.onUnauthorized();
        }
        return Promise.reject(error);
      }

      // ====> CON REFRESH (por si luego lo quieres activar)
      if (status === 401 && !original._retry) {
        original._retry = true;

        // Si no hay refreshAccessToken, comportarse como disableRefresh
        if (!opts.refreshAccessToken) {
          if (opts.onUnauthorized) await opts.onUnauthorized();
          return Promise.reject(error);
        }

        if (isRefreshing) {
          return new Promise((resolve, reject) => queue.push({ resolve, reject, config: original }));
        }

        isRefreshing = true;
        try {
          const newToken = await opts.refreshAccessToken();
          await flush(null, newToken);
          isRefreshing = false;

          original.headers = original.headers ?? {};
          if (newToken) (original.headers as any).Authorization = `Bearer ${newToken}`;
          return instance(original);
        } catch (e) {
          isRefreshing = false;
          await flush(e, null);
          if (opts.onUnauthorized) await opts.onUnauthorized();
          return Promise.reject(e);
        }
      }

      return Promise.reject(error);
    }
  );

  console.log(reqId);
  console.log(resId);

  return () => {
    instance.interceptors.request.eject(reqId);
    instance.interceptors.response.eject(resId);
  };
}
