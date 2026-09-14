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
