import { handleClusterQuickAdd } from './cardActions';
import { sendMessage } from '@/shared/lib/chrome-apis';
import { getWordStatuses } from '@/features/dictionary/services/wordStatusClient';
import { captureScreenshot } from '@/features/cardCreator/media/screenshot';
import { captureSentenceAudio } from '@/features/cardCreator/media/sentenceAudio';
import { quickAddNote } from '@/features/cardCreator/service/quickAddNote';
import { testConnection } from '@/features/cardCreator/service/cardCreatorService';
import { showProgressToast, type ProgressToastHandle } from '@/features/subtitle/ui/subtitleUI';
import type { SubtitleActionContext } from './subtitleActionContext';
import type { Settings } from '@/entities/media';

jest.mock('@/shared/lib/chrome-apis', () => ({ sendMessage: jest.fn() }));
jest.mock('@/features/dictionary/services/wordStatusClient', () => ({ getWordStatuses: jest.fn() }));
jest.mock('@/features/cardCreator/media/screenshot', () => ({ captureScreenshot: jest.fn() }));
jest.mock('@/features/cardCreator/media/sentenceAudio', () => ({ captureSentenceAudio: jest.fn() }));
jest.mock('@/features/cardCreator/service/cardCreatorPrefetch', () => ({ prefetchAnkiConnectData: jest.fn() }));
jest.mock('@/features/cardCreator/service/quickAddNote', () => ({ quickAddNote: jest.fn() }));
jest.mock('@/features/cardCreator/service/cardCreatorService', () => ({ testConnection: jest.fn() }));
jest.mock('@/features/cardCreator/state/cardDraft', () => ({
  ...jest.requireActual('@/features/cardCreator/state/cardDraft'),
  DraftAutosaver: jest.fn().mockImplementation(() => ({
    load: jest.fn(async () => ({
      deck: 'Default',
      noteType: 'Basic',
      fieldMapping: { Front: 'targetWord', Back: 'definitions' },
      tags: '',
    })),
  })),
}));
jest.mock('@/features/subtitle/ui/subtitleUI', () => ({ showProgressToast: jest.fn() }));

const mockSendMessage = jest.mocked(sendMessage);
const mockGetWordStatuses = jest.mocked(getWordStatuses);
const mockCaptureScreenshot = jest.mocked(captureScreenshot);
const mockCaptureSentenceAudio = jest.mocked(captureSentenceAudio);
const mockQuickAddNote = jest.mocked(quickAddNote);
const mockTestConnection = jest.mocked(testConnection);
const mockShowProgressToast = jest.mocked(showProgressToast);

function makeChip(): jest.Mocked<ProgressToastHandle> {
  return { update: jest.fn(), finish: jest.fn(), dismiss: jest.fn() };
}

function makeCtx(overrides: Partial<SubtitleActionContext> = {}): SubtitleActionContext {
  const video = { videoWidth: 640, readyState: 4, currentTime: 1.5 } as unknown as HTMLVideoElement;
  return {
    video,
    container: document.createElement('div'),
    webTextCtrl: undefined,
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

describe('handleClusterQuickAdd', () => {
  let chip: jest.Mocked<ProgressToastHandle>;

  beforeEach(() => {
    jest.clearAllMocks();
    chip = makeChip();
    mockShowProgressToast.mockReturnValue(chip);
    mockTestConnection.mockResolvedValue({ ok: true, value: 6 });
    mockGetWordStatuses.mockResolvedValue(new Map([['hello', 'unknown'], ['world', 'known']]));
    mockCaptureScreenshot.mockResolvedValue({ kind: 'image' } as never);
    mockCaptureSentenceAudio.mockResolvedValue({ ok: true, file: { kind: 'audio' } } as never);
    mockSendMessage.mockResolvedValue({ success: true, data: [] } as never);
    mockQuickAddNote.mockResolvedValue({ ok: true, noteId: 42 });
  });

  it('finishes with the Anki-not-open state when the preflight connection fails', async () => {
    mockTestConnection.mockResolvedValue({ ok: false, error: 'Network error: Failed to fetch' });

    await handleClusterQuickAdd(makeCtx());

    expect(chip.finish).toHaveBeenCalledWith(expect.stringMatching(/anki isn't open/i), 'error');
    expect(mockQuickAddNote).not.toHaveBeenCalled();
  });

  it('reports recording then adding then success for the happy path', async () => {
    await handleClusterQuickAdd(makeCtx());

    expect(mockShowProgressToast).toHaveBeenCalledWith(expect.stringMatching(/collecting/i), expect.any(HTMLElement));
    expect(chip.update).toHaveBeenCalledWith(expect.stringMatching(/recording/i));
    expect(chip.update).toHaveBeenCalledWith(expect.stringMatching(/adding card 1 of 1/i));
    expect(mockQuickAddNote).toHaveBeenCalledTimes(1);
    expect(chip.finish).toHaveBeenCalledWith(expect.stringMatching(/added 1 card/i), 'success');
  });

  it('maps AnkiConnect network failures from quickAddNote to the Anki-not-open state', async () => {
    mockQuickAddNote.mockResolvedValue({ ok: false, error: 'Network error: Failed to fetch' });

    await handleClusterQuickAdd(makeCtx());

    expect(chip.finish).toHaveBeenCalledWith(expect.stringMatching(/anki isn't open/i), 'error');
  });

  it('finishes with an info state when every word is already known', async () => {
    mockGetWordStatuses.mockResolvedValue(new Map([['hello', 'known'], ['world', 'known']]));

    await handleClusterQuickAdd(makeCtx());

    expect(chip.finish).toHaveBeenCalledWith(expect.stringMatching(/no unknown or tracking/i), 'info');
    expect(mockQuickAddNote).not.toHaveBeenCalled();
  });
});
