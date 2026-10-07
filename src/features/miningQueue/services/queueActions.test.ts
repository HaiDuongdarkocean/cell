import {
  queueItemToPrefill,
  queueQuickAddDestination,
  quickAddQueueItemToSrs,
} from './queueActions';
import type { MiningQueueItem } from '@/entities/miningQueue';
import type { PopupCardCreatorPrefill } from '@/entities/dictionary';

jest.mock('@/shared/lib/storage/settingsStore', () => ({
  loadSettings: jest.fn(),
}));

import { loadSettings } from '@/shared/lib/storage/settingsStore';

const loadSettingsMock = loadSettings as jest.Mock;
const addToOceanSrsMock = jest.fn();

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

describe('queueQuickAddDestination', () => {
  it('reads the configured srs destination', async () => {
    loadSettingsMock.mockResolvedValue({ dictionaryPopup: { srsDestination: 'ocean-srs' } });
    await expect(queueQuickAddDestination()).resolves.toBe('ocean-srs');
  });

  it('defaults to anki when unset', async () => {
    loadSettingsMock.mockResolvedValue({});
    await expect(queueQuickAddDestination()).resolves.toBe('anki');
  });
});

describe('quickAddQueueItemToSrs', () => {
  it('passes the stored snapshot to the injected Ocean SRS port', async () => {
    addToOceanSrsMock.mockResolvedValue({ noteId: 'n1', cardId: 'c1' });
    await quickAddQueueItemToSrs(TERM_ITEM, addToOceanSrsMock);
    expect(addToOceanSrsMock).toHaveBeenCalledWith(SNAPSHOT);
  });

  it('throws instead of silently adding when there is no snapshot', async () => {
    await expect(quickAddQueueItemToSrs(SENTENCE_ITEM, addToOceanSrsMock)).rejects.toThrow();
    expect(addToOceanSrsMock).not.toHaveBeenCalled();
  });

  it('propagates SRS failures so the caller keeps the row', async () => {
    addToOceanSrsMock.mockRejectedValue(new Error('srs offline'));
    await expect(quickAddQueueItemToSrs(TERM_ITEM, addToOceanSrsMock)).rejects.toThrow('srs offline');
  });
});
