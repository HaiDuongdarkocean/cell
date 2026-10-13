import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SubtitlePanel } from './SubtitlePanel';
import type { BilingualCue } from '@/entities/media';
import type { WordStatus } from '@/entities/dictionary';
import {
  DEFAULT_BAND_THRESHOLDS,
  resolveCueListTokenMetadata,
  type CueListTokenMap,
  type ResolveMeta,
  type Token,
} from '@/features/tokenize';
import { useStudyModeStore } from '@/features/studyModes';
import { getStorage, setStorage } from '@/shared/lib/chrome-apis';

jest.mock('@/features/tokenize/logic/cueListTokens', () => {
  const actual = jest.requireActual<typeof import('@/features/tokenize')>(
    '@/features/tokenize/logic/cueListTokens',
  );
  return { ...actual, resolveCueListTokenMetadata: jest.fn() };
});

jest.mock('@/shared/lib/chrome-apis', () => {
  const actual =
    jest.requireActual<typeof import('@/shared/lib/chrome-apis')>(
      '@/shared/lib/chrome-apis',
    );
  return { ...actual, getStorage: jest.fn(), setStorage: jest.fn() };
});

const resolveMock = resolveCueListTokenMetadata as jest.MockedFunction<
  typeof resolveCueListTokenMetadata
>;
const getStorageMock = getStorage as jest.MockedFunction<typeof getStorage>;
const setStorageMock = setStorage as jest.MockedFunction<typeof setStorage>;

const STATUSES: Record<string, WordStatus> = {
  easy: 'known',
  one: 'known',
  rare: 'unknown',
  word: 'known',
  here: 'known',
  words: 'unknown',
  abound: 'unknown',
};

const CUES: BilingualCue[] = [
  { index: 1, start: 0, end: 1000, targetText: 'easy one', nativeText: '' },
  { index: 2, start: 1000, end: 2000, targetText: 'rare word here', nativeText: '' },
  { index: 3, start: 2000, end: 3000, targetText: 'rare words abound', nativeText: '' },
];

function withStatuses(map: CueListTokenMap): CueListTokenMap {
  const next = new Map<number, readonly Token[]>();
  for (const [cueIndex, tokens] of map) {
    next.set(
      cueIndex,
      tokens.map((token) =>
        token.isSeparator
          ? token
          : { ...token, status: STATUSES[token.term] ?? 'unknown' },
      ),
    );
  }
  return next;
}

function resolvedMeta(overrides: Partial<ResolveMeta> = {}): ResolveMeta {
  return {
    resolved: true,
    failed: false,
    freqUnfiltered: true,
    rankByTerm: new Map(),
    thresholds: DEFAULT_BAND_THRESHOLDS,
    ...overrides,
  };
}

function renderPanel(props: Partial<Parameters<typeof SubtitlePanel>[0]> = {}) {
  return render(
    <SubtitlePanel
      cues={CUES}
      currentTimeMs={0}
      onSeek={jest.fn()}
      tokenize={{ langCode: 'en', onTokenClick: jest.fn() }}
      {...props}
    />,
  );
}

