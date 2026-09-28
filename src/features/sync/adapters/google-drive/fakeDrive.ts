import { blobToBytes } from '../contract/blobBytes';
import type { LaunchWebAuthFlow, WebAuthFlowRequest } from './googleDriveStorageProvider';
import {
  DRIVE_API_BASE,
  DRIVE_UPLOAD_BASE,
  GOOGLE_REVOKE_ENDPOINT,
  GOOGLE_USERINFO_ENDPOINT,
} from './authUrls';

export interface FakeDriveFile {
  id: string;
  accountKey: string;
  name: string;
  bytes: Uint8Array;
  modifiedSeq: number;
  space: 'drive' | 'appdata';
  parent?: string;
  mimeType?: string;
}

export interface FakeDriveRequest {
  method: string;
  url: string;
}

export interface FakeFailure {
  status?: number;
  reason?: string;
  network?: boolean;
  consume?: boolean;
  consumeLimit?: number;
  urlIncludes?: string;
}

interface FakeAccount {
  sub: string;
  email: string;
  revoked: boolean;
}

interface FakeSession {
  accountKey: string;
  fileId?: string;
  name?: string;
  parent?: string;
  expectedSize?: number;
  received: number;
  buffer: Uint8Array;
}

export interface FakeDrive {
  fetchFn: typeof fetch;
  launchWebAuthFlow: LaunchWebAuthFlow;
  launchRequests: WebAuthFlowRequest[];
  requests: FakeDriveRequest[];
  filesFor(accountKey: string): FakeDriveFile[];
  seedFile(
    accountKey: string,
    path: string,
    bytes: Uint8Array,
    space?: 'drive' | 'appdata',
  ): FakeDriveFile;
  deleteFileRaw(accountKey: string, fileId: string): void;
  revokeAccount(accountKey: string): void;
  invalidateTokens(accountKey: string): void;
  failNext(count: number, status: number, reason?: string, urlIncludes?: string): void;
  failNetworkNext(count: number, urlIncludes?: string): void;
  failConsumeNext(count: number, consumeLimit: number | undefined, urlIncludes?: string): void;
  setQuotaLimit(bytes: number | null): void;
}

const FILE_ID_SEQ_BASE = 'file-';
const BASE_MILLIS = 1_700_000_000_000;
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const SYNC_ROOT_NAME = 'Tihoka Sync';

function jsonResponse(status: number, body: unknown, headers?: Record<string, string>): Response {
  const lowered = new Map<string, string>();
  for (const [k, v] of Object.entries(headers ?? {})) lowered.set(k.toLowerCase(), v);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body ?? null)),
    arrayBuffer: async () => new Uint8Array(0).buffer,
    blob: async () => new Blob([]),
    headers: { get: (name: string) => lowered.get(name.toLowerCase()) ?? null },
  } as unknown as Response;
}

function bytesResponse(status: number, bytes: Uint8Array): Response {
  const copy = bytes.slice();
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => null,
    text: async () => '',
    arrayBuffer: async () => copy.buffer,
    headers: { get: () => null },
  } as unknown as Response;
}

