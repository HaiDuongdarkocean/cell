import type { Connection } from '../../domain/types';
import { connectionId } from '../../domain/scope';
import { ProviderError } from '../../ports/storageProvider';
import { InMemoryKeyValueStore } from '../memory/InMemoryKeyValueStore';
import { SeededClock } from '../memory/SeededClock';
import { blobToBytes } from '../contract/blobBytes';
import { createFakeDrive } from './fakeDrive';
import type { FakeDrive } from './fakeDrive';
import { FOLDER_MIME } from './driveLayout';
import { GoogleDriveStorageProvider } from './googleDriveStorageProvider';

const REDIRECT_URL = 'https://fakeext.chromiumapp.org/';
const CHAIN = 'cell-sync/v1/scopes/profile:en/devices/dev1';

interface Harness {
  provider: GoogleDriveStorageProvider;
  drive: FakeDrive;
  kv: InMemoryKeyValueStore;
  connect(): Promise<Connection>;
}

const makeHarness = (): Harness => {
  const kv = new InMemoryKeyValueStore();
  const drive = createFakeDrive();
  const provider = new GoogleDriveStorageProvider({
    kv,
    clientId: 'unit-test-client',
    launchWebAuthFlow: drive.launchWebAuthFlow,
    getRedirectUrl: () => REDIRECT_URL,
    fetchFn: drive.fetchFn,
    clock: new SeededClock(1_700_000_000_000),
    sleep: async () => {},
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
  return { provider, drive, kv, connect };
};

const textOf = async (blob: Blob): Promise<string> =>
  new TextDecoder().decode(await blobToBytes(blob));

const listQueries = (drive: FakeDrive): string[] =>
  drive.requests
    .filter((r) => r.method === 'GET' && r.url.includes('/files?'))
    .map((r) => decodeURIComponent(new URL(r.url).searchParams.get('q') ?? ''));

describe('foldered layout', () => {
  it('writes mapped paths into folder chain', async () => {
    const { provider, drive, connect } = makeHarness();
    const conn = await connect();
    await provider.write(conn, `${CHAIN}/journal-1.json.gz`, new Blob(['abc']));
    const folders = drive.foldersFor(conn.accountKey).map((f) => f.name);
    expect(folders).toEqual(expect.arrayContaining(['profile-en', 'dev1']));
    const file = drive
      .filesFor(conn.accountKey)
      .find((f) => f.name === 'journal-1.json.gz');
    expect(file?.parent).toBe(
      drive.foldersFor(conn.accountKey).find((f) => f.name === 'dev1')?.id,
    );
  });

  it('reads a foldered file written through the provider', async () => {
    const { provider, connect } = makeHarness();
    const conn = await connect();
    await provider.write(conn, `${CHAIN}/journal-2.json.gz`, new Blob(['payload']));
    const blob = await provider.read(conn, `${CHAIN}/journal-2.json.gz`);
    expect(await textOf(blob)).toBe('payload');
  });

  it('reads newest across namespaces: newer flat twin wins, flat-only resolves', async () => {
    const { provider, drive, connect } = makeHarness();
    const conn = await connect();
    await provider.write(conn, `${CHAIN}/journal-9.json.gz`, new Blob(['foldered-old']));
    const folderedFile = drive
      .filesFor(conn.accountKey)
      .find((f) => f.name === 'journal-9.json.gz')!;
    drive.setModifiedTime(conn.accountKey, folderedFile.id, 100);
    drive.seedFile(conn.accountKey, `${CHAIN}/journal-9.json.gz`, new TextEncoder().encode('flat-new'), 'drive', { modifiedSeq: 900 });
    drive.seedFile(conn.accountKey, `${CHAIN}/journal-8.json.gz`, new TextEncoder().encode('flat-only'), 'drive', { modifiedSeq: 950 });
    const readBack = await provider.read(conn, `${CHAIN}/journal-9.json.gz`);
    expect(await textOf(readBack)).toBe('flat-new');
    const flatOnly = await provider.read(conn, `${CHAIN}/journal-8.json.gz`);
    expect(await textOf(flatOnly)).toBe('flat-only');
  });

  it('remove deletes both flat and foldered copies', async () => {
    const { provider, drive, connect } = makeHarness();
    const conn = await connect();
    drive.seedFile(conn.accountKey, `${CHAIN}/journal-5.json.gz`, new TextEncoder().encode('flat'), 'drive', { modifiedSeq: 10 });
    await provider.write(conn, `${CHAIN}/journal-5.json.gz`, new Blob(['foldered']));
    await provider.remove(conn, `${CHAIN}/journal-5.json.gz`);
    const remaining = drive
      .filesFor(conn.accountKey)
      .filter((f) => f.name.includes('journal-5'));
    expect(remaining).toHaveLength(0);
  });

  it('remove throws not-found when neither copy exists', async () => {
    const { provider, connect } = makeHarness();
    const conn = await connect();
    await expect(provider.remove(conn, `${CHAIN}/journal-99.json.gz`)).rejects.toBeInstanceOf(
      ProviderError,
    );
  });

  it('list merges flat and foldered entries newest-wins', async () => {
    const { provider, drive, connect } = makeHarness();
    const conn = await connect();
    await provider.write(conn, `${CHAIN}/journal-1.json.gz`, new Blob(['fold']));
    const foldFile = drive.filesFor(conn.accountKey).find((f) => f.name === 'journal-1.json.gz')!;
    drive.setModifiedTime(conn.accountKey, foldFile.id, 200);
    drive.seedFile(conn.accountKey, `${CHAIN}/journal-1.json.gz`, new TextEncoder().encode('flat'), 'drive', { modifiedSeq: 300 });
    const entries = await provider.list(conn, 'cell-sync/v1/scopes/profile:en/devices/dev1/');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.path).toBe(`${CHAIN}/journal-1.json.gz`);
    expect(entries[0]!.modifiedAt).toBe(1_700_000_000_000 + 300 * 1000);
  });

  it('list(scopesPrefix) descends folder tree within bounded queries', async () => {
    const { provider, drive, connect } = makeHarness();
    const conn = await connect();
    await provider.write(conn, `${CHAIN}/journal-1.json.gz`, new Blob(['a']));
    await provider.write(conn, 'cell-sync/v1/scopes/global/devices/dev2/journal-1.json.gz', new Blob(['b']));
    const before = listQueries(drive).length;
    const entries = await provider.list(conn, 'cell-sync/v1/scopes/');
    const queries = listQueries(drive).length - before;
    expect(queries).toBeLessThanOrEqual(4);
    expect(entries.map((e) => e.path).sort()).toEqual([
      'cell-sync/v1/scopes/global/devices/dev2/journal-1.json.gz',
      'cell-sync/v1/scopes/profile:en/devices/dev1/journal-1.json.gz',
    ]);
  });

  it('list returns flat-only results for unmapped prefixes', async () => {
    const { provider, drive, connect } = makeHarness();
    const conn = await connect();
    drive.seedFile(conn.accountKey, 'cell-sync/v1/scratch/x.txt', new TextEncoder().encode('x'), 'drive');
    const entries = await provider.list(conn, 'cell-sync/v1/scratch/');
    expect(entries.map((e) => e.path)).toEqual(['cell-sync/v1/scratch/x.txt']);
  });
});

describe('flat migration', () => {
  it('moves a legacy flat file into the folder chain metadata-only', async () => {
    const { provider, drive, connect } = makeHarness();
    const conn = await connect();
    const legacy = drive.seedFile(conn.accountKey, `${CHAIN}/journal-1.json.gz`, new TextEncoder().encode('old'), 'drive');
    await provider.list(conn, 'cell-sync/v1/');
    const moved = drive.filesFor(conn.accountKey).find((f) => f.id === legacy.id);
    const devFolder = drive.foldersFor(conn.accountKey).find((f) => f.name === 'dev1');
    expect(moved?.name).toBe('journal-1.json.gz');
    expect(moved?.parent).toBe(devFolder?.id);
    expect(drive.filesFor(conn.accountKey).filter((f) => f.name.includes('journal-1'))).toHaveLength(1);
  });

  it('removes the older flat twin when foldered copy is newer', async () => {
    const { provider, drive, connect } = makeHarness();
    const conn = await connect();
    await provider.write(conn, `${CHAIN}/journal-2.json.gz`, new Blob(['fresh']));
    const flat = drive.seedFile(conn.accountKey, `${CHAIN}/journal-2.json.gz`, new TextEncoder().encode('stale'), 'drive', { modifiedSeq: 1 });
    await provider.list(conn, 'cell-sync/v1/');
    expect(drive.filesFor(conn.accountKey).filter((f) => f.id === flat.id)).toHaveLength(0);
    const kept = drive.filesFor(conn.accountKey).filter((f) => f.name === 'journal-2.json.gz');
    expect(kept).toHaveLength(1);
    expect(new TextDecoder().decode(kept[0]!.bytes)).toBe('fresh');
  });

  it('throttles migration via kv flag', async () => {
    const { provider, drive, kv, connect } = makeHarness();
    const conn = await connect();
    drive.seedFile(conn.accountKey, `${CHAIN}/journal-3.json.gz`, new TextEncoder().encode('a'), 'drive');
    await provider.list(conn, 'cell-sync/v1/');
    expect(
      await kv.get<number>(
        'local',
        `syncAdapter:google-drive:flatMigrated:${conn.accountKey}`,
      ),
    ).toEqual(expect.any(Number));
    drive.seedFile(conn.accountKey, `${CHAIN}/journal-4.json.gz`, new TextEncoder().encode('b'), 'drive');
    const before = drive.requests.length;
    await provider.list(conn, 'cell-sync/v1/');
    const patches = drive.requests
      .slice(before)
      .filter((r) => r.method === 'PATCH');
    expect(patches).toHaveLength(0);
  });

  it('does not create folders when reading a missing path', async () => {
    const { provider, drive, connect } = makeHarness();
    const conn = await connect();
    await expect(provider.read(conn, `${CHAIN}/nope.json.gz`)).rejects.toBeInstanceOf(ProviderError);
    expect(drive.foldersFor(conn.accountKey).map((f) => f.name)).toEqual(['Tihoka Sync']);
  });
});
