import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { emitWordStatusChanged } from '@/features/dictionary';
import { IPLUS1_OFF_CLASS } from '@/features/tokenize';
import type { WordStatus } from '@/entities/dictionary';

const getWordTranslations = jest.fn() as jest.MockedFunction<
  (sl: string, tl: string, terms: readonly string[]) => Promise<Map<string, string> | null>
>;

jest.mock('@/features/translate', () => ({
  getWordTranslations: (sl: string, tl: string, terms: readonly string[]) =>
    getWordTranslations(sl, tl, terms),
}));

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
        document.querySelector('[data-tihoka-id="cue-item"][data-current="true"]'),
      ).toHaveAttribute('data-cue-index', '2'),
    );
    expect(syncPill()).toBeInTheDocument();
  });
});

describe('CueList bulk selection', () => {
  function renderWithSelection() {
    const terms = new Set<string>();
    const listeners = new Set<(t: ReadonlySet<string>) => void>();
    const tokenize = {
      langCode: 'en',
      onTokenClick: jest.fn(),
      onTokenCtrlClick: jest.fn((term: string) => {
        if (terms.has(term)) terms.delete(term);
        else terms.add(term);
        const next = new Set(terms);
        for (const listener of listeners) listener(next);
      }),
      selection: {
        getTerms: () => terms,
        subscribe: (cb: (t: ReadonlySet<string>) => void) => {
          listeners.add(cb);
          return () => listeners.delete(cb);
        },
      },
    };
    renderList({ tokenize });
    return tokenize;
  }

  function firstToken(): HTMLElement | null {
    return document.querySelector<HTMLElement>('.js-Tihoka-token[data-tihoka-term="first"]');
  }

  async function waitForFirstToken(): Promise<HTMLElement> {
    let token: HTMLElement | null = null;
    await waitFor(() => {
      token = firstToken();
      expect(token).not.toBeNull();
    });
    return token!;
  }

  it('ctrl+click toggles a term instead of opening the dictionary', async () => {
    const tokenize = renderWithSelection();
    const token = await waitForFirstToken();

    fireEvent.click(token, { ctrlKey: true });

    expect(tokenize.onTokenCtrlClick).toHaveBeenCalledWith('first');
    expect(tokenize.onTokenClick).not.toHaveBeenCalled();
    await waitFor(() => expect(token.className).toContain('js-Tihoka-token--selected'));
  });

  it('plain click still opens the dictionary', async () => {
    const tokenize = renderWithSelection();
    const token = await waitForFirstToken();

    fireEvent.click(token);

    expect(tokenize.onTokenClick).toHaveBeenCalledWith(
      'first',
      token,
      'first line',
      expect.anything(),
      0,
    );
    expect(tokenize.onTokenCtrlClick).not.toHaveBeenCalled();
  });

  it('modifier click falls back to onTokenClick when no selection handler exists', async () => {
    const onTokenClick = jest.fn();
    renderList({ tokenize: { langCode: 'en', onTokenClick } });
    const token = await waitForFirstToken();

    fireEvent.click(token, { ctrlKey: true });

    expect(onTokenClick).toHaveBeenCalled();
  });
});

describe('CueList timestamp', () => {
  it('renders the start–end range on both desktop and mobile', async () => {
    renderList();
    await waitFor(() => expect(scroller()).toBeInTheDocument());
    expect(screen.getAllByTestId('cue-timestamp')[0].textContent).toBe('0:00 – 0:01');
  });
});

