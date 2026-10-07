import { afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Settings } from '@/entities/media';
import { DEFAULT_SETTINGS } from '@/shared/config/config';
import { SettingsDialogContent } from './SettingsDialogContent';

// The settings dialog composes many feature panels; stub the heavy ones so
// this test stays focused on the Audio card merge (spec
// fnc_audio-settings-pipeline — Task 5).
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
  ResourcesPanel: (props: { langCode: string; activeProfileId?: string | null }) => (
    <div
      data-cell-id="resources-panel"
      data-lang-code={props.langCode}
      data-active-profile={props.activeProfileId ?? ''}
    />
  ),
}));
jest.mock('@/features/tts/ui/TtsLanguagePanel', () => ({
  TtsLanguagePanel: () => <div data-cell-id="tts-language-panel" />,
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

describe('SettingsDialogContent — resources ↔ profile binding', () => {
  const profile = {
    id: 'p-en',
    target: 'en',
    native: '',
    name: 'English',
    order: 1,
    subtitleOverlayTargetStyle: DEFAULT_SETTINGS.subtitleOverlayTargetStyle!,
    subtitleOverlayNativeStyle: DEFAULT_SETTINGS.subtitleOverlayNativeStyle!,
    subtitleOverlayAutoLoad: true,
    subtitleOverlayAutoLoadAsr: false,
    subtitleOverlayAutoTranslate: false,
    dictionaryPopup: DEFAULT_SETTINGS.dictionaryPopup!,
  };

  it('gates the Resources card behind having at least one profile', () => {
    const { container } = renderContent({
      ...DEFAULT_SETTINGS,
      languageProfiles: [],
      activeProfileId: null,
    } as Settings);

    const resourcesCard = container.querySelector('[data-section="resources"]');
    expect(resourcesCard?.querySelector('[data-cell-id="resources-panel"]')).not.toBeInTheDocument();
    expect(screen.getByTestId('resources-goto-profiles')).toBeInTheDocument();
  });

  it('renders ResourcesPanel scoped to the active profile when one exists', () => {
    const { container } = renderContent({
      ...DEFAULT_SETTINGS,
      languageProfiles: [profile],
      activeProfileId: 'p-en',
    } as Settings);

    const panel = container.querySelector('[data-cell-id="resources-panel"]');
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute('data-lang-code', 'en');
  });
});

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

    fireEvent.click(
      screen.getByRole('button', { name: 'Number of audios to autoplay' }),
    );
    fireEvent.click(screen.getByRole('option', { name: '2' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        dictionaryPopup: expect.objectContaining({
          tts: expect.objectContaining({ autoplayCount: 2 }),
        }),
      }),
    );
  });
});

describe('SettingsDialogContent — nav orientation cutoff', () => {
  const OriginalResizeObserver = globalThis.ResizeObserver;

  beforeAll(() => {
    if (typeof Element.prototype.scrollTo !== 'function') {
      Element.prototype.scrollTo = jest.fn();
    }
    if (typeof Element.prototype.scrollIntoView !== 'function') {
      Element.prototype.scrollIntoView = jest.fn();
    }
  });

  const mockContainerWidth = (width: number): void => {
    globalThis.ResizeObserver = jest.fn(
      (cb: (entries: { contentRect: { width: number } }[]) => void) => ({
        observe: jest.fn(() => cb([{ contentRect: { width } }])),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      }),
    ) as unknown as typeof ResizeObserver;
  };

  afterEach(() => {
    globalThis.ResizeObserver = OriginalResizeObserver;
  });

  it('renders the horizontal labeled strip at 700px instead of the collapsed rail', () => {
    mockContainerWidth(700);
    const { container } = renderContent();

    const sidebar = container.querySelector('aside[data-orientation]');
    expect(sidebar).toHaveAttribute('data-orientation', 'horizontal');
    expect(sidebar).not.toHaveAttribute('data-collapsed');
    expect(container.querySelector('nav')).toHaveClass('horizontal');
  });

  it('renders the expanded vertical sidebar at ≥768px', () => {
    mockContainerWidth(800);
    const { container } = renderContent();

    const sidebar = container.querySelector('aside[data-orientation]');
    expect(sidebar).toHaveAttribute('data-orientation', 'vertical');
    expect(sidebar).not.toHaveAttribute('data-collapsed');
    expect(container.querySelector('nav')).toHaveClass('vertical');
  });

  const makeScrollableMain = (container: HTMLElement): HTMLElement => {
    const main = container.querySelector<HTMLElement>('.mainCol');
    if (!main) throw new Error('main column not rendered');
    let top = 0;
    Object.defineProperties(main, {
      scrollHeight: { value: 2000, configurable: true },
      clientHeight: { value: 400, configurable: true },
      scrollTop: {
        get: () => top,
        set: (v: number) => { top = v; },
        configurable: true,
      },
    });
    return main;
  };

  it('hides the horizontal nav on downward scroll and reveals it on scroll up', async () => {
    mockContainerWidth(700);
    const { container } = renderContent();
    const body = container.firstElementChild as HTMLElement;
    const aside = container.querySelector('aside[data-orientation="horizontal"]');
    const main = makeScrollableMain(container);

    main.scrollTop = 200;
    fireEvent.scroll(main);
    expect(body).toHaveAttribute('data-nav-hidden', 'true');
    expect(aside).toHaveAttribute('aria-hidden', 'true');

    await new Promise((resolve) => setTimeout(resolve, 350));
    main.scrollTop = 80;
    fireEvent.scroll(main);
    expect(body).not.toHaveAttribute('data-nav-hidden');
    expect(aside).not.toHaveAttribute('aria-hidden');
  });

  it('reveals the horizontal nav immediately at scroll top', () => {
    mockContainerWidth(700);
    const { container } = renderContent();
    const body = container.firstElementChild as HTMLElement;
    const main = makeScrollableMain(container);

    main.scrollTop = 200;
    fireEvent.scroll(main);
    expect(body).toHaveAttribute('data-nav-hidden', 'true');

    main.scrollTop = 0;
    fireEvent.scroll(main);
    expect(body).not.toHaveAttribute('data-nav-hidden');
  });

  it('never hides the nav in vertical orientation', () => {
    mockContainerWidth(800);
    const { container } = renderContent();
    const body = container.firstElementChild as HTMLElement;
    const main = makeScrollableMain(container);

    main.scrollTop = 200;
    fireEvent.scroll(main);
    expect(body).not.toHaveAttribute('data-nav-hidden');
  });
});
