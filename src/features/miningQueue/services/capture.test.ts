import { savePrefillToQueue, saveCueToQueue } from './capture';
import { queueSave } from './miningQueueClient';
import type { BilingualCue } from '@/entities/media';
import type { PopupCardCreatorPrefill } from '@/entities/dictionary';

jest.mock('./miningQueueClient', () => ({
  queueSave: jest.fn(),
}));
jest.mock('@/shared/lib/storage/settingsStore', () => ({
  loadSettings: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/entities/settings', () => ({
  getActiveProfileSettings: jest.fn(() => undefined),
}));

const queueSaveMock = queueSave as jest.Mock;

const PREFILL = {
  term: '猫',
  langCode: 'ja',
  reading: '',
  definitions: [],
  rawDefinitions: [],
  contextSentence: '猫が好き',
} as PopupCardCreatorPrefill;

const CUE: BilingualCue = {
  index: 3,
  start: 1000,
  end: 2000,
  targetText: '猫が好きだ',
  nativeText: 'I like cats',
};

beforeEach(() => {
  jest.clearAllMocks();
  queueSaveMock.mockResolvedValue({ id: 'x', deduped: false });
});

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('savePrefillToQueue', () => {
  it('notifies success on first save', async () => {
    const notify = jest.fn();
    savePrefillToQueue(PREFILL, { notify });
    await flush();
    expect(notify).toHaveBeenCalledWith(expect.any(String), 'success');
  });

  it('notifies saved-again when deduped', async () => {
    queueSaveMock.mockResolvedValue({ id: 'x', deduped: true });
    const notify = jest.fn();
    savePrefillToQueue(PREFILL, { notify });
    await flush();
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('queued'), 'success');
  });

  it('surfaces store errors instead of swallowing them', async () => {
    queueSaveMock.mockRejectedValue(new Error('disk full'));
    const notify = jest.fn();
    savePrefillToQueue(PREFILL, { notify });
    await flush();
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('disk full'), 'error');
  });
});

describe('saveCueToQueue', () => {
  it('persists cue sentences with the caller language', async () => {
    const notify = jest.fn();
    saveCueToQueue(CUE, { langCode: 'ja', videoId: 'v9', notify });
    await flush();
    expect(queueSaveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'sentence',
        langCode: 'ja',
        videoId: 'v9',
        cueIndex: 3,
        cueStart: 1000,
        sentence: '猫が好きだ',
        translation: 'I like cats',
      }),
    );
    expect(notify).toHaveBeenCalledWith(expect.any(String), 'success');
  });

  it('falls back to en when no language can be resolved', async () => {
    saveCueToQueue(CUE, {});
    await flush();
    expect(queueSaveMock).toHaveBeenCalledWith(
      expect.objectContaining({ langCode: 'en' }),
    );
  });
});
