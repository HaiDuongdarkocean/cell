import type { Connection } from '../../domain/types';
import type { Clock } from '../../ports/clock';
import type { KeyValueStore } from '../../ports/keyValueStore';
import { ProviderError } from '../../ports/storageProvider';
import type {
  AuthorizedAccount,
  ProviderErrorKind,
  RemoteEntry,
  StorageProvider,
} from '../../ports/storageProvider';
import { blobToBytes } from '../contract/blobBytes';
import {
  buildAuthorizationUrl,
  DRIVE_API_BASE,
  DRIVE_UPLOAD_BASE,
  GOOGLE_REVOKE_ENDPOINT,
  GOOGLE_USERINFO_ENDPOINT,
  parseAuthRedirect,
} from './authUrls';
import { providerErrorFromResponse, toProviderError } from './errors';

export interface WebAuthFlowRequest {
  url: string;
  interactive: boolean;
  abortOnLoadForNonInteractive?: boolean;
  timeoutMsForNonInteractive?: number;
}

export type LaunchWebAuthFlow = (request: WebAuthFlowRequest) => Promise<string | undefined>;

export interface GoogleDriveStorageProviderDeps {
  kv: KeyValueStore;
  clientId?: string;
  launchWebAuthFlow?: LaunchWebAuthFlow;
  getRedirectUrl?: () => string;
  fetchFn?: typeof fetch;
  clock?: Clock;
  sleep?: (ms: number) => Promise<void>;
  retryAttempts?: number;
  resumableThresholdBytes?: number;
  silentFlowTimeoutMs?: number;
}

interface DriveFile {
  id?: string;
  name?: string;
  size?: string;
  modifiedTime?: string;
  md5Checksum?: string;
}

interface DriveFileList {
  files?: DriveFile[];
  nextPageToken?: string;
}

interface UserInfoResponse {
  sub?: string;
  email?: string;
}

interface StoredToken {
  accessToken: string;
  expiresAt: number;
}

interface ResumeState {
  uri: string;
  fileId?: string;
  size: number;
}

interface SessionProbe {
  kind: 'committed' | 'resume' | 'dead';
  file?: DriveFile;
  offset?: number;
}

const PROVIDER_ID = 'google-drive';
const APP_FOLDER = 'appDataFolder';
const LIST_FIELDS = 'nextPageToken,files(id,name,size,modifiedTime,md5Checksum)';
const FILE_FIELDS = 'id,name,size,modifiedTime,md5Checksum';
const TOKEN_EXPIRY_MARGIN_MS = 5 * 60 * 1000;
const DEFAULT_RESUMABLE_THRESHOLD = 5 * 1024 * 1024;
const DEFAULT_RETRY_ATTEMPTS = 3;
const RETRY_BASE_MS = 250;
const RETRY_CAP_MS = 8000;
const DEFAULT_SILENT_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 60_000;
const MIN_UPLOAD_BPS = 100 * 1024;
const RETRYABLE_KINDS: ReadonlySet<ProviderErrorKind> = new Set(['rate-limit', 'network']);

function tokenStoreKey(accountKey: string): string {
  return `syncAdapter:${PROVIDER_ID}:token:${accountKey}`;
}

function resumeKeyPrefix(path: string): string {
  return `syncAdapter:${PROVIDER_ID}:${path}:`;
}

function toBlob(bytes: Uint8Array): Blob {
  const buf = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Blob([buf]);
}

function bodySizeBytes(body: BodyInit | null | undefined): number {
  if (body == null) return 0;
  if (body instanceof Blob) return body.size;
  if (typeof body === 'string') return body.length;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body)) return body.byteLength;
  if (body instanceof URLSearchParams) return body.toString().length;
  return 0;
}

function escapeQueryLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function fileModifiedAt(file: DriveFile): number {
  const parsed = Date.parse(file.modifiedTime ?? '');
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toRemoteEntry(file: DriveFile): RemoteEntry {
  const entry: RemoteEntry = {
    path: file.name ?? '',
    size: Number(file.size ?? 0),
    modifiedAt: fileModifiedAt(file),
  };
  if (file.md5Checksum !== undefined) entry.providerChecksum = file.md5Checksum;
  return entry;
}

async function contentHashHex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const buf = await subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
    let hex = '';
    for (const b of new Uint8Array(buf)) hex += b.toString(16).padStart(2, '0');
    return hex;
  }
  let h0 = 0x811c9dc5;
  let h1 = 0x811c9dc5 ^ 0x9e3779b9;
  for (const b of bytes) {
    h0 = Math.imul(h0 ^ b, 0x01000193);
    h1 = Math.imul(h1 ^ b, 0x01000193);
  }
  return `${(h0 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

export class GoogleDriveStorageProvider implements StorageProvider {
  readonly providerId = PROVIDER_ID;
  readonly displayName = 'Google Drive';

  private readonly kv: KeyValueStore;
  private readonly clientId?: string;
  private readonly launchFlow?: LaunchWebAuthFlow;
  private readonly redirectUrl?: () => string;
  private readonly fetchFn: typeof fetch;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly retryAttempts: number;
  private readonly resumableThreshold: number;
  private readonly silentFlowTimeoutMs: number;
  private boundarySeq = 0;

  constructor(deps: GoogleDriveStorageProviderDeps) {
    this.kv = deps.kv;
    this.clientId = deps.clientId;
    this.launchFlow = deps.launchWebAuthFlow;
    this.redirectUrl = deps.getRedirectUrl;
    this.fetchFn = deps.fetchFn ?? ((url, init) => fetch(url, init));
    const clock = deps.clock;
    this.now = () => (clock ? clock.now() : Date.now());
    this.sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.retryAttempts = deps.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS;
    this.resumableThreshold = deps.resumableThresholdBytes ?? DEFAULT_RESUMABLE_THRESHOLD;
    this.silentFlowTimeoutMs = deps.silentFlowTimeoutMs ?? DEFAULT_SILENT_TIMEOUT_MS;
  }

  async authorize(opts: { interactive: boolean; accountHint?: string }): Promise<AuthorizedAccount> {
    if (!this.clientId) {
      throw new ProviderError('unknown', 'google-drive OAuth client id is not configured');
    }
    if (!this.launchFlow || !this.redirectUrl) {
      throw new ProviderError('unknown', 'chrome.identity web auth flow is unavailable');
    }
    const url = buildAuthorizationUrl({
      clientId: this.clientId,
      redirectUrl: this.redirectUrl(),
      interactive: opts.interactive,
      accountHint: opts.accountHint,
    });
    let redirect: string | undefined;
    try {
      redirect = await this.launchFlow(
        opts.interactive
          ? { url, interactive: true }
          : {
              url,
              interactive: false,
              abortOnLoadForNonInteractive: true,
              timeoutMsForNonInteractive: this.silentFlowTimeoutMs,
            },
      );
    } catch (e) {
      throw new ProviderError('auth', 'authorization flow aborted', { cause: e });
    }
    const grant = parseAuthRedirect(redirect, this.now());
    const info = await this.withRetry(() => this.requestUserInfo(grant.accessToken));
    if (!info.sub) {
      throw new ProviderError('unknown', 'userinfo response carried no subject');
    }
    const token: StoredToken = { accessToken: grant.accessToken, expiresAt: grant.expiresAt };
    await this.kv.set('session', tokenStoreKey(info.sub), token);
    return {
      accountKey: info.sub,
      displayName: info.email ?? info.sub,
      accessToken: grant.accessToken,
      expiresAt: grant.expiresAt,
    };
  }

  async hasToken(connection: Connection): Promise<boolean> {
    const stored = await this.kv.get<StoredToken>(
      'session',
      tokenStoreKey(connection.accountKey),
    );
    return typeof stored?.accessToken === 'string' && stored.accessToken !== '';
  }

  async revoke(connection: Connection): Promise<void> {
    this.requireConnection(connection);
    const stored = await this.kv.get<StoredToken>('session', tokenStoreKey(connection.accountKey));
    if (stored?.accessToken) {
      try {
        await this.withRetry(() =>
          this.send(GOOGLE_REVOKE_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `token=${encodeURIComponent(stored.accessToken)}`,
          }),
        );
      } catch {}
    }
    await this.kv.del('session', tokenStoreKey(connection.accountKey));
  }

  async list(connection: Connection, prefix: string): Promise<RemoteEntry[]> {
    return this.authed(connection, async (token) => {
      const clause = prefix ? `name contains '${escapeQueryLiteral(prefix)}' and ` : '';
      const files = await this.queryFiles(
        token,
        `${clause}trashed = false and '${APP_FOLDER}' in parents`,
        (file) => file.name !== undefined && file.name.startsWith(prefix),
      );
      const newest = new Map<string, DriveFile>();
      for (const file of files) {
        const name = file.name ?? '';
        const prev = newest.get(name);
        if (!prev || fileModifiedAt(file) >= fileModifiedAt(prev)) newest.set(name, file);
      }
      return [...newest.values()]
        .map(toRemoteEntry)
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    });
  }

  async read(connection: Connection, path: string): Promise<Blob> {
    return this.authed(connection, async (token) => {
      const target = await this.newestCopy(token, path);
      const response = await this.send(
        `${DRIVE_API_BASE}/files/${encodeURIComponent(target.id ?? '')}?alt=media`,
        { headers: this.authHeaders(token) },
      );
      return new Blob([await response.arrayBuffer()]);
    });
  }

  async write(connection: Connection, path: string, body: Blob): Promise<RemoteEntry> {
    return this.authed(connection, async (token) => {
      const copies = await this.findCopies(token, path);
      const target = copies.length ? copies.reduce(newerFile) : undefined;
      const bytes = await blobToBytes(body);
      const committed =
        bytes.byteLength > this.resumableThreshold
          ? await this.resumableWrite(token, path, bytes, body.type, target)
          : target
            ? await this.mediaUpdate(token, target, bytes, body.type)
            : await this.multipartCreate(token, path, bytes, body.type);
      for (const copy of copies) {
        if (copy.id && copy.id !== committed.id) {
          await this.deleteFile(token, copy.id);
        }
      }
      return toRemoteEntry(committed);
    });
  }

  async remove(connection: Connection, path: string): Promise<void> {
    await this.authed(connection, async (token) => {
      const copies = await this.findCopies(token, path);
      if (copies.length === 0) {
        throw new ProviderError('not-found', `no such path: ${path}`);
      }
      for (const copy of copies) {
        if (copy.id) await this.deleteFile(token, copy.id);
      }
    });
  }

  async quota(connection: Connection): Promise<{ usedBytes: number; totalBytes: number | null }> {
    return this.authed(connection, async (token) => {
      const response = await this.send(`${DRIVE_API_BASE}/about?fields=storageQuota`, {
        headers: this.authHeaders(token),
      });
      const data = (await response.json()) as {
        storageQuota?: { usage?: string; limit?: string };
      };
      const limit = data.storageQuota?.limit;
      return {
        usedBytes: Number(data.storageQuota?.usage ?? 0),
        totalBytes: limit === undefined ? null : Number(limit),
      };
    });
  }

  private requireConnection(connection: Connection): void {
    if (connection.providerId !== this.providerId) {
      throw new ProviderError('auth', `connection is not a ${this.providerId} connection`);
    }
    if (connection.connectionId !== `${this.providerId}:${connection.accountKey}`) {
      throw new ProviderError('auth', `malformed connection id: ${connection.connectionId}`);
    }
  }

  private async tokenFor(connection: Connection): Promise<string> {
    const key = tokenStoreKey(connection.accountKey);
    const stored = await this.kv.get<StoredToken>('session', key);
    if (stored && stored.expiresAt - this.now() > TOKEN_EXPIRY_MARGIN_MS) {
      return stored.accessToken;
    }
    const account = await this.authorize({
      interactive: false,
      accountHint: connection.displayName,
    });
    if (account.accountKey !== connection.accountKey) {
      await this.kv.del('session', tokenStoreKey(account.accountKey));
      throw new ProviderError('auth', 'renewed token belongs to a different account');
    }
    return account.accessToken;
  }

  private async authed<T>(connection: Connection, fn: (token: string) => Promise<T>): Promise<T> {
    this.requireConnection(connection);
    for (let round = 0; round < 2; round += 1) {
      const token = await this.tokenFor(connection);
      try {
        return await this.withRetry(() => fn(token));
      } catch (e) {
        if (e instanceof ProviderError && e.kind === 'auth' && round === 0) {
          await this.kv.del('session', tokenStoreKey(connection.accountKey));
          continue;
        }
        throw e;
      }
    }
    throw new ProviderError('auth', 'authorization failed after token renewal');
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let last: ProviderError = new ProviderError('unknown', 'request did not run');
    for (let attempt = 0; attempt < this.retryAttempts; attempt += 1) {
      try {
        return await fn();
      } catch (e) {
        last = toProviderError(e);
        if (!RETRYABLE_KINDS.has(last.kind) || attempt === this.retryAttempts - 1) {
          throw last;
        }
        await this.sleep(Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_CAP_MS));
      }
    }
    throw last;
  }

  private authHeaders(token: string): Record<string, string> {
    return { Authorization: `Bearer ${token}` };
  }

  private async send(url: string, init: RequestInit): Promise<Response> {
    const timeoutMs = REQUEST_TIMEOUT_MS + Math.floor(bodySizeBytes(init.body) / MIN_UPLOAD_BPS) * 1000;
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    const response = await this.fetchFn(url, { ...init, signal });
    if (!response.ok) throw await providerErrorFromResponse(response);
    return response;
  }

  private async requestUserInfo(accessToken: string): Promise<UserInfoResponse> {
    const response = await this.send(GOOGLE_USERINFO_ENDPOINT, {
      headers: this.authHeaders(accessToken),
    });
    return (await response.json()) as UserInfoResponse;
  }

  private async queryFiles(
    token: string,
    q: string,
    keep: (file: DriveFile) => boolean,
  ): Promise<DriveFile[]> {
    const out: DriveFile[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({
        spaces: APP_FOLDER,
        q,
        fields: LIST_FIELDS,
        pageSize: '1000',
      });
      if (pageToken) params.set('pageToken', pageToken);
      const response = await this.send(`${DRIVE_API_BASE}/files?${params.toString()}`, {
        headers: this.authHeaders(token),
      });
      const data = (await response.json()) as DriveFileList;
      for (const file of data.files ?? []) {
        if (keep(file)) out.push(file);
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
    return out;
  }

  private async findCopies(token: string, path: string): Promise<DriveFile[]> {
    return this.queryFiles(
      token,
      `name = '${escapeQueryLiteral(path)}' and trashed = false and '${APP_FOLDER}' in parents`,
      (file) => file.name === path,
    );
  }

  private async newestCopy(token: string, path: string): Promise<DriveFile> {
    const copies = await this.findCopies(token, path);
    if (copies.length === 0) {
      throw new ProviderError('not-found', `no such path: ${path}`);
    }
    return copies.reduce(newerFile);
  }

  private async multipartCreate(
    token: string,
    path: string,
    bytes: Uint8Array,
    mimeType: string,
  ): Promise<DriveFile> {
    this.boundarySeq += 1;
    const boundary = `cell-sync-${this.now().toString(36)}-${this.boundarySeq.toString(36)}`;
    const encoder = new TextEncoder();
    const meta = encoder.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify({ name: path, parents: [APP_FOLDER] })}\r\n` +
        `--${boundary}\r\nContent-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`,
    );
    const trailer = encoder.encode(`\r\n--${boundary}--\r\n`);
    const body = new Uint8Array(meta.byteLength + bytes.byteLength + trailer.byteLength);
    body.set(meta, 0);
    body.set(bytes, meta.byteLength);
    body.set(trailer, meta.byteLength + bytes.byteLength);
    const response = await this.send(
      `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=${encodeURIComponent(FILE_FIELDS)}`,
      {
        method: 'POST',
        headers: {
          ...this.authHeaders(token),
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: toBlob(body),
      },
    );
    return (await response.json()) as DriveFile;
  }

  private async mediaUpdate(
    token: string,
    target: DriveFile,
    bytes: Uint8Array,
    mimeType: string,
  ): Promise<DriveFile> {
    const response = await this.send(
      `${DRIVE_UPLOAD_BASE}/files/${encodeURIComponent(target.id ?? '')}` +
        `?uploadType=media&fields=${encodeURIComponent(FILE_FIELDS)}`,
      {
        method: 'PATCH',
        headers: {
          ...this.authHeaders(token),
          'Content-Type': mimeType || 'application/octet-stream',
        },
        body: toBlob(bytes),
      },
    );
    return (await response.json()) as DriveFile;
  }

  private async resumableWrite(
    token: string,
    path: string,
    bytes: Uint8Array,
    mimeType: string,
    target: DriveFile | undefined,
  ): Promise<DriveFile> {
    const hash = await contentHashHex(bytes);
    const key = `${resumeKeyPrefix(path)}${hash}`;
    const saved = await this.kv.get<ResumeState>('local', key);
    let sessionUri: string | undefined;
    let fileId = target?.id;
    if (saved && saved.size === bytes.byteLength) {
      sessionUri = saved.uri;
      fileId = saved.fileId ?? fileId;
    }
    if (sessionUri) {
      const probe = await this.probeSession(token, sessionUri, bytes.byteLength);
      if (probe.kind === 'committed' && probe.file) {
        await this.clearResumeKeys(path, key);
        return probe.file;
      }
      const offset = probe.kind === 'resume' ? (probe.offset ?? 0) : -1;
      if (offset >= 0 && offset < bytes.byteLength) {
        const file = await this.uploadChunk(token, sessionUri, bytes, offset);
        await this.clearResumeKeys(path, key);
        return file;
      }
      await this.kv.del('local', key);
    }
    const initiated = await this.initiateSession(token, path, bytes, mimeType, fileId);
    sessionUri = initiated.uri;
    fileId = initiated.fileId ?? fileId;
    await this.kv.set('local', key, { uri: sessionUri, fileId, size: bytes.byteLength });
    const file = await this.uploadChunk(token, sessionUri, bytes, 0);
    await this.clearResumeKeys(path, key);
    return file;
  }

  private async initiateSession(
    token: string,
    path: string,
    bytes: Uint8Array,
    mimeType: string,
    fileId: string | undefined,
  ): Promise<{ uri: string; fileId?: string }> {
    const headers: Record<string, string> = {
      ...this.authHeaders(token),
      'X-Upload-Content-Type': mimeType || 'application/octet-stream',
      'X-Upload-Content-Length': String(bytes.byteLength),
    };
    const response = fileId
      ? await this.send(
          `${DRIVE_UPLOAD_BASE}/files/${encodeURIComponent(fileId)}?uploadType=resumable`,
          { method: 'PATCH', headers },
        )
      : await this.send(`${DRIVE_UPLOAD_BASE}/files?uploadType=resumable`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json; charset=UTF-8' },
          body: JSON.stringify({ name: path, parents: [APP_FOLDER] }),
        });
    const uri = response.headers.get('Location');
    if (!uri) {
      throw new ProviderError('unknown', 'resumable initiation returned no session URI');
    }
    return { uri, fileId };
  }

  private async probeSession(
    token: string,
    sessionUri: string,
    size: number,
  ): Promise<SessionProbe> {
    const response = await this.fetchFn(sessionUri, {
      method: 'PUT',
      headers: {
        ...this.authHeaders(token),
        'Content-Range': `bytes */${size}`,
      },
    });
    if (response.status === 308) {
      const range = response.headers.get('Range');
      const offset = range ? parseRangeEnd(range) + 1 : 0;
      return { kind: 'resume', offset };
    }
    if (response.status === 404 || response.status === 410) {
      return { kind: 'dead' };
    }
    if (response.ok) {
      return { kind: 'committed', file: (await response.json()) as DriveFile };
    }
    throw await providerErrorFromResponse(response);
  }

  private async uploadChunk(
    token: string,
    sessionUri: string,
    bytes: Uint8Array,
    offset: number,
  ): Promise<DriveFile> {
    const end = bytes.byteLength - 1;
    const response = await this.fetchFn(sessionUri, {
      method: 'PUT',
      headers: {
        ...this.authHeaders(token),
        'Content-Range': `bytes ${offset}-${end}/${bytes.byteLength}`,
        'Content-Type': 'application/octet-stream',
      },
      body: toBlob(bytes.subarray(offset)),
    });
    if (response.status === 308) {
      throw new ProviderError('network', 'resumable upload interrupted before commit');
    }
    if (!response.ok) throw await providerErrorFromResponse(response);
    return (await response.json()) as DriveFile;
  }

  private async clearResumeKeys(path: string, currentKey: string): Promise<void> {
    const keys = await this.kv.list('local', resumeKeyPrefix(path));
    for (const key of keys) {
      if (key !== currentKey) await this.kv.del('local', key);
    }
    await this.kv.del('local', currentKey);
  }

  private async deleteFile(token: string, fileId: string): Promise<void> {
    try {
      await this.send(`${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}`, {
        method: 'DELETE',
        headers: this.authHeaders(token),
      });
    } catch (e) {
      if (e instanceof ProviderError && e.kind === 'not-found') return;
      throw e;
    }
  }
}

function newerFile(a: DriveFile, b: DriveFile): DriveFile {
  return fileModifiedAt(b) >= fileModifiedAt(a) ? b : a;
}

function parseRangeEnd(range: string): number {
  const match = /bytes=\d+-(\d+)/.exec(range);
  return match ? Number(match[1]) : -1;
}
