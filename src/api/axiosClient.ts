// src/api/axiosClient.ts
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from "axios";
import { getItem } from "../utils/storage";
import Constants from "expo-constants";
import { logger } from "../utils/logger";

const expoConfig = Constants.expoConfig ?? (Constants as any).manifest;
const baseURL =
  expoConfig?.extra?.EXPO_PUBLIC_API_URL ??
  process.env.EXPO_PUBLIC_API_URL ??
  "https://hurrypos-backend.onrender.com/api";

// ✅ Simple in-memory cache for GET requests (5 min TTL)
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

const requestCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCacheKey = (method: string, url: string): string => {
  return `${method}:${url}`;
};

const isCacheValid = (entry: CacheEntry): boolean => {
  return Date.now() - entry.timestamp < entry.ttl;
};

const clearExpiredCache = () => {
  for (const [key, entry] of requestCache.entries()) {
    if (!isCacheValid(entry)) {
      requestCache.delete(key);
    }
  }
};

// ✅ Run cache cleanup every 60 seconds
setInterval(clearExpiredCache, 60000);

logger.log("[axiosClient] API baseURL:", baseURL);

const api: AxiosInstance = axios.create({
  baseURL,
  timeout: 15000,
});

// ✅ Request interceptor: attach token + add cache support
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getItem("token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add cache key for GET requests
    const cacheKey = getCacheKey(config.method || "GET", config.url || "");
    (config as any).cacheKey = cacheKey;

    return config;
  },
  (error) => {
    logger.error("[axiosClient] Request error:", error);
    return Promise.reject(error);
  }
);

// ✅ Response interceptor: cache GET responses
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Cache successful GET responses
    if (response.config.method === "get" || response.config.method === "GET") {
      const cacheKey = (response.config as any).cacheKey;
      if (cacheKey) {
        requestCache.set(cacheKey, {
          data: response.data,
          timestamp: Date.now(),
          ttl: CACHE_TTL,
        });
      }
    }
    return response;
  },
  (error) => {
    // ✅ Return cached data on error if available (for GET requests)
    if (error.config && (error.config.method === "get" || error.config.method === "GET")) {
      const cacheKey = (error.config as any).cacheKey;
      const cached = requestCache.get(cacheKey);

      if (cached && isCacheValid(cached)) {
        logger.log("[axiosClient] Returning cached response on error:", cacheKey);
        return Promise.resolve({ data: cached.data, config: error.config } as any);
      }
    }

    // Suppress logging for known expected errors (fallback endpoints)
    const shouldSuppressLog = 
      error.response?.status === 404 && error.config?.url?.includes("/supplier-carts") ||
      error.response?.status === 500 && error.config?.url?.includes("/suppliers/transactions") && error.config?.method === "get";

    if (!shouldSuppressLog) {
      // Build richer diagnostic info for server (5xx) and other response errors
      try {
        const resp = error.response;
        const cfg = error.config || {};
        const details = {
          message: error.message,
          status: resp?.status,
          url: cfg.url,
          method: cfg.method,
          requestData: cfg.data,
          responseData: resp?.data,
          headers: resp?.headers,
        };

        // Log full details (logger only prints in dev)
        logger.error("[axiosClient] Response error:", details);
      } catch (e) {
        // Fallback minimal log
        logger.error("[axiosClient] Response error (logging failed):", String(error));
      }
    }

    return Promise.reject(error);
  }
);

export default api;
