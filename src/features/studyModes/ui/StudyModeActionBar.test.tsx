import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudyModeActionBar } from './StudyModeActionBar';
import { PRESETS } from '@/entities/studyMode/constants';

const customModes = [
  {
    id: 'custom-1',
    type: 'custom' as const,
    icon: 'slidersHorizontal' as const,
    title: 'My combo',
    description: 'Custom mode',
    steps: [{ subtitle: 'target' as const, pause: 'none' as const, repeat: 1 as const, speed: 1 as const, after: 'continue' as const }],
  },
];

const noop = (): void => undefined;

let originalResizeObserver: unknown;

beforeAll(() => {
  originalResizeObserver = global.ResizeObserver;
  global.ResizeObserver = class ResizeObserverMock {
    private callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element): void {
      this.callback(
        [{ target, contentRect: { width: 500, height: 40, top: 0, left: 0, bottom: 40, right: 500, x: 0, y: 0 } } as unknown as ResizeObserverEntry],
        this,
      );
    }
    unobserve(): void { /* noop */ }
    disconnect(): void { /* noop */ }
  } as unknown as typeof ResizeObserver;
});

afterAll(() => {
  global.ResizeObserver = originalResizeObserver as typeof ResizeObserver;
});

describe('StudyModeActionBar', () => {
  it('renders all preset and custom mode tabs', () => {
    render(
      <StudyModeActionBar
        activeModeId="dictation"
        customModes={customModes}
        playbackSpeed={1}
        onModeChange={noop}
        onSpeedChange={noop}
      />,
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(PRESETS.length + customModes.length);
  });

  it('highlights the active tab', () => {
    render(
      <StudyModeActionBar
        activeModeId="cloze"
        customModes={[]}
        playbackSpeed={1}
        onModeChange={noop}
        onSpeedChange={noop}
      />,
    );
    const active = screen.getByRole('tab', { name: 'Cloze' });
    expect(active).toHaveAttribute('aria-selected', 'true');
  });

  it('calls onModeChange when a tab is clicked', () => {
    const onModeChange = jest.fn();
    render(
      <StudyModeActionBar
        activeModeId="normal"
        customModes={[]}
        playbackSpeed={1}
        onModeChange={onModeChange}
        onSpeedChange={noop}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Dictation' }));
    expect(onModeChange).toHaveBeenCalledWith('dictation');
  });

  it('shows the right overflow arrow when the track overflows', () => {
    const { container } = render(
      <StudyModeActionBar
        activeModeId="normal"
        customModes={[]}
        playbackSpeed={1}
        onModeChange={noop}
        onSpeedChange={noop}
      />,
    );
    const track = container.querySelector('[data-cell-id="study-mode-scroll-track"]') as HTMLElement;
    Object.defineProperty(track, 'scrollWidth', { value: 800, configurable: true });
    Object.defineProperty(track, 'clientWidth', { value: 300, configurable: true });
    Object.defineProperty(track, 'scrollLeft', { value: 0, configurable: true });
    fireEvent.scroll(track);
    expect(container.querySelector('[data-cell-id="study-mode-scroll-right"]')).toBeInTheDocument();
    expect(container.querySelector('[data-cell-id="study-mode-scroll-left"]')).not.toBeInTheDocument();
  });

  it('shows the left overflow arrow after scrolling right', () => {
    const { container } = render(
      <StudyModeActionBar
        activeModeId="normal"
        customModes={[]}
        playbackSpeed={1}
        onModeChange={noop}
        onSpeedChange={noop}
      />,
    );
    const track = container.querySelector('[data-cell-id="study-mode-scroll-track"]') as HTMLElement;
    Object.defineProperty(track, 'scrollWidth', { value: 800, configurable: true });
    Object.defineProperty(track, 'clientWidth', { value: 300, configurable: true });
    Object.defineProperty(track, 'scrollLeft', { value: 250, configurable: true });
    fireEvent.scroll(track);
    expect(container.querySelector('[data-cell-id="study-mode-scroll-left"]')).toBeInTheDocument();
  });

  it('moves focus between tabs with left/right arrow keys', () => {
    render(
      <StudyModeActionBar
        activeModeId="normal"
        customModes={[]}
        playbackSpeed={1}
        onModeChange={noop}
        onSpeedChange={noop}
      />,
    );
    const tabs = screen.getAllByRole('tab');
    tabs[0]?.focus();
    fireEvent.keyDown(tabs[0]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tabs[1]);
    fireEvent.keyDown(tabs[1]!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tabs[0]);
  });
});
