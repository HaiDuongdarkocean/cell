import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { useCuesStore } from '@/stores/cuesStore';
import { SubtitleBlock } from './SubtitleBlock';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { SrtCue } from '@/entities/media/types';

const makeCue = (index: number, text: string): SrtCue => ({
  index,
  start: index * 1000,
  end: index * 1000 + 500,
  text,
});

const baseStyle: OverlayStyleConfig = {
  fontSize: 24,
  textColor: '#ffffff',
  backgroundColor: '#000000',
  backgroundOpacity: 0.7,
  textOpacity: 1,
  textShadow: { preset: 'soft', color: '#000000', blur: 2, offsetX: 1, offsetY: 1 },
  fontFamily: 'sans-serif',
  fontWeight: 600,
  horizontalAlign: 'center',
  visible: true,
};

function setCues(targetCues: SrtCue[], nativeCues: SrtCue[], targetIndex = -1, nativeIndex = -1) {
  act(() => {
    useCuesStore.getState().setCues(targetCues, nativeCues);
    useCuesStore.getState().setActiveIndex(targetIndex, nativeIndex);
  });
}

function resetStore(): void {
  act(() => {
    useCuesStore.setState({
      targetCues: [],
      nativeCues: [],
      targetActiveIndex: -1,
      nativeActiveIndex: -1,
      targetLoadStatus: { state: 'idle' },
      nativeLoadStatus: { state: 'idle' },
    });
  });
}

