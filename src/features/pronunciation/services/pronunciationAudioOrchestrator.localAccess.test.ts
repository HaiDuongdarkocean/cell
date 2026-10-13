/**
 * @jest-environment-options {"url": "chrome-extension://Tihoka-test/"}
 */

const mockGetFileHandle = jest.fn();
const mockVerifyPermission = jest.fn();

jest.mock('@/shared/lib/storage/localFileHandleStorage', () => ({
  getFileHandle: (...args: unknown[]) => mockGetFileHandle(...args),
  verifyPermission: (...args: unknown[]) => mockVerifyPermission(...args),
}));

import {
  ensureLocalAudioAccess,
  LocalAudioProvider,
} from './pronunciationAudioOrchestrator';
import type { LocalFileAudioSettings } from '@/entities/settings/types';

function makeLocalFile(over: Partial<LocalFileAudioSettings> = {}): LocalFileAudioSettings {
  return {
    packageType: 'single',
    dslFileHandleId: 'dsl-id',
    audioArchiveHandleId: 'zip-id',
    splitArchiveDirectoryHandleId: 'dir-id',
    splitArchivePattern: 'Forvo_{firstLetter}.zip',
    lastIndexedAt: 1,
    ...over,
  };
}

describe('ensureLocalAudioAccess', () => {
  beforeEach(() => {
    mockGetFileHandle.mockReset();
    mockVerifyPermission.mockReset();
  });

  it('verifies the archive handle for a single-zip package', async () => {
    const handle = { kind: 'file', queryPermission: jest.fn().mockResolvedValue('prompt') };
    mockGetFileHandle.mockResolvedValue(handle);

    await ensureLocalAudioAccess(makeLocalFile());

    expect(mockGetFileHandle).toHaveBeenCalledWith('zip-id');
    expect(mockVerifyPermission).toHaveBeenCalledWith(handle, 'read');
  });

  it('verifies the directory handle for a split package', async () => {
    const handle = { kind: 'directory', queryPermission: jest.fn().mockResolvedValue('prompt') };
    mockGetFileHandle.mockResolvedValue(handle);

    await ensureLocalAudioAccess(makeLocalFile({ packageType: 'split' }));

    expect(mockGetFileHandle).toHaveBeenCalledWith('dir-id');
    expect(mockVerifyPermission).toHaveBeenCalledWith(handle, 'read');
  });

  it('skips the request when permission is already granted', async () => {
    const handle = { kind: 'file', queryPermission: jest.fn().mockResolvedValue('granted') };
    mockGetFileHandle.mockResolvedValue(handle);

    await ensureLocalAudioAccess(makeLocalFile());

    expect(mockVerifyPermission).not.toHaveBeenCalled();
  });

  it('does nothing without settings or a stored handle id', async () => {
    await ensureLocalAudioAccess(undefined);
    await ensureLocalAudioAccess(makeLocalFile({ audioArchiveHandleId: null }));
    expect(mockGetFileHandle).not.toHaveBeenCalled();
  });

  it('does nothing when the stored handle is gone', async () => {
    mockGetFileHandle.mockResolvedValue(undefined);
    await ensureLocalAudioAccess(makeLocalFile());
    expect(mockVerifyPermission).not.toHaveBeenCalled();
  });

  it('swallows storage/permission failures', async () => {
    mockGetFileHandle.mockRejectedValue(new Error('idb gone'));
    await expect(ensureLocalAudioAccess(makeLocalFile())).resolves.toBeUndefined();
  });
});

describe('LocalAudioProvider permission ensure', () => {
  beforeEach(() => {
    mockGetFileHandle.mockReset();
    mockVerifyPermission.mockReset();
  });

  afterEach(() => {
    delete (globalThis as { __TihokaSendMessage?: unknown }).__TihokaSendMessage;
  });

  it('re-verifies the archive handle before delegating to the service worker', async () => {
    const order: string[] = [];
    mockGetFileHandle.mockResolvedValue({
      kind: 'file',
      queryPermission: jest.fn().mockResolvedValue('prompt'),
    });
    mockVerifyPermission.mockImplementation(() => {
      order.push('verifyPermission');
      return Promise.resolve(true);
    });
    (globalThis as { __TihokaSendMessage?: unknown }).__TihokaSendMessage = () => {
      order.push('sendMessage');
      return Promise.resolve({ success: true, data: { items: [] } });
    };

    const provider = new LocalAudioProvider(makeLocalFile());
    await provider.resolve('hello', 'en');

    expect(order).toEqual(['verifyPermission', 'sendMessage']);
  });
});
