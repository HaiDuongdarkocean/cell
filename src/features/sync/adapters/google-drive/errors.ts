import { ProviderError } from '../../ports/storageProvider';
import type { ProviderErrorKind } from '../../ports/storageProvider';

const RATE_LIMIT_REASONS = new Set([
  'rateLimitExceeded',
  'userRateLimitExceeded',
  'dailyLimitExceeded',
]);

export function providerErrorKindForStatus(status: number, reason?: string): ProviderErrorKind {
  if (status === 401) return 'auth';
  if (status === 403) {
    if (reason && RATE_LIMIT_REASONS.has(reason)) return 'rate-limit';
    if (reason === 'storageQuotaExceeded') return 'quota';
    return 'auth';
  }
  if (status === 404) return 'not-found';
  if (status === 408) return 'network';
  if (status === 429) return 'rate-limit';
  if (status >= 500) return 'network';
  return 'unknown';
}

interface DriveErrorShape {
  error?: {
    code?: number;
    message?: string;
    errors?: { reason?: string }[];
  };
}

export async function providerErrorFromResponse(response: Response): Promise<ProviderError> {
  let reason: string | undefined;
  let message = `HTTP ${response.status}`;
  try {
    const body = (await response.json()) as DriveErrorShape;
    reason = body.error?.errors?.[0]?.reason;
    if (body.error?.message) message = body.error.message;
  } catch {
    try {
      const text = await response.text();
      if (text) message = `${message}: ${text.slice(0, 200)}`;
    } catch {}
  }
  return new ProviderError(providerErrorKindForStatus(response.status, reason), message);
}

export function toProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new ProviderError('network', message, { cause: error });
}
