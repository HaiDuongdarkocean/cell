import { buildSubtitleQueue, handleCardCreatorAction } from './cardActions';
import { getWordStatuses } from '@/features/dictionary/services/wordStatusClient';
import { captureScreenshot } from '@/features/cardCreator/media/screenshot';
import { captureSentenceAudio } from '@/features/cardCreator/media/sentenceAudio';
import { showProgressToast, type ProgressToastHandle } from '@/features/subtitle/ui/subtitleUI';
import { sendMessage } from '@/shared/lib/chrome-apis';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { SubtitleActionContext } from './subtitleActionContext';
import type { Settings } from '@/entities/media';

jest.mock('@/features/dictionary/services/wordStatusClient', () => ({ getWordStatuses: jest.fn() }));
jest.mock('@/features/cardCreator/media/screenshot', () => ({ captureScreenshot: jest.fn() }));
jest.mock('@/features/cardCreator/media/sentenceAudio', () => ({ captureSentenceAudio: jest.fn() }));
jest.mock('@/features/cardCreator/service/cardCreatorPrefetch', () => ({ prefetchAnkiConnectData: jest.fn(async () => ({})) }));
jest.mock('@/features/subtitle/ui/subtitleUI', () => ({ showProgressToast: jest.fn() }));
jest.mock('@/shared/lib/chrome-apis', () => ({ sendMessage: jest.fn() }));

const mockGetWordStatuses = jest.mocked(getWordStatuses);
const mockCaptureScreenshot = jest.mocked(captureScreenshot);
const mockCaptureSentenceAudio = jest.mocked(captureSentenceAudio);
const mockShowProgressToast = jest.mocked(showProgressToast);
const mockSendMessage = jest.mocked(sendMessage);

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

function makeLookupResult(term: string) {
  return {
    term,
    langCode: 'en',
    reading: '',
    readingKind: 'ipa',
    frequency: null,
    status: 'unknown',
    partsOfSpeech: [],
    definitions: [{ id: 'd1', pos: 'v', text: 'say hello' }],
    rawDefinitions: ['say hello'],
    detectedPhrase: null,
    matchSource: 'fallback',
  };
}

function makeSingleWordSendMessageMock() {
  return jest.fn(async (message: unknown) => {
    const msg = message as { type: string; payload?: { request?: { term?: string } } };
    if (msg.type === MESSAGE_TYPES.LOOKUP_REQUEST) {
      return { success: true, data: [makeLookupResult(msg.payload?.request?.term ?? 'hello')] };
    }
    if (msg.type === MESSAGE_TYPES.FETCH_COMMUNITY_AUDIO) {
      return { success: true, data: { items: [{ id: 'a1', kind: 'word', source: 'community', label: 'Forvo', state: 'idle', url: 'http://audio/hello.mp3', defaultSelected: false }] } };
    }
    if (msg.type === MESSAGE_TYPES.FETCH_IMAGES) {
      return { success: true, data: { items: [{ id: 'i1', src: 'http://img/hello.png', alt: 'hello', defaultSelected: false }] } };
    }
    if (msg.type === MESSAGE_TYPES.TRANSLATE) {
      return { success: true, data: { translated: ['xin chào'] } };
    }
    return { success: false };
  });
}

function makeNativeCues() {
  return [{ index: 0, start: 1000, end: 3000, text: 'xin chào thế giới' }];
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
    mockSendMessage.mockResolvedValue({ success: false });
  });

  it('opens the queue for quick-update with initialAction quick-add', async () => {
    const ctx = makeCtx();

    await handleCardCreatorAction(ctx, 'quick-update');

    expect(ctx.webTextCtrl!.updateCardCreatorSettings).toHaveBeenCalled();
    expect(ctx.webTextCtrl!.sendToCard).toHaveBeenCalledWith(
      expect.objectContaining({
        queue: expect.arrayContaining([expect.objectContaining({ term: 'hello', definitions: '' })]),
        prefill: expect.objectContaining({ targetWord: 'hello' }),
        initialMedia: expect.arrayContaining([expect.objectContaining({ kind: 'image' })]),
      }),
      'quick-add',
      expect.anything(),
    );
  });

  it('opens the queue for edit-card with initialAction edit-card', async () => {
    const ctx = makeCtx();

    await handleCardCreatorAction(ctx, 'edit-card');

    expect(ctx.webTextCtrl!.sendToCard).toHaveBeenCalledWith(
      expect.objectContaining({
        queue: expect.arrayContaining([expect.objectContaining({ term: 'hello', definitions: '' })]),
        prefill: expect.objectContaining({ targetWord: 'hello' }),
      }),
      'edit-card',
      expect.anything(),
    );
  });

  it('opens the queue for update-current with initialAction quick-update', async () => {
    const ctx = makeCtx();

    await handleCardCreatorAction(ctx, 'update-current');

    expect(ctx.webTextCtrl!.sendToCard).toHaveBeenCalledWith(
      expect.objectContaining({
        queue: expect.arrayContaining([expect.objectContaining({ term: 'hello', definitions: '' })]),
        prefill: expect.objectContaining({ targetWord: 'hello' }),
      }),
      'quick-update',
      expect.anything(),
    );
  });

  it('dismisses the progress chip after opening the queue', async () => {
    const ctx = makeCtx();

    await handleCardCreatorAction(ctx, 'edit-card');

    expect(chip.dismiss).toHaveBeenCalled();
  });

  it('looks up a single unknown word and pre-fills Card Creator data', async () => {
    const ctx = makeCtx({ getNativeCues: makeNativeCues });
    mockSendMessage.mockImplementation(makeSingleWordSendMessageMock());

    await handleCardCreatorAction(ctx, 'edit-card');

    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MESSAGE_TYPES.LOOKUP_REQUEST,
      payload: expect.objectContaining({
        request: expect.objectContaining({ term: 'hello' }),
      }),
    }));
    expect(ctx.webTextCtrl!.sendToCard).toHaveBeenCalledWith(
      expect.objectContaining({
        queue: expect.arrayContaining([expect.objectContaining({ term: 'hello' })]),
        prefill: expect.objectContaining({
          targetWord: 'hello',
          definitions: expect.stringContaining('say hello'),
          wordAudioItems: expect.arrayContaining([expect.objectContaining({ id: 'a1', url: 'http://audio/hello.mp3' })]),
          imageItems: expect.arrayContaining([expect.objectContaining({ id: 'i1', src: 'http://img/hello.png' })]),
        }),
      }),
      'edit-card',
      expect.objectContaining({
        term: 'hello',
        wordAudioUrls: expect.arrayContaining(['http://audio/hello.mp3']),
        imageUrls: expect.arrayContaining(['http://img/hello.png']),
      }),
    );
    expect(ctx.webTextCtrl!.sendToCard).toHaveBeenCalledWith(
      expect.objectContaining({
        prefill: expect.objectContaining({
          sentenceTranslation: 'xin chào thế giới',
        }),
      }),
      'edit-card',
      expect.anything(),
    );
  });

  it('translates the sentence when no native cue is available', async () => {
    const ctx = makeCtx();
    mockSendMessage.mockImplementation(makeSingleWordSendMessageMock());

    await handleCardCreatorAction(ctx, 'edit-card');

    expect(ctx.webTextCtrl!.sendToCard).toHaveBeenCalledWith(
      expect.objectContaining({
        prefill: expect.objectContaining({
          sentenceTranslation: 'xin chào',
        }),
      }),
      'edit-card',
      expect.anything(),
    );
  });
});
