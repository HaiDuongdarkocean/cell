import { LingvoDslAudioProvider } from './lingvoDslAudioProvider';
import type { LocalFileAudioSettings } from '@/entities/settings';

const mockGetFileHandle = jest.fn();
const mockVerifyPermission = jest.fn();
const mockGetLingvoDslAudioPaths = jest.fn();
const mockSingleResolveAudio = jest.fn();
const mockSplitResolveAudio = jest.fn();

jest.mock('@/shared/lib/storage/localFileHandleStorage', () => ({
  getFileHandle: (...args: unknown[]) => mockGetFileHandle(...args),
  verifyPermission: (...args: unknown[]) => mockVerifyPermission(...args),
  saveFileHandle: jest.fn(),
  deleteFileHandle: jest.fn(),
  listFileHandleIds: jest.fn(),
}));

jest.mock('../repositories/lingvoDslIndexRepository', () => ({
  getLingvoDslAudioPaths: (...args: unknown[]) => mockGetLingvoDslAudioPaths(...args),
  saveLingvoDslIndex: jest.fn(),
  clearLingvoDslIndex: jest.fn(),
}));

jest.mock('./zipAudioResolver', () => ({
  SingleZipAudioResolver: jest.fn().mockImplementation(() => ({
    resolveAudio: mockSingleResolveAudio,
  })),
  SplitZipAudioResolver: jest.fn().mockImplementation(() => ({
    resolveAudio: mockSplitResolveAudio,
  })),
}));

describe('LingvoDslAudioProvider', () => {
  const createObjectURLSpy = jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFileHandle.mockReset();
    mockVerifyPermission.mockReset();
    mockGetLingvoDslAudioPaths.mockReset();
    mockSingleResolveAudio.mockReset();
    mockSplitResolveAudio.mockReset();
    createObjectURLSpy.mockReturnValue('blob:mock');
  });

  it('returns empty array when no local package is configured', async () => {
    const settings: LocalFileAudioSettings = {
      packageType: 'single',
      dslFileHandleId: null,
      audioArchiveHandleId: null,
      splitArchiveDirectoryHandleId: null,
      splitArchivePattern: '',
      lastIndexedAt: null,
    };
    const provider = new LingvoDslAudioProvider(settings);
    const items = await provider.resolve('hello', 'en');
    expect(items).toEqual([]);
  });

  it('resolves audio items for a single package', async () => {
    const archiveHandle = { kind: 'file', name: 'ForvoEnglish.dsl.files.zip' } as unknown as FileSystemFileHandle;
    mockGetFileHandle.mockResolvedValue(archiveHandle);
    mockVerifyPermission.mockResolvedValue(true);
    mockGetLingvoDslAudioPaths.mockResolvedValue(['hello.mp3', 'hello2.mp3']);
    mockSingleResolveAudio
      .mockResolvedValueOnce(new Blob(['a'], { type: 'audio/mpeg' }))
      .mockResolvedValueOnce(undefined);

    const settings: LocalFileAudioSettings = {
      packageType: 'single',
      dslFileHandleId: 'dsl-1',
      audioArchiveHandleId: 'archive-1',
      splitArchiveDirectoryHandleId: null,
      splitArchivePattern: '',
      lastIndexedAt: Date.now(),
    };
    const provider = new LingvoDslAudioProvider(settings);
    const items = await provider.resolve('hello', 'en');

    expect(mockGetFileHandle).toHaveBeenCalledWith('archive-1');
    expect(mockVerifyPermission).toHaveBeenCalledWith(archiveHandle, 'read');
    expect(mockGetLingvoDslAudioPaths).toHaveBeenCalledWith('dsl-1', 'hello');
    expect(items).toHaveLength(1);
    expect(items[0].source).toBe('local');
    expect(items[0].kind).toBe('word');
    expect(items[0].url).toBe('blob:mock');
  });

  it('resolves audio items for a split package', async () => {
    const dirHandle = { kind: 'directory', name: 'ForvoEnglish' } as unknown as FileSystemDirectoryHandle;
    mockGetFileHandle.mockResolvedValue(dirHandle);
    mockVerifyPermission.mockResolvedValue(true);
    mockGetLingvoDslAudioPaths.mockResolvedValue(['hello.mp3']);
    mockSplitResolveAudio.mockResolvedValue(new Blob(['a'], { type: 'audio/mpeg' }));

    const settings: LocalFileAudioSettings = {
      packageType: 'split',
      dslFileHandleId: 'dsl-1',
      audioArchiveHandleId: null,
      splitArchiveDirectoryHandleId: 'dir-1',
      splitArchivePattern: 'ForvoEnglish_{firstLetter}.zip',
      lastIndexedAt: Date.now(),
    };
    const provider = new LingvoDslAudioProvider(settings);
    const items = await provider.resolve('hello', 'en');

    expect(mockGetFileHandle).toHaveBeenCalledWith('dir-1');
    expect(mockSplitResolveAudio).toHaveBeenCalledWith('hello', 'hello.mp3');
    expect(items).toHaveLength(1);
  });

  it('returns empty array when permission is denied', async () => {
    const archiveHandle = { kind: 'file' } as unknown as FileSystemFileHandle;
    mockGetFileHandle.mockResolvedValue(archiveHandle);
    mockVerifyPermission.mockResolvedValue(false);

    const settings: LocalFileAudioSettings = {
      packageType: 'single',
      dslFileHandleId: 'dsl-1',
      audioArchiveHandleId: 'archive-1',
      splitArchiveDirectoryHandleId: null,
      splitArchivePattern: '',
      lastIndexedAt: Date.now(),
    };
    const provider = new LingvoDslAudioProvider(settings);
    const items = await provider.resolve('hello', 'en');
    expect(items).toEqual([]);
  });

  it('returns empty array when the term is not in the local index', async () => {
    mockGetFileHandle.mockResolvedValue({ kind: 'file' } as FileSystemFileHandle);
    mockVerifyPermission.mockResolvedValue(true);
    mockGetLingvoDslAudioPaths.mockResolvedValue(undefined);

    const settings: LocalFileAudioSettings = {
      packageType: 'single',
      dslFileHandleId: 'dsl-1',
      audioArchiveHandleId: 'archive-1',
      splitArchiveDirectoryHandleId: null,
      splitArchivePattern: '',
      lastIndexedAt: Date.now(),
    };
    const provider = new LingvoDslAudioProvider(settings);
    const items = await provider.resolve('missing', 'en');
    expect(items).toEqual([]);
  });
});
