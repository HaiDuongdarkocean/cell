import type { Connection } from '../../domain/types';
import { connectionId } from '../../domain/scope';
import { ProviderError } from '../../ports/storageProvider';
import { InMemoryKeyValueStore } from '../memory/InMemoryKeyValueStore';
import { SeededClock } from '../memory/SeededClock';
import { blobToBytes } from '../contract/blobBytes';
import {
  buildAuthorizationUrl,
  DRIVE_API_BASE,
  DRIVE_SCOPES,
  GOOGLE_AUTH_ENDPOINT,
  parseAuthRedirect,
} from './authUrls';
import { providerErrorKindForStatus } from './errors';
import { createFakeDrive } from './fakeDrive';
import type { FakeDrive } from './fakeDrive';
import { GoogleDriveStorageProvider } from './googleDriveStorageProvider';

const REDIRECT_URL = 'https://fakeext.chromiumapp.org/';

const blobOf = (...bytes: number[]): Blob => new Blob([new Uint8Array(bytes)]);

const bytesOf = async (blob: Blob): Promise<number[]> => [...(await blobToBytes(blob))];

const failureOf = async (promise: Promise<unknown>): Promise<ProviderError> => {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(ProviderError);
    return e as ProviderError;
  }
  throw new Error('expected promise to reject');
};

interface Harness {
  provider: GoogleDriveStorageProvider;
  drive: FakeDrive;
  kv: InMemoryKeyValueStore;
  sleeps: number[];
  connect(): Promise<Connection>;
}

const makeHarness = (opts?: { resumableThresholdBytes?: number }): Harness => {
  const kv = new InMemoryKeyValueStore();
  const drive = createFakeDrive();
  const sleeps: number[] = [];
  const provider = new GoogleDriveStorageProvider({
    kv,
    clientId: 'unit-test-client',
    launchWebAuthFlow: drive.launchWebAuthFlow,
    getRedirectUrl: () => REDIRECT_URL,
    fetchFn: drive.fetchFn,
    clock: new SeededClock(1_700_000_000_000),
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    resumableThresholdBytes: opts?.resumableThresholdBytes,
  });
  const connect = async (): Promise<Connection> => {
    const account = await provider.authorize({ interactive: true });
    return {
      connectionId: connectionId(provider.providerId, account.accountKey),
      providerId: provider.providerId,
      accountKey: account.accountKey,
      displayName: account.displayName,
    };
  };
  return { provider, drive, kv, sleeps, connect };
};

