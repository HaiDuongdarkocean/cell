import { render } from '@testing-library/react';
import { SubtitlePanel } from './SubtitlePanel';
import type { BilingualCue } from '@/entities/media';

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
