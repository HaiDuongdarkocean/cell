import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { DictionaryPanelView } from './DictionaryPanelView';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { translateSentence } from '@/features/cardCreator/media/translation';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { LookupResult } from '../types';

jest.mock('@/shared/lib/chrome-apis/runtime', () => ({
  sendMessage: jest.fn(),
}));

jest.mock('@/features/cardCreator/media/translation', () => ({
  translateSentence: jest.fn(),
}));

jest.mock('./CandidateView', () => ({
  CandidateView: function CandidateViewMock(props: { index: number; candidate: { term: string } }) {
    return require('react').createElement(
      'article',
      {
        id: `dictionary-candidate-${props.index}`,
        'data-testid': `dictionary-candidate-${props.index}`,
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
    frequency: null,
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

    await waitFor(() => expect(screen.getByTestId('dictionary-error')).toHaveTextContent('lookup failed'));
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
});
