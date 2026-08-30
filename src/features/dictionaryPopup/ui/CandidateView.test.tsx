import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/react';
import { CandidateView } from './CandidateView';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { translateSentence } from '@/features/cardCreator/media/translation';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { DEFAULT_SETTINGS } from '@/shared/config/config';
import type { LookupResult, AudioItem, ImageItem, PopupCardCreatorPrefill } from '../types';

jest.mock('@/shared/lib/chrome-apis/runtime', () => ({
  sendMessage: jest.fn(),
}));

jest.mock('@/features/cardCreator/media/translation', () => ({
  translateSentence: jest.fn(),
}));

jest.mock('@/shared/lib/storage/settingsStore', () => ({
  loadSettings: jest.fn(),
}));

const mockSendMessage = jest.mocked(sendMessage);
const mockTranslateSentence = jest.mocked(translateSentence);
const mockLoadSettings = jest.mocked(loadSettings);

function makeResult(term: string, overrides?: Partial<LookupResult>): LookupResult {
  return {
    term,
    langCode: 'en',
    reading: '/həˈloʊ/',
    readingKind: 'ipa',
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

function makeAudio(id: string, kind: AudioItem['kind'], url: string, selected = false): AudioItem {
  return {
    id,
    kind,
    source: 'community',
    label: 'Test · US',
    state: 'idle',
    url,
    defaultSelected: selected,
  };
}

function makeImage(id: string, selected = false): ImageItem {
  return {
    id,
    alt: `image ${id}`,
    src: `https://example.com/${id}.jpg`,
    defaultSelected: selected,
  };
}

function setupMocks(): void {
  jest.clearAllMocks();
  mockLoadSettings.mockResolvedValue(DEFAULT_SETTINGS);
  mockSendMessage.mockImplementation(async <T = unknown>(msg: unknown): Promise<T> => {
    const message = msg as { type: string };
    if (message.type === MESSAGE_TYPES.FETCH_LOCAL_AUDIO) {
      return { success: true, data: { items: [] } } as T;
    }
    if (message.type === MESSAGE_TYPES.FETCH_COMMUNITY_AUDIO) {
      return { success: true, data: { items: [makeAudio('a1', 'word', 'https://audio/1', true)] } } as T;
    }
    if (message.type === MESSAGE_TYPES.TTS_FETCH_AUDIO) {
      return { success: true, data: { url: 'https://audio/tts' } } as T;
    }
    if (message.type === MESSAGE_TYPES.FETCH_IMAGES) {
      return { success: true, data: { items: [makeImage('i1'), makeImage('i2')] } } as T;
    }
    if (message.type === MESSAGE_TYPES.TTS_SPEAK || message.type === MESSAGE_TYPES.WORD_STATUS_SET) {
      return { success: true } as T;
    }
    return { success: true } as T;
  });
  mockTranslateSentence.mockResolvedValue('xin chào');
}

describe('CandidateView', () => {
  beforeEach(setupMocks);

  it('renders term, reading, status and definitions', () => {
    const candidate = makeResult('hello', {
      status: 'known',
      definitions: [
        { id: 'd1', pos: 'n', text: 'greeting', examples: [], source: 'test', defaultSelected: true },
      ],
    });

    render(
      <CandidateView
        candidate={candidate}
        index={0}
        contextSentence="hello world"
        sourceLang="en"
        targetLang="vi"
      />,
    );

    expect(screen.getByTestId('dictionary-term')).toHaveTextContent('hello');
    expect(screen.getByTestId('dictionary-reading')).toHaveTextContent('/həˈloʊ/');
    expect(screen.getByTestId('dictionary-status-cycle')).toHaveTextContent('known');
    expect(screen.getByTestId('dictionary-definitions')).toBeInTheDocument();
    expect(screen.getAllByTestId('dictionary-definition')).toHaveLength(1);
  });

  it('cycles status and sends WORD_STATUS_SET', async () => {
    const candidate = makeResult('hello');

    render(
      <CandidateView
        candidate={candidate}
        index={0}
        contextSentence=""
        sourceLang="en"
        targetLang="vi"
      />,
    );

    fireEvent.click(screen.getByTestId('dictionary-status-cycle'));

    await waitFor(() => expect(screen.getByTestId('dictionary-status-cycle')).toHaveTextContent('tracking'));

    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MESSAGE_TYPES.WORD_STATUS_SET,
      payload: expect.objectContaining({ term: 'hello', langCode: 'en', status: 'tracking' }),
    }));
  });

  it('fetches and renders audio panel when audio tab is opened', async () => {
    const candidate = makeResult('hello');

    render(
      <CandidateView
        candidate={candidate}
        index={0}
        contextSentence=""
        sourceLang="en"
        targetLang="vi"
      />,
    );

    fireEvent.click(screen.getByTestId('dictionary-tab-audio'));

    const audioPanel = await screen.findByTestId('dictionary-audio-panel');
    expect(audioPanel).toBeInTheDocument();

    await waitFor(() => expect(within(audioPanel).getByText('Test')).toBeInTheDocument());

    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MESSAGE_TYPES.FETCH_COMMUNITY_AUDIO,
    }));
    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MESSAGE_TYPES.TTS_FETCH_AUDIO,
    }));
  });

  it('toggles audio selection and updates the count badge', async () => {
    const candidate = makeResult('hello');

    render(
      <CandidateView
        candidate={candidate}
        index={0}
        contextSentence=""
        sourceLang="en"
        targetLang="vi"
      />,
    );

    fireEvent.click(screen.getByTestId('dictionary-tab-audio'));
    const audioPanel = await screen.findByTestId('dictionary-audio-panel');
    await waitFor(() => expect(within(audioPanel).getByText('Test')).toBeInTheDocument());

    expect(screen.getByTestId('dictionary-tab-audio')).toHaveTextContent('1');

    const label = within(audioPanel).getByText('Test');
    fireEvent.click(label);

    await waitFor(() => expect(screen.getByTestId('dictionary-tab-audio')).not.toHaveTextContent('1'));
  });

  it('fetches and renders image panel when image tab is opened', async () => {
    const candidate = makeResult('hello');

    render(
      <CandidateView
        candidate={candidate}
        index={0}
        contextSentence=""
        sourceLang="en"
        targetLang="vi"
      />,
    );

    fireEvent.click(screen.getByTestId('dictionary-tab-image'));

    const imagePanel = await screen.findByTestId('dictionary-image-panel');
    expect(imagePanel).toBeInTheDocument();

    await waitFor(() => expect(within(imagePanel).getByAltText('image i1')).toBeInTheDocument());

    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MESSAGE_TYPES.FETCH_IMAGES,
    }));
  });

  it('toggles image selection and updates the count badge', async () => {
    const candidate = makeResult('hello');

    render(
      <CandidateView
        candidate={candidate}
        index={0}
        contextSentence=""
        sourceLang="en"
        targetLang="vi"
      />,
    );

    fireEvent.click(screen.getByTestId('dictionary-tab-image'));
    const imagePanel = await screen.findByTestId('dictionary-image-panel');
    await waitFor(() => expect(within(imagePanel).getByAltText('image i1')).toBeInTheDocument());

    const img = within(imagePanel).getByAltText('image i1');
    fireEvent.click(img.closest('button')!);

    await waitFor(() => expect(screen.getByTestId('dictionary-tab-image')).toHaveTextContent('1'));
  });

  it('translates and renders the translate panel', async () => {
    const candidate = makeResult('hello');

    render(
      <CandidateView
        candidate={candidate}
        index={0}
        contextSentence="hello world"
        sourceLang="en"
        targetLang="vi"
      />,
    );

    fireEvent.click(screen.getByTestId('dictionary-tab-translate'));
    const translatePanel = await screen.findByTestId('dictionary-translate-panel');
    expect(translatePanel).toBeInTheDocument();

    // Auto-translate fires on mount — no manual button click needed
    await waitFor(() => expect(within(translatePanel).getByText('xin chào')).toBeInTheDocument());
    expect(mockTranslateSentence).toHaveBeenCalledWith('hello world', 'en', 'vi');

    fireEvent.click(within(translatePanel).getByText('xin chào'));

    await waitFor(() => expect(screen.getByTestId('dictionary-tab-translate')).toHaveTextContent('1'));
  });

  it('renders the links panel when the links tab is opened', async () => {
    const candidate = makeResult('hello');

    render(
      <CandidateView
        candidate={candidate}
        index={0}
        contextSentence=""
        sourceLang="en"
        targetLang="vi"
      />,
    );

    fireEvent.click(screen.getByTestId('dictionary-tab-links'));

    const linksPanel = await screen.findByTestId('dictionary-links-panel');
    expect(linksPanel).toBeInTheDocument();
    expect(screen.getByTestId('dictionary-link-cambridge')).toHaveAttribute('href', expect.stringContaining('hello'));
    expect(screen.getByTestId('dictionary-link-wiktionary')).toHaveAttribute('href', expect.stringContaining('hello'));
    expect(screen.getByTestId('dictionary-link-gtranslate')).toHaveAttribute('href', expect.stringContaining('hello'));
    // Links tab does not show a badge
    expect(screen.getByTestId('dictionary-tab-links')).not.toHaveTextContent('3');
  });

  it('toggles definitions and updates selected count', () => {
    const candidate = makeResult('hello', {
      definitions: [
        { id: 'd1', pos: 'n', text: 'greeting', examples: [], source: 'test', defaultSelected: true },
        { id: 'd2', pos: 'v', text: 'to greet', examples: [], source: 'test', defaultSelected: false },
      ],
    });

    render(
      <CandidateView
        candidate={candidate}
        index={0}
        contextSentence=""
        sourceLang="en"
        targetLang="vi"
      />,
    );

    const definitions = screen.getAllByTestId('dictionary-definition');
    fireEvent.click(definitions[0]);
    fireEvent.click(definitions[1]);

    // d1 unselected, d2 selected
    expect(mockSendMessage).not.toHaveBeenCalledWith(expect.objectContaining({
      type: MESSAGE_TYPES.WORD_STATUS_SET,
    }));
  });

  it('sendToCard fetches audio, image and translation and calls onSendToCard', async () => {
    const candidate = makeResult('hello', {
      definitions: [
        { id: 'd1', pos: 'n', text: 'greeting', examples: [], source: 'test', defaultSelected: true },
      ],
    });
    const onSendToCard = jest.fn<(prefill: PopupCardCreatorPrefill) => void>();

    render(
      <CandidateView
        candidate={candidate}
        index={0}
        contextSentence="hello world"
        sourceLang="en"
        targetLang="vi"
        onSendToCard={onSendToCard}
      />,
    );

    await act(async () => { fireEvent.click(screen.getByTestId('dictionary-send-to-card')); });

    await waitFor(() => expect(onSendToCard).toHaveBeenCalled());

    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MESSAGE_TYPES.FETCH_COMMUNITY_AUDIO,
    }));
    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MESSAGE_TYPES.FETCH_IMAGES,
    }));
    expect(mockTranslateSentence).toHaveBeenCalledWith('hello world', 'en', 'vi');

    expect(onSendToCard).toHaveBeenCalledWith(expect.objectContaining({
      term: 'hello',
      contextSentence: 'hello world',
      translation: 'xin chào',
      wordAudioUrls: ['https://audio/1'],
      sentenceAudioUrls: ['https://audio/tts'],
      imageUrls: ['https://example.com/i1.jpg'],
    }));
  });

  it('quickAdd calls onQuickAdd with selected definitions', async () => {
    const candidate = makeResult('hello', {
      definitions: [
        { id: 'd1', pos: 'n', text: 'greeting', examples: [], source: 'test', defaultSelected: true },
      ],
    });
    const onQuickAdd = jest.fn<(prefill: PopupCardCreatorPrefill) => void>();

    render(
      <CandidateView
        candidate={candidate}
        index={0}
        contextSentence="hello world"
        sourceLang="en"
        targetLang="vi"
        onQuickAdd={onQuickAdd}
      />,
    );

    await act(async () => { fireEvent.click(screen.getByTestId('dictionary-quick-add')); });

    await waitFor(() => expect(onQuickAdd).toHaveBeenCalled());

    expect(onQuickAdd).toHaveBeenCalledWith(expect.objectContaining({
      term: 'hello',
      definitions: [{ pos: 'n', text: 'greeting' }],
      contextSentence: 'hello world',
    }));
  });
});
