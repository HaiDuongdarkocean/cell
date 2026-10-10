import { saveCueToQueue } from './capture';
import { queueSave } from './miningQueueClient';
import type { BilingualCue } from '@/entities/media';

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
    expect(notify).toHaveBeenCalledWith(expect.any(String), 'success', undefined);
  });

  it('notifies info with checkDouble icon when the cue was already queued', async () => {
    queueSaveMock.mockResolvedValue({ id: 'x', deduped: true });
    const notify = jest.fn();
    saveCueToQueue(CUE, { langCode: 'ja', notify });
    await flush();
    expect(notify).toHaveBeenCalledWith(expect.any(String), 'info', { icon: 'checkDouble' });
  });

  it('notifies a friendly error without leaking the raw failure', async () => {
    queueSaveMock.mockRejectedValue(new Error('IDB quota exceeded'));
    const notify = jest.fn();
    saveCueToQueue(CUE, { langCode: 'ja', notify });
    await flush();
    expect(notify).toHaveBeenCalledWith(expect.any(String), 'error');
    expect(notify.mock.calls[0]![0]).not.toContain('quota');
  });

  it('falls back to en when no language can be resolved', async () => {
    saveCueToQueue(CUE, {});
    await flush();
    expect(queueSaveMock).toHaveBeenCalledWith(
      expect.objectContaining({ langCode: 'en' }),
    );
  });
});
