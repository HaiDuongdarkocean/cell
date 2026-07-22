// devSeed test — verifies dev-only auto-seed logic: no-op in prod, parallel
// import when DB empty, skip when DB has data, error-tolerant.

import 'fake-indexeddb/auto';
import { seedDevDataIfEmpty, setDevSeedEnabled } from './devSeed';
import { importFile } from './importOrchestrator';
import { countResources } from '../repositories/resourceRepository';
import { closeAllDBs, clearAllStores } from '../repositories/baseRepository';

jest.mock('./importOrchestrator', () => ({
  importFile: jest.fn(),
}));
jest.mock('../repositories/resourceRepository', () => ({
  countResources: jest.fn(),
  addResource: jest.fn(),
  getResource: jest.fn(),
  getAllResources: jest.fn(),
  updateResource: jest.fn(),
  deleteResource: jest.fn(),
  findResourceBySignature: jest.fn(),
}));

const importFileMock = importFile as jest.MockedFunction<typeof importFile>;
const countResourcesMock = countResources as jest.MockedFunction<typeof countResources>;

beforeEach(() => {
  closeAllDBs();
  jest.clearAllMocks();
  countResourcesMock.mockResolvedValue(0);
  importFileMock.mockResolvedValue({ resourceId: 1, wordCount: 100, format: 'cambridge-json' });
  // Mock global fetch
  (globalThis.fetch as unknown) = jest.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
  });
});

beforeEach(async () => {
  await clearAllStores('en');
});

afterAll(() => {
  setDevSeedEnabled(false);
  delete (globalThis as { fetch?: unknown }).fetch;
});

describe('seedDevDataIfEmpty', () => {
  it('no-ops when dev mode is disabled (production)', async () => {
    setDevSeedEnabled(false);
    await seedDevDataIfEmpty('en');
    expect(countResourcesMock).not.toHaveBeenCalled();
    expect(importFileMock).not.toHaveBeenCalled();
  });

  it('imports seed files in parallel when DB is empty (dev mode)', async () => {
    setDevSeedEnabled(true);
    await seedDevDataIfEmpty('en');
    expect(countResourcesMock).toHaveBeenCalledWith('en');
    // 2 seed files: dictionary + frequency — both imported
    expect(importFileMock).toHaveBeenCalledTimes(2);
    // Verify resource types
    const types = importFileMock.mock.calls.map((c) => c[1]);
    expect(types).toContain('DICTIONARY');
    expect(types).toContain('FREQUENCY');
  });

  it('skips import when DB already has resources', async () => {
    setDevSeedEnabled(true);
    countResourcesMock.mockResolvedValue(3);
    await seedDevDataIfEmpty('en');
    expect(importFileMock).not.toHaveBeenCalled();
  });

  it('catches fetch errors without throwing (fire-and-forget)', async () => {
    setDevSeedEnabled(true);
    (globalThis.fetch as unknown as jest.Mock).mockRejectedValueOnce(new Error('network fail'));
    // Should not throw — errors are caught + logged
    await expect(seedDevDataIfEmpty('en')).resolves.not.toThrow();
  });

  it('catches import errors without throwing', async () => {
    setDevSeedEnabled(true);
    importFileMock.mockRejectedValue(new Error('import fail'));
    await expect(seedDevDataIfEmpty('en')).resolves.not.toThrow();
  });

  it('prevents concurrent seed runs (in-memory lock)', async () => {
    setDevSeedEnabled(true);
    // First call hangs on countResources
    let resolveCount: (v: number) => void = () => {};
    countResourcesMock.mockReturnValueOnce(new Promise<number>((r) => { resolveCount = r; }));
    const first = seedDevDataIfEmpty('en');
    const second = seedDevDataIfEmpty('en');
    // Resolve first call
    resolveCount(0);
    await Promise.all([first, second]);
    // Second call should have been blocked by in-memory lock — only 1 set of imports
    // (countResources may be called twice but importFile only from first run)
    expect(importFileMock).toHaveBeenCalledTimes(2);
  });
});
