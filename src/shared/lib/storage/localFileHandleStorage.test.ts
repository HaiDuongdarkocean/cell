import 'fake-indexeddb/auto';
import {
  saveFileHandle,
  getFileHandle,
  deleteFileHandle,
  listFileHandleIds,
  verifyPermission,
} from './localFileHandleStorage';

describe('localFileHandleStorage', () => {
  beforeEach(async () => {
    for (const id of await listFileHandleIds()) {
      await deleteFileHandle(id);
    }
  });

  it('saves and retrieves a file handle', async () => {
    const mockHandle = { kind: 'file', name: 'test.zip' } as unknown as FileSystemFileHandle;
    await saveFileHandle('handle-1', mockHandle);
    const loaded = await getFileHandle('handle-1');
    expect(loaded).toEqual(expect.objectContaining({ kind: 'file', name: 'test.zip' }));
  });

  it('saves and retrieves a directory handle', async () => {
    const mockHandle = { kind: 'directory', name: 'ForvoEnglish' } as unknown as FileSystemDirectoryHandle;
    await saveFileHandle('dir-1', mockHandle);
    const loaded = await getFileHandle('dir-1');
    expect(loaded).toEqual(expect.objectContaining({ kind: 'directory', name: 'ForvoEnglish' }));
  });

  it('returns undefined for an unknown id', async () => {
    const loaded = await getFileHandle('missing');
    expect(loaded).toBeUndefined();
  });

  it('deletes a stored handle', async () => {
    const mockHandle = { kind: 'file', name: 'test.zip' } as unknown as FileSystemFileHandle;
    await saveFileHandle('to-delete', mockHandle);
    await deleteFileHandle('to-delete');
    const loaded = await getFileHandle('to-delete');
    expect(loaded).toBeUndefined();
  });

  it('lists all stored handle ids', async () => {
    const h1 = { kind: 'file', name: 'a.zip' } as unknown as FileSystemFileHandle;
    const h2 = { kind: 'file', name: 'b.zip' } as unknown as FileSystemFileHandle;
    await saveFileHandle('id-a', h1);
    await saveFileHandle('id-b', h2);
    const ids = await listFileHandleIds();
    expect(ids).toEqual(expect.arrayContaining(['id-a', 'id-b']));
    expect(ids.length).toBe(2);
  });

  it('overwrites an existing handle', async () => {
    const h1 = { kind: 'file', name: 'old.zip' } as unknown as FileSystemFileHandle;
    const h2 = { kind: 'file', name: 'new.zip' } as unknown as FileSystemFileHandle;
    await saveFileHandle('same', h1);
    await saveFileHandle('same', h2);
    const loaded = await getFileHandle('same');
    expect(loaded).toEqual(expect.objectContaining({ name: 'new.zip' }));
  });

  describe('verifyPermission', () => {
    it('returns true when permission is already granted', async () => {
      const handle = {
        queryPermission: jest.fn().mockResolvedValue('granted'),
        requestPermission: jest.fn(),
      } as unknown as FileSystemHandle;
      const ok = await verifyPermission(handle);
      expect(ok).toBe(true);
      expect(handle.requestPermission).not.toHaveBeenCalled();
    });

    it('requests permission and returns true when user grants', async () => {
      const handle = {
        queryPermission: jest.fn().mockResolvedValue('prompt'),
        requestPermission: jest.fn().mockResolvedValue('granted'),
      } as unknown as FileSystemHandle;
      const ok = await verifyPermission(handle, 'readwrite');
      expect(handle.queryPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
      expect(handle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
      expect(ok).toBe(true);
    });

    it('returns false when permission is denied', async () => {
      const handle = {
        queryPermission: jest.fn().mockResolvedValue('prompt'),
        requestPermission: jest.fn().mockResolvedValue('denied'),
      } as unknown as FileSystemHandle;
      const ok = await verifyPermission(handle);
      expect(ok).toBe(false);
    });
  });
});