describe('buildAuthorizationUrl', () => {
  it('builds an implicit-flow URL with verbatim redirect and appdata scopes', () => {
    const url = buildAuthorizationUrl({
      clientId: 'cid-123',
      redirectUrl: REDIRECT_URL,
      interactive: true,
    });
    const parsed = new URL(url);
    expect(url.startsWith(`${GOOGLE_AUTH_ENDPOINT}?`)).toBe(true);
    expect(parsed.searchParams.get('client_id')).toBe('cid-123');
    expect(parsed.searchParams.get('redirect_uri')).toBe(REDIRECT_URL);
    expect(parsed.searchParams.get('response_type')).toBe('token');
    expect(parsed.searchParams.get('scope')).toBe(DRIVE_SCOPES);
    expect(parsed.searchParams.get('prompt')).toBe('select_account');
    expect(parsed.searchParams.get('login_hint')).toBeNull();
  });

  it('uses prompt=none plus login_hint for silent renewal', () => {
    const url = buildAuthorizationUrl({
      clientId: 'cid-123',
      redirectUrl: 'https://32cdbde6.extensions.allizom.org/',
      interactive: false,
      accountHint: 'a@b.c',
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'https://32cdbde6.extensions.allizom.org/',
    );
    expect(parsed.searchParams.get('prompt')).toBe('none');
    expect(parsed.searchParams.get('login_hint')).toBe('a@b.c');
  });
});

describe('parseAuthRedirect', () => {
  it('extracts access_token and computes expiresAt from expires_in', () => {
    const grant = parseAuthRedirect(
      `${REDIRECT_URL}#access_token=tok-1&token_type=Bearer&expires_in=3600`,
      1_000,
    );
    expect(grant.accessToken).toBe('tok-1');
    expect(grant.expiresAt).toBe(1_000 + 3_600_000);
  });

  it('maps an error fragment to an auth ProviderError', async () => {
    const err = await failureOf(
      Promise.resolve().then(() =>
        parseAuthRedirect(`${REDIRECT_URL}#error=access_denied`, 0),
      ),
    );
    expect(err.kind).toBe('auth');
  });

  it('maps a missing redirect to an auth ProviderError', async () => {
    const err = await failureOf(Promise.resolve().then(() => parseAuthRedirect(undefined, 0)));
    expect(err.kind).toBe('auth');
  });
});

describe('providerErrorKindForStatus', () => {
  it.each([
    [401, undefined, 'auth'],
    [403, 'rateLimitExceeded', 'rate-limit'],
    [403, 'userRateLimitExceeded', 'rate-limit'],
    [403, 'storageQuotaExceeded', 'quota'],
    [403, 'insufficientPermissions', 'auth'],
    [404, undefined, 'not-found'],
    [408, undefined, 'network'],
    [429, undefined, 'rate-limit'],
    [500, undefined, 'network'],
    [503, undefined, 'network'],
    [400, undefined, 'unknown'],
  ])('status %i reason %s → %s', (status, reason, kind) => {
    expect(providerErrorKindForStatus(status, reason)).toBe(kind);
  });
});

describe('GoogleDriveStorageProvider oauth', () => {
  it('passes the redirect URL from getRedirectUrl verbatim into the auth URL', async () => {
    const h = makeHarness();
    await h.connect();
    expect(h.drive.launchRequests).toHaveLength(1);
    const url = new URL(h.drive.launchRequests[0]!.url);
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT_URL);
    expect(h.drive.launchRequests[0]!.interactive).toBe(true);
  });

  it('stores the token only in the session area keyed by account', async () => {
    const h = makeHarness();
    const conn = await h.connect();
    const sessionKeys = await h.kv.list('session', `syncAdapter:google-drive:token:`);
    expect(sessionKeys).toEqual([`syncAdapter:google-drive:token:${conn.accountKey}`]);
    expect(await h.kv.list('local', 'syncAdapter:google-drive:token:')).toEqual([]);
  });

  it('silent renewal uses prompt=none, login_hint and non-interactive flow options', async () => {
    const h = makeHarness();
    const conn = await h.connect();
    await h.provider.list(conn, '');
    expect(h.drive.launchRequests).toHaveLength(1);
    await h.kv.del('session', `syncAdapter:google-drive:token:${conn.accountKey}`);
    await h.provider.list(conn, '');
    expect(h.drive.launchRequests).toHaveLength(2);
    const silent = h.drive.launchRequests[1]!;
    expect(silent.interactive).toBe(false);
    expect(silent.abortOnLoadForNonInteractive).toBe(true);
    expect(silent.timeoutMsForNonInteractive).toBeGreaterThan(0);
    const url = new URL(silent.url);
    expect(url.searchParams.get('prompt')).toBe('none');
    expect(url.searchParams.get('login_hint')).toBe(conn.displayName);
  });

  it('renews silently once when the API returns 401', async () => {
    const h = makeHarness();
    const conn = await h.connect();
    h.drive.invalidateTokens(conn.accountKey);
    await h.provider.write(conn, 'x.bin', blobOf(1));
    expect(await bytesOf(await h.provider.read(conn, 'x.bin'))).toEqual([1]);
    expect(h.drive.launchRequests.filter((r) => !r.interactive)).toHaveLength(1);
  });

  it('fails with auth when silent renewal cannot mint a usable token', async () => {
    const h = makeHarness();
    const conn = await h.connect();
    h.drive.revokeAccount(conn.accountKey);
    const err = await failureOf(h.provider.list(conn, ''));
    expect(err.kind).toBe('auth');
  });

  it('revoke posts to the revoke endpoint and clears the session token', async () => {
    const h = makeHarness();
    const conn = await h.connect();
    await h.provider.revoke(conn);
    expect(
      h.drive.requests.some(
        (r) => r.method === 'POST' && r.url.includes('revoke'),
      ),
    ).toBe(true);
    expect(await h.kv.list('session', 'syncAdapter:google-drive:token:')).toEqual([]);
    const err = await failureOf(h.provider.list(conn, ''));
    expect(err.kind).toBe('auth');
  });
});

