import { describe, expect, it } from '@jest/globals';
import { connectionId } from '../../domain/scope';
import type { Connection } from '../../domain/types';
import { blobToBytes } from '../contract/blobBytes';
import { InMemoryKeyValueStore } from '../memory/InMemoryKeyValueStore';
import { SeededClock } from '../memory/SeededClock';
import { createFakeDrive } from './fakeDrive';
import type { FakeDrive } from './fakeDrive';
import { GoogleDriveStorageProvider } from './googleDriveStorageProvider';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

interface Setup {
  provider: GoogleDriveStorageProvider;
  connection: Connection;
  drive: FakeDrive;
}

async function makeSetup(): Promise<Setup> {
  const kv = new InMemoryKeyValueStore();
  const drive = createFakeDrive();
  const provider = new GoogleDriveStorageProvider({
    kv,
    clientId: 'fresh-write-test',
    launchWebAuthFlow: drive.launchWebAuthFlow,
    getRedirectUrl: () => 'https://fakeext.chromiumapp.org/',
    fetchFn: drive.fetchFn,
    clock: new SeededClock(1_700_000_000_000),
    sleep: async () => {},
  });
  const account = await provider.authorize({ interactive: true });
  const connection: Connection = {
    connectionId: connectionId(provider.providerId, account.accountKey),
    providerId: provider.providerId,
    accountKey: account.accountKey,
    displayName: account.displayName,
  };
  return { provider, connection, drive };
}

const META_FORMAT = 'cell-sync/v1/meta/format.json';
const META_BELL = 'cell-sync/v1/meta/bell.json';
const body = () => new Blob([JSON.stringify({ ok: true })], { type: 'application/json' });

function driveRequests(setup: Setup): { method: string; url: string }[] {
  return setup.drive.requests.filter(
    (r) => r.url.includes('/drive/v3/') || r.url.includes('/upload/drive/v3/'),
  );
}

describe('SC-16: fresh write skips existence lookups', () => {
  it('a fresh write on a warm chain issues only the multipart create', async () => {
    const setup = await makeSetup();
    await setup.provider.write(setup.connection, META_FORMAT, body());
    setup.drive.requests.length = 0;

    await setup.provider.write(setup.connection, META_BELL, body(), { fresh: true });

    const requests = driveRequests(setup);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.method).toBe('POST');
    expect(requests[0]!.url).toContain(`${UPLOAD_API}/files`);
    expect(requests[0]!.url).toContain('uploadType=multipart');
    expect(
      requests.filter((r) => r.method === 'GET' && r.url.startsWith(`${DRIVE_API}/files?`)),
    ).toHaveLength(0);

    const bell = setup.drive.filesFor(setup.connection.accountKey).find((f) => f.name === 'bell.json');
    expect(bell).toBeDefined();
  });

  it('a write without opts keeps the old request sequence (lookup queries then create)', async () => {
    const setup = await makeSetup();
    await setup.provider.write(setup.connection, META_FORMAT, body());
    setup.drive.requests.length = 0;

    await setup.provider.write(setup.connection, META_BELL, body());

    const requests = driveRequests(setup);
    const listCalls = requests.filter(
      (r) => r.method === 'GET' && r.url.startsWith(`${DRIVE_API}/files?`),
    );
    const creates = requests.filter(
      (r) => r.method === 'POST' && r.url.includes('uploadType=multipart'),
    );
    expect(listCalls.length).toBeGreaterThanOrEqual(2);
    expect(creates).toHaveLength(1);
    expect(requests[requests.length - 1]).toEqual(creates[0]);
  });

  it('a fresh write still lands in the resolved folder chain', async () => {
    const setup = await makeSetup();
    const entry = await setup.provider.write(setup.connection, META_BELL, body(), {
      fresh: true,
    });
    expect(entry.path).toBe('bell.json');
    const readBack = await setup.provider.read(setup.connection, META_BELL);
    expect(new TextDecoder().decode(await blobToBytes(readBack))).toBe(
      JSON.stringify({ ok: true }),
    );
  });
});
