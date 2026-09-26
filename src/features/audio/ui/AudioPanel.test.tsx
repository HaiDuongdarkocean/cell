import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PronunciationSettings, TtsSettings } from '@/entities/settings/types';
import { AudioPanel } from './AudioPanel';

// SourceDetailPanel → BrowserVoicePanel loads voices via createTtsEngine()
// in an effect; jsdom has neither chrome.tts nor speechSynthesis, so stub it.
jest.mock('@/features/tts/services/ttsEngineService', () => ({
  createTtsEngine: () => ({
    getVoices: () => Promise.resolve([]),
    speak: () => Promise.resolve(),
    stop: () => undefined,
  }),
}));

// BrowserVoicePanel's async voice loading triggers React act() warnings in
// jsdom. We test the panel itself in BrowserVoicePanel.test.tsx; here we only
// need to verify the SourceDetailPanel route renders it for browserTts.
jest.mock('./BrowserVoicePanel', () => ({
  BrowserVoicePanel() {
    return <div data-cell-id="browser-voice-panel">Browser Voice Panel (mock)</div>;
  },
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
  options: {
    pronunciation?: PronunciationSettings;
    tts?: TtsSettings;
    onPronunciationChange?: (next: PronunciationSettings) => void;
    onTtsChange?: (next: TtsSettings) => void;
  } = {},
) {
  return render(
    <AudioPanel
      pronunciation={options.pronunciation ?? makePronunciation()}
      tts={options.tts ?? makeTts()}
      targetLang="en"
      onPronunciationChange={options.onPronunciationChange ?? jest.fn()}
      onTtsChange={options.onTtsChange ?? jest.fn()}
    />,
  );
}

describe('AudioPanel', () => {
  it('renders all sections: modes, pipeline, detail, tester, autoplay', async () => {
    renderPanel();

    expect(screen.getByTestId('audio-panel')).toBeInTheDocument();

    // Output mode segmented control — 5 modes + hint popover trigger.
    for (const mode of ['auto', 'natural', 'fast', 'offline', 'minimal']) {
      expect(screen.getByTestId(`audio-mode-${mode}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('audio-mode-hint')).toBeInTheDocument();

    // Compact tester.
    expect(screen.getByTestId('audio-tester-input')).toBeInTheDocument();
    expect(screen.getByTestId('audio-tester-play')).toBeInTheDocument();

    // Autoplay.
    expect(screen.getByText('Autoplay')).toBeInTheDocument();

    // Pipeline + detail pane for the first engine in the fallback chain.
    expect(screen.getByRole('list', { name: 'Audio source order' })).toBeInTheDocument();
    expect(screen.getByTestId('source-detail-panel')).toHaveAttribute(
      'data-engine',
      'localFile',
    );
  });

  it('shows the output-mode hint only after the hint button is pressed', async () => {
    renderPanel();

    expect(
      screen.queryByText('Switching mode replaces the source order below.'),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('audio-mode-hint'));

    expect(
      screen.getByText('Switching mode replaces the source order below.'),
    ).toBeInTheDocument();
  });

  it('replaces fallbackEngines with the full mode chain on mode change', async () => {
    const onPronunciationChange = jest.fn();
    renderPanel({ onPronunciationChange });

    fireEvent.click(screen.getByTestId('audio-mode-fast'));

    expect(onPronunciationChange).toHaveBeenCalledWith(
      expect.objectContaining({
        fallbackEngines: ['browserTts', 'native', 'localFile', 'espeak'],
      }),
    );
  });

  it('marks the detected mode as pressed', async () => {
    renderPanel({
      pronunciation: makePronunciation({
        fallbackEngines: ['localFile', 'espeak', 'supertonic'],
      }),
    });

    expect(screen.getByTestId('audio-mode-offline')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('audio-mode-auto')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('updates the detail pane when a pipeline step is selected', () => {
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Browser voice (ready)' }));

    expect(screen.getByTestId('source-detail-panel')).toHaveAttribute(
      'data-engine',
      'browserTts',
    );
    expect(screen.getByTestId('browser-voice-panel')).toBeInTheDocument();
  });

  it('changes tts.autoplayCount via the Autoplay select', async () => {
    const onTtsChange = jest.fn();
    renderPanel({ onTtsChange });

    fireEvent.click(screen.getByRole('button', { name: 'Autoplay count' }));
    fireEvent.click(screen.getByRole('option', { name: '2' }));

    expect(onTtsChange).toHaveBeenCalledWith(
      expect.objectContaining({ autoplayCount: 2 }),
    );
  });

  it('asks for input when Play is pressed with an empty tester field', async () => {
    renderPanel();

    fireEvent.click(screen.getByTestId('audio-tester-play'));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Enter a word to test.',
    );
  });

  it('reports when no audio is found for a tester term', async () => {
    renderPanel();

    fireEvent.change(screen.getByTestId('audio-tester-input'), {
      target: { value: 'hello' },
    });
    fireEvent.click(screen.getByTestId('audio-tester-play'));

    // jsdom has no chrome.runtime — every provider resolves to [].
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'No audio found in the current order.',
      ),
    );
  });
});
