import { persistSyncedSettings, CURRENT_SCHEMA_VERSION } from '@/shared/lib/storage/settingsStore';
import { STORAGE_KEYS } from '@/shared/config/config';

const storageLocalSetMock = jest.fn<Promise<void>, [Record<string, unknown>]>();

beforeAll(() => {
  global.chrome = {
    storage: {
      local: { set: storageLocalSetMock },
    },
  } as unknown as typeof chrome;
});

beforeEach(() => {
  storageLocalSetMock.mockReset();
  storageLocalSetMock.mockResolvedValue(undefined);
});

afterAll(() => {
  delete (global as { chrome?: unknown }).chrome;
});

describe('persistSyncedSettings', () => {
  it('normalizes applied values before writing and stamps the schema version', async () => {
    await persistSyncedSettings({
      navClusterButtonSize: 500,
      navClusterTextOpacity: 'bad',
      subtitleBlockSettings: { yOffsetPercent: 200, globalScale: 9, bgOpacity: -1 },
    });

    expect(storageLocalSetMock).toHaveBeenCalledTimes(1);
    const written = storageLocalSetMock.mock.calls[0][0][STORAGE_KEYS.SETTINGS] as Record<
      string,
      unknown
    >;
    expect(written.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(written.navClusterButtonSize).toBe(100);
    expect(written.navClusterTextOpacity).toBe(1);
    expect(written.subtitleBlockSettings).toEqual({
      yOffsetPercent: 95,
      globalScale: 2,
      bgOpacity: 0,
    });
    expect(written.languageProfiles).toEqual([]);
    expect(written.uiLanguage).toBe('auto');
  });
});
