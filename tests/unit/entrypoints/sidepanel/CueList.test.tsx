import { render, screen, fireEvent } from '@testing-library/react';
import { CueList } from '@/entrypoints/sidepanel/components/CueList';
import type { BilingualCue } from '@/types/media';

// jsdom does not implement scrollIntoView — mock it
beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

describe('CueList', () => {
  const sampleCues: BilingualCue[] = [
    { index: 1, start: 1000, end: 3000, targetText: 'Hello world', nativeText: 'Xin chào' },
    { index: 2, start: 3500, end: 5000, targetText: 'How are you?', nativeText: 'Bạn khỏe không?' },
  ];

  it('renders all cues with target + native text', () => {
    render(<CueList cues={sampleCues} currentTimeMs={0} onSeek={jest.fn()} />);

    expect(screen.getByText('Hello world')).toBeTruthy();
    expect(screen.getByText('Xin chào')).toBeTruthy();
    expect(screen.getByText('How are you?')).toBeTruthy();
    expect(screen.getByText('Bạn khỏe không?')).toBeTruthy();
  });

  it('renders timestamps', () => {
    render(<CueList cues={sampleCues} currentTimeMs={0} onSeek={jest.fn()} />);

    const timestamps = screen.getAllByTestId('cue-timestamp');
    expect(timestamps).toHaveLength(2);
    expect(timestamps[0].textContent).toBe('00:00:01');
    expect(timestamps[1].textContent).toBe('00:00:03.500');
  });

  it('calls onSeek with cue start time when cue-timestamp clicked', () => {
    const onSeek = jest.fn();
    render(<CueList cues={sampleCues} currentTimeMs={0} onSeek={onSeek} />);

    const timestamps = screen.getAllByTestId('cue-timestamp');
    fireEvent.click(timestamps[0]);
    expect(onSeek).toHaveBeenCalledWith(1000);

    fireEvent.click(timestamps[1]);
    expect(onSeek).toHaveBeenCalledWith(3500);
  });

  it('does NOT call onSeek when cue text (non-timestamp) clicked', () => {
    const onSeek = jest.fn();
    render(<CueList cues={sampleCues} currentTimeMs={0} onSeek={onSeek} />);

    // Click on cue target text — should NOT seek
    fireEvent.click(screen.getByText('Hello world'));
    expect(onSeek).not.toHaveBeenCalled();

    // Click on cue native text — should NOT seek
    fireEvent.click(screen.getByText('Xin chào'));
    expect(onSeek).not.toHaveBeenCalled();
  });

  it('highlights current cue', () => {
    render(<CueList cues={sampleCues} currentTimeMs={2000} onSeek={jest.fn()} />);

    const items = screen.getAllByTestId('cue-item');
    // 2000ms is within cue 1 (1000-3000) → first item highlighted
    expect(items[0].getAttribute('data-current')).toBe('true');
    expect(items[1].getAttribute('data-current')).toBe('false');
  });

  it('highlights second cue when in range', () => {
    render(<CueList cues={sampleCues} currentTimeMs={4000} onSeek={jest.fn()} />);

    const items = screen.getAllByTestId('cue-item');
    // 4000ms is within cue 2 (3500-5000) → second item highlighted
    expect(items[1].getAttribute('data-current')).toBe('true');
    expect(items[0].getAttribute('data-current')).toBe('false');
  });

  it('does not highlight any cue when between cues', () => {
    render(<CueList cues={sampleCues} currentTimeMs={3200} onSeek={jest.fn()} />);

    const items = screen.getAllByTestId('cue-item');
    expect(items[0].getAttribute('data-current')).toBe('false');
    expect(items[1].getAttribute('data-current')).toBe('false');
  });

  it('renders cue with empty nativeText without native div', () => {
    const cues: BilingualCue[] = [
      { index: 1, start: 1000, end: 3000, targetText: 'No native', nativeText: '' },
    ];
    render(<CueList cues={cues} currentTimeMs={0} onSeek={jest.fn()} />);

    expect(screen.getByText('No native')).toBeTruthy();
    expect(screen.queryByTestId('cue-native-text')).toBeNull();
  });

  // Regression: boundary overlap. When cue[i].end === cue[i+1].start (adjacent
  // cues, common in real subtitles), a closed interval [start,end] would match
  // BOTH cues and findIndex returns the earlier one → replay-cue "jumps back
  // to previous cue" bug. Half-open [start,end) must match only the NEXT cue.
  describe('boundary overlap (half-open [start, end))', () => {
    const adjacentCues: BilingualCue[] = [
      { index: 1, start: 1000, end: 3000, targetText: 'First', nativeText: '' },
      { index: 2, start: 3000, end: 5000, targetText: 'Second', nativeText: '' },
    ];

    it('at t = cue[i].end = cue[i+1].start, highlights the NEXT cue (not previous)', () => {
      render(<CueList cues={adjacentCues} currentTimeMs={3000} onSeek={jest.fn()} />);

      const items = screen.getAllByTestId('cue-item');
      // t=3000 is cue1.end AND cue2.start. Half-open [start,end) → only cue 2.
      expect(items[0].getAttribute('data-current')).toBe('false');
      expect(items[1].getAttribute('data-current')).toBe('true');
    });

    it('at t = cue[i].end - 1, highlights the current cue', () => {
      render(<CueList cues={adjacentCues} currentTimeMs={2999} onSeek={jest.fn()} />);

      const items = screen.getAllByTestId('cue-item');
      expect(items[0].getAttribute('data-current')).toBe('true');
      expect(items[1].getAttribute('data-current')).toBe('false');
    });
  });

  // ADR-019 sync: CueList must highlight the cue at effective time
  // (currentTimeMs + offsetMs), matching the overlay. Without offset, raw
  // time would highlight the wrong cue (the cue at raw video time, not the
  // cue the overlay displays).
  describe('offset sync (ADR-019)', () => {
    it('offsetMs shifts highlight to effective-time cue', () => {
      // sampleCues: [1000-3000 'Hello', 3500-5000 'How are you?']
      // Raw time 2000ms → cue 0 ('Hello'). Offset +2000ms → effective 4000ms → cue 1.
      render(<CueList cues={sampleCues} currentTimeMs={2000} offsetMs={2000} onSeek={jest.fn()} />);
      const items = screen.getAllByTestId('cue-item');
      expect(items[0].getAttribute('data-current')).toBe('false');
      expect(items[1].getAttribute('data-current')).toBe('true');
    });

    it('negative offset shifts highlight backward', () => {
      // Raw time 4000ms → cue 1. Offset -2000ms → effective 2000ms → cue 0.
      render(<CueList cues={sampleCues} currentTimeMs={4000} offsetMs={-2000} onSeek={jest.fn()} />);
      const items = screen.getAllByTestId('cue-item');
      expect(items[0].getAttribute('data-current')).toBe('true');
      expect(items[1].getAttribute('data-current')).toBe('false');
    });

    it('default offsetMs=0 is backward compatible (raw time highlight)', () => {
      render(<CueList cues={sampleCues} currentTimeMs={2000} onSeek={jest.fn()} />);
      const items = screen.getAllByTestId('cue-item');
      expect(items[0].getAttribute('data-current')).toBe('true');
    });

    it('timestamp shifts by -offsetMs (displays video time, not raw cue time)', () => {
      // sampleCues: [1000-3000 'Hello', 3500-5000 'How are you?']
      // Offset -5000ms → timestamp = cue.start - (-5000) = cue.start + 5000.
      // 'Hello' 1000 → 6000 (00:00:06), 'How are you?' 3500 → 8500 (00:00:08.500).
      render(<CueList cues={sampleCues} currentTimeMs={0} offsetMs={-5000} onSeek={jest.fn()} />);
      const timestamps = screen.getAllByTestId('cue-timestamp');
      expect(timestamps[0].textContent).toBe('00:00:06');
      expect(timestamps[1].textContent).toBe('00:00:08.500');
    });

    it('onSeek still sends raw cue.start (SEEK_TO handler subtracts offset)', () => {
      const onSeek = jest.fn();
      render(<CueList cues={sampleCues} currentTimeMs={0} offsetMs={-5000} onSeek={onSeek} />);
      const timestamps = screen.getAllByTestId('cue-timestamp');
      fireEvent.click(timestamps[0]);
      expect(onSeek).toHaveBeenCalledWith(1000); // raw cue.start, not shifted
    });
  });

  // Regression: scrollIntoView must use behavior 'auto' (instant), not 'smooth'.
  // Smooth scroll across a long cue list (full movie) causes motion sickness.
  describe('scroll behavior', () => {
    it('uses instant scroll (behavior: auto) when cue changes', () => {
      const cues: BilingualCue[] = [
        { index: 1, start: 1000, end: 3000, targetText: 'A', nativeText: '' },
        { index: 2, start: 3000, end: 5000, targetText: 'B', nativeText: '' },
      ];
      const { rerender } = render(<CueList cues={cues} currentTimeMs={1500} onSeek={jest.fn()} />);
      (Element.prototype.scrollIntoView as jest.Mock).mockClear();

      // Move to next cue → should trigger instant scroll
      rerender(<CueList cues={cues} currentTimeMs={3500} onSeek={jest.fn()} />);

      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith(
        expect.objectContaining({ behavior: 'auto', block: 'center' }),
      );
    });
  });
});
