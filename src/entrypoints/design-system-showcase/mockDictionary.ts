import type { AudioItem, ImageItem, LookupResult, DefinitionEntry } from '@/features/dictionaryPopup/types';
import type { MessageResponse } from '@/entities/message';
import type { ResourceInfo, ImportResult } from '@/entities/dictionary';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { SHOWCASE_DATA, type DataVariant } from './showcaseParams';
import { getMockResourcesForLang } from './mockResources';

/** A minimal silent 1-second WAV data URL for audio playback demos. */
const SILENT_WAV_URL = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

const OVERFLOW_LONG = `${'A'.repeat(120)}🎌${'あ'.repeat(60)}${'中'.repeat(50)}`;
const OVERFLOW_MIXED = '日本語🎌😀TiếngViệtEnglish한국어中文';

/** Generate a simple placeholder SVG as a data URL for image demos. */
function makePlaceholderImageDataUrl(text: string): string {
  const safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="100%" height="100%" fill="#e2e8f0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#64748b" font-family="sans-serif" font-size="24">${safeText}</text></svg>`;
  const base64 = typeof btoa !== 'undefined' ? btoa(svg) : Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

function buildFullLookupResult(term: string): LookupResult {
  return {
    term,
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
}

function buildOverflowDefinitions(): DefinitionEntry[] {
  const definitions: DefinitionEntry[] = [];
  for (let i = 0; i < 20; i += 1) {
    let text: string;
    let examples: string[];
    if (i === 0) {
      text = OVERFLOW_LONG;
      examples = [OVERFLOW_LONG, '', 'X', OVERFLOW_MIXED];
    } else if (i === 1) {
      text = '';
      examples = [OVERFLOW_MIXED];
    } else if (i === 2) {
      text = 'a';
      examples = [];
    } else if (i === 3) {
      text = OVERFLOW_MIXED;
      examples = [OVERFLOW_LONG, 'single'];
    } else if (i % 5 === 0) {
      text = `${'word'.repeat(60)}`;
      examples = [`${'example'.repeat(40)}`, ''];
    } else {
      text = `Overflow definition ${i + 1}: an extended sense used to stress-test dictionary rendering with moderately long content.`;
      examples = [`Example sentence ${i + 1} for overflow definition testing.`];
    }
    definitions.push({
      id: `overflow-def-${i + 1}`,
      pos: i % 2 === 0 ? 'noun' : 'verb',
      text,
      examples,
      source: i % 3 === 0 ? 'cambridge' : 'wiktionary',
      defaultSelected: i === 0,
    });
  }
  return definitions;
}

function buildOverflowLookupResult(_term: string): LookupResult {
  const definitions = buildOverflowDefinitions();
  return {
    term: OVERFLOW_LONG,
    langCode: 'en',
    reading: `/${'ə'.repeat(80)}/`,
    readingKind: 'ipa',
    frequency: { rank: 999_999, source: 'wordfreq' },
    status: 'unknown',
    partsOfSpeech: ['noun', 'verb', 'adjective', 'adverb', 'interjection', 'conjunction', 'preposition'],
    definitions,
    rawDefinitions: definitions.map((d) => d.text),
    detectedPhrase: null,
    matchSource: 'dictionary',
  };
}

function buildEmptyLookupResult(term: string): LookupResult {
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
  };
}

export function getMockLookupResult(variant: DataVariant = SHOWCASE_DATA, term = 'serendipity'): LookupResult {
  if (variant === 'empty') return buildEmptyLookupResult(term);
  if (variant === 'overflow') return buildOverflowLookupResult(term);
  return buildFullLookupResult(term);
}

function buildFullAudioItems(): AudioItem[] {
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

function buildOverflowAudioItems(): AudioItem[] {
  const items: AudioItem[] = [];
  for (let i = 0; i < 30; i += 1) {
    let label: string;
    if (i === 0) {
      label = OVERFLOW_LONG;
    } else if (i === 1) {
      label = '';
    } else if (i === 2) {
      label = 'U';
    } else if (i === 3) {
      label = OVERFLOW_MIXED;
    } else if (i % 5 === 0) {
      label = `${'audio'.repeat(40)}`;
    } else {
      label = `Forvo · ${i % 2 === 0 ? 'US' : 'UK'} ${i + 1}`;
    }
    items.push({
      id: `mock-audio-${i + 1}`,
      kind: 'word',
      source: 'community',
      label,
      state: 'idle',
      url: SILENT_WAV_URL,
      defaultSelected: i === 0,
    });
  }
  return items;
}

export function getMockAudioItems(variant: DataVariant = SHOWCASE_DATA): AudioItem[] {
  if (variant === 'empty') return [];
  if (variant === 'overflow') return buildOverflowAudioItems();
  return buildFullAudioItems();
}

function buildFullImageItems(): ImageItem[] {
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

function buildOverflowImageItems(): ImageItem[] {
  const items: ImageItem[] = [];
  for (let i = 0; i < 30; i += 1) {
    let alt: string;
    if (i === 0) {
      alt = OVERFLOW_LONG;
    } else if (i === 1) {
      alt = '';
    } else if (i === 2) {
      alt = 'I';
    } else if (i === 3) {
      alt = OVERFLOW_MIXED;
    } else if (i % 5 === 0) {
      alt = `${'image'.repeat(40)}`;
    } else {
      alt = `Serendipity illustration ${i + 1}`;
    }
    items.push({
      id: `mock-image-${i + 1}`,
      alt,
      src: makePlaceholderImageDataUrl(`Image ${i + 1}`),
      defaultSelected: i === 0,
    });
  }
  return items;
}

export function getMockImageItems(variant: DataVariant = SHOWCASE_DATA): ImageItem[] {
  if (variant === 'empty') return [];
  if (variant === 'overflow') return buildOverflowImageItems();
  return buildFullImageItems();
}

function getMockTranslation(variant: DataVariant = SHOWCASE_DATA): string[] {
  if (variant === 'empty') return [''];
  if (variant === 'overflow') return [`${'sự tình cờ may mắn'.repeat(20)}日本語🎌😀`, ''];
  return ['sự tình cờ may mắn'];
}

function buildLookupResult(term: string): LookupResult {
  return getMockLookupResult(SHOWCASE_DATA, term);
}

function mockResourceList(langCode: string): ResourceInfo[] {
  return getMockResourcesForLang(langCode);
}

function handleResourceImport(payload: Record<string, unknown>): ImportResult {
  const resourceType = payload.resourceType as 'DICTIONARY' | 'FREQUENCY';
  return {
    resourceId: 999,
    wordCount: 0,
    format: resourceType === 'DICTIONARY' ? 'json-array' : 'txt',
    skippedAsDuplicate: false,
  };
}

async function mockSendMessage(message: unknown): Promise<unknown> {
  const m = message as { type?: string; payload?: Record<string, unknown> };

  switch (m.type) {
    case MESSAGE_TYPES.LOOKUP_REQUEST: {
      const request = (m.payload?.request ?? { term: 'serendipity' }) as { term: string };
      const result: MessageResponse<LookupResult[]> = { success: true, data: [buildLookupResult(request.term)] };
      return result;
    }

    case MESSAGE_TYPES.FETCH_COMMUNITY_AUDIO: {
      const result: MessageResponse<{ items: AudioItem[] }> = { success: true, data: { items: getMockAudioItems() } };
      return result;
    }

    case MESSAGE_TYPES.FETCH_LOCAL_AUDIO: {
      const result: MessageResponse<{ items: AudioItem[] }> = { success: true, data: { items: [] } };
      return result;
    }

    case MESSAGE_TYPES.TTS_FETCH_AUDIO: {
      const result: MessageResponse<{ url: string }> = { success: true, data: { url: SILENT_WAV_URL } };
      return result;
    }

    case MESSAGE_TYPES.PRONUNCIATION_ESPEAK_TTS: {
      return { success: true };
    }

    case MESSAGE_TYPES.FETCH_IMAGES: {
      const result: MessageResponse<{ items: ImageItem[] }> = { success: true, data: { items: getMockImageItems() } };
      return result;
    }

    case MESSAGE_TYPES.TRANSLATE: {
      const result: MessageResponse<{ translated: string[] }> = { success: true, data: { translated: getMockTranslation() } };
      return result;
    }

    case MESSAGE_TYPES.WORD_STATUS_SET:
    case MESSAGE_TYPES.TTS_SPEAK:
    case MESSAGE_TYPES.LOOKUP_CANCEL:
      return { success: true };

    case MESSAGE_TYPES.WORD_STATUSES_GET: {
      const result: MessageResponse<{ statuses: Record<string, 'unknown' | 'known' | 'tracking' | 'ignore'> }> = {
        success: true,
        data: { statuses: {} },
      };
      return result;
    }

    case MESSAGE_TYPES.FREQUENCY_GET: {
      const result: MessageResponse<{ rank: number; source: string }> = {
        success: true,
        data: { rank: 1234, source: 'wordfreq' },
      };
      return result;
    }

    case MESSAGE_TYPES.RESOURCE_LIST: {
      const langCode = (m.payload?.langCode as string) ?? 'en';
      const result: MessageResponse<{ resources: ResourceInfo[] }> = {
        success: true,
        data: { resources: mockResourceList(langCode) },
      };
      return result;
    }

    case MESSAGE_TYPES.RESOURCE_DELETE:
    case MESSAGE_TYPES.RESOURCE_REORDER:
    case MESSAGE_TYPES.RESOURCE_SET_ENABLED:
    case MESSAGE_TYPES.RESOURCE_SET_PROFILES:
      return { success: true };

    case MESSAGE_TYPES.RESOURCE_SAMPLE: {
      const result: MessageResponse<{ entries: unknown[] }> = { success: true, data: { entries: [] } };
      return result;
    }

    case MESSAGE_TYPES.RESOURCE_FIND: {
      const result: MessageResponse<{ entry: unknown | null }> = { success: true, data: { entry: null } };
      return result;
    }

    case MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK: {
      const result: MessageResponse<ImportResult> = {
        success: true,
        data: handleResourceImport(m.payload ?? {}),
      };
      return result;
    }

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

let installed = false;

/**
 * Install a global `sendMessage` override for the design-system showcase.
 * This lets `PopupDictionary` and `ResourcesPanel` render with mock data and
 * functional media tabs without a real background service worker.
 */
export function installMockDictionarySendMessage(): void {
  if (installed) return;
  installed = true;

  (globalThis as unknown as { __cellSendMessage?: (message: unknown) => Promise<unknown> }).__cellSendMessage =
    mockSendMessage;
}

/**
 * Backwards-compatible alias for the global showcase sendMessage override.
 */
export const installMockSendMessage = installMockDictionarySendMessage;

/** Current lookup result snapshot for providers that need a synchronous value. */
export const MOCK_LOOKUP_RESULT: LookupResult = getMockLookupResult();