beforeEach(() => {
  global.ResizeObserver = class ResizeObserverMock {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
  resolveMock.mockReset().mockImplementation((map) =>
    Promise.resolve({ map: withStatuses(map), meta: resolvedMeta() }),
  );
  getStorageMock.mockReset().mockResolvedValue({});
  setStorageMock.mockReset().mockResolvedValue(undefined);
});

describe('SubtitlePanel cue filter', () => {
  it('shows the FAB with the i+1 badge count once metadata resolves', async () => {
    renderPanel();

    await waitFor(() =>
      expect(screen.getByTestId('cue-filter-badge').textContent).toBe('1'),
    );
  });

  it('shows a pending FAB while resolution is still pending', () => {
    resolveMock.mockReturnValue(new Promise(() => undefined));
    renderPanel();

    expect(screen.getByTestId('cue-filter-fab')).toBeInTheDocument();
    expect(screen.getByTestId('cue-filter-badge').textContent).toBe('…');
  });

  it('does not render the FAB when tokenize is off', async () => {
    renderPanel({ tokenize: null });
    await new Promise((r) => setTimeout(r, 10));

    expect(resolveMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('cue-filter-fab')).toBeNull();
  });

  it('does not render the FAB when the panel is blurred', async () => {
    renderPanel({ panelBlurred: true });
    await waitFor(() => expect(resolveMock).toHaveBeenCalled());

    expect(screen.queryByTestId('cue-filter-fab')).toBeNull();
  });

  it('does not render the FAB in practice mode and does not filter the practice list', async () => {
    renderPanel({ practiceMode: 'cloze' });
    await new Promise((r) => setTimeout(r, 10));

    expect(screen.queryByTestId('cue-filter-fab')).toBeNull();
    expect(screen.queryByTestId('cue-filter-strip')).toBeNull();
  });

  it('filters the cue list and shows the indicator strip after picking a mode', async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('cue-filter-fab')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('cue-filter-fab'));
    const hasUnknown = screen
      .getAllByRole('menuitemradio')
      .find((el) => el.textContent?.includes('Has new words'));
    fireEvent.click(hasUnknown!);

    await waitFor(() => {
      expect(screen.getAllByTestId('cue-item')).toHaveLength(2);
    });
    const strip = screen.getByTestId('cue-filter-strip');
    expect(strip.textContent).toContain('2/3');
    expect(setStorageMock).toHaveBeenCalledWith({ cueFilterMode: 'hasUnknown' });
  });

  it('reset from the strip restores all cues and hides the strip', async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('cue-filter-fab')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('cue-filter-fab'));
    fireEvent.click(
      screen.getAllByRole('menuitemradio').find((el) => el.textContent?.includes('One new word'))!,
    );
    await waitFor(() => expect(screen.getByTestId('cue-filter-strip')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('cue-filter-reset'));

    await waitFor(() => expect(screen.getAllByTestId('cue-item')).toHaveLength(3));
    expect(screen.queryByTestId('cue-filter-strip')).toBeNull();
  });

  it('shows the empty-state overlay while keeping CueList mounted', async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('cue-filter-fab')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('cue-filter-fab'));
    fireEvent.click(
      screen
        .getAllByRole('menuitemradio')
        .find((el) => el.textContent?.includes('learning'))!,
    );

    await waitFor(() => expect(screen.getByTestId('cue-filter-empty')).toBeInTheDocument());
    expect(screen.getByTestId('cue-list-scroll')).toBeInTheDocument();
    expect(screen.queryAllByTestId('cue-item')).toHaveLength(0);

    fireEvent.click(screen.getByTestId('cue-filter-empty-reset'));
    await waitFor(() => expect(screen.getAllByTestId('cue-item')).toHaveLength(3));
  });

  it('restores a persisted mode on mount', async () => {
    getStorageMock.mockResolvedValue({ cueFilterMode: 'i1' });
    renderPanel();

    await waitFor(() => expect(screen.getByTestId('cue-filter-strip')).toBeInTheDocument());
    expect(screen.getAllByTestId('cue-item')).toHaveLength(1);
  });

  it('falls back to all when a removed mode like dense is stored', async () => {
    getStorageMock.mockResolvedValue({ cueFilterMode: 'dense' });
    renderPanel();

    await waitFor(() => expect(screen.getByTestId('cue-filter-fab')).toBeInTheDocument());
    expect(screen.queryByTestId('cue-filter-strip')).toBeNull();
    expect(screen.getAllByTestId('cue-item')).toHaveLength(3);
  });

  it('falls back to all when the stored mode is invalid', async () => {
    getStorageMock.mockResolvedValue({ cueFilterMode: 'bogus' });
    renderPanel();

    await waitFor(() => expect(screen.getByTestId('cue-filter-fab')).toBeInTheDocument());
    expect(screen.queryByTestId('cue-filter-strip')).toBeNull();
    expect(screen.getAllByTestId('cue-item')).toHaveLength(3);
  });

  it('keeps the FAB in a pending state when the status side fails', async () => {
    resolveMock.mockImplementation((map) =>
      Promise.resolve({ map, meta: resolvedMeta({ failed: true }) }),
    );
    const { unmount } = renderPanel();
    await waitFor(() => expect(resolveMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 10));

    expect(screen.getByTestId('cue-filter-fab')).toBeInTheDocument();
    expect(screen.getByTestId('cue-filter-badge').textContent).toBe('…');
    unmount();
  });

  it('shows a pending FAB while a changed cue set re-resolves', async () => {
    const { rerender } = renderPanel();
    await waitFor(() => expect(screen.getByTestId('cue-filter-fab')).toBeInTheDocument());

    const nextCues: BilingualCue[] = [
      { index: 1, start: 0, end: 1000, targetText: 'totally new set', nativeText: '' },
      { index: 2, start: 1000, end: 2000, targetText: 'of cues entirely', nativeText: '' },
    ];
    resolveMock.mockReturnValue(new Promise(() => undefined));
    rerender(
      <SubtitlePanel
        cues={nextCues}
        currentTimeMs={0}
        onSeek={jest.fn()}
        tokenize={{ langCode: 'en', onTokenClick: jest.fn() }}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('cue-filter-badge').textContent).toBe('…'),
    );
  });

  it('counts every new word regardless of the unknown level — the badge matches the pills you see', async () => {
    resolveMock.mockImplementation((map) =>
      Promise.resolve({
        map: withStatuses(map),
        meta: resolvedMeta({
          freqUnfiltered: false,
          rankByTerm: new Map([['abound', 50_000]]),
          thresholds: { core: 2, common: 4, general: 10, advanced: 100_000 },
        }),
      }),
    );
    const original = useStudyModeStore.getState().advanced;
    useStudyModeStore.setState({
      advanced: { ...original, unknownLevel: 'core' },
    });
    renderPanel();

    await waitFor(() =>
      expect(screen.getByTestId('cue-filter-badge').textContent).toBe('1'),
    );

    useStudyModeStore.setState({ advanced: original });
  });

  it('suppresses the FAB for zh-family languages', async () => {
    renderPanel({ tokenize: { langCode: 'zh', onTokenClick: jest.fn() } });
    await new Promise((r) => setTimeout(r, 10));

    expect(screen.queryByTestId('cue-filter-fab')).toBeNull();
  });
});


