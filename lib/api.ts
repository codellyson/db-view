/**
 * Resilient API client built on axios.
 * All frontend API calls go through this module.
 *
 * Features:
 * - Auto-reconnect: if the server reports a lost DB connection, attempts
 *   to re-establish using saved credentials, then retries the original request.
 * - Retry with backoff on infrastructure errors (502/503/504).
 * - Clear, classified error messages for UI display.
 */

import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

const CURRENT_KEY = 'db-current-connection';

const client = axios.create({
  baseURL: '',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// --- Auto-reconnect machinery ---

let isReconnecting = false;
let reconnectPromise: Promise<boolean> | null = null;

function isConnectionLostError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('connection was lost') ||
    lower.includes('connection terminated') ||
    lower.includes('no database connection') ||
    lower.includes('connect to a database') ||
    lower.includes('not connected') ||
    lower.includes('connection reset') ||
    lower.includes('pool has been destroyed');
}

function getCurrentConnectionId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CURRENT_KEY);
}

async function attemptReconnect(): Promise<boolean> {
  // Deduplicate: if already reconnecting, wait for that attempt
  if (reconnectPromise) return reconnectPromise;

  const connectionId = getCurrentConnectionId();
  if (!connectionId) return false;

  isReconnecting = true;
  reconnectPromise = (async () => {
    try {
      // Server reads credentials from encrypted HTTP-only cookie
      const res = await axios.patch('/api/saved-connections',
        { id: connectionId },
        { timeout: 10000, headers: { 'Content-Type': 'application/json' } },
      );
      return res.status === 200;
    } catch {
      return false;
    } finally {
      isReconnecting = false;
      reconnectPromise = null;
    }
  })();

  return reconnectPromise;
}

// --- Response interceptor ---

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ error?: string; message?: string }>) => {
    let message = 'An unexpected error occurred';
    const status = error.response?.status;

    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      message = 'Request timed out. The server may be slow or unreachable.';
    } else if (!error.response) {
      message = 'Network error. Check your connection and try again.';
    } else if (error.response.data) {
      message = error.response.data.error || error.response.data.message || `Request failed (${status})`;
    }

    // Auto-reconnect: if this looks like a lost DB connection, try to reconnect
    // and replay the original request once
    const originalRequest = error.config as InternalAxiosRequestConfig & { _reconnectAttempted?: boolean };
    if (
      originalRequest &&
      !originalRequest._reconnectAttempted &&
      !isReconnecting &&
      isConnectionLostError(message)
    ) {
      originalRequest._reconnectAttempted = true;
      const reconnected = await attemptReconnect();
      if (reconnected) {
        // Retry the original request
        return client.request(originalRequest);
      }
    }

    const enriched = new Error(message) as Error & { status?: number };
    enriched.status = status;
    return Promise.reject(enriched);
  }
);

// --- Request helpers ---

interface ApiOptions extends Omit<AxiosRequestConfig, 'url' | 'method' | 'data'> {
  /** Skip retry logic (default for mutations) */
  noRetry?: boolean;
  /** Max retry attempts (default: 2 for GET) */
  retries?: number;
}

function isRetryable(status?: number, msg?: string): boolean {
  if (!status) return true; // network errors are retryable
  if (msg && isConnectionLostError(msg)) return false; // handled by reconnect, not retry
  if (msg) {
    const lower = msg.toLowerCase();
    if (lower.includes('authentication') || lower.includes('permission denied')) {
      return false;
    }
  }
  return status === 502 || status === 503 || status === 504 || status === 408 || status === 429;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  url: string,
  data?: any,
  options: ApiOptions = {}
): Promise<T> {
  const { noRetry, retries = 2, ...axiosConfig } = options;
  const shouldRetry = noRetry !== undefined ? !noRetry : method === 'GET';
  const maxAttempts = shouldRetry ? retries + 1 : 1;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await client.request<T>({
        method,
        url,
        data,
        ...axiosConfig,
      });
      return response.data;
    } catch (err: any) {
      lastError = err;
      const status = err.status as number | undefined;

      if (shouldRetry && isRetryable(status, err.message) && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}

export const api = {
  get: <T = any>(url: string, options?: ApiOptions) =>
    request<T>('GET', url, undefined, options),

  post: <T = any>(url: string, body?: any, options?: ApiOptions) =>
    request<T>('POST', url, body, options),

  patch: <T = any>(url: string, body?: any, options?: ApiOptions) =>
    request<T>('PATCH', url, body, options),

  delete: <T = any>(url: string, body?: any, options?: ApiOptions) =>
    request<T>('DELETE', url, body, options),
};