describe('CueList word glosses', () => {
  beforeEach(() => {
    getWordTranslations.mockReset().mockResolvedValue(
      new Map([
        ['first', 'đầu tiên'],
        ['line', 'dòng'],
        ['second', 'thứ hai'],
        ['third', 'thứ ba'],
      ]),
    );
  });

  it('renders data-gloss under tokens and drops the gloss-off lane when glossDisplay is always', async () => {
    renderList({
      tokenize: {
        langCode: 'en',
        onTokenClick: jest.fn(),
        glossDisplay: 'always',
        glossTargetLanguage: 'vi',
      },
    });

    await waitFor(() => {
      expect(
        document.querySelector<HTMLElement>('.js-Tihoka-token[data-tihoka-term="first"]'),
      ).toHaveAttribute('data-gloss', 'đầu tiên');
    });
    expect(document.querySelector('.js-Tihoka-token--gloss-off')).toBeNull();
  });

  it('keeps the gloss lane suppressed and sends no translate request when glossDisplay is off', async () => {
    renderList({ tokenize: { langCode: 'en', onTokenClick: jest.fn() } });

    await waitFor(() =>
      expect(document.querySelector('.js-Tihoka-token--gloss-off')).not.toBeNull(),
    );
    expect(document.querySelector('[data-gloss]')).toBeNull();
    expect(getWordTranslations).not.toHaveBeenCalled();
  });
});

describe('CueList mobile PM mode', () => {
  it('renders all cues as cards in list mode', () => {
    renderList({ mobile: true, displayMode: 'list', showAllCues: true });
    const items = document.querySelectorAll('[data-tihoka-id="cue-item"]');
    expect(items.length).toBe(3);
    expect(document.querySelector('[data-tihoka-id="cue-list-scroll"]')).not.toBeNull();
  });

  it('active mode renders only the current cue', () => {
    renderList({ mobile: true, displayMode: 'active' });
    const items = document.querySelectorAll('[data-tihoka-id="cue-item"]');
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain('first line');
  });

  it('active mode falls back to the next upcoming cue after the last', () => {
    renderList({ mobile: true, displayMode: 'active', currentTimeMs: 5000 });
    const items = document.querySelectorAll('[data-tihoka-id="cue-item"]');
    expect(items.length).toBeLessThanOrEqual(1);
  });

  it('renders card actions inside the active cue card', () => {
    renderList({
      mobile: true,
      displayMode: 'list',
      showAllCues: true,
      cardActions: <button data-tihoka-id="quick-add-btn" />,
    });
    const actions = document.querySelectorAll('[data-tihoka-id="pm-card-actions"]');
    expect(actions.length).toBe(1);
    expect(actions[0].querySelector('[data-tihoka-id="quick-add-btn"]')).not.toBeNull();
  });

  it('shows the sync pill when the user scrolls away in mobile mode', async () => {
    renderList({ mobile: true, displayMode: 'list', showAllCues: true });
    await waitFor(() => expect(document.querySelector('[data-tihoka-id="cue-list-scroll"]')).not.toBeNull());
    expect(document.querySelector('[data-tihoka-id="cue-list-sync"]')).toBeNull();

    userScrollTo(100);
    await waitFor(() => expect(document.querySelector('[data-tihoka-id="cue-list-sync"]')).not.toBeNull());
  });

  it('list mode mounts the full cue list for scrolling', () => {
    const manyCues: BilingualCue[] = Array.from({ length: 20 }, (_, i) => ({
      index: i + 1,
      start: i * 1000,
      end: i * 1000 + 900,
      targetText: `line ${i + 1}`,
      nativeText: '',
    }));
    render(
      <CueList
        cues={manyCues}
        currentTimeMs={10_500}
        onSeek={jest.fn()}
        mobile
        displayMode="list"
      />,
    );
    const items = document.querySelectorAll('[data-tihoka-id="cue-item"]');
    expect(items.length).toBe(20);
    expect(document.querySelector('[data-cue-index="11"][data-current="true"]')).not.toBeNull();
  });

  it('marks the active card with pm-cue-active-card', () => {
    renderList({ mobile: true, displayMode: 'list' });
    const marker = document.querySelector('[data-tihoka-id="pm-cue-active-card"]');
    expect(marker).not.toBeNull();
    expect(marker!.closest('[data-tihoka-id="cue-item"]')).toHaveAttribute('data-cue-index', '1');
  });
});

