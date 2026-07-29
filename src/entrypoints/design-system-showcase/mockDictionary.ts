import type { AudioItem, ImageItem, LookupResult } from '@/features/dictionaryPopup/types';
import type { MessageResponse } from '@/entities/message';
import { MESSAGE_TYPES } from '@/shared/config/messages';

/** A minimal silent 1-second WAV data URL for audio playback demos. */
const SILENT_WAV_URL = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

/** Generate a simple placeholder SVG as a data URL for image demos. */
function makePlaceholderImageDataUrl(text: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="100%" height="100%" fill="#e2e8f0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#64748b" font-family="sans-serif" font-size="24">${text}</text></svg>`;
  const base64 = typeof btoa !== 'undefined' ? btoa(svg) : Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

export const MOCK_LOOKUP_RESULT: LookupResult = {
  term: 'serendipity',
  langCode: 'en',
  reading: '/ˌser.ənˈdɪp.ə.ti/',
  readingKind: 'ipa',
  frequency: { rank: 1234, source: 'wordfreq' },
  status: 'unknown',
  partsOfSpeech: ['noun'],
  definitions: [
    {
      id: '1',
      pos: 'noun',
      text: 'the occurrence of events by chance in a happy or beneficial way',
      examples: ['We found the restaurant by pure serendipity.'],
      source: 'cambridge',
      defaultSelected: true,
    },
    {
      id: '2',
      pos: 'noun',
      text: 'a fortunate accident',
      examples: [],
      source: 'wiktionary',
      defaultSelected: false,
    },
  ],
  rawDefinitions: [
    'the occurrence of events by chance in a happy or beneficial way',
    'a fortunate accident',
  ],
  detectedPhrase: null,
  matchSource: 'dictionary',
};

function mockAudioItems(): AudioItem[] {
  return [
    {
      id: 'mock-audio-1',
      kind: 'word',
      source: 'community',
      label: 'Forvo · US',
      state: 'idle',
      url: SILENT_WAV_URL,
      defaultSelected: true,
    },
    {
      id: 'mock-audio-2',
      kind: 'word',
      source: 'community',
      label: 'Forvo · UK',
      state: 'idle',
      url: SILENT_WAV_URL,
      defaultSelected: false,
    },
  ];
}

function mockImageItems(): ImageItem[] {
  return [
    {
      id: 'mock-image-1',
      alt: 'Serendipity illustration 1',
      src: makePlaceholderImageDataUrl('Image 1'),
      defaultSelected: true,
    },
    {
      id: 'mock-image-2',
      alt: 'Serendipity illustration 2',
      src: makePlaceholderImageDataUrl('Image 2'),
      defaultSelected: false,
    },
  ];
}

function makeLookupResult(term: string): LookupResult {
  return { ...MOCK_LOOKUP_RESULT, term };
}

async function mockSendMessage(message: unknown): Promise<unknown> {
  const m = message as { type?: string; payload?: Record<string, unknown> };

  switch (m.type) {
    case MESSAGE_TYPES.LOOKUP_REQUEST: {
      const request = (m.payload?.request ?? { term: 'serendipity' }) as { term: string };
      const result: MessageResponse<LookupResult[]> = { success: true, data: [makeLookupResult(request.term)] };
      return result;
    }

    case MESSAGE_TYPES.FETCH_COMMUNITY_AUDIO: {
      const result: MessageResponse<{ items: AudioItem[] }> = { success: true, data: { items: mockAudioItems() } };
      return result;
    }

    case MESSAGE_TYPES.TTS_FETCH_AUDIO: {
      const result: MessageResponse<{ url: string }> = { success: true, data: { url: SILENT_WAV_URL } };
      return result;
    }

    case MESSAGE_TYPES.FETCH_IMAGES: {
      const result: MessageResponse<{ items: ImageItem[] }> = { success: true, data: { items: mockImageItems() } };
      return result;
    }

    case MESSAGE_TYPES.TRANSLATE: {
      const result: MessageResponse<{ translated: string[] }> = { success: true, data: { translated: ['sự tình cờ may mắn'] } };
      return result;
    }

    case MESSAGE_TYPES.WORD_STATUS_SET:
    case MESSAGE_TYPES.TTS_SPEAK:
    case MESSAGE_TYPES.LOOKUP_CANCEL:
      return { success: true };

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

let installed = false;

/**
 * Install a global `sendMessage` override for the design-system showcase.
 * This lets `PopupDictionary` render with mock data and functional media tabs
 * without a real background service worker.
 */
export function installMockDictionarySendMessage(): void {
  if (installed) return;
  installed = true;

  (globalThis as unknown as { __cellSendMessage?: (message: unknown) => Promise<unknown> }).__cellSendMessage =
    mockSendMessage;
}