function errorJson(status: number, reason?: string): Response {
  return jsonResponse(status, {
    error: {
      code: status,
      message: `fake drive error ${status}${reason ? ` ${reason}` : ''}`,
      errors: reason ? [{ reason }] : [],
    },
  });
}

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array, from: number): number {
  outer: for (let i = from; i + needle.byteLength <= haystack.byteLength; i += 1) {
    for (let j = 0; j < needle.byteLength; j += 1) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function parseMultipart(
  body: Uint8Array,
  contentType: string,
): { metadata: { name?: string; parents?: string[] }; bytes: Uint8Array } {
  const boundaryMatch = /boundary=([^;\s]+)/.exec(contentType);
  if (!boundaryMatch) throw new Error('multipart body missing boundary');
  const encoder = new TextEncoder();
  const dash = encoder.encode(`--${boundaryMatch[1]}`);
  const headerBreak = encoder.encode('\r\n\r\n');
  const firstBreak = indexOfBytes(body, headerBreak, 0);
  const metaEnd = indexOfBytes(body, encoder.encode('\r\n--'), firstBreak + headerBreak.byteLength);
  const metaJson = new TextDecoder().decode(body.subarray(firstBreak + 4, metaEnd));
  const mediaBreak = indexOfBytes(body, headerBreak, metaEnd);
  const mediaEnd = indexOfBytes(body, dash, mediaBreak + headerBreak.byteLength) - 2;
  return {
    metadata: JSON.parse(metaJson) as { name?: string; parents?: string[] },
    bytes: body.slice(mediaBreak + headerBreak.byteLength, mediaEnd),
  };
}

function queryNameFilter(q: string): { exact?: string; contains?: string } {
  const exact = /name = '((?:\\'|[^'])*)'/.exec(q);
  if (exact) return { exact: exact[1]!.replace(/\\'/g, "'").replace(/\\\\/g, '\\') };
  const contains = /name contains '((?:\\'|[^'])*)'/.exec(q);
  if (contains) return { contains: contains[1]!.replace(/\\'/g, "'").replace(/\\\\/g, '\\') };
  return {};
}

function queryParentsFilter(q: string): string | undefined {
  return /'([^']+)' in parents/.exec(q)?.[1];
}

function queryMimeFilter(q: string): string | undefined {
  return /mimeType = '([^']+)'/.exec(q)?.[1];
}

export function createFakeDrive(): FakeDrive {
  const accounts: FakeAccount[] = [];
  const tokens = new Map<string, string>();
  const files: FakeDriveFile[] = [];
  const sessions = new Map<string, FakeSession>();
  const failures: FakeFailure[] = [];
  const requests: FakeDriveRequest[] = [];
  const launchRequests: WebAuthFlowRequest[] = [];
  let accountSeq = 0;
  let tokenSeq = 0;
  let fileSeq = 0;
  let sessionSeq = 0;
  let clockSeq = 0;
  let quotaLimit: number | null = null;

  const nextSeq = (): number => {
    clockSeq += 1;
    return clockSeq;
  };

  const isoOf = (seq: number): string => new Date(BASE_MILLIS + seq * 1000).toISOString();

  const fileJson = (file: FakeDriveFile): Record<string, unknown> => ({
    id: file.id,
    name: file.name,
    size: String(file.bytes.byteLength),
    modifiedTime: isoOf(file.modifiedSeq),
  });

  const issueToken = (account: FakeAccount): string => {
    tokenSeq += 1;
    const token = `tok-${account.sub}-${tokenSeq}`;
    tokens.set(token, account.sub);
    return token;
  };

  const addAccount = (email?: string): FakeAccount => {
    accountSeq += 1;
    const account: FakeAccount = {
      sub: `sub-${accountSeq}`,
      email: email ?? `user${accountSeq}@fake.drive`,
      revoked: false,
    };
    accounts.push(account);
    return account;
  };

  const accountForToken = (init: RequestInit | undefined): FakeAccount | undefined => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const auth = headers.Authorization ?? headers.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
    const sub = tokens.get(token);
    if (!sub) return undefined;
    const account = accounts.find((a) => a.sub === sub);
    if (!account || account.revoked) return undefined;
    return account;
  };

  const unauthorized = (): Response => errorJson(401, 'authError');

  const ensureRootFolder = (account: { sub: string }): string => {
    const existing = files.find(
      (f) => f.accountKey === account.sub && f.mimeType === FOLDER_MIME && f.parent === 'root',
    );
    if (existing) return existing.id;
    fileSeq += 1;
    const folder: FakeDriveFile = {
      id: `${FILE_ID_SEQ_BASE}${fileSeq}`,
      accountKey: account.sub,
      name: SYNC_ROOT_NAME,
      bytes: new Uint8Array(0),
      modifiedSeq: nextSeq(),
      space: 'drive',
      parent: 'root',
      mimeType: FOLDER_MIME,
    };
    files.push(folder);
    return folder.id;
  };

  const handleList = (account: FakeAccount, url: URL): Response => {
    const q = url.searchParams.get('q') ?? '';
    const filter = queryNameFilter(q);
    const parent = queryParentsFilter(q);
    const mime = queryMimeFilter(q);
    const space = url.searchParams.get('spaces') === 'appDataFolder' ? 'appdata' : 'drive';
    const pageSize = Number(url.searchParams.get('pageSize') ?? '100');
    const start = Number(url.searchParams.get('pageToken') ?? '0');
    const matched = files.filter(
      (f) =>
        f.accountKey === account.sub &&
        f.space === space &&
        (parent !== undefined ? f.parent === parent : true) &&
        (mime !== undefined ? f.mimeType === mime : true) &&
        (filter.exact !== undefined ? f.name === filter.exact : true) &&
        (filter.contains !== undefined ? f.name.includes(filter.contains) : true),
    );
    const page = matched.slice(start, start + pageSize);
    const nextOffset = start + pageSize;
    const body: Record<string, unknown> = { files: page.map(fileJson) };
    if (nextOffset < matched.length) body.nextPageToken = String(nextOffset);
    return jsonResponse(200, body);
  };

  const putFile = (
    account: FakeAccount | { sub: string },
    name: string,
    bytes: Uint8Array,
    fileId?: string,
    opts?: { parent?: string; space?: 'drive' | 'appdata'; mimeType?: string },
  ): FakeDriveFile => {
    const seq = nextSeq();
    if (fileId) {
      const existing = files.find((f) => f.id === fileId && f.accountKey === account.sub);
      if (existing) {
        existing.bytes = bytes.slice();
        existing.modifiedSeq = seq;
        return existing;
      }
    }
    fileSeq += 1;
    const file: FakeDriveFile = {
      id: `${FILE_ID_SEQ_BASE}${fileSeq}`,
      accountKey: account.sub,
      name,
      bytes: bytes.slice(),
      modifiedSeq: seq,
      space: opts?.space ?? 'drive',
      parent: opts?.parent,
      mimeType: opts?.mimeType,
    };
    files.push(file);
    return file;
  };

  const bodyBytesOf = async (init: RequestInit | undefined): Promise<Uint8Array> => {
    const body = init?.body;
    if (body instanceof Uint8Array) return body;
    if (typeof body === 'string') return new TextEncoder().encode(body);
    if (body instanceof Blob) return blobToBytes(body);
    if (body instanceof ArrayBuffer) return new Uint8Array(body);
    return new Uint8Array(0);
  };

  const consumeIntoSession = async (
    sessionId: string,
    init: RequestInit | undefined,
    limit?: number,
  ): Promise<void> => {
    const session = sessions.get(sessionId);
    if (!session) return;
    const incoming = (await bodyBytesOf(init)).subarray(0, limit ?? Number.MAX_SAFE_INTEGER);
    const merged = new Uint8Array(session.received + incoming.byteLength);
    merged.set(session.buffer.subarray(0, session.received), 0);
    merged.set(incoming, session.received);
    session.buffer = merged;
    session.received += incoming.byteLength;
  };

  const dispatch = async (url: string, init: RequestInit | undefined): Promise<Response> => {
    const method = init?.method ?? 'GET';
    const failure = failures[0];
    if (failure && (!failure.urlIncludes || url.includes(failure.urlIncludes))) {
      failures.shift();
      if (failure.consume) {
        const sid = /[?&]upload_id=([^&]+)/.exec(url)?.[1];
        if (method === 'PUT' && sid) await consumeIntoSession(sid, init, failure.consumeLimit);
      }
      if (failure.network) throw new TypeError('fake network failure');
      return errorJson(failure.status ?? 500, failure.reason);
    }
    if (url === GOOGLE_REVOKE_ENDPOINT) {
      const body = typeof init?.body === 'string' ? init.body : '';
      const token = new URLSearchParams(body).get('token') ?? '';
      const sub = tokens.get(token);
      if (sub) {
        const account = accounts.find((a) => a.sub === sub);
        if (account) account.revoked = true;
        for (const [t, s] of tokens) if (s === sub) tokens.delete(t);
      }
      return jsonResponse(200, {});
    }
    const account = accountForToken(init);
    if (!account) return unauthorized();

    if (url === GOOGLE_USERINFO_ENDPOINT) {
      return jsonResponse(200, { sub: account.sub, email: account.email });
    }

    if (url.startsWith(`${DRIVE_API_BASE}/about`)) {
      const usage = files
        .filter((f) => f.accountKey === account.sub)
        .reduce((sum, f) => sum + f.bytes.byteLength, 0);
      const quota: Record<string, string> = { usage: String(usage) };
      if (quotaLimit !== null) quota.limit = String(quotaLimit);
      return jsonResponse(200, { storageQuota: quota });
    }

    const sessionMatch = /[?&]upload_id=([^&]+)/.exec(url);
    if (method === 'PUT' && sessionMatch) {
      const session = sessions.get(sessionMatch[1] ?? '');
      if (!session || session.accountKey !== account.sub) return errorJson(404, 'notFound');
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const range = headers['Content-Range'] ?? '';
      const statusMatch = /bytes \*\/(\d+)/.exec(range);
      if (statusMatch) {
        if (
          session.expectedSize !== undefined &&
          session.received >= session.expectedSize &&
          session.received >= Number(statusMatch[1])
        ) {
          const file = putFile(
            account,
            session.name ?? 'unnamed',
            session.buffer.subarray(0, Number(statusMatch[1])),
            session.fileId,
            { parent: session.parent },
          );
          sessions.delete(sessionMatch[1] ?? '');
          return jsonResponse(200, fileJson(file));
        }
        const headersOut: Record<string, string> = {};
        if (session.received > 0) headersOut.Range = `bytes=0-${session.received - 1}`;
        return jsonResponse(308, undefined, headersOut);
      }
      const chunkMatch = /bytes (\d+)-(\d+)\/(\d+)/.exec(range);
      if (!chunkMatch) return errorJson(400, 'badRequest');
      const start = Number(chunkMatch[1]);
      const end = Number(chunkMatch[2]);
      const total = Number(chunkMatch[3]);
      if (start !== session.received) {
        const headersOut: Record<string, string> = {};
        if (session.received > 0) headersOut.Range = `bytes=0-${session.received - 1}`;
        return jsonResponse(308, undefined, headersOut);
      }
      const incoming = await bodyBytesOf(init);
      const merged = new Uint8Array(session.received + incoming.byteLength);
      merged.set(session.buffer.subarray(0, session.received), 0);
      merged.set(incoming, session.received);
      session.buffer = merged;
      session.received += incoming.byteLength;
      if (end >= total - 1 && session.received >= total) {
        const file = putFile(
          account,
          session.name ?? 'unnamed',
          session.buffer.subarray(0, total),
          session.fileId,
          { parent: session.parent },
        );
        sessions.delete(sessionMatch[1] ?? '');
        return jsonResponse(200, fileJson(file));
      }
      return jsonResponse(308, undefined, { Range: `bytes=0-${session.received - 1}` });
    }

    if (url.startsWith(`${DRIVE_UPLOAD_BASE}/files`)) {
      const uploadType = new URL(url).searchParams.get('uploadType');
      if (method === 'POST' && uploadType === 'resumable') {
        const meta = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as {
          name?: string;
          parents?: string[];
        };
        const parent = meta.parents?.[0];
        if (
          parent !== undefined &&
          parent !== 'root' &&
          parent !== 'appDataFolder' &&
          !files.some((f) => f.id === parent && f.accountKey === account.sub)
        ) {
          return errorJson(404, 'notFound');
        }
        const headers = (init?.headers ?? {}) as Record<string, string>;
        sessionSeq += 1;
        const sid = `sess-${sessionSeq}`;
        sessions.set(sid, {
          accountKey: account.sub,
          name: meta.name,
          parent,
          expectedSize: Number(headers['X-Upload-Content-Length'] ?? '0') || undefined,
          received: 0,
          buffer: new Uint8Array(0),
        });
        return jsonResponse(200, {}, {
          Location: `${DRIVE_UPLOAD_BASE}/files?uploadType=resumable&upload_id=${sid}`,
        });
      }
      if (method === 'PATCH' && uploadType === 'resumable') {
        const fileId = /\/files\/([^?]+)\?/.exec(`${url}?`)?.[1];
        const headers = (init?.headers ?? {}) as Record<string, string>;
        sessionSeq += 1;
        const sid = `sess-${sessionSeq}`;
        sessions.set(sid, {
          accountKey: account.sub,
          fileId,
          expectedSize: Number(headers['X-Upload-Content-Length'] ?? '0') || undefined,
          received: 0,
          buffer: new Uint8Array(0),
        });
        return jsonResponse(200, {}, {
          Location: `${DRIVE_UPLOAD_BASE}/files?uploadType=resumable&upload_id=${sid}`,
        });
      }
      if (method === 'PATCH' && uploadType === 'media') {
        const fileId = /\/files\/([^?]+)\?/.exec(`${url}?`)?.[1];
        const target = files.find((f) => f.id === fileId && f.accountKey === account.sub);
        if (!target) return errorJson(404, 'notFound');
        const bytes = await bodyBytesOf(init);
        return jsonResponse(200, fileJson(putFile(account, target.name, bytes, target.id)));
      }
      if (method === 'POST' && uploadType === 'multipart') {
        const headers = (init?.headers ?? {}) as Record<string, string>;
        const contentType = headers['Content-Type'] ?? headers['content-type'] ?? '';
        const body = await bodyBytesOf(init);
        const { metadata, bytes } = parseMultipart(body, contentType);
        const parent = metadata.parents?.[0];
        if (
          parent !== undefined &&
          parent !== 'root' &&
          parent !== 'appDataFolder' &&
          !files.some((f) => f.id === parent && f.accountKey === account.sub)
        ) {
          return errorJson(404, 'notFound');
        }
        const file = putFile(account, metadata.name ?? 'unnamed', bytes, undefined, {
          parent,
        });
        return jsonResponse(200, fileJson(file));
      }
      return errorJson(400, 'badRequest');
    }

    if (url.startsWith(`${DRIVE_API_BASE}/files/`)) {
      const rest = url.slice(`${DRIVE_API_BASE}/files/`.length);
      const fileId = decodeURIComponent(rest.split('?')[0] ?? '');
      const target = files.find((f) => f.id === fileId && f.accountKey === account.sub);
      if (method === 'DELETE') {
        if (!target) return errorJson(404, 'notFound');
        files.splice(files.indexOf(target), 1);
        return jsonResponse(204, undefined);
      }
      if (method === 'GET' && new URL(url).searchParams.get('alt') === 'media') {
        if (!target) return errorJson(404, 'notFound');
        return bytesResponse(200, target.bytes);
      }
      if (method === 'GET') {
        if (!target) return errorJson(404, 'notFound');
        return jsonResponse(200, fileJson(target));
      }
      return errorJson(400, 'badRequest');
    }

    if (url.startsWith(`${DRIVE_API_BASE}/files`) && method === 'POST') {
      const meta = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as {
        name?: string;
        mimeType?: string;
        parents?: string[];
      };
      const folder = putFile(account, meta.name ?? 'unnamed', new Uint8Array(0), undefined, {
        parent: meta.parents?.[0],
        space: 'drive',
        mimeType: meta.mimeType,
      });
      return jsonResponse(200, fileJson(folder));
    }

    if (url.startsWith(`${DRIVE_API_BASE}/files`) && method === 'GET') {
      return handleList(account, new URL(url));
    }

    return errorJson(404, 'notFound');
  };

  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    requests.push({ method: init?.method ?? 'GET', url });
    return dispatch(url, init);
  }) as typeof fetch;

  const launchWebAuthFlow: LaunchWebAuthFlow = async (request) => {
    launchRequests.push(request);
    const url = new URL(request.url);
    const redirect = url.searchParams.get('redirect_uri') ?? '';
    const hint = url.searchParams.get('login_hint') ?? undefined;
    let account = hint ? accounts.find((a) => a.email === hint || a.sub === hint) : undefined;
    if (!request.interactive) {
      if (!account || account.revoked) {
        return `${redirect}#error=interaction_required&error_description=renewal_required`;
      }
    } else if (!account) {
      account = addAccount(hint);
    }
    if (!account) {
      return `${redirect}#error=interaction_required`;
    }
    const token = issueToken(account);
    return `${redirect}#access_token=${token}&token_type=Bearer&expires_in=3600`;
  };

  return {
    fetchFn,
    launchWebAuthFlow,
    launchRequests,
    requests,
    filesFor: (accountKey) =>
      files.filter((f) => f.accountKey === accountKey && f.mimeType !== FOLDER_MIME),
    seedFile: (accountKey, path, bytes, space = 'drive') => {
      const holder = { sub: accountKey, email: '', revoked: false };
      return putFile(holder, path, bytes, undefined, {
        space,
        parent: space === 'appdata' ? 'appDataFolder' : ensureRootFolder(holder),
      });
    },
    deleteFileRaw: (accountKey, fileId) => {
      const index = files.findIndex((f) => f.id === fileId && f.accountKey === accountKey);
      if (index >= 0) files.splice(index, 1);
    },
    revokeAccount: (accountKey) => {
      const account = accounts.find((a) => a.sub === accountKey);
      if (account) account.revoked = true;
      for (const [t, s] of tokens) if (s === accountKey) tokens.delete(t);
    },
    invalidateTokens: (accountKey) => {
      for (const [t, s] of tokens) if (s === accountKey) tokens.delete(t);
    },
    failNext: (count, status, reason, urlIncludes) => {
      for (let i = 0; i < count; i += 1) failures.push({ status, reason, urlIncludes });
    },
    failNetworkNext: (count, urlIncludes) => {
      for (let i = 0; i < count; i += 1) failures.push({ network: true, urlIncludes });
    },
    failConsumeNext: (count, consumeLimit, urlIncludes) => {
      for (let i = 0; i < count; i += 1) {
        failures.push({ network: true, consume: true, consumeLimit, urlIncludes });
      }
    },
    setQuotaLimit: (bytes) => {
      quotaLimit = bytes;
    },
  };
}