describe('CueTokenText i+1 marking', () => {
  function renderMarkedCue(targetText: string, statuses: Record<string, WordStatus> = {}) {
    renderList({
      cues: [{ index: 7, start: 0, end: 1000, targetText, nativeText: '' }],
      tokenize: { langCode: 'en', onTokenClick: jest.fn() },
    });
    act(() => {
      for (const [term, status] of Object.entries(statuses)) {
        emitWordStatusChanged({ langCode: 'en', term, status });
      }
    });
  }

  function wordSpan(term: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(`.js-Tihoka-token--word[data-tihoka-term="${term}"]`);
  }

  async function waitForWordSpans(): Promise<void> {
    await waitFor(() => expect(document.querySelector('.js-Tihoka-token--word')).not.toBeNull());
  }

  it('keeps the capsule only on the single unknown word of a scorable sentence', async () => {
    renderMarkedCue('alpha beta gamma delta', { alpha: 'known', beta: 'known', gamma: 'known' });
    await waitFor(() => {
      const delta = wordSpan('delta');
      expect(delta).not.toBeNull();
      expect(delta!.classList.contains(IPLUS1_OFF_CLASS)).toBe(false);
    });
    for (const term of ['alpha', 'beta', 'gamma']) {
      expect(wordSpan(term)!.classList.contains(IPLUS1_OFF_CLASS)).toBe(true);
    }
  });

  it('dims every word when two are unknown', async () => {
    renderMarkedCue('alpha beta gamma delta', { alpha: 'known', beta: 'known' });
    await waitForWordSpans();
    for (const term of ['alpha', 'beta', 'gamma', 'delta']) {
      expect(wordSpan(term)!.classList.contains(IPLUS1_OFF_CLASS)).toBe(true);
    }
  });

  it('dims every word of an all-known cue', async () => {
    renderMarkedCue('alpha beta gamma delta', {
      alpha: 'known',
      beta: 'known',
      gamma: 'known',
      delta: 'known',
    });
    await waitForWordSpans();
    for (const term of ['alpha', 'beta', 'gamma', 'delta']) {
      expect(wordSpan(term)!.classList.contains(IPLUS1_OFF_CLASS)).toBe(true);
    }
  });

  it('stamps block id and sentence index on word and gap spans', async () => {
    renderMarkedCue('alpha beta gamma delta.');
    await waitForWordSpans();
    const cue = document.querySelector('[data-cue-index="7"]')!;
    const delta = cue.querySelector<HTMLElement>('.js-Tihoka-token--word[data-tihoka-term="delta"]')!;
    expect(delta).toHaveAttribute('data-tihoka-block-id', 'cue-7');
    expect(delta).toHaveAttribute('data-tihoka-sentence', '0');
    const gaps = Array.from(cue.querySelectorAll<HTMLElement>('.js-Tihoka-token--separator'));
    expect(gaps.length).toBeGreaterThan(0);
    for (const gap of gaps) {
      expect(gap).toHaveAttribute('data-tihoka-block-id', 'cue-7');
      expect(gap).toHaveAttribute('data-tihoka-sentence', '0');
    }
  });
});

describe('CueList navigable cue set (SSOT for nav CTAs)', () => {
  it('publishes the rendered cue set and clears it on unmount', async () => {
    const { readNavigableCues } = jest.requireActual<
      typeof import('@/features/subtitle/logic/navigableCues')
    >('@/features/subtitle/logic/navigableCues');
    const { unmount } = renderList();
    await waitFor(() => expect(readNavigableCues()?.map((c) => c.index)).toEqual([1, 2, 3]));
    unmount();
    expect(readNavigableCues()).toBeNull();
  });

  it('publishes only cues matching the active filter', async () => {
    const { readNavigableCues } = jest.requireActual<
      typeof import('@/features/subtitle/logic/navigableCues')
    >('@/features/subtitle/logic/navigableCues');
    renderList({ cueFilter: (index) => index !== 2 });
    await waitFor(() => expect(readNavigableCues()?.map((c) => c.index)).toEqual([1, 3]));
  });
});
