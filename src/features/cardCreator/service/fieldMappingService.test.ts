import { FieldMappingWriter, resolveFieldMapping } from './fieldMappingService';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import type { Settings } from '@/entities/settings';

jest.mock('@/shared/lib/storage/settingsStore', () => ({
  loadSettings: jest.fn(),
  saveSettings: jest.fn(async () => {}),
}));

const loadMock = jest.mocked(loadSettings);
const saveMock = jest.mocked(saveSettings);

function settingsWith(fieldMappings: Record<string, Record<string, string>>): Settings {
  return {
    cardCreator: {
      ankiConnectUrl: 'http://localhost:8765',
      defaultDeck: 'Default',
      defaultNoteType: 'Basic',
      defaultTags: '',
      mediaUpdateMode: 'overwrite',
      fieldMappings,
    },
  } as Settings;
}

describe('resolveFieldMapping', () => {
  it('returns the saved mapping without needing persist', () => {
    const saved = { targetWord: 'Front' };
    const result = resolveFieldMapping(['Front', 'Back'], saved, { targetWord: 'Word' });
    expect(result).toEqual({ mapping: saved, shouldPersist: false });
  });

  it('uses the restored mapping when no saved mapping exists', () => {
    const restored = { targetWord: 'Restored' };
    const result = resolveFieldMapping(['Front', 'Back'], undefined, restored);
    expect(result).toEqual({ mapping: restored, shouldPersist: true });
  });

  it('auto-maps when neither saved nor restored mapping exists', () => {
    const result = resolveFieldMapping(['Front', 'Back'], undefined);
    expect(result.shouldPersist).toBe(true);
    expect(result.mapping.targetWord).toBe('Front');
  });
});

describe('FieldMappingWriter', () => {
  beforeEach(() => {
    loadMock.mockReset();
    saveMock.mockReset();
    saveMock.mockResolvedValue(undefined);
  });

  it('ignores an empty note type', async () => {
    const writer = new FieldMappingWriter();
    writer.persist('', { targetWord: 'Front' });
    await Promise.resolve();
    expect(loadMock).not.toHaveBeenCalled();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('merges the mapping into existing settings', async () => {
    loadMock.mockResolvedValue(settingsWith({ Basic: { note: 'Note' } }));
    const writer = new FieldMappingWriter();
    writer.persist('Basic', { targetWord: 'Front' });
    await new Promise((r) => setTimeout(r, 0));
    expect(saveMock).toHaveBeenCalledWith({
      cardCreator: expect.objectContaining({
        fieldMappings: {
          Basic: { targetWord: 'Front' },
        },
      }),
    });
  });

  it('serializes concurrent writes so read-modify-write does not interleave', async () => {
    const order: string[] = [];
    let releaseFirstSave: (() => void) | null = null;
    loadMock.mockImplementation(async () => {
      order.push('load');
      return settingsWith({});
    });
    saveMock
      .mockImplementationOnce(() => {
        order.push('save1-start');
        return new Promise<void>((resolve) => {
          releaseFirstSave = () => {
            order.push('save1-end');
            resolve();
          };
        });
      })
      .mockImplementation(async () => {
        order.push('save2');
      });

    const writer = new FieldMappingWriter();
    writer.persist('A', { targetWord: 'Front' });
    writer.persist('B', { targetWord: 'Back' });
    await new Promise((r) => setTimeout(r, 0));

    expect(order).toEqual(['load', 'save1-start']);
    releaseFirstSave!();
    await new Promise((r) => setTimeout(r, 0));
    expect(order).toEqual(['load', 'save1-start', 'save1-end', 'load', 'save2']);
  });

  it('keeps the queue alive after a failed write', async () => {
    loadMock
      .mockRejectedValueOnce(new Error('storage gone'))
      .mockResolvedValue(settingsWith({}));
    const writer = new FieldMappingWriter();
    writer.persist('A', { targetWord: 'Front' });
    writer.persist('B', { targetWord: 'Back' });
    await new Promise((r) => setTimeout(r, 0));
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock).toHaveBeenCalledWith({
      cardCreator: expect.objectContaining({
        fieldMappings: { B: { targetWord: 'Back' } },
      }),
    });
  });
});