describe('SubtitleBlock', () => {
  beforeEach(() => {
    resetStore();
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the active target and native cue', () => {
    setCues([makeCue(0, 'target 0'), makeCue(1, 'target 1')], [makeCue(0, 'native 0'), makeCue(1, 'native 1')], 1, 1);
    render(<SubtitleBlock targetStyle={baseStyle} nativeStyle={baseStyle} />);

    expect(screen.getByTestId('subtitle-block')).toBeInTheDocument();
    expect(screen.getByText('target 1')).toBeInTheDocument();
    expect(screen.getByText('native 1')).toBeInTheDocument();
  });

  it('hides native layer when native style visible is false', () => {
    setCues([makeCue(0, 'target 0')], [makeCue(0, 'native 0')], 0, 0);
    const nativeStyle = { ...baseStyle, visible: false };
    render(<SubtitleBlock targetStyle={baseStyle} nativeStyle={nativeStyle} />);

    expect(screen.getByText('target 0')).toBeInTheDocument();
    expect(screen.queryByText('native 0')).not.toBeInTheDocument();
  });

  it('renders block container with empty layers when no active cue', () => {
    setCues([], []);
    render(<SubtitleBlock targetStyle={baseStyle} nativeStyle={baseStyle} />);
    expect(screen.getByTestId('subtitle-block')).toBeInTheDocument();
    const targetLayer = screen.getByTestId('subtitle-block').querySelector('[data-role="target"]');
    const nativeLayer = screen.getByTestId('subtitle-block').querySelector('[data-role="native"]');
    expect(targetLayer).toBeInTheDocument();
    expect(nativeLayer).toBeNull();
  });

  it('shows "Loaded English" inline status after successful load, before first cue active', () => {
    // Simulate auto-load: loading → loaded (cues arrive, no active cue yet)
    act(() => {
      useCuesStore.getState().setLoadStatus('target', { state: 'loading', languageLabel: 'English' });
      useCuesStore.getState().setLoadStatus('native', { state: 'loading', languageLabel: 'Vietnamese' });
    });
    setCues([makeCue(0, 'target 0')], [makeCue(0, 'native 0')], -1, -1);
    render(<SubtitleBlock targetStyle={baseStyle} nativeStyle={baseStyle} />);

    // Status text shows "Loaded English" / "Loaded Vietnamese" (no active cue yet)
    expect(screen.getByText('Loaded English')).toBeInTheDocument();
    expect(screen.getByText('Loaded Vietnamese')).toBeInTheDocument();
  });

  it('replaces "Loaded" status with subtitle text when cue becomes active', () => {
    setCues([makeCue(0, 'target 0')], [makeCue(0, 'native 0')], 0, 0);
    render(<SubtitleBlock targetStyle={baseStyle} nativeStyle={baseStyle} />);

    // Active cue present → subtitle text shows, not status
    expect(screen.getByText('target 0')).toBeInTheDocument();
    expect(screen.getByText('native 0')).toBeInTheDocument();
    expect(screen.queryByText('Loaded English')).not.toBeInTheDocument();
  });

  it('shows "Loaded English (imported)" when source is imported', () => {
    act(() => {
      useCuesStore.getState().setLoadStatus('target', { state: 'loaded', languageLabel: 'English', source: 'imported' });
    });
    render(<SubtitleBlock targetStyle={baseStyle} nativeStyle={baseStyle} />);
    expect(screen.getByText('Loaded English (imported)')).toBeInTheDocument();
  });

  it('shows "Loaded English (from search)" when source is search', () => {
    act(() => {
      useCuesStore.getState().setLoadStatus('target', { state: 'loaded', languageLabel: 'English', source: 'search' });
    });
    render(<SubtitleBlock targetStyle={baseStyle} nativeStyle={baseStyle} />);
    expect(screen.getByText('Loaded English (from search)')).toBeInTheDocument();
  });

  it('shows "Loaded English (track 2)" when trackIndex is 2', () => {
    act(() => {
      useCuesStore.getState().setLoadStatus('target', { state: 'loaded', languageLabel: 'English', trackIndex: 2 });
    });
    render(<SubtitleBlock targetStyle={baseStyle} nativeStyle={baseStyle} />);
    expect(screen.getByText('Loaded English (track 2)')).toBeInTheDocument();
  });

  it('shows "Loaded English (imported) (track 1)" with source and trackIndex', () => {
    act(() => {
      useCuesStore.getState().setLoadStatus('target', { state: 'loaded', languageLabel: 'English', source: 'imported', trackIndex: 1 });
    });
    render(<SubtitleBlock targetStyle={baseStyle} nativeStyle={baseStyle} />);
    expect(screen.getByText('Loaded English (imported) (track 1)')).toBeInTheDocument();
  });

  it('shows "Translating to Vietnamese… (50/200)" with progress', () => {
    act(() => {
      useCuesStore.getState().setLoadStatus('target', { state: 'translating', languageLabel: 'Vietnamese', progress: { current: 50, total: 200 } });
    });
    render(<SubtitleBlock targetStyle={baseStyle} nativeStyle={baseStyle} />);
    expect(screen.getByText('Translating to Vietnamese… (50/200)')).toBeInTheDocument();
  });

  it('shows "Translating to Vietnamese…" without progress', () => {
    act(() => {
      useCuesStore.getState().setLoadStatus('target', { state: 'translating', languageLabel: 'Vietnamese' });
    });
    render(<SubtitleBlock targetStyle={baseStyle} nativeStyle={baseStyle} />);
    expect(screen.getByText('Translating to Vietnamese…')).toBeInTheDocument();
  });

  it('shows "Couldn\'t load English subtitle (timeout)" with errorType timeout', () => {
    act(() => {
      useCuesStore.getState().setLoadStatus('target', { state: 'error', languageLabel: 'English', errorType: 'timeout' });
    });
    render(<SubtitleBlock targetStyle={baseStyle} nativeStyle={baseStyle} />);
    expect(screen.getByText("Couldn't load English subtitle (timeout)")).toBeInTheDocument();
  });

  it('shows "Couldn\'t load English subtitle (not found)" with errorType not-found', () => {
    act(() => {
      useCuesStore.getState().setLoadStatus('target', { state: 'error', languageLabel: 'English', errorType: 'not-found' });
    });
    render(<SubtitleBlock targetStyle={baseStyle} nativeStyle={baseStyle} />);
    expect(screen.getByText("Couldn't load English subtitle (not found)")).toBeInTheDocument();
  });

  it('auto-clears "loaded" target status after 5 seconds', () => {
    jest.useFakeTimers();
    act(() => {
      useCuesStore.getState().setLoadStatus('target', { state: 'loaded', languageLabel: 'English' });
    });
    render(<SubtitleBlock targetStyle={baseStyle} nativeStyle={baseStyle} />);
    expect(screen.getByText('Loaded English')).toBeInTheDocument();

    act(() => { jest.advanceTimersByTime(5000); });
    expect(screen.queryByText('Loaded English')).not.toBeInTheDocument();
    expect(useCuesStore.getState().targetLoadStatus.state).toBe('idle');
  });

  it('auto-clears "error" target status after 10 seconds', () => {
    jest.useFakeTimers();
    act(() => {
      useCuesStore.getState().setLoadStatus('target', { state: 'error', languageLabel: 'English', errorType: 'timeout' });
    });
    render(<SubtitleBlock targetStyle={baseStyle} nativeStyle={baseStyle} />);
    expect(screen.getByText("Couldn't load English subtitle (timeout)")).toBeInTheDocument();

    act(() => { jest.advanceTimersByTime(10000); });
    expect(screen.queryByText("Couldn't load English subtitle (timeout)")).not.toBeInTheDocument();
    expect(useCuesStore.getState().targetLoadStatus.state).toBe('idle');
  });

  it('does NOT auto-clear "none" status (persists until SPA nav/user action)', () => {
    jest.useFakeTimers();
    act(() => {
      useCuesStore.getState().setLoadStatus('target', { state: 'none' });
    });
    render(<SubtitleBlock targetStyle={baseStyle} nativeStyle={baseStyle} />);
    expect(screen.getByText('No subtitles found on this page')).toBeInTheDocument();

    act(() => { jest.advanceTimersByTime(30000); });
    expect(screen.getByText('No subtitles found on this page')).toBeInTheDocument();
  });
});
