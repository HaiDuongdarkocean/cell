import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PronunciationSettings, TtsSettings } from '@/entities/settings/types';
import { SourceDetailPanel } from './SourceDetailPanel';

// TtsVoiceManagerPanel's async voice loading triggers React act() warnings in
// jsdom. We mock it to a simple placeholder and test the routing only.
jest.mock('@/features/tts/ui/TtsVoiceManagerPanel', () => ({
  TtsVoiceManagerPanel() {
    return <div data-cell-id="tts-voice-manager">TTS Voice Manager (mock)</div>;
  },
}));
jest.mock('@/features/dictionaryPopup/services/ttsEngineService', () => ({
  createTtsEngine: () => ({
    getVoices: () => Promise.resolve([]),
    speak: () => Promise.resolve(),
    stop: () => undefined,
  }),
}));

function makePronunciation(
  overrides: Partial<PronunciationSettings> = {},
): PronunciationSettings {
  return {
    fallbackEngines: ['localFile', 'native', 'supertonic', 'browserTts', 'espeak'],
    downloadEspeakTtsData: false,
    localFile: {
      packageType: 'single',
      dslFileHandleId: null,
      audioArchiveHandleId: null,
      splitArchiveDirectoryHandleId: null,
      splitArchivePattern: '',
      lastIndexedAt: null,
    },
    ...overrides,
  };
}

function makeTts(overrides: Partial<TtsSettings> = {}): TtsSettings {
  return {
    enabled: true,
    savedVoices: [],
    voices: [],
    maxDisplay: 3,
    autoplayCount: 0,
    preferredAccent: 'US',
    localTtsEnabled: false,
    localTtsLanguage: 'en',
    downloadedLanguages: [],
    hiddenLanguages: [],
    ...overrides,
  };
}

function renderPanel(
  engine: Parameters<typeof SourceDetailPanel>[0]['engine'],
  options: {
    pronunciation?: PronunciationSettings;
    tts?: TtsSettings;
    onPronunciationChange?: (next: PronunciationSettings) => void;
    onTtsChange?: (next: TtsSettings) => void;
  } = {},
) {
  return render(
    <SourceDetailPanel
      engine={engine}
      pronunciation={options.pronunciation ?? makePronunciation()}
      tts={options.tts ?? makeTts()}
      onPronunciationChange={options.onPronunciationChange ?? jest.fn()}
      onTtsChange={options.onTtsChange ?? jest.fn()}
    />,
  );
}

describe('SourceDetailPanel', () => {
  it('renders LocalPronunciationSettingsPanel for the localFile engine', async () => {
    renderPanel('localFile');

    expect(screen.getByTestId('source-detail-panel')).toHaveAttribute(
      'data-engine',
      'localFile',
    );
    expect(screen.getByText('Local Forvo package')).toBeInTheDocument();
    expect(screen.getByText('Package type')).toBeInTheDocument();
  });

  it('renders a short info text for the native engine', async () => {
    renderPanel('native');

    expect(screen.getByText('Community audio (Wikimedia)')).toBeInTheDocument();
    expect(screen.getByText(/no configuration needed/i)).toBeInTheDocument();
  });

  it('renders TtsLanguagePanel for the supertonic engine', async () => {
    renderPanel('supertonic');

    expect(screen.getByText('Local TTS (Supertonic v3)')).toBeInTheDocument();
    expect(screen.getByTestId('local-tts-toggle')).toBeInTheDocument();
  });

  it('renders TtsVoiceManagerPanel for the browserTts engine without the local TTS card', () => {
    renderPanel('browserTts');

    expect(screen.getByTestId('tts-voice-manager')).toBeInTheDocument();
    expect(screen.queryByTestId('local-tts-languages-card')).not.toBeInTheDocument();
  });

  it('renders the eSpeak data toggle for the espeak engine', async () => {
    renderPanel('espeak');

    expect(screen.getByText('eSpeak on-device TTS')).toBeInTheDocument();
    expect(screen.getByText('Download eSpeak TTS data')).toBeInTheDocument();
    expect(screen.getByTestId('espeak-data-toggle')).toBeInTheDocument();
  });

  it('calls onPronunciationChange when the eSpeak toggle is flipped', async () => {
    const onPronunciationChange = jest.fn();
    renderPanel('espeak', { onPronunciationChange });

    fireEvent.click(screen.getByTestId('espeak-data-toggle'));

    expect(onPronunciationChange).toHaveBeenCalledWith(
      expect.objectContaining({ downloadEspeakTtsData: true }),
    );
  });
});
