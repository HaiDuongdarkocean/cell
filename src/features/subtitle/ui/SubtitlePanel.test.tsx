import { fireEvent, render } from '@testing-library/react';
import { SubtitlePanel } from './SubtitlePanel';
import type { BilingualCue } from '@/entities/media';
import type { StudyMode } from '@/entities/studyMode/types';

const cues: BilingualCue[] = [
  { index: 1, start: 0, end: 5000, targetText: 'Hello', nativeText: 'Xin chào' },
];

describe('SubtitlePanel blur overlay', () => {
  beforeEach(() => {
    global.ResizeObserver = class ResizeObserverMock {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;
  });

  it('renders a blur overlay over the cue list when panelBlurred is true', () => {
    const { container } = render(
      <SubtitlePanel cues={cues} currentTimeMs={0} onSeek={jest.fn()} panelBlurred />,
    );

    expect(container.querySelector('[data-cell-id="subtitle-panel-blur-overlay"]')).toBeInTheDocument();
    expect(container.querySelector('[data-panel-blurred="true"]')).toBeInTheDocument();
  });

  it('does not render a blur overlay when panelBlurred is false', () => {
    const { container } = render(
      <SubtitlePanel cues={cues} currentTimeMs={0} onSeek={jest.fn()} />,
    );

    expect(container.querySelector('[data-cell-id="subtitle-panel-blur-overlay"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-panel-blurred="true"]')).not.toBeInTheDocument();
  });
});

describe('SubtitlePanel tab strip', () => {
  beforeEach(() => {
    global.ResizeObserver = class ResizeObserverMock {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;
  });

  it('renders no tab strip when only the Subtitles tab is renderable', () => {
    const { container } = render(
      <SubtitlePanel cues={cues} currentTimeMs={0} onSeek={jest.fn()} />,
    );

    expect(container.querySelector('[data-cell-id="subtitle-panel-tab-subtitles"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-cell-id^="subtitle-panel-tab-"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-cell-id="cue-list-scroll"]')).toBeInTheDocument();
  });

  it('renders no tab strip when tokenize is set without a playlist', () => {
    const { container } = render(
      <SubtitlePanel
        cues={cues}
        currentTimeMs={0}
        onSeek={jest.fn()}
        tokenize={{ langCode: 'zh', onTokenClick: jest.fn() }}
      />,
    );

    expect(container.querySelector('[data-cell-id="subtitle-panel-tab-subtitles"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-cell-id="cue-list-scroll"]')).toBeInTheDocument();
  });

  it('renders the tab strip when a Playlist tab exists', () => {
    const { container } = render(
      <SubtitlePanel
        cues={cues}
        currentTimeMs={0}
        onSeek={jest.fn()}
        playlistContent={<div data-testid="playlist-content" />}
      />,
    );

    expect(container.querySelector('[data-cell-id="subtitle-panel-tab-subtitles"]')).toBeInTheDocument();
    expect(container.querySelector('[data-cell-id="subtitle-panel-tab-playlist"]')).toBeInTheDocument();
    expect(container.querySelector('[data-cell-id="cue-list-scroll"]')).toBeInTheDocument();
  });
});

describe('SubtitlePanel practice cues', () => {
  beforeEach(() => {
    global.ResizeObserver = class ResizeObserverMock {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;
  });

  it('hides cues with no target text and never lands the review focus on them', () => {
    const mixed: BilingualCue[] = [
      { index: 1, start: 0, end: 1000, targetText: 'one', nativeText: '' },
      { index: 2, start: 1000, end: 2000, targetText: '', nativeText: 'native only' },
      { index: 3, start: 2000, end: 3000, targetText: 'three', nativeText: '' },
    ];
    const { container } = render(
      <SubtitlePanel cues={mixed} currentTimeMs={1500} onSeek={jest.fn()} practiceMode="dictation" />,
    );

    expect(container.querySelectorAll('[data-cell-id="cue-item"]')).toHaveLength(2);
    const current = container.querySelector('[data-cell-id="cue-item"][data-current="true"]');
    expect(current).not.toBeNull();
    expect(current?.getAttribute('data-cue-index')).toBe('1');
  });
});

describe('SubtitlePanel study menu', () => {
  const MORE_BTN = '[data-cell-id="subtitle-panel-more-btn"]';
  const MENU = '[data-cell-id="study-mode-action-bar"]';

  beforeEach(() => {
    global.ResizeObserver = class ResizeObserverMock {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;
  });

  const openMenu = (container: HTMLElement): HTMLElement => {
    fireEvent.click(container.querySelector(MORE_BTN)!);
    return document.querySelector(MENU) as HTMLElement;
  };

  it('renders the more trigger at the far right of the header, menu closed at rest', () => {
    const { container } = render(
      <SubtitlePanel cues={cues} currentTimeMs={0} onSeek={jest.fn()} onStudyModeChange={jest.fn()} />,
    );

    const header = container.querySelector('[data-cell-id="subtitle-panel-header"]')!;
    const btn = header.querySelector(MORE_BTN);
    expect(btn).toBeInTheDocument();
    expect(btn).toBe(header.lastElementChild);
    expect(btn).toHaveAttribute('aria-haspopup', 'menu');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector(MENU)).not.toBeInTheDocument();
  });

  it('renders no trigger when onStudyModeChange is absent', () => {
    const { container } = render(
      <SubtitlePanel cues={cues} currentTimeMs={0} onSeek={jest.fn()} />,
    );

    expect(container.querySelector(MORE_BTN)).not.toBeInTheDocument();
  });

  it('lists modes as menuitemradio, reflects the active mode, selects and closes', () => {
    const onMode = jest.fn();
    const { container } = render(
      <SubtitlePanel
        cues={cues}
        currentTimeMs={0}
        onSeek={jest.fn()}
        onStudyModeChange={onMode}
        activeModeId="normal"
      />,
    );

    const menu = openMenu(container);
    expect(menu).toHaveAttribute('role', 'menu');
    const normal = menu.querySelector('[data-cell-id="study-mode-normal"]')!;
    const dictation = menu.querySelector('[data-cell-id="study-mode-dictation"]')!;
    expect(normal).toHaveAttribute('role', 'menuitemradio');
    expect(normal).toHaveAttribute('aria-checked', 'true');
    expect(dictation).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(dictation);
    expect(onMode).toHaveBeenCalledWith('dictation');
    expect(document.querySelector(MENU)).not.toBeInTheDocument();
  });

  it('falls back to practiceMode for the selected item when activeModeId is unset', () => {
    const { container } = render(
      <SubtitlePanel
        cues={cues}
        currentTimeMs={0}
        onSeek={jest.fn()}
        onStudyModeChange={jest.fn()}
        practiceMode="cloze"
      />,
    );

    const menu = openMenu(container);
    expect(menu.querySelector('[data-cell-id="study-mode-cloze"]')).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('renders custom modes after presets', () => {
    const custom: StudyMode = {
      id: 'my-mode',
      type: 'custom',
      icon: 'play',
      title: 'My Mode',
      description: '',
      steps: [{ subtitle: 'both', pause: 'none', repeat: 1, speed: 1, after: 'continue' }],
    };
    const { container } = render(
      <SubtitlePanel
        cues={cues}
        currentTimeMs={0}
        onSeek={jest.fn()}
        onStudyModeChange={jest.fn()}
        customModes={[custom]}
      />,
    );

    expect(openMenu(container).querySelector('[data-cell-id="study-mode-my-mode"]')).toBeInTheDocument();
  });

  it('steps playback speed via the menu stepper', () => {
    const onSpeed = jest.fn();
    const { container } = render(
      <SubtitlePanel
        cues={cues}
        currentTimeMs={0}
        onSeek={jest.fn()}
        onStudyModeChange={jest.fn()}
        onPlaybackSpeedChange={onSpeed}
        playbackSpeed={1}
      />,
    );

    const menu = openMenu(container);
    expect(menu.querySelector('[data-cell-id="speed-value"]')).toHaveTextContent('1×');
    fireEvent.click(menu.querySelector('[data-cell-id="speed-inc"]')!);
    expect(onSpeed).toHaveBeenCalledWith(1.25);
    fireEvent.click(menu.querySelector('[data-cell-id="speed-dec"]')!);
    expect(onSpeed).toHaveBeenCalledWith(0.75);
  });
});
