import { ProviderError } from '../../ports/storageProvider';

export const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
export const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';
export const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
export const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
export const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.appdata openid email';

export interface AuthorizationUrlOptions {
  clientId: string;
  redirectUrl: string;
  interactive: boolean;
  accountHint?: string;
}

export function buildAuthorizationUrl(options: AuthorizationUrlOptions): string {
  const params = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirectUrl,
    response_type: 'token',
    scope: DRIVE_SCOPES,
    prompt: options.interactive ? 'select_account' : 'none',
  });
  if (options.accountHint) params.set('login_hint', options.accountHint);
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

export interface TokenGrant {
  accessToken: string;
  expiresAt: number;
}

export function parseAuthRedirect(
  redirectUrl: string | undefined,
  now: number,
): TokenGrant {
  if (!redirectUrl) {
    throw new ProviderError('auth', 'authorization flow returned no redirect');
  }
  let url: URL;
  try {
    url = new URL(redirectUrl);
  } catch (e) {
    throw new ProviderError('auth', 'authorization redirect is not a URL', { cause: e });
  }
  const fragment = url.hash.startsWith('#') ? url.hash.slice(1) : url.search.slice(1);
  const params = new URLSearchParams(fragment);
  const error = params.get('error');
  if (error) {
    throw new ProviderError('auth', `authorization denied: ${error}`);
  }
  const accessToken = params.get('access_token');
  if (!accessToken) {
    throw new ProviderError('auth', 'authorization redirect carried no access token');
  }
  const expiresInSec = Number(params.get('expires_in') ?? '3600');
  const ttlMs = (Number.isFinite(expiresInSec) && expiresInSec > 0 ? expiresInSec : 3600) * 1000;
  return { accessToken, expiresAt: now + ttlMs };
}
