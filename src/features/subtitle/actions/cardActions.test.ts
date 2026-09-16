import { handleCardCreatorAction } from './cardActions';
import { captureScreenshot } from '@/features/cardCreator/media/screenshot';
import { captureSentenceAudio } from '@/features/cardCreator/media/sentenceAudio';
import type { SubtitleActionContext } from './subtitleActionContext';
import type { Settings } from '@/entities/media';
import type { CardCreatorAction } from '@/features/subtitle/ui/subtitleCueEngine';

jest.mock('@/features/cardCreator/media/screenshot', () => ({ captureScreenshot: jest.fn() }));
jest.mock('@/features/cardCreator/media/sentenceAudio', () => ({ captureSentenceAudio: jest.fn() }));
jest.mock('@/features/cardCreator/service/cardCreatorPrefetch', () => ({ prefetchAnkiConnectData: jest.fn(async () => ({})) }));

const mockCaptureScreenshot = jest.mocked(captureScreenshot);
const mockCaptureSentenceAudio = jest.mocked(captureSentenceAudio);

function makeWebTextCtrl() {
  return {
    updateCardCreatorSettings: jest.fn(),
    sendToCard: jest.fn(),
    isCardCreatorOpen: jest.fn().mockReturnValue(true),
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

describe('handleCardCreatorAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCaptureScreenshot.mockResolvedValue({ kind: 'image' } as never);
    mockCaptureSentenceAudio.mockResolvedValue({ ok: true, file: { kind: 'audio' } } as never);
  });

  it.each<[CardCreatorAction, 'quick-add' | 'quick-update' | 'edit-card']>([
    ['quick-update', 'quick-add'],
    ['edit-card', 'edit-card'],
    ['update-current', 'quick-update'],
  ])('maps %s to initialAction %s', async (action, expected) => {
    const ctx = makeCtx();

    await handleCardCreatorAction(ctx, action);

    expect(ctx.webTextCtrl!.updateCardCreatorSettings).toHaveBeenCalled();
    expect(ctx.webTextCtrl!.sendToCard).toHaveBeenLastCalledWith(
      expect.anything(),
      expected,
    );
  });

  it('opens the card creator immediately with mediaPending, then fills captured media via a second send', async () => {
    const ctx = makeCtx();

    await handleCardCreatorAction(ctx, 'edit-card');

    const sendToCard = jest.mocked(ctx.webTextCtrl!.sendToCard);
    expect(sendToCard).toHaveBeenCalledTimes(2);
    expect(sendToCard.mock.calls[0][0]).toEqual(
      expect.objectContaining({ mediaPending: true }),
    );
    expect(sendToCard.mock.calls[0][0].initialMedia).toBeUndefined();
    expect(sendToCard.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        initialMedia: expect.arrayContaining([
          expect.objectContaining({ kind: 'image' }),
          expect.objectContaining({ kind: 'audio' }),
        ]),
      }),
    );
    expect(sendToCard.mock.calls[1][0].mediaPending).toBeUndefined();
  });

  it('does not queue or prefill unknown/tracking words — the user picks the term in the Dictionary', async () => {
    const ctx = makeCtx();

    await handleCardCreatorAction(ctx, 'edit-card');

    const sendToCard = jest.mocked(ctx.webTextCtrl!.sendToCard);
    for (const [context] of sendToCard.mock.calls) {
      expect(context.queue).toBeUndefined();
      expect(context.prefill).toBeUndefined();
    }
  });

  it('does not reopen the card creator when the user closed it during capture', async () => {
    const ctx = makeCtx();
    jest.mocked(ctx.webTextCtrl!.isCardCreatorOpen).mockReturnValue(false);

    await handleCardCreatorAction(ctx, 'edit-card');

    expect(ctx.webTextCtrl!.sendToCard).toHaveBeenCalledTimes(1);
  });
});
