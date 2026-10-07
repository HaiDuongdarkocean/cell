import { queueItemToPrefill, quickAddQueueItem } from './queueActions';
import type { MiningQueueItem } from '@/entities/miningQueue';
import type { PopupCardCreatorPrefill } from '@/entities/dictionary';

jest.mock('@/shared/lib/storage/settingsStore', () => ({
  loadSettings: jest.fn(),
}));
jest.mock('@/features/cardCreator', () => ({
  listModelFields: jest.fn(),
  resolveFieldMapping: jest.fn(),
  quickAddNote: jest.fn(),
  fetchMediaList: jest.fn(),
}));

import { loadSettings } from '@/shared/lib/storage/settingsStore';
import {
  listModelFields,
  resolveFieldMapping,
  quickAddNote,
  fetchMediaList,
} from '@/features/cardCreator';

const loadSettingsMock = loadSettings as jest.Mock;
const addToOceanSrsMock = jest.fn();
const listModelFieldsMock = listModelFields as jest.Mock;
const resolveFieldMappingMock = resolveFieldMapping as jest.Mock;
const quickAddNoteMock = quickAddNote as jest.Mock;
const fetchMediaListMock = fetchMediaList as jest.Mock;

const SNAPSHOT: PopupCardCreatorPrefill = {
  term: '猫',
  langCode: 'ja',
  reading: 'ねこ',
  definitions: [{ text: 'cat' }],
  rawDefinitions: ['cat'],
  contextSentence: '猫が好き',
  translation: 'I like cats',
  wordAudioUrls: ['https://audio/x.mp3'],
  sentenceAudioUrls: [],
  imageUrls: [],
};

const TERM_ITEM: MiningQueueItem = {
  id: 'q1',
  dedupeKey: 'term|猫|猫が好き',
  createdAt: 1,
  kind: 'term',
  term: '猫',
  pos: 'n',
  langCode: 'ja',
  sentence: '猫が好き',
  translation: 'I like cats',
  sourceLabel: 'Show',
  snapshot: SNAPSHOT,
};

const SENTENCE_ITEM: MiningQueueItem = {
  id: 'q2',
  dedupeKey: 'sentence|cue text|v1',
  createdAt: 2,
  kind: 'sentence',
  langCode: 'ja',
  sentence: 'cue text',
  videoId: 'v1',
};

beforeEach(() => {
  jest.clearAllMocks();
  fetchMediaListMock.mockResolvedValue([]);
});

describe('queueItemToPrefill', () => {
  it('replays the stored snapshot and threads queueItemId', () => {
    const prefill = queueItemToPrefill(TERM_ITEM);
    expect(prefill.term).toBe('猫');
    expect(prefill.contextSentence).toBe('猫が好き');
    expect(prefill.queueItemId).toBe('q1');
    expect(prefill.lookupResult).toBe(SNAPSHOT.lookupResult);
  });

  it('builds a sentence-only prefill without a term when no snapshot exists', () => {
    const prefill = queueItemToPrefill(SENTENCE_ITEM);
    expect(prefill.term).toBeUndefined();
    expect(prefill.contextSentence).toBe('cue text');
    expect(prefill.queueItemId).toBe('q2');
  });
});

describe('quickAddQueueItem', () => {
  it('routes to Ocean SRS when configured', async () => {
    loadSettingsMock.mockResolvedValue({ dictionaryPopup: { srsDestination: 'ocean-srs' } });
    addToOceanSrsMock.mockResolvedValue({ noteId: 'n1', cardId: 'c1' });
    const dest = await quickAddQueueItem(TERM_ITEM, () => {}, addToOceanSrsMock);
    expect(dest).toBe('ocean-srs');
    expect(addToOceanSrsMock).toHaveBeenCalledWith(SNAPSHOT);
    expect(quickAddNoteMock).not.toHaveBeenCalled();
  });

  it('throws instead of silently adding when Ocean SRS gets no snapshot', async () => {
    loadSettingsMock.mockResolvedValue({ dictionaryPopup: { srsDestination: 'ocean-srs' } });
    await expect(quickAddQueueItem(SENTENCE_ITEM, () => {}, addToOceanSrsMock)).rejects.toThrow();
    expect(addToOceanSrsMock).not.toHaveBeenCalled();
  });

  it('adds through AnkiConnect with mapped fields when destination is anki', async () => {
    loadSettingsMock.mockResolvedValue({
      dictionaryPopup: { srsDestination: 'anki' },
      cardCreator: {
        ankiConnectUrl: 'http://x',
        defaultDeck: 'D',
        defaultNoteType: 'M',
        defaultTags: 't1',
        fieldMappings: { M: { targetWord: 'Front' } },
      },
    });
    listModelFieldsMock.mockResolvedValue({ ok: true, value: ['Front'] });
    resolveFieldMappingMock.mockReturnValue({ mapping: { targetWord: 'Front' }, shouldPersist: false });
    quickAddNoteMock.mockResolvedValue({ ok: true, noteId: 42 });
    const dest = await quickAddQueueItem(TERM_ITEM, () => {}, addToOceanSrsMock);
    expect(dest).toBe('anki');
    expect(quickAddNoteMock).toHaveBeenCalledWith(
      'http://x', 'D', 'M', { targetWord: 'Front' }, 't1',
      expect.objectContaining({ targetWord: '猫', sentence: '猫が好き' }),
      expect.objectContaining({ images: [], sentenceAudios: [], wordAudios: [] }),
      expect.any(Function),
    );
  });

  it('propagates anki failures so the caller keeps the row', async () => {
    loadSettingsMock.mockResolvedValue({
      cardCreator: {
        ankiConnectUrl: 'http://x', defaultDeck: 'D',
        defaultNoteType: 'M', defaultTags: '',
      },
    });
    listModelFieldsMock.mockResolvedValue({ ok: false, error: 'no connect' });
    await expect(quickAddQueueItem(TERM_ITEM, () => {}, addToOceanSrsMock)).rejects.toThrow('no connect');
  });
});
