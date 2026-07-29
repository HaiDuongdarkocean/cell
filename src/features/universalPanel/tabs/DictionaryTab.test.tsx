import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { LookupResult } from '@/features/dictionaryPopup/types';
import type { PopupCardCreatorPrefill } from '@/features/dictionaryPopup/ui/popupDictionaryController';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { translateSentence } from '@/features/cardCreator/media/translation';
import { DictionaryTab } from './DictionaryTab';

jest.mock('@/shared/lib/chrome-apis/runtime', () => ({
  sendMessage: jest.fn(),
}));

jest.mock('@/features/cardCreator/media/translation', () => ({
  translateSentence: jest.fn(),
}));

jest.mock('./CardCreatorPanel', () => ({
  CardCreatorPanel: (props: { sourceLang: string; targetLang: string; context?: { term?: string } | null }) => (
    <div data-testid="card-creator-panel" data-source-lang={props.sourceLang} data-target-lang={props.targetLang}>
      {props.context?.term ? (
        <div data-testid="card-creator-prefill">{props.context.term}</div>
      ) : (
        <div>No card selected</div>
      )}
    </div>
  ),
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
    definitions: [{ id: '1', pos: 'n.', text: `definition of ${term}`, examples: [], source: 'cambridge', defaultSelected: true }],
    rawDefinitions: [`raw ${term}`],
    detectedPhrase: null,
    matchSource: 'dictionary',
    ...overrides,
  };
}

describe('DictionaryTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMessage.mockResolvedValue({ success: true, data: [] });
    mockTranslateSentence.mockResolvedValue('');
  });

  it('renders the left dictionary pane and right card-creator panel', async () => {
    render(<DictionaryTab langCode="en" sourceLang="en" targetLang="vi" />);

    expect(screen.getByTestId('dictionary-tab')).toBeInTheDocument();
    expect(screen.getByTestId('dictionary-panel')).toBeInTheDocument();
    expect(screen.getByTestId('card-creator-panel')).toBeInTheDocument();
    expect(screen.getByText('No card selected')).toBeInTheDocument();
  });

  it('passes source/target languages to the right pane', async () => {
    render(<DictionaryTab langCode="en" sourceLang="en" targetLang="vi" />);

    const panel = screen.getByTestId('card-creator-panel');
    expect(panel).toHaveAttribute('data-source-lang', 'en');
    expect(panel).toHaveAttribute('data-target-lang', 'vi');
  });

  it('renders the external card-creator context in the right pane', async () => {
    const context: PopupCardCreatorPrefill = {
      term: 'external',
      langCode: 'en',
      reading: '',
      definitions: [{ pos: 'v.', text: 'to test' }],
      rawDefinitions: ['to test'],
      contextSentence: 'external test sentence',
      wordAudioUrls: [],
      sentenceAudioUrls: [],
      imageUrls: [],
    };

    render(<DictionaryTab langCode="en" sourceLang="en" targetLang="vi" prefill={context} />);

    await waitFor(() => expect(screen.getByTestId('card-creator-prefill')).toHaveTextContent('external'));
  });

  it('performs an initial search and renders the result', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [makeResult('hello')] });

    render(<DictionaryTab langCode="en" sourceLang="en" targetLang="vi" initialTerm="hello" />);

    await waitFor(() => expect(screen.getByTestId('dictionary-term')).toHaveTextContent('hello'));
    expect(screen.getByTestId('dictionary-definitions')).toBeInTheDocument();
    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MESSAGE_TYPES.LOOKUP_REQUEST,
    }));
  });

  it('updates the right pane with context when Send to Card is pressed', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [makeResult('hello')] });

    render(<DictionaryTab langCode="en" sourceLang="en" targetLang="vi" initialTerm="hello" />);

    await waitFor(() => expect(screen.getByTestId('dictionary-term')).toHaveTextContent('hello'));

    fireEvent.click(screen.getByTestId('dictionary-send-to-card'));

    await waitFor(() => expect(screen.getByTestId('card-creator-prefill')).toHaveTextContent('hello'));
  });

  it('updates the right pane with context when Quick Add is pressed', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [makeResult('hello')] });

    render(<DictionaryTab langCode="en" sourceLang="en" targetLang="vi" initialTerm="hello" />);

    await waitFor(() => expect(screen.getByTestId('dictionary-term')).toHaveTextContent('hello'));

    fireEvent.click(screen.getByTestId('dictionary-quick-add'));

    await waitFor(() => expect(screen.getByTestId('card-creator-prefill')).toHaveTextContent('hello'));
  });

  it('cycles status and reflects in the footer badge', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [makeResult('hello')] });
    mockSendMessage.mockResolvedValueOnce({ success: true });

    render(<DictionaryTab langCode="en" sourceLang="en" targetLang="vi" initialTerm="hello" />);

    await waitFor(() => expect(screen.getByTestId('dictionary-term')).toHaveTextContent('hello'));

    fireEvent.click(screen.getByTestId('dictionary-status-cycle'));
    await waitFor(() => expect(screen.getByTestId('dictionary-status-cycle')).toHaveTextContent('tracking'));
  });

  it('opens translate tab and translates the search term', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [makeResult('hello')] });
    mockTranslateSentence.mockResolvedValueOnce('xin chào');

    render(<DictionaryTab langCode="en" sourceLang="en" targetLang="vi" initialTerm="hello" />);

    await waitFor(() => expect(screen.getByTestId('dictionary-term')).toHaveTextContent('hello'));

    fireEvent.click(screen.getByTestId('dictionary-tab-translate'));
    fireEvent.click(screen.getByTestId('dictionary-translate-panel').querySelector('button')!);

    await waitFor(() => expect(screen.getByTestId('dictionary-translate-panel')).toHaveTextContent('xin chào'));
  });
});
