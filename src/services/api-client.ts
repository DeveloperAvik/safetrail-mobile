import { errorResponseSchema, type ErrorCode } from '@safetrail/contracts';
import type { z } from 'zod';
import { config } from './config';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'INVALID_RESPONSE',
    message: string,
    readonly details?: Array<{ path: string; message: string }>,
  ) {
    super(message);
  }
  /** True when the request never reached the server (or no answer came back). */
  get isNetwork() {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT';
  }
}

export interface TokenProvider {
  getAccessToken(): string | null;
  /** Refresh the access token; resolves to the new token or null if the session ended. */
  refresh(): Promise<string | null>;
  onUnauthenticated(): void;
}

let tokens: TokenProvider | null = null;
export function setTokenProvider(p: TokenProvider) {
  tokens = p;
}

interface RequestOptions<T extends z.ZodType> {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  schema?: T;
  auth?: boolean;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

async function rawFetch(path: string, opts: RequestOptions<z.ZodType>, accessToken: string | null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? config.requestTimeoutMs);
  try {
    return await fetch(`${config.apiUrl}/api/v1${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...opts.headers,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) throw new ApiError(0, 'TIMEOUT', 'The server took too long to respond');
    throw new ApiError(0, 'NETWORK_ERROR', (err as Error).message || 'Network request failed');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Typed request helper: attaches the access token, refreshes it once on 401, maps errors to
 * ApiError and validates the response against the shared contract schema when provided.
 */
export async function request<T extends z.ZodType = z.ZodUnknown>(path: string, opts: RequestOptions<T> = {}): Promise<z.infer<T>> {
  const useAuth = opts.auth !== false;
  let res = await rawFetch(path, opts, useAuth ? (tokens?.getAccessToken() ?? null) : null);
  if (res.status === 401 && useAuth && tokens) {
    const fresh = await tokens.refresh();
    if (!fresh) {
      tokens.onUnauthenticated();
      throw new ApiError(401, 'UNAUTHENTICATED', 'Your session has ended. Please sign in again.');
    }
    res = await rawFetch(path, opts, fresh);
  }
  if (res.status === 204) return undefined as z.infer<T>;
  const text = await res.text();
  let json: unknown = undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    throw new ApiError(res.status, 'INVALID_RESPONSE', 'Unexpected response from server');
  }
  if (!res.ok) {
    const parsed = errorResponseSchema.safeParse(json);
    if (parsed.success) throw new ApiError(res.status, parsed.data.error.code, parsed.data.error.message, parsed.data.error.details);
    throw new ApiError(res.status, res.status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR', `Request failed (${res.status})`);
  }
  if (opts.schema) {
    const parsed = opts.schema.safeParse(json);
    if (!parsed.success) throw new ApiError(res.status, 'INVALID_RESPONSE', 'Server response did not match the API contract');
    return parsed.data;
  }
  return json as z.infer<T>;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.isNetwork) return 'No connection to the SafeTrail server.';
    return err.details?.[0] ? `${err.message}: ${err.details[0].message}` : err.message;
  }
  return 'Something went wrong. Please try again.';
}
