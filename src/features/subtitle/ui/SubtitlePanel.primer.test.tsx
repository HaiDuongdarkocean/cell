import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SubtitlePanel } from './SubtitlePanel';
import type { BilingualCue } from '@/entities/media';
import type { WordStatus } from '@/entities/dictionary';
import { emitWordStatusChanged } from '@/features/dictionary';
import {
  DEFAULT_BAND_THRESHOLDS,
  resolveCueListTokenMetadata,
  type CueListTokenMap,
  type ResolveMeta,
  type Token,
} from '@/features/tokenize';
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

const wordsTab = () => screen.queryByTestId('subtitle-panel-tab-words');

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

describe('SubtitlePanel Words tab', () => {
  it('shows the Words trigger with the learnable-term count once metadata resolves', async () => {
    renderPanel();
    await waitFor(() => expect(wordsTab()).toBeInTheDocument());
    expect(wordsTab()?.textContent).toContain('3');
  });

  it('renders ranked rows inside the Words tab', async () => {
    const onTokenClick = jest.fn();
    renderPanel({ tokenize: { langCode: 'en', onTokenClick } });
    await waitFor(() => expect(wordsTab()).toBeInTheDocument());

    fireEvent.click(wordsTab()!);
    await waitFor(() => expect(screen.getByTestId('primer-list')).toBeInTheDocument());

    const terms = screen
      .getAllByTestId('primer-row')
      .map((el) => el.querySelector('[data-cell-term]')?.getAttribute('data-cell-term'));
    expect(terms).toEqual(['rare', 'abound', 'words']);

    fireEvent.click(screen.getAllByTestId('primer-row')[0]);
    expect(onTokenClick).toHaveBeenCalledWith('rare', expect.any(HTMLElement), 'rare word here');
  });

  it('seeks to the first occurrence cue without firing lookup', async () => {
    const onSeek = jest.fn();
    const onTokenClick = jest.fn();
    renderPanel({ onSeek, tokenize: { langCode: 'en', onTokenClick } });
    await waitFor(() => expect(wordsTab()).toBeInTheDocument());
    fireEvent.click(wordsTab()!);
    await waitFor(() => expect(screen.getByTestId('primer-list')).toBeInTheDocument());

    fireEvent.click(screen.getAllByTestId('primer-seek')[0]);
    expect(onSeek).toHaveBeenCalledWith(1000);
    expect(onTokenClick).not.toHaveBeenCalled();
  });

  it('removes a row live when its word is marked known while the Words tab is open', async () => {
    renderPanel();
    await waitFor(() => expect(wordsTab()).toBeInTheDocument());
    fireEvent.click(wordsTab()!);
    await waitFor(() => expect(screen.getAllByTestId('primer-row')).toHaveLength(3));

    act(() => {
      emitWordStatusChanged({ langCode: 'en', term: 'rare', status: 'known' });
    });

    await waitFor(() => expect(screen.getAllByTestId('primer-row')).toHaveLength(2));
    const remaining = screen
      .getAllByTestId('primer-row')
      .map((el) => el.querySelector('[data-cell-term]')?.getAttribute('data-cell-term'));
    expect(remaining).toEqual(['abound', 'words']);
  });

  it('ignores status events for other languages', async () => {
    renderPanel();
    await waitFor(() => expect(wordsTab()).toBeInTheDocument());
    fireEvent.click(wordsTab()!);
    await waitFor(() => expect(screen.getAllByTestId('primer-row')).toHaveLength(3));

    act(() => {
      emitWordStatusChanged({ langCode: 'vi', term: 'rare', status: 'known' });
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.getAllByTestId('primer-row')).toHaveLength(3);
  });

  it('does not render the tab when tokenize is off', async () => {
    renderPanel({ tokenize: null });
    await new Promise((r) => setTimeout(r, 10));
    expect(wordsTab()).toBeNull();
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it('renders no tab strip when only the Subtitles tab is renderable', async () => {
    renderPanel({ tokenize: null });
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByTestId('subtitle-panel-tab-subtitles')).toBeNull();
    expect(screen.getAllByTestId('cue-item')).toHaveLength(3);
  });

  it('does not render the tab when blurred, in practice mode, or zh', async () => {
    const blurred = renderPanel({ panelBlurred: true });
    await waitFor(() => expect(resolveMock).toHaveBeenCalled());
    expect(wordsTab()).toBeNull();
    blurred.unmount();

    const practice = renderPanel({ practiceMode: 'cloze' });
    await new Promise((r) => setTimeout(r, 10));
    expect(wordsTab()).toBeNull();
    practice.unmount();

    renderPanel({ tokenize: { langCode: 'zh', onTokenClick: jest.fn() } });
    await new Promise((r) => setTimeout(r, 10));
    expect(wordsTab()).toBeNull();
  });

  it('resets to the Subtitles tab when the cue set changes while Words is active', async () => {
    const { rerender } = renderPanel();
    await waitFor(() => expect(wordsTab()).toBeInTheDocument());
    fireEvent.click(wordsTab()!);
    await waitFor(() => expect(screen.getByTestId('primer-list')).toBeInTheDocument());

    const nextCues: BilingualCue[] = [
      { index: 1, start: 0, end: 1000, targetText: 'totally new set', nativeText: '' },
    ];
    let resolvePending:
      | ((value: { map: CueListTokenMap; meta: ResolveMeta }) => void)
      | undefined;
    resolveMock.mockImplementation(
      () => new Promise((r) => { resolvePending = r; }),
    );
    rerender(
      <SubtitlePanel
        cues={nextCues}
        currentTimeMs={0}
        onSeek={jest.fn()}
        tokenize={{ langCode: 'en', onTokenClick: jest.fn() }}
      />,
    );

    await waitFor(() => expect(wordsTab()).toBeNull());
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getAllByTestId('cue-item')).toHaveLength(1);
    expect(screen.queryByTestId('primer-list')).toBeNull();

    const pendingMap = resolveMock.mock.calls.at(-1)?.[0];
    act(() => {
      resolvePending?.({ map: withStatuses(pendingMap!), meta: resolvedMeta() });
    });
    await waitFor(() => expect(wordsTab()).toBeInTheDocument());
    await waitFor(() =>
      expect(
        screen.getByTestId('subtitle-panel-tab-subtitles').getAttribute('aria-selected'),
      ).toBe('true'),
    );
  });

  it('auto-switches from Playlist to Subtitles when the first cues arrive', async () => {
    const { rerender } = render(
      <SubtitlePanel
        cues={[]}
        currentTimeMs={0}
        onSeek={jest.fn()}
        tokenize={{ langCode: 'en', onTokenClick: jest.fn() }}
        playlistContent={<div data-testid="playlist">pl</div>}
      />,
    );
    expect(
      screen.getByTestId('subtitle-panel-tab-playlist').getAttribute('aria-selected'),
    ).toBe('true');

    rerender(
      <SubtitlePanel
        cues={CUES}
        currentTimeMs={0}
        onSeek={jest.fn()}
        tokenize={{ langCode: 'en', onTokenClick: jest.fn() }}
        playlistContent={<div data-testid="playlist">pl</div>}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByTestId('subtitle-panel-tab-subtitles').getAttribute('aria-selected'),
      ).toBe('true'),
    );
    await waitFor(() => expect(wordsTab()).toBeInTheDocument());
  });

  it('keeps CueList mounted across the primer-available edge', async () => {
    renderPanel();
    await waitFor(() => expect(screen.getAllByTestId('cue-item')).toHaveLength(3));
    await waitFor(() => expect(wordsTab()).toBeInTheDocument());
    expect(screen.getAllByTestId('cue-item')).toHaveLength(3);
  });

  it('shows the all-known empty state when every word is known', async () => {
    const allKnown: Record<string, WordStatus> = Object.fromEntries(
      Object.keys(STATUSES).map((k) => [k, 'known']),
    );
    resolveMock.mockImplementation((map) =>
      Promise.resolve({
        map: new Map(
          [...map.entries()].map(([i, tokens]) => [
            i,
            tokens.map((t) => (t.isSeparator ? t : { ...t, status: allKnown[t.term] ?? 'known' })),
          ]),
        ),
        meta: resolvedMeta(),
      }),
    );
    renderPanel();
    await waitFor(() => expect(wordsTab()).toBeInTheDocument());
    expect(wordsTab()?.textContent).toContain('0');

    fireEvent.click(wordsTab()!);
    await waitFor(() => expect(screen.getByText('All words known')).toBeInTheDocument());
  });
});
