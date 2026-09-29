import { describe, expect, it } from '@jest/globals';
import { connectionId } from '../domain/scope';
import type { Connection } from '../domain/types';
import type { ChangeSignal, StorageProvider } from '../ports/storageProvider';
import { InMemoryKeyValueStore } from './memory/InMemoryKeyValueStore';
import { InMemoryStorageProvider } from './memory/InMemoryStorageProvider';
import { SeededClock } from './memory/SeededClock';
import { createFakeDrive } from './google-drive/fakeDrive';
import type { FakeDrive } from './google-drive/fakeDrive';
import { GoogleDriveStorageProvider } from './google-drive/googleDriveStorageProvider';

interface GoogleSetup {
  provider: GoogleDriveStorageProvider;
  signal: ChangeSignal;
  connection: Connection;
  drive: FakeDrive;
  kv: InMemoryKeyValueStore;
}

async function makeGoogleSetup(): Promise<GoogleSetup> {
  const kv = new InMemoryKeyValueStore();
  const drive = createFakeDrive();
  const provider = new GoogleDriveStorageProvider({
    kv,
    clientId: 'signal-test',
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
  if (provider.signal === undefined) throw new Error('provider.signal missing');
  return { provider, signal: provider.signal, connection, drive, kv };
}

async function makeMemorySetup(): Promise<{
  provider: StorageProvider;
  signal: ChangeSignal;
  connection: Connection;
}> {
  const provider = new InMemoryStorageProvider();
  const account = await provider.authorize({ interactive: true });
  const connection: Connection = {
    connectionId: connectionId(provider.providerId, account.accountKey),
    providerId: provider.providerId,
    accountKey: account.accountKey,
    displayName: account.displayName,
  };
  if (provider.signal === undefined) throw new Error('provider.signal missing');
  return { provider, signal: provider.signal, connection };
}

function bellFiles(setup: GoogleSetup) {
  return setup.drive
    .filesFor(setup.connection.accountKey)
    .filter((f) => f.name === 'bell.json');
}

describe('SC-17: ChangeSignal contract', () => {
  it('google-drive: peek on an account without a bell returns null and creates nothing', async () => {
    const setup = await makeGoogleSetup();
    const before = setup.drive.filesFor(setup.connection.accountKey).length;
    expect(await setup.signal.peek(setup.connection)).toBeNull();
    expect(setup.drive.filesFor(setup.connection.accountKey)).toHaveLength(before);
    expect(bellFiles(setup)).toHaveLength(0);
  });

  it('google-drive: ring creates then bumps; peek returns the latest token', async () => {
    const setup = await makeGoogleSetup();
    const first = await setup.signal.ring(setup.connection);
    expect(first).toBe('2');
    expect(bellFiles(setup)).toHaveLength(1);
    expect(await setup.signal.peek(setup.connection)).toBe('2');
    const second = await setup.signal.ring(setup.connection);
    expect(second).toBe('3');
    expect(await setup.signal.peek(setup.connection)).toBe('3');
    expect(bellFiles(setup)).toHaveLength(1);
  });

  it('google-drive: a trashed bell clears the cached id and the next ring recreates it', async () => {
    const setup = await makeGoogleSetup();
    await setup.signal.ring(setup.connection);
    const bell = bellFiles(setup)[0]!;
    const key = `bellFileId:${setup.connection.accountKey}`;
    expect(await setup.kv.get('local', key)).toBe(bell.id);

    setup.drive.setTrashed(setup.connection.accountKey, bell.id, true);
    expect(await setup.signal.peek(setup.connection)).toBeNull();
    expect(await setup.kv.get('local', key)).toBeUndefined();

    const recreated = await setup.signal.ring(setup.connection);
    expect(typeof recreated).toBe('string');
    const next = bellFiles(setup).find((f) => f.id !== bell.id);
    expect(next).toBeDefined();
    expect(await setup.kv.get('local', key)).toBe(next!.id);
  });

  it('google-drive: a deleted bell clears the cached id and the next ring recreates it', async () => {
    const setup = await makeGoogleSetup();
    await setup.signal.ring(setup.connection);
    const bell = bellFiles(setup)[0]!;
    const key = `bellFileId:${setup.connection.accountKey}`;

    setup.drive.deleteFileRaw(setup.connection.accountKey, bell.id);
    expect(await setup.signal.peek(setup.connection)).toBeNull();
    expect(await setup.kv.get('local', key)).toBeUndefined();

    await setup.signal.ring(setup.connection);
    expect(bellFiles(setup)).toHaveLength(1);
  });

  it('google-drive: a cached id that 404s on ring recreates once and returns a token', async () => {
    const setup = await makeGoogleSetup();
    await setup.signal.ring(setup.connection);
    const bell = bellFiles(setup)[0]!;
    setup.drive.deleteFileRaw(setup.connection.accountKey, bell.id);
    const token = await setup.signal.ring(setup.connection);
    expect(token).toBe('2');
    expect(bellFiles(setup)).toHaveLength(1);
  });

  it('in-memory: peek returns null until the first ring, then the latest token', async () => {
    const { signal, connection } = await makeMemorySetup();
    expect(await signal.peek(connection)).toBeNull();
    expect(await signal.ring(connection)).toBe('1');
    expect(await signal.peek(connection)).toBe('1');
    expect(await signal.ring(connection)).toBe('2');
    expect(await signal.peek(connection)).toBe('2');
  });
});
