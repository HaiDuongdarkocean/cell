import type { Connection } from '../../domain/types';
import { connectionId } from '../../domain/scope';
import { ProviderError } from '../../ports/storageProvider';
import type { StorageProvider } from '../../ports/storageProvider';
import { InMemoryStorageProvider } from '../memory/InMemoryStorageProvider';
import { SeededClock } from '../memory/SeededClock';
import { blobToBytes } from './blobBytes';

export interface StorageProviderContractEnv {
  provider: StorageProvider;
  connection: Connection;
  connect(): Promise<Connection>;
  seedNewerDuplicate(path: string, body: Blob): Promise<void>;
}

export type MakeStorageProviderContractEnv =
  () => Promise<StorageProviderContractEnv> | StorageProviderContractEnv;

const blobOf = (...bytes: number[]): Blob => new Blob([new Uint8Array(bytes)]);

const bytesOf = async (blob: Blob): Promise<number[]> => [...await blobToBytes(blob)];

const failureOf = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
    return undefined;
  } catch (e) {
    return e;
  }
};

export function runStorageProviderContract(makeEnv: MakeStorageProviderContractEnv): void {
  describe('StorageProvider contract', () => {
    let env: StorageProviderContractEnv;
    let conn: Connection;

    beforeEach(async () => {
      env = await makeEnv();
      conn = env.connection;
    });

    it('authorizes an account and derives a stable connection id', async () => {
      expect(conn.connectionId).toBe(`${env.provider.providerId}:${conn.accountKey}`);
      expect(conn.accountKey.length).toBeGreaterThan(0);
      expect(conn.displayName.length).toBeGreaterThan(0);
    });

    it('write is upsert-by-path: identical (path, bytes) stays one file', async () => {
      await env.provider.write(conn, 'a/f.bin', blobOf(9, 8, 7));
      await env.provider.write(conn, 'a/f.bin', blobOf(9, 8, 7));
      expect(await env.provider.list(conn, 'a/')).toHaveLength(1);
      expect(await bytesOf(await env.provider.read(conn, 'a/f.bin'))).toEqual([9, 8, 7]);
    });

    it('retrying a write after a crash creates no second file', async () => {
      const path = 'cell-sync/v1/scopes/global/devices/d1/journal-3.json.gz';
      await env.provider.write(conn, path, blobOf(1, 2, 3));
      await env.provider.write(conn, path, blobOf(1, 2, 3));
      const entries = await env.provider.list(conn, 'cell-sync/v1/scopes/global/devices/d1/');
      expect(entries.map((e) => e.path)).toEqual([path]);
    });

    it('write with different bytes replaces the path without duplicating it', async () => {
      await env.provider.write(conn, 'u/f.bin', blobOf(1));
      await env.provider.write(conn, 'u/f.bin', blobOf(2, 3));
      expect(await env.provider.list(conn, 'u/')).toHaveLength(1);
      expect(await bytesOf(await env.provider.read(conn, 'u/f.bin'))).toEqual([2, 3]);
    });

    it('read returns exactly the written bytes', async () => {
      const payload = [0, 1, 2, 255, 254, 13, 10, 0];
      await env.provider.write(conn, 'r/blob', blobOf(...payload));
      expect(await bytesOf(await env.provider.read(conn, 'r/blob'))).toEqual(payload);
    });

    it('list filters strictly by path prefix and reports RemoteEntry fields', async () => {
      await env.provider.write(conn, 'cell-sync/v1/meta/format.json', blobOf(1));
      await env.provider.write(conn, 'cell-sync/v1/scopes/global/devices/d1/journal-1.json.gz', blobOf(2, 2));
      await env.provider.write(conn, 'other/x', blobOf(3));

      const meta = await env.provider.list(conn, 'cell-sync/v1/meta/');
      expect(meta).toHaveLength(1);
      expect(meta[0]).toMatchObject({
        path: 'cell-sync/v1/meta/format.json',
        size: 1,
      });
      expect(typeof meta[0]!.modifiedAt).toBe('number');

      const all = await env.provider.list(conn, 'cell-sync/');
      expect(all.map((e) => e.path)).toEqual([
        'cell-sync/v1/meta/format.json',
        'cell-sync/v1/scopes/global/devices/d1/journal-1.json.gz',
      ]);
      expect(await env.provider.list(conn, 'cell-sync/v1/nothing/')).toEqual([]);
    });

    it('list dedupes duplicate paths to the newest copy and write removes the rest', async () => {
      await env.provider.write(conn, 'd/f.bin', blobOf(1));
      await env.seedNewerDuplicate('d/f.bin', blobOf(2, 2));

      const entries = await env.provider.list(conn, 'd/');
      expect(entries).toHaveLength(1);
      expect(entries[0]!.size).toBe(2);
      expect(await bytesOf(await env.provider.read(conn, 'd/f.bin'))).toEqual([2, 2]);

      await env.provider.write(conn, 'd/f.bin', blobOf(3));
      expect(await env.provider.list(conn, 'd/')).toHaveLength(1);
      expect(await bytesOf(await env.provider.read(conn, 'd/f.bin'))).toEqual([3]);
    });

    it('remove deletes the path; further reads and removes fail not-found', async () => {
      await env.provider.write(conn, 'm/f.bin', blobOf(1));
      await env.provider.remove(conn, 'm/f.bin');
      expect(await env.provider.list(conn, 'm/')).toEqual([]);

      const readErr = await failureOf(env.provider.read(conn, 'm/f.bin'));
      expect(readErr).toBeInstanceOf(ProviderError);
      expect((readErr as ProviderError).kind).toBe('not-found');

      const removeErr = await failureOf(env.provider.remove(conn, 'm/f.bin'));
      expect(removeErr).toBeInstanceOf(ProviderError);
      expect((removeErr as ProviderError).kind).toBe('not-found');
    });

    it('read of a missing path fails with a not-found ProviderError', async () => {
      const err = await failureOf(env.provider.read(conn, 'missing.bin'));
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).kind).toBe('not-found');
    });

    it('quota reports usedBytes that grows with writes and a nullable totalBytes', async () => {
      const before = await env.provider.quota(conn);
      const body = new Blob([new Uint8Array(100)]);
      await env.provider.write(conn, 'q/blob', body);
      const after = await env.provider.quota(conn);
      expect(after.usedBytes).toBeGreaterThanOrEqual(before.usedBytes + 100);
      expect(after.totalBytes === null || typeof after.totalBytes === 'number').toBe(true);
    });

    it('stores files per connection', async () => {
      const other = await env.connect();
      expect(other.connectionId).not.toBe(conn.connectionId);

      await env.provider.write(conn, 's/only-here.bin', blobOf(7));
      expect(await env.provider.list(other, 's/')).toEqual([]);
      const err = await failureOf(env.provider.read(other, 's/only-here.bin'));
      expect((err as ProviderError).kind).toBe('not-found');
    });

    it('a revoked connection cannot call operations', async () => {
      const c = await env.connect();
      await env.provider.write(c, 'v/f.bin', blobOf(1));
      await env.provider.revoke(c);
      const err = await failureOf(env.provider.list(c, 'v/'));
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).kind).toBe('auth');
    });

    it('reports token presence and drops it on revoke', async () => {
      const c = await env.connect();
      expect(await env.provider.hasToken(c)).toBe(true);
      await env.provider.revoke(c);
      expect(await env.provider.hasToken(c)).toBe(false);
    });
  });
}

const makeInMemoryEnv = async (): Promise<StorageProviderContractEnv> => {
  const provider = new InMemoryStorageProvider({ clock: new SeededClock(1_700_000_000_000) });
  const connect = async (): Promise<Connection> => {
    const account = await provider.authorize({ interactive: true });
    return {
      connectionId: connectionId(provider.providerId, account.accountKey),
      providerId: provider.providerId,
      accountKey: account.accountKey,
      displayName: account.displayName,
    };
  };
  const connection = await connect();
  return {
    provider,
    connection,
    connect,
    seedNewerDuplicate: async (path, body) => {
      await provider.seedDuplicate(connection, path, body);
    },
  };
};

runStorageProviderContract(makeInMemoryEnv);
