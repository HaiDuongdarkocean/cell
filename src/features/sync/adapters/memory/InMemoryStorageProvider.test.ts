import type { Connection } from '../../domain/types';
import { connectionId } from '../../domain/scope';
import { ProviderError } from '../../ports/storageProvider';
import { blobToBytes } from '../contract/blobBytes';
import { InMemoryStorageProvider } from './InMemoryStorageProvider';
import { SeededClock } from './SeededClock';

const toConnection = (provider: InMemoryStorageProvider, account: { accountKey: string; displayName: string }): Connection => ({
  connectionId: connectionId(provider.providerId, account.accountKey),
  providerId: provider.providerId,
  accountKey: account.accountKey,
  displayName: account.displayName,
});

const connect = async (provider: InMemoryStorageProvider): Promise<Connection> => {
  const account = await provider.authorize({ interactive: true });
  return toConnection(provider, account);
};

const failureOf = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
    return undefined;
  } catch (e) {
    return e;
  }
};

describe('InMemoryStorageProvider', () => {
  describe('authorize', () => {
    it('returns a distinct account per interactive authorization', async () => {
      const provider = new InMemoryStorageProvider();
      const a = await provider.authorize({ interactive: true });
      const b = await provider.authorize({ interactive: true });
      expect(a.accountKey).not.toBe(b.accountKey);
      expect(a.accessToken).not.toBe(b.accessToken);
      expect(a.expiresAt).toBeGreaterThan(0);
    });

    it('returns the same account when accountHint matches', async () => {
      const provider = new InMemoryStorageProvider();
      const first = await provider.authorize({ interactive: true });
      const again = await provider.authorize({ interactive: true, accountHint: first.displayName });
      expect(again.accountKey).toBe(first.accountKey);
      const byKey = await provider.authorize({ interactive: true, accountHint: first.accountKey });
      expect(byKey.accountKey).toBe(first.accountKey);
    });

    it('renews a token non-interactively for a hinted account', async () => {
      const provider = new InMemoryStorageProvider();
      const first = await provider.authorize({ interactive: true });
      const renewed = await provider.authorize({ interactive: false, accountHint: first.displayName });
      expect(renewed.accountKey).toBe(first.accountKey);
      expect(renewed.accessToken).not.toBe(first.accessToken);
    });

    it('rejects silent authorization without a known account hint', async () => {
      const provider = new InMemoryStorageProvider();
      const err = await failureOf(provider.authorize({ interactive: false }));
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).kind).toBe('auth');
      const unknown = await failureOf(provider.authorize({ interactive: false, accountHint: 'ghost@x.test' }));
      expect((unknown as ProviderError).kind).toBe('auth');
    });
  });

  describe('failure injection', () => {
    it('fails exactly the next N operations with the given kind, then recovers', async () => {
      const provider = new InMemoryStorageProvider();
      const conn = await connect(provider);
      provider.failNext(2, 'rate-limit');
      const e1 = await failureOf(provider.list(conn, ''));
      const e2 = await failureOf(provider.write(conn, 'x', new Blob([new Uint8Array([1])])));
      expect((e1 as ProviderError).kind).toBe('rate-limit');
      expect((e2 as ProviderError).kind).toBe('rate-limit');
      await expect(provider.list(conn, '')).resolves.toEqual([]);
    });

    it('injected failures surface as ProviderError and can hit authorize', async () => {
      const provider = new InMemoryStorageProvider();
      provider.failNext(1, 'network');
      const err = await failureOf(provider.authorize({ interactive: true }));
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).kind).toBe('network');
    });
  });

  describe('quota', () => {
    it('rejects writes beyond the configured byte quota', async () => {
      const provider = new InMemoryStorageProvider({ quotaBytes: 5 });
      const conn = await connect(provider);
      await provider.write(conn, 'a', new Blob([new Uint8Array(5)]));
      const err = await failureOf(provider.write(conn, 'b', new Blob([new Uint8Array(1)])));
      expect((err as ProviderError).kind).toBe('quota');
      const q = await provider.quota(conn);
      expect(q).toEqual({ usedBytes: 5, totalBytes: 5 });
    });

    it('setQuotaBytes reconfigures the limit', async () => {
      const provider = new InMemoryStorageProvider({ quotaBytes: 1 });
      const conn = await connect(provider);
      const err = await failureOf(provider.write(conn, 'a', new Blob([new Uint8Array(2)])));
      expect((err as ProviderError).kind).toBe('quota');
      provider.setQuotaBytes(10);
      await expect(provider.write(conn, 'a', new Blob([new Uint8Array(2)]))).resolves.toMatchObject({ size: 2 });
      provider.setQuotaBytes(null);
      expect((await provider.quota(conn)).totalBytes).toBeNull();
    });
  });

  describe('duplicates', () => {
    it('write collapses seeded duplicate copies of a path', async () => {
      const provider = new InMemoryStorageProvider();
      const conn = await connect(provider);
      await provider.write(conn, 'p/f', new Blob([new Uint8Array([1])]));
      await provider.seedDuplicate(conn, 'p/f', new Blob([new Uint8Array([2])]));
      expect(provider.countCopies(conn, 'p/f')).toBe(2);
      await provider.write(conn, 'p/f', new Blob([new Uint8Array([3])]));
      expect(provider.countCopies(conn, 'p/f')).toBe(1);
      expect([...await blobToBytes(await provider.read(conn, 'p/f'))]).toEqual([3]);
    });

    it('list and read select the copy with the newest modifiedAt', async () => {
      const clock = new SeededClock(1000);
      const provider = new InMemoryStorageProvider({ clock });
      const conn = await connect(provider);
      await provider.write(conn, 'p/f', new Blob([new Uint8Array([9])]));
      await provider.seedDuplicate(conn, 'p/f', new Blob([new Uint8Array([1])]), { modifiedAt: 1 });
      const [entry] = await provider.list(conn, 'p/');
      expect(entry!.modifiedAt).toBe(1000);
      expect([...await blobToBytes(await provider.read(conn, 'p/f'))]).toEqual([9]);
    });
  });

  describe('revoke', () => {
    it('blocks operations until the account is re-authorized', async () => {
      const provider = new InMemoryStorageProvider();
      const conn = await connect(provider);
      await provider.write(conn, 'v/f', new Blob([new Uint8Array([1])]));
      await provider.revoke(conn);
      const err = await failureOf(provider.read(conn, 'v/f'));
      expect((err as ProviderError).kind).toBe('auth');
      const account = await provider.authorize({ interactive: false, accountHint: conn.accountKey });
      const restored = toConnection(provider, account);
      expect(restored.connectionId).toBe(conn.connectionId);
      await expect(provider.list(restored, 'v/')).resolves.toHaveLength(1);
    });
  });

  it('rejects operations for unknown connections with an auth error', async () => {
    const provider = new InMemoryStorageProvider();
    const conn = await connect(provider);
    const foreign: Connection = { ...conn, accountKey: 'nobody' };
    const err = await failureOf(provider.list(foreign, ''));
    expect((err as ProviderError).kind).toBe('auth');
  });
});