describe('GoogleDriveStorageProvider REST', () => {
  it('creates small blobs via multipart upload into the sync root folder', async () => {
    const h = makeHarness();
    const conn = await h.connect();
    const entry = await h.provider.write(conn, 'a/b.bin', blobOf(1, 2, 3));
    expect(entry.path).toBe('a/b.bin');
    expect(entry.size).toBe(3);
    const create = h.drive.requests.find((r) => r.url.includes('uploadType=multipart'));
    expect(create?.method).toBe('POST');
    const file = h.drive.filesFor(conn.accountKey)[0]!;
    expect(await bytesOf(await h.provider.read(conn, 'a/b.bin'))).toEqual([1, 2, 3]);
    expect(file.bytes).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('retries retryable failures with exponential backoff', async () => {
    const h = makeHarness();
    const conn = await h.connect();
    h.drive.failNext(2, 500);
    await h.provider.list(conn, '');
    expect(h.sleeps).toEqual([250, 500]);
  });

  it('surfaces network kind after exhausting retries', async () => {
    const h = makeHarness();
    const conn = await h.connect();
    h.drive.failNetworkNext(9);
    const err = await failureOf(h.provider.list(conn, ''));
    expect(err.kind).toBe('network');
  });

  it('maps 403 rate-limit errors as retryable then surfaces rate-limit', async () => {
    const h = makeHarness();
    const conn = await h.connect();
    h.drive.failNext(3, 403, 'rateLimitExceeded');
    const err = await failureOf(h.provider.list(conn, ''));
    expect(err.kind).toBe('rate-limit');
    expect(h.sleeps).toEqual([250, 500]);
  });

  it('maps 403 storageQuotaExceeded to quota without retrying', async () => {
    const h = makeHarness();
    const conn = await h.connect();
    h.drive.failNext(1, 403, 'storageQuotaExceeded', 'uploadType=multipart');
    const err = await failureOf(h.provider.write(conn, 'q.bin', blobOf(1)));
    expect(err.kind).toBe('quota');
    expect(h.sleeps).toEqual([]);
  });

  it('remove tolerates a 404 from delete after the lookup', async () => {
    const h = makeHarness();
    const conn = await h.connect();
    await h.provider.write(conn, 'm.bin', blobOf(1));
    h.drive.failNext(1, 404, 'notFound', 'files/file-');
    await h.provider.remove(conn, 'm.bin');
  });

  it('reports quota limit as totalBytes and null when unlimited', async () => {
    const h = makeHarness();
    const conn = await h.connect();
    h.drive.setQuotaLimit(15 * 1024 * 1024 * 1024);
    const withLimit = await h.provider.quota(conn);
    expect(withLimit.totalBytes).toBe(15 * 1024 * 1024 * 1024);
    h.drive.setQuotaLimit(null);
    const unlimited = await h.provider.quota(conn);
    expect(unlimited.totalBytes).toBeNull();
  });
});

describe('GoogleDriveStorageProvider sync root folder', () => {
  const folderCreateCount = (h: Harness): number =>
    h.drive.requests.filter(
      (r) => r.method === 'POST' && r.url.startsWith(`${DRIVE_API_BASE}/files`),
    ).length;

  it('creates the Tihoka Sync folder once and cleans up legacy appDataFolder files', async () => {
    const h = makeHarness();
    const conn = await h.connect();
    h.drive.seedFile(
      conn.accountKey,
      'cell-sync/v1/legacy.bin',
      new Uint8Array([7]),
      'appdata',
    );
    await h.provider.write(conn, 'a/b.bin', blobOf(1));
    expect(folderCreateCount(h)).toBe(1);
    expect(
      h.drive.filesFor(conn.accountKey).some((f) => f.name === 'cell-sync/v1/legacy.bin'),
    ).toBe(false);

    await h.provider.write(conn, 'a/c.bin', blobOf(2));
    expect(folderCreateCount(h)).toBe(1);
  });

  it('recreates the sync root folder when it disappears mid-session', async () => {
    const h = makeHarness();
    const conn = await h.connect();
    await h.provider.write(conn, 'a/b.bin', blobOf(1));
    const seeded = h.drive.filesFor(conn.accountKey)[0]!;
    h.drive.deleteFileRaw(conn.accountKey, seeded.parent!);

    const entry = await h.provider.write(conn, 'a/c.bin', blobOf(2));
    expect(entry.path).toBe('a/c.bin');
    expect(await bytesOf(await h.provider.read(conn, 'a/c.bin'))).toEqual([2]);
    expect(folderCreateCount(h)).toBe(2);
  });
});

describe('GoogleDriveStorageProvider resumable upload', () => {
  const bigBody = (): Blob => blobOf(0, 1, 2, 3, 4, 5, 6, 7, 8, 9);

  it('uploads blobs above the threshold via a resumable session', async () => {
    const h = makeHarness({ resumableThresholdBytes: 4 });
    const conn = await h.connect();
    await h.provider.write(conn, 'big.bin', bigBody());
    const urls = h.drive.requests.map((r) => `${r.method} ${r.url}`);
    expect(urls.some((u) => u.includes('POST') && u.includes('uploadType=resumable'))).toBe(true);
    expect(urls.some((u) => u.includes('PUT') && u.includes('upload_id='))).toBe(true);
    expect(await bytesOf(await h.provider.read(conn, 'big.bin'))).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(await h.kv.list('local', 'syncAdapter:google-drive:big.bin:')).toEqual([]);
  });

  it('persists the session URI and resumes the same bytes on retry', async () => {
    const h = makeHarness({ resumableThresholdBytes: 4 });
    const conn = await h.connect();
    h.drive.failNetworkNext(3, 'upload_id=');
    const first = await failureOf(h.provider.write(conn, 'big.bin', bigBody()));
    expect(first.kind).toBe('network');
    const keys = await h.kv.list('local', 'syncAdapter:google-drive:big.bin:');
    expect(keys).toHaveLength(1);

    await h.provider.write(conn, 'big.bin', bigBody());
    const statusProbe = h.drive.requests.find(
      (r) => r.method === 'PUT' && r.url.includes('upload_id='),
    );
    expect(statusProbe).toBeDefined();
    expect(h.drive.filesFor(conn.accountKey)).toHaveLength(1);
    expect(await bytesOf(await h.provider.read(conn, 'big.bin'))).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(await h.kv.list('local', 'syncAdapter:google-drive:big.bin:')).toEqual([]);
  });

  it('commits a session whose bytes landed but whose response was lost', async () => {
    const h = makeHarness({ resumableThresholdBytes: 4 });
    const conn = await h.connect();
    h.drive.failConsumeNext(1, undefined, 'upload_id=');
    await h.provider.write(conn, 'big.bin', bigBody());
    expect(h.drive.filesFor(conn.accountKey)).toHaveLength(1);
    expect(await bytesOf(await h.provider.read(conn, 'big.bin'))).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  it('resumes mid-upload when the server kept a partial range', async () => {
    const h = makeHarness({ resumableThresholdBytes: 4 });
    const conn = await h.connect();
    h.drive.failConsumeNext(1, 4, 'upload_id=');
    await h.provider.write(conn, 'big.bin', bigBody());
    const file = h.drive.filesFor(conn.accountKey)[0]!;
    expect([...file.bytes]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('discards a dead session and starts over', async () => {
    const h = makeHarness({ resumableThresholdBytes: 4 });
    const conn = await h.connect();
    h.drive.failNetworkNext(3, 'upload_id=');
    await failureOf(h.provider.write(conn, 'big.bin', bigBody()));
    const key = (await h.kv.list('local', 'syncAdapter:google-drive:big.bin:'))[0]!;
    await h.kv.set('local', key, { uri: 'https://dead.example/session', size: 10 });
    h.drive.failNext(1, 404, 'notFound', 'dead.example');
    await h.provider.write(conn, 'big.bin', bigBody());
    expect(h.drive.filesFor(conn.accountKey)).toHaveLength(1);
    expect(await bytesOf(await h.provider.read(conn, 'big.bin'))).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  it('uses resumable update sessions when the path already exists', async () => {
    const h = makeHarness({ resumableThresholdBytes: 4 });
    const conn = await h.connect();
    await h.provider.write(conn, 'big.bin', bigBody());
    await h.provider.write(conn, 'big.bin', blobOf(9, 9, 9, 9, 9, 9));
    const urls = h.drive.requests.map((r) => `${r.method} ${r.url}`);
    expect(urls.some((u) => u.startsWith('PATCH') && u.includes('uploadType=resumable'))).toBe(
      true,
    );
    expect(h.drive.filesFor(conn.accountKey)).toHaveLength(1);
    expect(await bytesOf(await h.provider.read(conn, 'big.bin'))).toEqual([9, 9, 9, 9, 9, 9]);
  });
});
