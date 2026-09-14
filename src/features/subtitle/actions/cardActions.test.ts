import { buildSubtitleQueue, handleCardCreatorAction } from './cardActions';
import { getWordStatuses } from '@/features/dictionary/services/wordStatusClient';
import { captureScreenshot } from '@/features/cardCreator/media/screenshot';
import { captureSentenceAudio } from '@/features/cardCreator/media/sentenceAudio';
import { showProgressToast, type ProgressToastHandle } from '@/features/subtitle/ui/subtitleUI';
import type { SubtitleActionContext } from './subtitleActionContext';
import type { Settings } from '@/entities/media';

jest.mock('@/features/dictionary/services/wordStatusClient', () => ({ getWordStatuses: jest.fn() }));
jest.mock('@/features/cardCreator/media/screenshot', () => ({ captureScreenshot: jest.fn() }));
jest.mock('@/features/cardCreator/media/sentenceAudio', () => ({ captureSentenceAudio: jest.fn() }));
jest.mock('@/features/cardCreator/service/cardCreatorPrefetch', () => ({ prefetchAnkiConnectData: jest.fn(async () => ({})) }));
jest.mock('@/features/subtitle/ui/subtitleUI', () => ({ showProgressToast: jest.fn() }));

const mockGetWordStatuses = jest.mocked(getWordStatuses);
const mockCaptureScreenshot = jest.mocked(captureScreenshot);
const mockCaptureSentenceAudio = jest.mocked(captureSentenceAudio);
const mockShowProgressToast = jest.mocked(showProgressToast);

function makeChip(): jest.Mocked<ProgressToastHandle> {
  return { update: jest.fn(), finish: jest.fn(), dismiss: jest.fn() };
}

function makeWebTextCtrl() {
  return {
    updateCardCreatorSettings: jest.fn(),
    sendToCard: jest.fn(),
    isCardCreatorOpen: jest.fn().mockReturnValue(false),
    handleLookup: jest.fn(),
    cancelLookup: jest.fn(),
    configureVideo: jest.fn(),
  };
}

function makeCtx(overrides: Partial<SubtitleActionContext> = {}): SubtitleActionContext {
  const video = { videoWidth: 640, readyState: 4, currentTime: 1.5 } as unknown as HTMLVideoElement;
  return {
    video,
    container: document.createElement('div'),
    webTextCtrl: makeWebTextCtrl() as unknown as NonNullable<SubtitleActionContext['webTextCtrl']>,
    getTargetCues: () => [{ index: 0, start: 1000, end: 3000, text: 'hello world' }],
    getNativeCues: () => [],
    getCurrentTargetText: () => 'hello world',
    getCurrentNativeText: () => 'xin chào',
    getOffsetMs: () => 0,
    showToast: jest.fn(),
    loadSettingsOrToast: jest.fn(async () => ({
      cardCreator: {
        ankiConnectUrl: 'http://localhost:8765',
        defaultDeck: '',
        defaultNoteType: '',
        defaultTags: '',
      },
      subtitleOverlayTargetLanguage: 'en',
    }) as unknown as Settings),
    ...overrides,
  };
}

describe('buildSubtitleQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetWordStatuses.mockResolvedValue(new Map([['can', 'unknown'], ['stop', 'unknown'], ['it', 'known']]));
  });

  it('returns queue items with empty definitions and does not lookup', async () => {
    const queue = await buildSubtitleQueue('can stop it', 'en');

    expect(queue).toEqual([
      { term: 'can', definitions: '', status: 'unknown' },
      { term: 'stop', definitions: '', status: 'unknown' },
    ]);
  });

  it('filters out known words', async () => {
    mockGetWordStatuses.mockResolvedValue(new Map([['hello', 'known'], ['world', 'known']]));

    const queue = await buildSubtitleQueue('hello world', 'en');

    expect(queue).toEqual([]);
  });
});

describe('handleCardCreatorAction', () => {
  let chip: jest.Mocked<ProgressToastHandle>;

  beforeEach(() => {
    jest.clearAllMocks();
    chip = makeChip();
    mockShowProgressToast.mockReturnValue(chip);
    mockGetWordStatuses.mockResolvedValue(new Map([['hello', 'unknown'], ['world', 'known']]));
    mockCaptureScreenshot.mockResolvedValue({ kind: 'image' } as never);
    mockCaptureSentenceAudio.mockResolvedValue({ ok: true, file: { kind: 'audio' } } as never);
  });

  it('opens the queue for quick-update with initialAction quick-add', async () => {
    const ctx = makeCtx();

    await handleCardCreatorAction(ctx, 'quick-update');

    expect(ctx.webTextCtrl!.updateCardCreatorSettings).toHaveBeenCalled();
    expect(ctx.webTextCtrl!.sendToCard).toHaveBeenCalledWith(
      expect.objectContaining({
        queue: expect.arrayContaining([expect.objectContaining({ term: 'hello', definitions: '' })]),
        initialMedia: expect.arrayContaining([expect.objectContaining({ kind: 'image' })]),
      }),
      'quick-add',
    );
  });

  it('opens the queue for edit-card with initialAction edit-card', async () => {
    const ctx = makeCtx();

    await handleCardCreatorAction(ctx, 'edit-card');

    expect(ctx.webTextCtrl!.sendToCard).toHaveBeenCalledWith(
      expect.objectContaining({
        queue: expect.arrayContaining([expect.objectContaining({ term: 'hello', definitions: '' })]),
      }),
      'edit-card',
    );
  });

  it('opens the queue for update-current with initialAction quick-update', async () => {
    const ctx = makeCtx();

    await handleCardCreatorAction(ctx, 'update-current');

    expect(ctx.webTextCtrl!.sendToCard).toHaveBeenCalledWith(
      expect.objectContaining({
        queue: expect.arrayContaining([expect.objectContaining({ term: 'hello', definitions: '' })]),
      }),
      'quick-update',
    );
  });

  it('dismisses the progress chip after opening the queue', async () => {
    const ctx = makeCtx();

    await handleCardCreatorAction(ctx, 'edit-card');

    expect(chip.dismiss).toHaveBeenCalled();
  });
});
