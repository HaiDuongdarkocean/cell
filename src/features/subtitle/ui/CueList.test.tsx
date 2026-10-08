import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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
        document.querySelector('[data-cell-id="cue-item"][data-current="true"]'),
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
    return document.querySelector<HTMLElement>('.js-cell-token[data-cell-term="first"]');
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
    await waitFor(() => expect(token.className).toContain('js-cell-token--selected'));
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

  it('renders data-gloss under tokens and drops the gloss-off lane when showGlosses is on', async () => {
    renderList({
      tokenize: {
        langCode: 'en',
        onTokenClick: jest.fn(),
        showGlosses: true,
        glossTargetLanguage: 'vi',
      },
    });

    await waitFor(() => {
      const word = document.querySelector<HTMLElement>(
        '.js-cell-token[data-cell-term="first"] .js-cell-token-word',
      );
      expect(word).toHaveAttribute('data-gloss', 'đầu tiên');
    });
    expect(document.querySelector('.js-cell-token--gloss-off')).toBeNull();
  });

  it('keeps the gloss lane suppressed and sends no translate request when showGlosses is off', async () => {
    renderList({ tokenize: { langCode: 'en', onTokenClick: jest.fn() } });

    await waitFor(() =>
      expect(document.querySelector('.js-cell-token--gloss-off')).not.toBeNull(),
    );
    expect(document.querySelector('[data-gloss]')).toBeNull();
    expect(getWordTranslations).not.toHaveBeenCalled();
  });
});

describe('CueList mobile PM mode', () => {
  it('renders all cues as cards in list mode', () => {
    renderList({ mobile: true, displayMode: 'list', showAllCues: true });
    const items = document.querySelectorAll('[data-cell-id="cue-item"]');
    expect(items.length).toBe(3);
    expect(document.querySelector('[data-cell-id="cue-list-scroll"]')).not.toBeNull();
  });

  it('active mode renders only the current cue', () => {
    renderList({ mobile: true, displayMode: 'active' });
    const items = document.querySelectorAll('[data-cell-id="cue-item"]');
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain('first line');
  });

  it('active mode falls back to the next upcoming cue after the last', () => {
    renderList({ mobile: true, displayMode: 'active', currentTimeMs: 5000 });
    const items = document.querySelectorAll('[data-cell-id="cue-item"]');
    expect(items.length).toBeLessThanOrEqual(1);
  });

  it('renders card actions inside the active cue card', () => {
    renderList({
      mobile: true,
      displayMode: 'list',
      showAllCues: true,
      cardActions: <button data-cell-id="quick-add-btn" />,
    });
    const actions = document.querySelectorAll('[data-cell-id="pm-card-actions"]');
    expect(actions.length).toBe(1);
    expect(actions[0].querySelector('[data-cell-id="quick-add-btn"]')).not.toBeNull();
  });

  it('shows the sync pill when the user scrolls away in mobile mode', async () => {
    renderList({ mobile: true, displayMode: 'list', showAllCues: true });
    await waitFor(() => expect(document.querySelector('[data-cell-id="cue-list-scroll"]')).not.toBeNull());
    expect(document.querySelector('[data-cell-id="cue-list-sync"]')).toBeNull();

    userScrollTo(100);
    await waitFor(() => expect(document.querySelector('[data-cell-id="cue-list-sync"]')).not.toBeNull());
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
    const items = document.querySelectorAll('[data-cell-id="cue-item"]');
    expect(items.length).toBe(20);
    expect(document.querySelector('[data-cue-index="11"][data-current="true"]')).not.toBeNull();
  });

  it('marks the active card with pm-cue-active-card', () => {
    renderList({ mobile: true, displayMode: 'list' });
    const marker = document.querySelector('[data-cell-id="pm-cue-active-card"]');
    expect(marker).not.toBeNull();
    expect(marker!.closest('[data-cell-id="cue-item"]')).toHaveAttribute('data-cue-index', '1');
  });
});
