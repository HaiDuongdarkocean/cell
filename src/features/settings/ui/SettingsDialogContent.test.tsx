import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Settings } from '@/entities/media';
import { DEFAULT_SETTINGS } from '@/shared/config/config';
import { SettingsDialogContent } from './SettingsDialogContent';

// The settings dialog composes many feature panels; stub the heavy ones so
// this test stays focused on the Audio card merge (spec
// fnc_audio-settings-pipeline — Task 5).
jest.mock('./CardCreatorSettingsPanel', () => ({
  CardCreatorSettingsPanel: () => <div data-cell-id="card-creator-panel" />,
}));
jest.mock('./DictionaryPopupSettingsPanel', () => ({
  DictionaryPopupSettingsPanel: () => <div data-cell-id="dictionary-popup-panel" />,
}));
jest.mock('./LanguageProfilePanel', () => ({
  LanguageProfilePanel: () => <div data-cell-id="language-profile-panel" />,
}));
jest.mock('@/features/theme/ui/ThemePanel', () => ({
  ThemePanel: () => <div data-cell-id="theme-panel" />,
}));
jest.mock('@/features/dictionary/ui/ResourcesPanel', () => ({
  ResourcesPanel: () => <div data-cell-id="resources-panel" />,
}));
jest.mock('@/features/tts/ui/TtsLanguagePanel', () => ({
  TtsLanguagePanel: () => <div data-cell-id="tts-language-panel" />,
}));
jest.mock('@/features/tts/ui/TtsVoiceManagerPanel', () => ({
  DEFAULT_TTS_SETTINGS: {
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
  },
  TtsVoiceManagerPanel: () => <div data-cell-id="tts-voice-manager" />,
}));

function renderContent(
  settings: Settings = DEFAULT_SETTINGS,
  onChange: (settings: Settings) => void = jest.fn(),
) {
  const utils = render(
    <SettingsDialogContent settings={settings} onChange={onChange} />,
  );
  return { onChange, ...utils };
}

describe('SettingsDialogContent — merged Audio card', () => {
  it('renders a single Audio card and no legacy audio cards', () => {
    const { container } = renderContent();

    const audioCard = container.querySelector('[data-section="audio"]');
    expect(audioCard).toBeInTheDocument();
    expect(audioCard).toHaveTextContent('Audio');
    // The merged AudioPanel body is rendered inside the Audio card.
    expect(
      audioCard?.querySelector('[data-cell-id="audio-panel"]'),
    ).toBeInTheDocument();

    expect(
      container.querySelector('[data-section="pronunciation"]'),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-section="localPronunciation"]'),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-section="tts"]'),
    ).not.toBeInTheDocument();
  });

  it('shows a single Audio item in the sidebar nav', () => {
    const { container } = renderContent();

    expect(
      container.querySelector('[data-section-id="audio"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-section-id="pronunciation"]'),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-section-id="localPronunciation"]'),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-section-id="tts"]'),
    ).not.toBeInTheDocument();
  });

  it('renders the pipeline detail pane for the first fallback engine', () => {
    renderContent();

    expect(screen.getByTestId('source-detail-panel')).toHaveAttribute(
      'data-engine',
      'localFile',
    );
  });

  it('wires onPronunciationChange through settings.pronunciation', () => {
    const onChange = jest.fn();
    renderContent(DEFAULT_SETTINGS, onChange);

    fireEvent.click(screen.getByTestId('audio-mode-fast'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        pronunciation: expect.objectContaining({
          fallbackEngines: ['browserTts', 'native', 'localFile', 'espeak'],
        }),
      }),
    );
  });

  it('wires onTtsChange through settings.dictionaryPopup.tts', () => {
    const onChange = jest.fn();
    renderContent(DEFAULT_SETTINGS, onChange);

    fireEvent.click(screen.getByTestId('audio-enable-toggle'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        dictionaryPopup: expect.objectContaining({
          tts: expect.objectContaining({ enabled: false }),
        }),
      }),
    );
  });
});
