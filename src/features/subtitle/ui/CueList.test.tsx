import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CueList } from './CueList';
import type { BilingualCue } from '@/entities/media';

const CUES: BilingualCue[] = [
  { index: 1, start: 0, end: 1000, targetText: 'first line', nativeText: '' },
  { index: 2, start: 1000, end: 2000, targetText: 'second line', nativeText: '' },
  { index: 3, start: 2000, end: 3000, targetText: 'third line', nativeText: '' },
];

function renderList(props: Partial<Parameters<typeof CueList>[0]> = {}) {
  return render(
    <CueList cues={CUES} currentTimeMs={500} onSeek={jest.fn()} {...props} />,
  );
}

function scroller(): HTMLElement {
  return screen.getByTestId('cue-list-scroll');
}

function syncPill(): HTMLElement | null {
  return screen.queryByTestId('cue-list-sync');
}

function userScrollTo(top: number): void {
  const list = scroller();
  list.scrollTop = top;
  fireEvent.scroll(list);
}

beforeEach(() => {
  global.ResizeObserver = class ResizeObserverMock {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
});

describe('CueList scroll desync (REQ-6)', () => {
  it('shows the sync pill when the user scrolls away and hides it on resync', async () => {
    renderList();
    await waitFor(() => expect(scroller()).toBeInTheDocument());
    expect(syncPill()).toBeNull();

    userScrollTo(100);
    await waitFor(() => expect(syncPill()).toBeInTheDocument());

    fireEvent.click(syncPill()!);
    await waitFor(() => expect(syncPill()).toBeNull());
  });

  it('does not desync within the 2px tolerance', async () => {
    renderList();
    await waitFor(() => expect(scroller()).toBeInTheDocument());

    userScrollTo(2);
    await new Promise((r) => setTimeout(r, 20));
    expect(syncPill()).toBeNull();
  });

  it('resumes follow when a cue timestamp is clicked while desynced', async () => {
    const onSeek = jest.fn();
    renderList({ onSeek });
    await waitFor(() => expect(scroller()).toBeInTheDocument());

    userScrollTo(100);
    await waitFor(() => expect(syncPill()).toBeInTheDocument());

    fireEvent.click(screen.getAllByTestId('cue-timestamp')[1]);
    expect(onSeek).toHaveBeenCalledWith(1000);
    await waitFor(() => expect(syncPill()).toBeNull());
  });

  it('resets to following when filterEpoch changes', async () => {
    const { rerender } = renderList({ filterEpoch: 'a' });
    await waitFor(() => expect(scroller()).toBeInTheDocument());

    userScrollTo(100);
    await waitFor(() => expect(syncPill()).toBeInTheDocument());

    rerender(
      <CueList cues={CUES} currentTimeMs={500} onSeek={jest.fn()} filterEpoch="b" />,
    );
    await waitFor(() => expect(syncPill()).toBeNull());
  });

  it('keeps the current-cue highlight advancing while desynced', async () => {
    const { rerender } = renderList();
    await waitFor(() => expect(scroller()).toBeInTheDocument());

    userScrollTo(100);
    await waitFor(() => expect(syncPill()).toBeInTheDocument());

    rerender(<CueList cues={CUES} currentTimeMs={1500} onSeek={jest.fn()} />);
    await waitFor(() =>
      expect(
        document.querySelector('[data-cell-id="cue-item"][data-current="true"]'),
      ).toHaveAttribute('data-cue-index', '2'),
    );
    expect(syncPill()).toBeInTheDocument();
  });
});
