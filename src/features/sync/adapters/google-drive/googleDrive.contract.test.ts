import { runStorageProviderContract } from '../contract/storageProvider.contract.test';
import type { StorageProviderContractEnv } from '../contract/storageProvider.contract.test';
import { blobToBytes } from '../contract/blobBytes';
import { connectionId } from '../../domain/scope';
import type { Connection } from '../../domain/types';
import { InMemoryKeyValueStore } from '../memory/InMemoryKeyValueStore';
import { SeededClock } from '../memory/SeededClock';
import { createFakeDrive } from './fakeDrive';
import { GoogleDriveStorageProvider } from './googleDriveStorageProvider';

const makeGoogleDriveEnv = async (): Promise<StorageProviderContractEnv> => {
  const kv = new InMemoryKeyValueStore();
  const drive = createFakeDrive();
  const provider = new GoogleDriveStorageProvider({
    kv,
    clientId: 'contract-test-client',
    launchWebAuthFlow: drive.launchWebAuthFlow,
    getRedirectUrl: () => 'https://fakeext.chromiumapp.org/',
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
  const connection = await connect();
  return {
    provider,
    connection,
    connect,
    seedNewerDuplicate: async (path, body) => {
      drive.seedFile(connection.accountKey, path, await blobToBytes(body));
    },
  };
};

runStorageProviderContract(makeGoogleDriveEnv);
