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

  it('renders the left dictionary pane and right card-creator placeholder', async () => {
    render(<DictionaryTab langCode="en" sourceLang="en" targetLang="vi" />);

    expect(screen.getByTestId('dictionary-tab')).toBeInTheDocument();
    expect(screen.getByTestId('dictionary-panel')).toBeInTheDocument();
    expect(screen.getByTestId('card-creator-panel')).toBeInTheDocument();
    expect(screen.getByText('No card selected')).toBeInTheDocument();
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

  it('updates the right CardCreatorPanel when Send to Card is pressed', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [makeResult('hello')] });

    render(<DictionaryTab langCode="en" sourceLang="en" targetLang="vi" initialTerm="hello" />);

    await waitFor(() => expect(screen.getByTestId('dictionary-term')).toHaveTextContent('hello'));

    fireEvent.click(screen.getByTestId('dictionary-send-to-card'));

    await waitFor(() => expect(screen.getByTestId('card-creator-prefill')).toBeInTheDocument());
    expect(screen.getByTestId('card-creator-prefill')).toHaveTextContent('hello');
  });

  it('forwards the right pane confirm to onSendToCard', async () => {
    const onSendToCard = jest.fn();
    mockSendMessage.mockResolvedValueOnce({ success: true, data: [makeResult('hello')] });

    render(<DictionaryTab langCode="en" sourceLang="en" targetLang="vi" initialTerm="hello" onSendToCard={onSendToCard} />);

    await waitFor(() => expect(screen.getByTestId('dictionary-term')).toHaveTextContent('hello'));

    fireEvent.click(screen.getByTestId('dictionary-send-to-card'));
    await waitFor(() => expect(screen.getByTestId('card-creator-confirm')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('card-creator-confirm'));
    expect(onSendToCard).toHaveBeenCalledTimes(1);
    expect((onSendToCard.mock.calls[0][0] as PopupCardCreatorPrefill).term).toBe('hello');
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
