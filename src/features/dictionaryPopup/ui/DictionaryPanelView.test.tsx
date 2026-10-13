import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { DictionaryPanelView } from './DictionaryPanelView';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { translateSentence } from '@/features/cardCreator';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { LookupResult } from '@/entities/dictionary';

jest.mock('@/shared/lib/chrome-apis/runtime', () => ({
  sendMessage: jest.fn(),
}));

jest.mock('@/features/cardCreator', () => ({
  translateSentence: jest.fn(),
}));

jest.mock('./CandidateView', () => ({
  CandidateView: function CandidateViewMock(props: { index: number; candidate: { term: string } }) {
    return require('react').createElement(
      'article',
      {
        'data-tihoka-id': `dictionary-candidate-${props.index}`,
        'data-candidate-term': props.candidate.term,
      },
      props.candidate.term,
    );
  },
}));

const mockSendMessage = jest.mocked(sendMessage);
const mockTranslateSentence = jest.mocked(translateSentence);

function makeResult(term: string, overrides?: Partial<LookupResult>): LookupResult {
  return {
    term,
    langCode: 'en',
    reading: '',
    readingKind: 'none',
    frequencies: [],
    status: 'unknown',
    partsOfSpeech: [],
    definitions: [],
    rawDefinitions: [],
    detectedPhrase: null,
    matchSource: 'dictionary',
    ...overrides,
  };
}

function setupMocks(): void {
  jest.clearAllMocks();
  mockTranslateSentence.mockResolvedValue('');
  mockSendMessage.mockImplementation(async <T = unknown>(msg: unknown): Promise<T> => {
    const message = msg as { type: string; payload?: { request?: { term: string } } };
    if (message.type === MESSAGE_TYPES.LOOKUP_REQUEST) {
      const term = message.payload?.request?.term ?? 'hello';
      return { success: true, data: [makeResult(term, { status: 'known' }), makeResult(`${term}-alt`)] } as T;
    }
    if (message.type === MESSAGE_TYPES.LOOKUP_CANCEL) {
      return { success: true } as T;
    }
    if (message.type === MESSAGE_TYPES.WORD_STATUS_SET || message.type === MESSAGE_TYPES.TTS_SPEAK) {
      return { success: true } as T;
    }
    return { success: true } as T;
  });
}

