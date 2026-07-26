import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import type { Settings } from '@/entities/media';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { onStorageChanged, removeOnStorageChangedListener } from '@/shared/lib/chrome-apis';
import { DEFAULT_SETTINGS } from '@/shared/config/config';
import { CardCreatorPanel, type CardCreatorPanelProps } from './CardCreatorPanel';

jest.mock('@/shared/lib/storage/settingsStore', () => ({
  loadSettings: jest.fn(),
}));

jest.mock('@/shared/lib/chrome-apis', () => ({
  onStorageChanged: jest.fn(),
  removeOnStorageChangedListener: jest.fn(),
}));

const mockUseCardCreatorState = jest.fn();
jest.mock('@/features/cardCreator/ui/useCardCreatorState', () => ({
  useCardCreatorState: (...args: unknown[]) => mockUseCardCreatorState(...args),
  OpenContext: undefined,
}));

jest.mock('@/features/cardCreator/ui/CardCreatorDialogContent', () => ({
  CardCreatorDialogContent: ({ state, variant }: { state: unknown; variant: string }) => (
    <div data-testid="card-creator-content" data-variant={variant}>
      {JSON.stringify(state)}
    </div>
  ),
}));

const mockLoadSettings = jest.mocked(loadSettings);
const mockOnStorageChanged = jest.mocked(onStorageChanged);
const mockRemoveOnStorageChangedListener = jest.mocked(removeOnStorageChangedListener);

describe('CardCreatorPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCardCreatorState.mockReturnValue({ draft: {} });
    mockLoadSettings.mockResolvedValue(DEFAULT_SETTINGS as Settings);
    mockOnStorageChanged.mockReturnValue(undefined);
    mockRemoveOnStorageChangedListener.mockReturnValue(undefined);
  });

  it('loads settings and renders the card creator content', async () => {
    render(<CardCreatorPanel sourceLang="en" targetLang="vi" />);

    await waitFor(() => expect(screen.getByTestId('card-creator-content')).toBeInTheDocument());
    expect(mockLoadSettings).toHaveBeenCalledTimes(1);
    expect(mockUseCardCreatorState).toHaveBeenCalledWith(
      expect.objectContaining({ ankiConnectUrl: DEFAULT_SETTINGS.cardCreator.ankiConnectUrl }),
      expect.objectContaining({ sourceLang: 'en', targetLang: 'vi' }),
    );
  });

  it('maps prefill into the openContext for useCardCreatorState', async () => {
    const prefill = {
      term: 'hello',
      langCode: 'en',
      reading: 'həˈloʊ',
      definitions: [{ pos: 'exclamation', text: 'used as a greeting' }],
      rawDefinitions: ['raw hello'],
      contextSentence: 'Hello, world.',
      translation: 'xin chào',
      wordAudioUrls: ['https://example.com/word.mp3'],
      sentenceAudioUrls: ['https://example.com/sentence.mp3'],
      imageUrls: ['https://example.com/img.png'],
    } satisfies CardCreatorPanelProps['prefill'];

    render(<CardCreatorPanel sourceLang="en" targetLang="vi" prefill={prefill} />);

    await waitFor(() => expect(screen.getByTestId('card-creator-content')).toBeInTheDocument());
    const [, openContext] = mockUseCardCreatorState.mock.calls[0]! as [unknown, { sourceLang: string; targetLang: string; prefill: Record<string, unknown> }];
    expect(openContext.sourceLang).toBe('en');
    expect(openContext.targetLang).toBe('vi');
    expect(openContext.prefill.targetWord).toBe('hello');
    expect(openContext.prefill.definitions).toBe('• exclamation used as a greeting');
    expect(openContext.prefill.sentence).toBe('Hello, world.');
    expect(openContext.prefill.sentenceTranslation).toBe('xin chào');
    expect(openContext.prefill.wordAudioUrls).toEqual(['https://example.com/word.mp3']);
    expect(openContext.prefill.sentenceAudioUrls).toEqual(['https://example.com/sentence.mp3']);
    expect(openContext.prefill.imageUrls).toEqual(['https://example.com/img.png']);
  });

  it('handles null/undefined prefill gracefully', async () => {
    render(<CardCreatorPanel sourceLang="en" targetLang="vi" prefill={null} />);

    await waitFor(() => expect(screen.getByTestId('card-creator-content')).toBeInTheDocument());
    const [, openContext] = mockUseCardCreatorState.mock.calls[0]! as [unknown, { sourceLang: string; targetLang: string; prefill: Record<string, unknown> | undefined }];
    expect(openContext.sourceLang).toBe('en');
    expect(openContext.targetLang).toBe('vi');
    expect(openContext.prefill).toBeUndefined();
  });

  it('re-syncs settings when chrome.storage.local changes', async () => {
    let storageListener: ((changes: Record<string, chrome.storage.StorageChange>, area: string) => void) | null = null;
    mockOnStorageChanged.mockImplementation((cb) => { storageListener = cb; });
    mockLoadSettings.mockResolvedValueOnce(DEFAULT_SETTINGS as Settings);

    const customSettings = { ...DEFAULT_SETTINGS, cardCreator: { ...DEFAULT_SETTINGS.cardCreator, ankiConnectUrl: 'http://custom:8765' } } as Settings;
    mockLoadSettings.mockResolvedValueOnce(customSettings);

    render(<CardCreatorPanel sourceLang="en" targetLang="vi" />);
    await waitFor(() => expect(screen.getByTestId('card-creator-content')).toBeInTheDocument());

    storageListener!({ settings: { newValue: {}, oldValue: {} } }, 'local');
    await waitFor(() => expect(mockLoadSettings).toHaveBeenCalledTimes(2));
  });
});
