import type { Connection } from '../../domain/types';
import type { Clock } from '../../ports/clock';
import type { KeyValueStore } from '../../ports/keyValueStore';
import { ProviderError } from '../../ports/storageProvider';
import type {
  AuthorizedAccount,
  ChangeSignal,
  ProviderErrorKind,
  RemoteEntry,
  StorageProvider,
  WriteOptions,
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
import {
  FOLDER_MIME as DRIVE_FOLDER_MIME,
  folderedTarget,
  logicalPathOf,
  mapLogicalPath,
  REMOTE_ROOT,
  scopeOfFolderName,
} from './driveLayout';
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
  version?: string;
  modifiedTime?: string;
  createdTime?: string;
  md5Checksum?: string;
  mimeType?: string;
  trashed?: boolean;
  parents?: string[];
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
const DRIVE_SPACE = 'drive';
const SYNC_ROOT_FOLDER_NAME = 'Tihoka Sync';
const LIST_FIELDS =
  'nextPageToken,files(id,name,size,modifiedTime,createdTime,md5Checksum,mimeType,trashed,parents)';
const FILE_FIELDS = 'id,name,size,modifiedTime,mimeType,trashed';
const FLAT_MIGRATE_INTERVAL_MS = 60 * 60 * 1000;
const PARENT_OR_CHUNK = 100;
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

function rootFolderKey(accountKey: string): string {
  return `syncAdapter:${PROVIDER_ID}:root:${accountKey}`;
}

function bellFileKey(accountKey: string): string {
  return `bellFileId:${accountKey}`;
}

const BELL_FOLDER_CHAIN: readonly string[] = ['meta'];
const BELL_FILE_NAME = 'bell.json';

function legacyCleanedKey(accountKey: string): string {
  return `syncAdapter:${PROVIDER_ID}:legacyCleaned:${accountKey}`;
}

function flatMigratedKey(accountKey: string): string {
  return `syncAdapter:${PROVIDER_ID}:flatMigrated:${accountKey}`;
}

function chainCacheKey(chain: readonly string[]): string {
  return chain.join('');
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
  private readonly verifiedRoots = new Set<string>();
  private readonly folderIds = new Map<string, Map<string, string>>();
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
      const rootId = await this.rootFolderId(token, connection);
      const flat = await this.flatListing(token, rootId, prefix);
      const foldered = await this.listFoldered(token, rootId, prefix);
      const byPath = new Map<string, RemoteEntry>();
      for (const file of flat) {
        const entry = toRemoteEntry(file);
        const prev = byPath.get(entry.path);
        if (!prev || entry.modifiedAt >= prev.modifiedAt) byPath.set(entry.path, entry);
      }
      for (const entry of foldered) {
        const prev = byPath.get(entry.path);
        if (!prev || entry.modifiedAt >= prev.modifiedAt) byPath.set(entry.path, entry);
      }
      try {
        await this.migrateFlatFiles(token, connection.accountKey, rootId, flat);
      } catch {}
      return [...byPath.values()].sort((a, b) =>
        a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
      );
    });
  }

  async read(connection: Connection, path: string): Promise<Blob> {
    return this.authed(connection, async (token) => {
      const rootId = await this.rootFolderId(token, connection);
      const copies = await this.allCopiesOf(token, connection.accountKey, rootId, path);
      if (copies.flat.length + copies.foldered.length === 0) {
        throw new ProviderError('not-found', `no such path: ${path}`);
      }
      const target = [...copies.flat, ...copies.foldered].reduce(newerFile);
      const response = await this.send(
        `${DRIVE_API_BASE}/files/${encodeURIComponent(target.id ?? '')}?alt=media`,
        { headers: this.authHeaders(token) },
      );
      return new Blob([await response.arrayBuffer()]);
    });
  }

  async write(
    connection: Connection,
    path: string,
    body: Blob,
    opts?: WriteOptions,
  ): Promise<RemoteEntry> {
    return this.authed(connection, async (token) => {
      const bytes = await blobToBytes(body);
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const rootId = await this.rootFolderId(token, connection);
        const mapped = mapLogicalPath(path);
        try {
          const parentId = mapped
            ? await this.resolveOrCreateChain(token, connection.accountKey, rootId, mapped.chain)
            : rootId;
          const leaf = mapped ? mapped.leaf : path;
          const copies =
            opts?.fresh === true
              ? { flat: [] as DriveFile[], foldered: [] as DriveFile[] }
              : mapped
                ? await this.allCopiesOf(token, connection.accountKey, rootId, path)
                : { flat: await this.findCopies(token, rootId, path), foldered: [] as DriveFile[] };
          const target = copies.foldered.length
            ? copies.foldered.reduce(newerFile)
            : mapped
              ? undefined
              : copies.flat.length
                ? copies.flat.reduce(newerFile)
                : undefined;
          const committed =
            bytes.byteLength > this.resumableThreshold
              ? await this.resumableWrite(token, parentId, leaf, path, bytes, body.type, target)
              : target
                ? await this.mediaUpdate(token, target, bytes, body.type)
                : await this.multipartCreate(token, parentId, leaf, bytes, body.type);
          for (const copy of [...copies.flat, ...copies.foldered]) {
            if (copy.id && copy.id !== committed.id) {
              await this.deleteFile(token, copy.id);
            }
          }
          return toRemoteEntry(committed);
        } catch (e) {
          if (e instanceof ProviderError && e.kind === 'not-found' && attempt === 0) {
            await this.invalidateRoot(connection.accountKey);
            continue;
          }
          throw e;
        }
      }
      throw new ProviderError('unknown', 'write retry loop exhausted');
    });
  }

  async remove(connection: Connection, path: string): Promise<void> {
    await this.authed(connection, async (token) => {
      const rootId = await this.rootFolderId(token, connection);
      const mapped = mapLogicalPath(path);
      const copies = mapped
        ? await this.allCopiesOf(token, connection.accountKey, rootId, path)
        : { flat: await this.findCopies(token, rootId, path), foldered: [] };
      if (copies.flat.length + copies.foldered.length === 0) {
        throw new ProviderError('not-found', `no such path: ${path}`);
      }
      for (const copy of [...copies.flat, ...copies.foldered]) {
        if (copy.id) await this.deleteFile(token, copy.id);
      }
      if (mapped) {
        const folderId = this.cachedChainId(connection.accountKey, mapped.chain);
        if (folderId !== undefined) {
          await this.reapIfEmpty(token, connection.accountKey, folderId);
        }
      }
    });
  }

  readonly signal: ChangeSignal = {
    peek: (connection) => this.peekBell(connection),
    ring: (connection) => this.ringBell(connection),
  };

  private async bellFileId(token: string, connection: Connection): Promise<string | undefined> {
    const key = bellFileKey(connection.accountKey);
    const cached = await this.kv.get<string>('local', key);
    if (cached !== undefined) return cached;
    const rootId = await this.rootFolderId(token, connection);
    const meta = await this.resolveChain(
      token,
      connection.accountKey,
      rootId,
      BELL_FOLDER_CHAIN,
    );
    if (meta?.id === undefined) return undefined;
    const found = (await this.findInFolder(token, meta.id, BELL_FILE_NAME))[0]?.id;
    if (found !== undefined) {
      await this.kv.set('local', key, found);
    }
    return found;
  }

  private async peekBell(connection: Connection): Promise<string | null> {
    return this.authed(connection, async (token) => {
      const fileId = await this.bellFileId(token, connection);
      if (fileId === undefined) return null;
      try {
        const response = await this.send(
          `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?fields=version,trashed`,
          { headers: this.authHeaders(token) },
        );
        const file = (await response.json()) as DriveFile;
        if (file.trashed === true) {
          await this.kv.del('local', bellFileKey(connection.accountKey));
          return null;
        }
        return file.version !== undefined ? String(file.version) : null;
      } catch (e) {
        if (e instanceof ProviderError && e.kind === 'not-found') {
          await this.kv.del('local', bellFileKey(connection.accountKey));
          return null;
        }
        throw e;
      }
    });
  }

  private async ringBell(connection: Connection): Promise<string> {
    return this.authed(connection, async (token) => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        let fileId = await this.bellFileId(token, connection);
        if (fileId === undefined) {
          fileId = await this.createBellFile(token, connection);
          await this.kv.set('local', bellFileKey(connection.accountKey), fileId);
        }
        try {
          const response = await this.send(
            `${DRIVE_UPLOAD_BASE}/files/${encodeURIComponent(fileId)}?uploadType=media&fields=version`,
            {
              method: 'PATCH',
              headers: {
                ...this.authHeaders(token),
                'Content-Type': 'application/json; charset=UTF-8',
              },
              body: JSON.stringify({ at: this.now() }),
            },
          );
          const file = (await response.json()) as DriveFile;
          if (file.version === undefined) {
            throw new ProviderError('unknown', 'bell update returned no version');
          }
          return String(file.version);
        } catch (e) {
          if (e instanceof ProviderError && e.kind === 'not-found' && attempt === 0) {
            await this.kv.del('local', bellFileKey(connection.accountKey));
            continue;
          }
          throw e;
        }
      }
      throw new ProviderError('unknown', 'bell ring retry loop exhausted');
    });
  }

  private async createBellFile(token: string, connection: Connection): Promise<string> {
    const rootId = await this.rootFolderId(token, connection);
    const parentId = await this.resolveOrCreateChain(
      token,
      connection.accountKey,
      rootId,
      BELL_FOLDER_CHAIN,
    );
    const file = await this.multipartCreate(
      token,
      parentId,
      BELL_FILE_NAME,
      new TextEncoder().encode(JSON.stringify({ at: this.now() })),
      'application/json',
    );
    if (file.id === undefined) {
      throw new ProviderError('unknown', 'bell file creation returned no id');
    }
    return file.id;
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

  private async invalidateRoot(accountKey: string): Promise<void> {
    this.verifiedRoots.delete(accountKey);
    this.folderIds.delete(accountKey);
    await this.kv.del('local', rootFolderKey(accountKey));
  }

  private async rootFolderId(token: string, connection: Connection): Promise<string> {
    const accountKey = connection.accountKey;
    const key = rootFolderKey(accountKey);
    let rootId = await this.kv.get<string>('local', key);
    if (rootId !== undefined && !this.verifiedRoots.has(accountKey)) {
      try {
        const response = await this.send(
          `${DRIVE_API_BASE}/files/${encodeURIComponent(rootId)}?fields=id,trashed`,
          {
            headers: this.authHeaders(token),
          },
        );
        const file = (await response.json()) as DriveFile;
        if (file.trashed === true) {
          await this.kv.del('local', key);
          rootId = undefined;
        } else {
          this.verifiedRoots.add(accountKey);
        }
      } catch (e) {
        if (e instanceof ProviderError && e.kind === 'not-found') {
          await this.kv.del('local', key);
          rootId = undefined;
        } else {
          throw e;
        }
      }
    }
    if (rootId === undefined) {
      const existing = await this.queryFiles(
        token,
        `name = '${escapeQueryLiteral(SYNC_ROOT_FOLDER_NAME)}' and ` +
          `mimeType = '${DRIVE_FOLDER_MIME}' and 'root' in parents and trashed = false`,
        (file) => file.id !== undefined,
        DRIVE_SPACE,
      );
      const found = existing[0]?.id;
      if (found !== undefined) {
        rootId = found;
      } else {
        const response = await this.send(`${DRIVE_API_BASE}/files?fields=id`, {
          method: 'POST',
          headers: {
            ...this.authHeaders(token),
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify({
            name: SYNC_ROOT_FOLDER_NAME,
            mimeType: DRIVE_FOLDER_MIME,
            parents: ['root'],
          }),
        });
        rootId = ((await response.json()) as DriveFile).id;
        if (rootId === undefined) {
          throw new ProviderError('unknown', 'sync root folder creation returned no id');
        }
      }
      await this.kv.set('local', key, rootId);
      this.verifiedRoots.add(accountKey);
    }
    await this.cleanupLegacySpace(token, accountKey);
    return rootId;
  }

  private async cleanupLegacySpace(token: string, accountKey: string): Promise<void> {
    const flag = legacyCleanedKey(accountKey);
    if (await this.kv.get<boolean>('local', flag)) return;
    try {
      const files = await this.queryFiles(
        token,
        'trashed = false',
        (file) => file.id !== undefined,
        APP_FOLDER,
      );
      for (const file of files) {
        if (file.id) await this.deleteFile(token, file.id);
      }
      await this.kv.set('local', flag, true);
    } catch {}
  }

  private async queryFiles(
    token: string,
    q: string,
    keep: (file: DriveFile) => boolean,
    spaces: string,
  ): Promise<DriveFile[]> {
    const out: DriveFile[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({
        spaces,
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

  private async flatListing(
    token: string,
    rootId: string,
    prefix: string,
  ): Promise<DriveFile[]> {
    const clause = prefix ? `name contains '${escapeQueryLiteral(prefix)}' and ` : '';
    return this.queryFiles(
      token,
      `${clause}trashed = false and '${rootId}' in parents`,
      (file) =>
        file.name !== undefined &&
        file.name.startsWith(prefix) &&
        file.mimeType !== DRIVE_FOLDER_MIME,
      DRIVE_SPACE,
    );
  }

  private async findCopies(token: string, rootId: string, path: string): Promise<DriveFile[]> {
    return this.queryFiles(
      token,
      `name = '${escapeQueryLiteral(path)}' and trashed = false and '${rootId}' in parents`,
      (file) => file.name === path && file.mimeType !== DRIVE_FOLDER_MIME,
      DRIVE_SPACE,
    );
  }

  private async findInFolder(
    token: string,
    folderId: string,
    name: string,
  ): Promise<DriveFile[]> {
    return this.queryFiles(
      token,
      `name = '${escapeQueryLiteral(name)}' and trashed = false and '${folderId}' in parents`,
      (file) => file.name === name && file.mimeType !== DRIVE_FOLDER_MIME,
      DRIVE_SPACE,
    );
  }

  private async allCopiesOf(
    token: string,
    accountKey: string,
    rootId: string,
    path: string,
  ): Promise<{ flat: DriveFile[]; foldered: DriveFile[] }> {
    const flat = await this.findCopies(token, rootId, path);
    const mapped = mapLogicalPath(path);
    if (!mapped) return { flat, foldered: [] };
    const folder = await this.resolveChain(token, accountKey, rootId, mapped.chain);
    if (!folder?.id) return { flat, foldered: [] };
    const foldered = await this.findInFolder(token, folder.id, mapped.leaf);
    return { flat, foldered };
  }

  private cachedChainId(accountKey: string, chain: readonly string[]): string | undefined {
    return this.folderIds.get(accountKey)?.get(chainCacheKey(chain));
  }

  private folderCacheFor(accountKey: string): Map<string, string> {
    let cache = this.folderIds.get(accountKey);
    if (!cache) {
      cache = new Map<string, string>();
      this.folderIds.set(accountKey, cache);
    }
    return cache;
  }

  private async childFoldersOf(
    token: string,
    parentId: string,
    name?: string,
  ): Promise<DriveFile[]> {
    const nameClause = name === undefined ? '' : `name = '${escapeQueryLiteral(name)}' and `;
    return this.queryFiles(
      token,
      `${nameClause}mimeType = '${DRIVE_FOLDER_MIME}' and trashed = false and '${parentId}' in parents`,
      (file) =>
        file.mimeType === DRIVE_FOLDER_MIME && (name === undefined || file.name === name),
      DRIVE_SPACE,
    );
  }

  private async createFolder(
    token: string,
    parentId: string,
    name: string,
  ): Promise<string> {
    const response = await this.send(`${DRIVE_API_BASE}/files?fields=id`, {
      method: 'POST',
      headers: {
        ...this.authHeaders(token),
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        name,
        mimeType: DRIVE_FOLDER_MIME,
        parents: [parentId],
      }),
    });
    const id = ((await response.json()) as DriveFile).id;
    if (id === undefined) {
      throw new ProviderError('unknown', `folder creation returned no id: ${name}`);
    }
    return id;
  }

  private async resolveChain(
    token: string,
    accountKey: string,
    rootId: string,
    chain: readonly string[],
  ): Promise<DriveFile | undefined> {
    const cache = this.folderCacheFor(accountKey);
    const cached = cache.get(chainCacheKey(chain));
    if (cached !== undefined) {
      return { id: cached };
    }
    let parentId = rootId;
    let folder: DriveFile | undefined;
    const prefix: string[] = [];
    for (const segment of chain) {
      const siblings = await this.childFoldersOf(token, parentId, segment);
      folder = siblings.sort(olderFolder)[0];
      if (folder?.id === undefined) return undefined;
      parentId = folder.id;
      prefix.push(segment);
      cache.set(chainCacheKey(prefix), folder.id);
      for (const dup of siblings.slice(1)) {
        if (dup.id) void this.reapIfEmpty(token, accountKey, dup.id);
      }
    }
    return folder;
  }

  private async resolveOrCreateChain(
    token: string,
    accountKey: string,
    rootId: string,
    chain: readonly string[],
  ): Promise<string> {
    const cache = this.folderCacheFor(accountKey);
    let parentId = rootId;
    const prefix: string[] = [];
    for (const segment of chain) {
      prefix.push(segment);
      const key = chainCacheKey(prefix);
      const cached = cache.get(key);
      if (cached !== undefined) {
        parentId = cached;
        continue;
      }
      const siblings = await this.childFoldersOf(token, parentId, segment);
      const existing = siblings.sort(olderFolder)[0]?.id;
      parentId = existing ?? (await this.createFolder(token, parentId, segment));
      cache.set(key, parentId);
      for (const dup of siblings.slice(1)) {
        if (dup.id) void this.reapIfEmpty(token, accountKey, dup.id);
      }
    }
    return parentId;
  }

  private async listFoldered(
    token: string,
    rootId: string,
    prefix: string,
  ): Promise<RemoteEntry[]> {
    const target = folderedTarget(prefix);
    if (target === null) return [];
    const entries: RemoteEntry[] = [];
    if (target.kind === 'chain') {
      const folderIds = await this.resolveChainAll(token, rootId, target.chain);
      await this.descendLevel(
        token,
        folderIds.map((id) => ({ id, chain: [...target.chain] })),
        target.leafPrefix,
        entries,
        prefix,
      );
      return entries;
    }
    const roots = await this.childFoldersOf(token, rootId);
    const nodes: { id: string; chain: string[] }[] = [];
    for (const folder of roots) {
      const name = folder.name ?? '';
      const scope = scopeOfFolderName(name);
      const isMisc = name === 'blobs' || name === 'meta';
      if (scope === null && !isMisc) continue;
      if (
        target.kind === 'scopes' &&
        (scope === null ||
          (target.scopePrefix !== '' && !scope.startsWith(target.scopePrefix)))
      ) {
        continue;
      }
      if (folder.id !== undefined) nodes.push({ id: folder.id, chain: [name] });
    }
    await this.descendLevel(token, nodes, '', entries, prefix);
    return entries;
  }

  private async resolveChainAll(
    token: string,
    rootId: string,
    chain: readonly string[],
  ): Promise<string[]> {
    let parentIds = [rootId];
    for (const segment of chain) {
      const next: string[] = [];
      for (const parentId of parentIds) {
        for (const folder of await this.childFoldersOf(token, parentId, segment)) {
          if (folder.id !== undefined) next.push(folder.id);
        }
      }
      if (next.length === 0) return [];
      parentIds = next;
    }
    return parentIds;
  }

  private async descendLevel(
    token: string,
    nodes: { id: string; chain: string[] }[],
    leafPrefix: string,
    out: RemoteEntry[],
    prefix: string,
  ): Promise<void> {
    for (let i = 0; i < nodes.length; i += PARENT_OR_CHUNK) {
      const chunk = nodes.slice(i, i + PARENT_OR_CHUNK);
      const byParent = new Map(chunk.map((n) => [n.id, n] as const));
      const orClause = chunk.map((n) => `'${n.id}' in parents`).join(' or ');
      const children = await this.queryFiles(
        token,
        `trashed = false and (${orClause})`,
        (file) => file.id !== undefined && file.name !== undefined,
        DRIVE_SPACE,
      );
      const deeper: { id: string; chain: string[] }[] = [];
      for (const child of children) {
        const parent = child.parents?.find((p) => byParent.has(p));
        const node = parent !== undefined ? byParent.get(parent) : undefined;
        if (node === undefined) continue;
        const name = child.name ?? '';
        if (!name.startsWith(leafPrefix)) continue;
        if (child.mimeType === DRIVE_FOLDER_MIME) {
          deeper.push({ id: child.id!, chain: [...node.chain, name] });
          continue;
        }
        const logical = logicalPathOf(node.chain, name);
        if (logical !== null && logical.startsWith(prefix)) {
          out.push(toRemoteEntry({ ...child, name: logical }));
        }
      }
      if (deeper.length > 0) await this.descendLevel(token, deeper, '', out, prefix);
    }
  }

  private async reapIfEmpty(
    token: string,
    accountKey: string,
    folderId: string,
  ): Promise<void> {
    try {
      const children = await this.queryFiles(
        token,
        `trashed = false and '${folderId}' in parents`,
        (file) => file.id !== undefined,
        DRIVE_SPACE,
      );
      if (children.length > 0) return;
      await this.deleteFile(token, folderId);
      const cache = this.folderIds.get(accountKey);
      if (cache !== undefined) {
        for (const [key, id] of cache) {
          if (id === folderId) cache.delete(key);
        }
      }
    } catch {}
  }

  private async migrateFlatFiles(
    token: string,
    accountKey: string,
    rootId: string,
    flat: DriveFile[],
  ): Promise<void> {
    const flag = flatMigratedKey(accountKey);
    const last = await this.kv.get<number>('local', flag);
    if (last !== undefined && this.now() - last < FLAT_MIGRATE_INTERVAL_MS) return;
    const legacy = flat.filter(
      (file) =>
        file.name !== undefined &&
        file.name.startsWith(`${REMOTE_ROOT}/`) &&
        mapLogicalPath(file.name) !== null,
    );
    if (legacy.length === 0) return;
    await this.kv.set('local', flag, this.now());
    try {
      for (const file of legacy) {
        const mapped = mapLogicalPath(file.name!)!;
        const leafFolderId = await this.resolveOrCreateChain(
          token,
          accountKey,
          rootId,
          mapped.chain,
        );
        const twins = await this.findInFolder(token, leafFolderId, mapped.leaf);
        const twin = twins.length ? twins.reduce(newerFile) : undefined;
        if (twin === undefined) {
          await this.moveFile(token, file, leafFolderId, mapped.leaf, rootId);
        } else if (fileModifiedAt(file) > fileModifiedAt(twin)) {
          await this.moveFile(token, file, leafFolderId, mapped.leaf, rootId);
          await this.compareAndDelete(token, twin);
        } else {
          await this.compareAndDelete(token, file);
        }
      }
    } catch {}
  }

  private async moveFile(
    token: string,
    file: DriveFile,
    folderId: string,
    leaf: string,
    fromParentId: string,
  ): Promise<void> {
    try {
      await this.send(
        `${DRIVE_API_BASE}/files/${encodeURIComponent(file.id ?? '')}` +
          `?addParents=${encodeURIComponent(folderId)}` +
          `&removeParents=${encodeURIComponent(fromParentId)}` +
          `&fields=${encodeURIComponent(FILE_FIELDS)}`,
        {
          method: 'PATCH',
          headers: {
            ...this.authHeaders(token),
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify({ name: leaf }),
        },
      );
    } catch (e) {
      if (e instanceof ProviderError && e.kind === 'not-found') return;
      throw e;
    }
  }

  private async compareAndDelete(token: string, file: DriveFile): Promise<void> {
    try {
      const response = await this.send(
        `${DRIVE_API_BASE}/files/${encodeURIComponent(file.id ?? '')}?fields=id,modifiedTime`,
        { headers: this.authHeaders(token) },
      );
      const fresh = (await response.json()) as DriveFile;
      if (fresh.modifiedTime !== file.modifiedTime) return;
      await this.deleteFile(token, file.id!);
    } catch (e) {
      if (e instanceof ProviderError && e.kind === 'not-found') return;
      throw e;
    }
  }

  private async multipartCreate(
    token: string,
    parentId: string,
    name: string,
    bytes: Uint8Array,
    mimeType: string,
  ): Promise<DriveFile> {
    this.boundarySeq += 1;
    const boundary = `cell-sync-${this.now().toString(36)}-${this.boundarySeq.toString(36)}`;
    const encoder = new TextEncoder();
    const meta = encoder.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify({ name, parents: [parentId] })}\r\n` +
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
    parentId: string,
    name: string,
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
    const initiated = await this.initiateSession(token, parentId, name, bytes, mimeType, fileId);
    sessionUri = initiated.uri;
    fileId = initiated.fileId ?? fileId;
    await this.kv.set('local', key, { uri: sessionUri, fileId, size: bytes.byteLength });
    const file = await this.uploadChunk(token, sessionUri, bytes, 0);
    await this.clearResumeKeys(path, key);
    return file;
  }

  private async initiateSession(
    token: string,
    parentId: string,
    name: string,
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
          body: JSON.stringify({ name, parents: [parentId] }),
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
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
    const remaining = bytes.byteLength - offset;
    const response = await this.fetchFn(sessionUri, {
      method: 'PUT',
      headers: {
        ...this.authHeaders(token),
        'Content-Range': `bytes ${offset}-${end}/${bytes.byteLength}`,
        'Content-Type': 'application/octet-stream',
      },
      body: toBlob(bytes.subarray(offset)),
      signal: AbortSignal.timeout(
        REQUEST_TIMEOUT_MS + Math.floor(remaining / MIN_UPLOAD_BPS) * 1000,
      ),
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

function fileCreatedAt(file: DriveFile): number {
  const parsed = Date.parse(file.createdTime ?? '');
  return Number.isNaN(parsed) ? 0 : parsed;
}

function olderFolder(a: DriveFile, b: DriveFile): number {
  const diff = fileCreatedAt(a) - fileCreatedAt(b);
  if (diff !== 0) return diff;
  return (a.id ?? '') < (b.id ?? '') ? -1 : 1;
}

function parseRangeEnd(range: string): number {
  const match = /bytes=\d+-(\d+)/.exec(range);
  return match ? Number(match[1]) : -1;
}