describe('DictionaryPanelView', () => {
  beforeEach(() => {
    setupMocks();
    (HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders loading and then result with candidates', async () => {
    render(
      <DictionaryPanelView
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        initialTerm="hello"
        isOpen
      />,
    );

    expect(screen.getByTestId('dictionary-panel')).toBeInTheDocument();
    expect(screen.getByTestId('dictionary-search-input')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByTestId('dictionary-candidate-0')).toBeInTheDocument());

    expect(screen.getByTestId('dictionary-candidate-0')).toHaveAttribute('data-candidate-term', 'hello');
    expect(screen.getByTestId('dictionary-candidate-1')).toHaveAttribute('data-candidate-term', 'hello-alt');
    expect(screen.getByTestId('dictionary-candidate-chip-0')).toHaveTextContent('hello');
    expect(screen.getByTestId('dictionary-candidate-chip-1')).toHaveTextContent('hello-alt');

    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MESSAGE_TYPES.LOOKUP_REQUEST,
      payload: expect.objectContaining({
        request: expect.objectContaining({ term: 'hello' }),
      }),
    }));
  });

  it('shows a candidate skeleton with the term in the header while loading', () => {
    // Force loading state without a result — simulates the instant-feedback
    // window between popup mount and the lookup response.
    mockSendMessage.mockImplementation(async () => new Promise(() => {}));

    render(
      <DictionaryPanelView
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        initialTerm="serendipity"
        isLoading
        isOpen
      />,
    );

    const skeleton = screen.getByTestId('dictionary-candidate-skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
    // Header shows the real term immediately — instant feedback.
    expect(screen.getByTestId('dictionary-term')).toHaveTextContent('serendipity');
    // No candidate data yet.
    expect(screen.queryByTestId('dictionary-candidate-0')).not.toBeInTheDocument();
  });

  it('renders an error when lookup fails', async () => {
    mockSendMessage.mockImplementation(async <T = unknown>(): Promise<T> => ({ success: false, error: 'lookup failed' } as T));

    render(
      <DictionaryPanelView
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        initialTerm="hello"
        isOpen
      />,
    );

    await waitFor(() => expect(screen.getByTestId('dictionary-error')).toHaveTextContent("Couldn't look that word up. Try again."));
  });

  it('renders empty state before search', async () => {
    render(
      <DictionaryPanelView
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        isOpen
      />,
    );

    await waitFor(() => expect(screen.getByTestId('dictionary-empty')).toBeInTheDocument());
  });

  it('keeps the search input enabled while a lookup is in flight', () => {
    mockSendMessage.mockImplementation(async () => new Promise(() => {}));

    render(
      <DictionaryPanelView
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        initialTerm="hello"
        isOpen
      />,
    );

    expect(screen.getByTestId('dictionary-search-input')).not.toBeDisabled();
  });

  it('selects the whole term when the search input gains focus', async () => {
    render(
      <DictionaryPanelView
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        initialTerm="hello"
        isOpen
      />,
    );

    const input = screen.getByTestId('dictionary-search-input') as HTMLInputElement;
    fireEvent.focus(input);

    await waitFor(() => {
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(input.value.length);
      expect(input.value).toBe('hello');
    });
  });

  it('submits a new search from the search field', async () => {
    render(
      <DictionaryPanelView
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        initialTerm="hello"
        isOpen
      />,
    );

    await waitFor(() => expect(screen.getByTestId('dictionary-candidate-0')).toBeInTheDocument());

    const input = screen.getByTestId('dictionary-search-input');
    fireEvent.change(input, { target: { value: 'world' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MESSAGE_TYPES.LOOKUP_REQUEST,
      payload: expect.objectContaining({
        request: expect.objectContaining({ term: 'world' }),
      }),
    })));

    await waitFor(() => expect(screen.getByTestId('dictionary-candidate-0')).toHaveAttribute('data-candidate-term', 'world'));
  });

  it('adds searched terms to history and allows re-searching from history', async () => {
    render(
      <DictionaryPanelView
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        initialTerm="hello"
        isOpen
      />,
    );

    const historySection = await waitFor(() => screen.getByTestId('dictionary-search-history'));

    const historyTerm = within(historySection).getByText('hello');
    expect(historyTerm).toHaveTextContent('hello');

    fireEvent.click(historyTerm);

    await waitFor(() => expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MESSAGE_TYPES.LOOKUP_REQUEST,
      payload: expect.objectContaining({
        request: expect.objectContaining({ term: 'hello' }),
      }),
    })));
  });

  it('clears search history', async () => {
    render(
      <DictionaryPanelView
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        initialTerm="hello"
        isOpen
      />,
    );

    await waitFor(() => expect(screen.getByTestId('dictionary-search-history')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('dictionary-search-history-clear'));

    await waitFor(() => expect(screen.queryByTestId('dictionary-search-history')).not.toBeInTheDocument());
  });

  it('clicking a candidate chip highlights it and scrolls the candidate into view', async () => {
    render(
      <DictionaryPanelView
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        initialTerm="hello"
        isOpen
      />,
    );

    await waitFor(() => expect(screen.getByTestId('dictionary-candidate-0')).toBeInTheDocument());

    const chip = screen.getByTestId('dictionary-candidate-chip-1');
    fireEvent.click(chip);

    await waitFor(() => expect(chip).toHaveAttribute('aria-current', 'true'));
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('scrolls the candidate into view when the panel is mounted inside a Shadow DOM (popup variant)', async () => {
    // Reproduces the real popup mount: DictionaryPanelView lives inside a
    // shadow root, so document.getElementById cannot reach candidates.
    // The fix uses containerRef.querySelector which stays inside the shadow tree.
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });

    render(
      <DictionaryPanelView
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        initialTerm="hello"
        isOpen
        variant="popup"
      />,
      { container: shadow as unknown as HTMLElement },
    );

    // Candidate elements live inside the shadow root, NOT in document.
    await waitFor(() => expect(shadow.querySelector('[data-tihoka-id="dictionary-candidate-0"]')).not.toBeNull());
    expect(document.getElementById('dictionary-candidate-0')).toBeNull();

    const chip = shadow.querySelector('[data-tihoka-id="dictionary-candidate-chip-1"]') as HTMLElement;
    expect(chip).not.toBeNull();
    fireEvent.click(chip);

    await waitFor(() => expect(chip).toHaveAttribute('aria-current', 'true'));
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();

    document.body.removeChild(host);
  });

  it('restores each lookup level\'s scroll position on breadcrumb navigation', async () => {
    // The shared popup mount repaints whichever chain level surfaces, so the
    // scroll container is the panel's nearest overflow ancestor. scrollKey
    // mirrors what Dictionary passes: trail + displayed result term.
    const scroller = document.createElement('div');
    scroller.style.overflowY = 'auto';
    document.body.appendChild(scroller);
    const store = { v: 0 };
    Object.defineProperty(scroller, 'scrollTop', {
      get: () => store.v,
      set: (v: number) => { store.v = v; },
    });

    const view = (key: string, term: string) => (
      <DictionaryPanelView
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        initialTerm={term}
        initialResult={makeResult(term)}
        isOpen
        variant="popup"
        scrollKey={key}
      />
    );

    const { rerender } = render(view('lv1:quick', 'quick'), { container: scroller });
    await waitFor(() => expect(screen.getByTestId('dictionary-candidate-0')).toBeInTheDocument());

    scroller.scrollTop = 300;
    fireEvent.scroll(scroller);

    rerender(view('lv2:brown', 'brown'));
    expect(scroller.scrollTop).toBe(0);

    scroller.scrollTop = 120;
    fireEvent.scroll(scroller);

    rerender(view('lv1:quick', 'quick'));
    expect(scroller.scrollTop).toBe(300);

    scroller.remove();
  });

  it('reveals nav chrome on level change and shields it from the restore scroll jump', async () => {
    // Bug: back-navigation lands on a level whose saved scroll is deep, the
    // restore jump reads as scroll-down and collapseOnScroll re-hides the
    // lookup trail right away — the next crumb needs a scroll-up first.
    const host = document.createElement('div');
    host.setAttribute('data-tihoka-id', 'popup-dictionary');
    const scroller = document.createElement('div');
    scroller.style.overflowY = 'auto';
    host.appendChild(scroller);
    document.body.appendChild(host);
    const store = { v: 0 };
    Object.defineProperty(scroller, 'scrollTop', {
      get: () => store.v,
      set: (v: number) => { store.v = v; },
    });

    const view = (key: string, term: string) => (
      <DictionaryPanelView
        langCode="en"
        sourceLang="en"
        targetLang="vi"
        initialTerm={term}
        initialResult={makeResult(term)}
        isOpen
        variant="popup"
        scrollKey={key}
      />
    );

    const { rerender } = render(view('lv1:quick', 'quick'), { container: scroller });
    await waitFor(() => expect(screen.getByTestId('dictionary-candidate-0')).toBeInTheDocument());

    host.setAttribute('data-dict-collapsed', '');
    scroller.scrollTop = 600;
    fireEvent.scroll(scroller);

    rerender(view('lv2:brown', 'brown'));
    expect(host.hasAttribute('data-dict-collapsed')).toBe(false);
    expect(scroller.scrollTop).toBe(0);

    host.setAttribute('data-dict-collapsed', '');
    scroller.scrollTop = 120;
    fireEvent.scroll(scroller);
    host.setAttribute('data-dict-collapsed', '');

    rerender(view('lv1:quick', 'quick'));
    expect(host.hasAttribute('data-dict-collapsed')).toBe(false);
    expect(scroller.scrollTop).toBe(600);

    // The restore lands deep — its async scroll event must not re-hide chrome.
    scroller.scrollTop = 900;
    fireEvent.scroll(scroller);
    expect(host.hasAttribute('data-dict-collapsed')).toBe(false);

    // Past the reveal window, collapse works again.
    jest.spyOn(performance, 'now').mockReturnValue(Number.MAX_SAFE_INTEGER);
    scroller.scrollTop = 1200;
    fireEvent.scroll(scroller);
    expect(host.hasAttribute('data-dict-collapsed')).toBe(true);

    host.remove();
  });

  it('autofocuses the search input on open at desktop width only', async () => {
    const originalMatchMedia = window.matchMedia;
    const mobileMatchMedia = (query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      onchange: null,
      dispatchEvent: jest.fn(),
    });
    try {
      // Mobile (<840px): autofocus would pop the virtual keyboard over the
      // freshly opened panel, so the open-focus timer is skipped.
      Object.defineProperty(window, 'matchMedia', { writable: true, value: mobileMatchMedia });
      const { unmount } = render(
        <DictionaryPanelView langCode="en" sourceLang="en" targetLang="vi" isOpen />,
      );
      await new Promise((r) => setTimeout(r, 400));
      expect(screen.getByTestId('dictionary-search-input')).not.toHaveFocus();
      unmount();

      // Desktop: the 250ms post-animation focus still applies.
      Object.defineProperty(window, 'matchMedia', { writable: true, value: originalMatchMedia });
      render(<DictionaryPanelView langCode="en" sourceLang="en" targetLang="vi" isOpen />);
      await waitFor(() => expect(screen.getByTestId('dictionary-search-input')).toHaveFocus());
    } finally {
      Object.defineProperty(window, 'matchMedia', { writable: true, value: originalMatchMedia });
    }
  });
});
