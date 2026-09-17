import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CueList } from '@/features/subtitle/ui/CueList';
import { emitWordStatusChanged } from '@/features/dictionary/services/wordStatusEvents';
import type { BilingualCue } from '@/entities/media';

// jsdom does not implement scrollIntoView or layout (offsetTop/scrollHeight) —
// mock scrollIntoView (legacy) and stub layout props for the manual scrollTop
// centering logic.
beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
  // jsdom returns 0 for offsetTop/offsetHeight/scrollHeight/clientHeight.
  // The centering logic reads these to compute targetScroll. Stub them so the
  // effect runs without throwing; the exact values don't matter for this test
  // (we assert scrollTop is set, not a specific pixel value).
  Object.defineProperty(Element.prototype, 'offsetTop', { configurable: true, get() { return 0; } });
  Object.defineProperty(Element.prototype, 'offsetHeight', { configurable: true, get() { return 50; } });
  Object.defineProperty(Element.prototype, 'scrollHeight', { configurable: true, get() { return 500; } });
  Object.defineProperty(Element.prototype, 'clientHeight', { configurable: true, get() { return 200; } });
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
    expect(timestamps[0].textContent).toBe('0:01');
    expect(timestamps[1].textContent).toBe('0:03');
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
      expect(timestamps[0].textContent).toBe('0:06');
      expect(timestamps[1].textContent).toBe('0:08');
    });

    it('onSeek still sends raw cue.start (SEEK_TO handler subtracts offset)', () => {
      const onSeek = jest.fn();
      render(<CueList cues={sampleCues} currentTimeMs={0} offsetMs={-5000} onSeek={onSeek} />);
      const timestamps = screen.getAllByTestId('cue-timestamp');
      fireEvent.click(timestamps[0]);
      expect(onSeek).toHaveBeenCalledWith(1000); // raw cue.start, not shifted
    });
  });

  describe('practice presentation props', () => {
    it('renders default cue markup when no practice props are given', () => {
      render(<CueList cues={sampleCues} currentTimeMs={2000} onSeek={jest.fn()} />);
      expect(screen.getAllByTestId('cue-target-text')).toHaveLength(2);
      expect(screen.queryByTestId('cue-masked-target')).toBeNull();
    });

    it('renders renderCueContent output in place of the default text slot', () => {
      const renderCueContent = jest.fn(
        (_cue: BilingualCue, _index: number, isCurrent: boolean) =>
          isCurrent ? (
            <div data-cell-id="practice-active-cue">exercise</div>
          ) : (
            <div data-cell-id="cue-masked-target" />
          ),
      );
      render(
        <CueList
          cues={sampleCues}
          currentTimeMs={2000}
          onSeek={jest.fn()}
          renderCueContent={renderCueContent}
        />,
      );
      const items = screen.getAllByTestId('cue-item');
      expect(items[0].querySelector('[data-cell-id="practice-active-cue"]')).toBeTruthy();
      expect(items[0].querySelector('[data-cell-id="cue-target-text"]')).toBeNull();
      expect(items[1].querySelector('[data-cell-id="practice-active-cue"]')).toBeNull();
      expect(items[1].querySelector('[data-cell-id="cue-target-text"]')).toBeNull();
      expect(items[1].querySelector('[data-cell-id="cue-masked-target"]')).toBeTruthy();
      expect(screen.queryByText('How are you?')).toBeNull();
      expect(items[1].querySelector('[data-cell-id="cue-timestamp"]')).toBeTruthy();
      expect(renderCueContent).toHaveBeenCalledWith(sampleCues[0], 0, true);
      expect(renderCueContent).toHaveBeenCalledWith(sampleCues[1], 1, false);
    });

    it('falls back to default text when renderCueContent returns undefined', () => {
      render(
        <CueList
          cues={sampleCues}
          currentTimeMs={2000}
          onSeek={jest.fn()}
          renderCueContent={() => undefined}
        />,
      );
      expect(screen.getAllByTestId('cue-target-text')).toHaveLength(2);
    });

    it('hides native text when showNative is false', () => {
      render(<CueList cues={sampleCues} currentTimeMs={2000} onSeek={jest.fn()} showNative={false} />);
      expect(screen.queryByTestId('cue-native-text')).toBeNull();
      expect(screen.getAllByTestId('cue-target-text')).toHaveLength(2);
    });
  });

  describe('tokenize', () => {
    it('renders target text as clickable token spans when tokenize is set', () => {
      render(
        <CueList
          cues={sampleCues}
          currentTimeMs={0}
          onSeek={jest.fn()}
          tokenize={{ langCode: 'en', onTokenClick: jest.fn() }}
        />,
      );

      const target = screen.getAllByTestId('cue-target-text')[0];
      const tokens = target.querySelectorAll('.js-cell-token');
      expect(tokens.length).toBeGreaterThan(0);
      expect(target.textContent).toBe('Hello world');
      // 'Hello' and 'world' are word tokens with term/start/end attributes.
      const hello = target.querySelector('[data-cell-term="hello"]');
      expect(hello).not.toBeNull();
      expect(hello?.getAttribute('data-cell-start')).toBe('0');
      expect(hello?.getAttribute('data-cell-end')).toBe('5');
      // Native text stays plain.
      expect(screen.getByText('Xin chào')).toBeTruthy();
    });

    it('calls onTokenClick with term, element and full cue text', () => {
      const onTokenClick = jest.fn();
      render(
        <CueList
          cues={sampleCues}
          currentTimeMs={0}
          onSeek={jest.fn()}
          tokenize={{ langCode: 'en', onTokenClick }}
        />,
      );

      const target = screen.getAllByTestId('cue-target-text')[0];
      const world = target.querySelector('[data-cell-term="world"]') as HTMLElement;
      fireEvent.click(world);

      expect(onTokenClick).toHaveBeenCalledWith('world', world, 'Hello world');
    });

    it('updates an already-rendered token when its status changes', async () => {
      render(
        <CueList
          cues={sampleCues}
          currentTimeMs={0}
          onSeek={jest.fn()}
          tokenize={{ langCode: 'en', onTokenClick: jest.fn() }}
        />,
      );

      const target = screen.getAllByTestId('cue-target-text')[0];
      await waitFor(() => {
        expect(target.querySelector('[data-cell-term="hello"]')?.className).toContain('js-cell-token--status-unknown');
      });

      act(() => {
        emitWordStatusChanged({ langCode: 'en', term: 'hello', status: 'known' });
      });

      const hello = target.querySelector('[data-cell-term="hello"]') as HTMLElement;
      expect(hello.className).toContain('js-cell-token--status-known');
      expect(hello.className).not.toContain('js-cell-token--status-unknown');
    });

    it('renders plain text when tokenize is null', () => {
      render(
        <CueList cues={sampleCues} currentTimeMs={0} onSeek={jest.fn()} tokenize={null} />,
      );

      const target = screen.getAllByTestId('cue-target-text')[0];
      expect(target.querySelectorAll('.js-cell-token')).toHaveLength(0);
      expect(target.textContent).toBe('Hello world');
    });

    it('tokenizes an already-open list when tokenize turns on via rerender', async () => {
      const onTokenClick = jest.fn();
      const { rerender } = render(
        <CueList cues={sampleCues} currentTimeMs={0} onSeek={jest.fn()} tokenize={null} />,
      );

      const target = screen.getAllByTestId('cue-target-text')[0];
      expect(target.querySelectorAll('.js-cell-token')).toHaveLength(0);

      rerender(
        <CueList
          cues={sampleCues}
          currentTimeMs={0}
          onSeek={jest.fn()}
          tokenize={{ langCode: 'en', onTokenClick }}
        />,
      );

      await waitFor(() => {
        expect(target.querySelector('[data-cell-term="hello"]')).not.toBeNull();
      });
      const hello = target.querySelector('[data-cell-term="hello"]') as HTMLElement;
      expect(hello.className).toContain('js-cell-token--word');
      expect(hello.className).toContain('js-cell-token--status-unknown');
      expect(hello.querySelector('.js-cell-token-word')?.textContent).toBe('Hello');
      expect(hello.querySelector('.js-cell-token-status')).not.toBeNull();
    });

    it('re-tokenizes after tokenize toggles off then back on', async () => {
      const { rerender } = render(
        <CueList
          cues={sampleCues}
          currentTimeMs={0}
          onSeek={jest.fn()}
          tokenize={{ langCode: 'en', onTokenClick: jest.fn() }}
        />,
      );

      const target = screen.getAllByTestId('cue-target-text')[0];
      await waitFor(() => {
        expect(target.querySelector('[data-cell-term="hello"]')).not.toBeNull();
      });

      rerender(
        <CueList cues={sampleCues} currentTimeMs={0} onSeek={jest.fn()} tokenize={null} />,
      );
      expect(target.querySelectorAll('.js-cell-token')).toHaveLength(0);

      rerender(
        <CueList
          cues={sampleCues}
          currentTimeMs={0}
          onSeek={jest.fn()}
          tokenize={{ langCode: 'en', onTokenClick: jest.fn() }}
        />,
      );
      await waitFor(() => {
        expect(target.querySelector('[data-cell-term="hello"]')).not.toBeNull();
      });
    });
  });

  // Regression: auto-scroll must use manual scrollTop on the list container,
  // NOT scrollIntoView. scrollIntoView({ block: 'center' }) scrolls ALL
  // scrollable ancestors — in split view (normal mode), the panel is inserted
  // into the host page DOM (YouTube watch page is scrollable). When the cue is
  // near the end of the list, the list can't center it → scrollIntoView scrolls
  // the YouTube document to center the panel → page jumps ("giật màn hình").
  // Manual scrollTop only scrolls the list, clamped to [0, maxScrollTop].
  describe('scroll behavior', () => {
    it('does NOT call scrollIntoView when cue changes', () => {
      const cues: BilingualCue[] = [
        { index: 1, start: 1000, end: 3000, targetText: 'A', nativeText: '' },
        { index: 2, start: 3000, end: 5000, targetText: 'B', nativeText: '' },
      ];
      const { rerender } = render(<CueList cues={cues} currentTimeMs={1500} onSeek={jest.fn()} />);
      (Element.prototype.scrollIntoView as jest.Mock).mockClear();

      // Move to next cue → should NOT call scrollIntoView (uses manual scrollTop)
      rerender(<CueList cues={cues} currentTimeMs={3500} onSeek={jest.fn()} />);

      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    });
  });
});
